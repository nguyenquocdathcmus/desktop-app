import Foundation
import AVFoundation
import Vision
import CoreMedia

// face-detector — reads a video file, samples frames every ~0.25s, runs Vision
// face detection, and prints one JSON line per detected face center:
//   {"t":1.25,"cx":0.48,"cy":0.41}
// Coordinates are the face-center normalized to the frame (0-1, top-left origin).
// Consumed by the Electron main process for webcam auto-framing (Sprint 11).

func emitLine(_ t: Double, _ cx: Double, _ cy: Double) {
    print(String(format: "{\"t\":%.3f,\"cx\":%.4f,\"cy\":%.4f}", t, cx, cy))
    fflush(stdout)
}

// --- Parse args ---
var inputPath = ""
var sampleInterval = 0.25
var i = 1
let argv = CommandLine.arguments
while i < argv.count {
    switch argv[i] {
    case "--input":
        i += 1; inputPath = i < argv.count ? argv[i] : ""
    case "--interval":
        i += 1; sampleInterval = i < argv.count ? Double(argv[i]) ?? 0.25 : 0.25
    default: break
    }
    i += 1
}

guard !inputPath.isEmpty, FileManager.default.fileExists(atPath: inputPath) else {
    fputs("Usage: face-detector --input <video> [--interval 0.25]\n", stderr)
    exit(1)
}

let asset = AVAsset(url: URL(fileURLWithPath: inputPath))

let group = DispatchGroup()
group.enter()

Task {
    defer { group.leave() }
    do {
        guard let track = try await asset.loadTracks(withMediaType: .video).first else {
            fputs("No video track\n", stderr)
            return
        }

        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ])
        output.alwaysCopiesSampleData = false
        reader.add(output)
        reader.startReading()

        var nextSampleTime = 0.0
        let request = VNDetectFaceRectanglesRequest()

        while reader.status == .reading {
            guard let buffer = output.copyNextSampleBuffer() else { break }
            let pts = CMSampleBufferGetPresentationTimeStamp(buffer).seconds
            // Only run detection on frames at the requested cadence — Vision is
            // fast but running it at 30/60fps would be pure waste for framing.
            guard pts >= nextSampleTime else { continue }
            nextSampleTime = pts + sampleInterval

            guard let pixelBuffer = CMSampleBufferGetImageBuffer(buffer) else { continue }
            let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, options: [:])
            try? handler.perform([request])

            // Pick the largest face when several are visible.
            if let face = (request.results ?? []).max(by: { $0.boundingBox.width < $1.boundingBox.width }) {
                let box = face.boundingBox // normalized, bottom-left origin
                let cx = box.midX
                let cy = 1.0 - box.midY   // flip to top-left origin
                emitLine(pts, cx, cy)
            }
        }
    } catch {
        fputs("face-detector error: \(error.localizedDescription)\n", stderr)
    }
}

group.wait()
exit(0)
