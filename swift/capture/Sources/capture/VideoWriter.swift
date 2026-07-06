import Foundation
import AVFoundation
import CoreMedia
import VideoToolbox

/// Writes video (HEVC Lossless) and audio (AAC) to a .mov file via AVAssetWriter.
class VideoWriter {
    private let url: URL
    private let width: Int
    private let height: Int
    private let fps: Int
    private let captureAudio: Bool
    private let hdr: Bool

    private var assetWriter: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private var audioInput: AVAssetWriterInput?
    private var pixelBufferAdaptor: AVAssetWriterInputPixelBufferAdaptor?

    private var hasStartedSession = false
    private var firstVideoTime: CMTime?
    private let writeQueue = DispatchQueue(label: "ss.videowriter", qos: .userInteractive)
    private var finishContinuation: CheckedContinuation<Void, Never>?

    // Pause support: frames are dropped entirely while paused (not written to the
    // asset writer), and the cumulative paused duration is subtracted from every
    // subsequent frame's presentation time so the output has no frozen/black gap
    // at the point where recording resumes.
    private var isPaused = false
    private var pauseAccumulated = CMTime.zero
    private var pauseStartedAt: CMTime?

    /// Toggle pause state. `at` is the source (unshifted) PTS of the frame that
    /// triggered the transition, used to measure how long the pause lasted.
    func setPaused(_ paused: Bool, at sourceTime: CMTime) {
        writeQueue.sync {
            if paused == isPaused { return }
            if paused {
                pauseStartedAt = sourceTime
            } else if let started = pauseStartedAt {
                let gap = CMTimeSubtract(sourceTime, started)
                if gap.isValid && gap.seconds > 0 {
                    pauseAccumulated = CMTimeAdd(pauseAccumulated, gap)
                }
                pauseStartedAt = nil
            }
            isPaused = paused
        }
    }

    init(url: URL, width: Int, height: Int, fps: Int, captureAudio: Bool, hdr: Bool = false) throws {
        self.url = url
        self.width = width
        self.height = height
        self.fps = fps
        self.captureAudio = captureAudio
        self.hdr = hdr

        // Ensure output directory exists
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
    }

    func start() throws {
        assetWriter = try AVAssetWriter(outputURL: url, fileType: .mov)
        guard let writer = assetWriter else { throw NSError(domain: "VideoWriter", code: 1) }

        // HEVC Lossless video settings
        // VideoToolbox hardware encoder on Apple Silicon — fast and lossless
        // HEVC at highest quality — near-lossless for editing
        // kVTCompressionPropertyKey_Lossless is not available in all SDK versions,
        // so we use Quality = 1.0 which instructs VideoToolbox to use max quality mode
        //
        // Sprint 25 US-190 — HDR capture uses HEVC Main10 (10-bit) instead of the
        // default 8-bit profile, plus BT.2100 PQ color primaries/transfer so the
        // captured file actually carries HDR metadata rather than just wider bit
        // depth with no way for a player to know it's HDR.
        var compressionProps: [String: Any] = [
            AVVideoQualityKey: NSNumber(value: 1.0),
            AVVideoExpectedSourceFrameRateKey: NSNumber(value: fps),
            kVTCompressionPropertyKey_AllowFrameReordering as String: NSNumber(value: false),
            kVTCompressionPropertyKey_RealTime as String: NSNumber(value: true),
        ]
        if hdr {
            compressionProps[AVVideoProfileLevelKey as String] = kVTProfileLevel_HEVC_Main10_AutoLevel as String
        }

        var videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.hevc,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: compressionProps
        ]
        if hdr {
            videoSettings[AVVideoColorPropertiesKey] = [
                AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_2020,
                AVVideoTransferFunctionKey: AVVideoTransferFunction_SMPTE_ST_2084_PQ,
                AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_2020
            ]
        }

        videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        videoInput!.expectsMediaDataInRealTime = true
        videoInput!.mediaTimeScale = CMTimeScale(fps * 100)

        let sourceAttrs: [String: Any] = [
            kCVPixelBufferPixelFormatTypeKey as String: hdr
                ? kCVPixelFormatType_ARGB2101010LEPacked
                : kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: width,
            kCVPixelBufferHeightKey as String: height,
        ]
        pixelBufferAdaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: videoInput!,
            sourcePixelBufferAttributes: sourceAttrs
        )

        if writer.canAdd(videoInput!) {
            writer.add(videoInput!)
        }

        if captureAudio {
            let audioSettings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: 48000,
                AVNumberOfChannelsKey: 2,
                AVEncoderBitRateKey: 256000,
            ]
            audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioSettings)
            audioInput!.expectsMediaDataInRealTime = true
            if writer.canAdd(audioInput!) {
                writer.add(audioInput!)
            }
        }

        writer.startWriting()
    }

    func appendVideo(_ buffer: CMSampleBuffer) {
        guard let writer = assetWriter,
              writer.status == .writing,
              let videoInput = videoInput,
              videoInput.isReadyForMoreMediaData else { return }

        let sourcePts = CMSampleBufferGetPresentationTimeStamp(buffer)

        writeQueue.sync {
            if isPaused { return }
            // Only touch the PTS when a pause actually accumulated time — blind
            // CMTimeSubtract with kCMTimeZero (timescale 1) forces a timescale
            // conversion that AVAssetWriter rejects with OSStatus -16122
            // (invalid media timestamp) on the first append, silently failing
            // the whole writer (no moov atom → unreadable file).
            let pts = pauseAccumulated.value == 0
                ? sourcePts
                : CMTimeSubtract(sourcePts, CMTimeConvertScale(pauseAccumulated, timescale: sourcePts.timescale, method: .default))

            if !hasStartedSession {
                writer.startSession(atSourceTime: pts)
                firstVideoTime = pts
                hasStartedSession = true
            }

            // Extract CVPixelBuffer and write via adaptor for better performance
            if let imageBuffer = CMSampleBufferGetImageBuffer(buffer),
               let adaptor = pixelBufferAdaptor {
                adaptor.append(imageBuffer, withPresentationTime: pts)
            } else {
                videoInput.append(buffer)
            }
        }
    }

    func appendAudio(_ buffer: CMSampleBuffer) {
        guard let writer = assetWriter,
              writer.status == .writing,
              let audioInput = audioInput,
              audioInput.isReadyForMoreMediaData,
              hasStartedSession else { return }

        writeQueue.sync {
            if isPaused { return }
            guard pauseAccumulated.seconds > 0 else {
                audioInput.append(buffer)
                return
            }
            // Shift audio PTS by the same accumulated pause offset as video so
            // both tracks stay in sync after a pause/resume cycle.
            if let shifted = Self.shiftedCopy(of: buffer, by: pauseAccumulated) {
                audioInput.append(shifted)
            } else {
                audioInput.append(buffer)
            }
        }
    }

    /// Returns a copy of `buffer` with every sample's PTS/DTS shifted back by `offset`.
    private static func shiftedCopy(of buffer: CMSampleBuffer, by offset: CMTime) -> CMSampleBuffer? {
        let count = CMSampleBufferGetNumSamples(buffer)
        var timingInfos = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(), count: count)
        var actualCount = 0
        guard CMSampleBufferGetSampleTimingInfoArray(
            buffer, entryCount: count, arrayToFill: &timingInfos, entriesNeededOut: &actualCount
        ) == noErr else { return nil }

        for i in 0..<actualCount {
            timingInfos[i].presentationTimeStamp = CMTimeSubtract(timingInfos[i].presentationTimeStamp, offset)
            if timingInfos[i].decodeTimeStamp.isValid {
                timingInfos[i].decodeTimeStamp = CMTimeSubtract(timingInfos[i].decodeTimeStamp, offset)
            }
        }

        var shifted: CMSampleBuffer?
        let status = CMSampleBufferCreateCopyWithNewTiming(
            allocator: kCFAllocatorDefault,
            sampleBuffer: buffer,
            sampleTimingEntryCount: actualCount,
            sampleTimingArray: &timingInfos,
            sampleBufferOut: &shifted
        )
        return status == noErr ? shifted : nil
    }

    func finish() async {
        guard let writer = assetWriter else { return }

        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            writeQueue.async {
                self.videoInput?.markAsFinished()
                self.audioInput?.markAsFinished()
                writer.finishWriting {
                    // A failed writer "finishes" instantly without writing the moov
                    // atom — surface the real error instead of dying silently.
                    if writer.status == .failed {
                        let ns = writer.error as NSError?
                        let detail = "\(ns?.domain ?? "?") code=\(ns?.code ?? 0) \(ns?.userInfo.description ?? "")"
                        let msg = (writer.error?.localizedDescription ?? "unknown") + " | " + detail
                        print("{\"event\":\"error\",\"code\":\"WRITER_FAILED\",\"message\":\"\(msg.replacingOccurrences(of: "\"", with: "'").replacingOccurrences(of: "\n", with: " "))\"}")
                        fflush(stdout)
                    }
                    continuation.resume()
                }
            }
        }
    }
}
