import Foundation
import ScreenCaptureKit
import AVFoundation
import CoreMedia
import CoreGraphics

// MARK: - CLI argument parsing

struct Args {
    var outputPath: String = ""
    var displayId: UInt32 = 0
    var windowId: UInt32 = 0       // 0 = full display mode
    var fps: Int = 60
    var captureAudio: Bool = true
    var duration: Double = 0       // 0 = until SIGTERM
    var listWindows: Bool = false   // emit window list JSON and exit
    var maxHeight: Int = 0          // 0 = no cap (native/Retina resolution); e.g. 1080 caps to 1080p
    var hideCursor: Bool = false    // capture without the system cursor (synthetic cursor mode)
    var hdr: Bool = false           // Sprint 25 US-190 — 10-bit capture, opt-in only

    static func parse() -> Args {
        var args = Args()
        let argv = CommandLine.arguments
        var i = 1
        while i < argv.count {
            switch argv[i] {
            case "--output":
                i += 1; args.outputPath = i < argv.count ? argv[i] : ""
            case "--display-id":
                i += 1; args.displayId = i < argv.count ? UInt32(argv[i]) ?? 0 : 0
            case "--window-id":
                i += 1; args.windowId = i < argv.count ? UInt32(argv[i]) ?? 0 : 0
            case "--fps":
                i += 1; args.fps = i < argv.count ? Int(argv[i]) ?? 60 : 60
            case "--no-audio":
                args.captureAudio = false
            case "--duration":
                i += 1; args.duration = i < argv.count ? Double(argv[i]) ?? 0 : 0
            case "--list-windows":
                args.listWindows = true
            case "--max-height":
                i += 1; args.maxHeight = i < argv.count ? Int(argv[i]) ?? 0 : 0
            case "--hide-cursor":
                args.hideCursor = true
            case "--hdr":
                args.hdr = true
            default: break
            }
            i += 1
        }
        return args
    }
}

/// Scales width/height down to fit within maxHeight, preserving aspect ratio.
/// Rounds to even numbers, as required by H.264/HEVC encoders. No-op if maxHeight <= 0 or already within bounds.
func capResolution(width: Int, height: Int, maxHeight: Int) -> (Int, Int) {
    guard maxHeight > 0, height > maxHeight else { return (width, height) }
    let scale = Double(maxHeight) / Double(height)
    let newWidth = Int((Double(width) * scale).rounded()) & ~1
    let newHeight = maxHeight & ~1
    return (newWidth, newHeight)
}

// MARK: - JSON status output (read by Electron via stdout)

func emit(_ event: String, _ data: [String: Any] = [:]) {
    var payload: [String: Any] = ["event": event, "t": Date().timeIntervalSince1970 * 1000]
    payload.merge(data) { _, new in new }
    if let json = try? JSONSerialization.data(withJSONObject: payload),
       let str = String(data: json, encoding: .utf8) {
        print(str)
        fflush(stdout)
    }
}

// MARK: - Window listing (--list-windows mode)

@available(macOS 13.0, *)
func listWindowsAndExit() async {
    do {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        var windows: [[String: Any]] = []
        for win in content.windows {
            guard win.frame.width > 100, win.frame.height > 100 else { continue }
            // Layer 0 = regular app windows; skips Wallpaper, Dock, overlays etc.
            guard win.windowLayer == 0 else { continue }
            let appName = win.owningApplication?.applicationName ?? ""
            let bundleId = win.owningApplication?.bundleIdentifier ?? ""
            guard !appName.isEmpty else { continue }
            windows.append([
                "id": win.windowID,
                "title": win.title ?? appName,
                "appName": appName,
                "bundleId": bundleId,
                "width": Int(win.frame.width),
                "height": Int(win.frame.height)
            ])
        }
        emit("windows", ["windows": windows])
    } catch {
        emit("error", ["code": "LIST_FAILED", "message": error.localizedDescription])
    }
    exit(0)
}

// MARK: - Main capture controller

@available(macOS 13.0, *)
class CaptureController: NSObject, SCStreamOutput, SCStreamDelegate {
    private var stream: SCStream?
    private var writer: VideoWriter?
    private let args: Args
    private var startTime: CMTime?
    private var frameCount: Int = 0
    private var lastSampleTime: CMTime = .zero

    init(args: Args) {
        self.args = args
    }

    func startCapture() async throws {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)

        let filter: SCContentFilter
        var pixelWidth: Int
        var pixelHeight: Int

        if args.windowId != 0 {
            // Window-specific capture. Failing to find the requested window must be
            // a LOUD error — silently falling through to full-display capture is
            // exactly the "picked a window but recorded the whole screen" bug.
            guard let win = content.windows.first(where: { $0.windowID == args.windowId }) else {
                emit("error", [
                    "code": "WINDOW_NOT_FOUND",
                    "message": "Selected window no longer exists or its ID didn't match — close this and reselect the window"
                ])
                exit(1)
            }
            // Real bug fixed here: SCContentFilter(display:excludingWindows:[])
            // + SCStreamConfiguration.sourceRect to crop to the window's frame
            // does NOT crop on this OS build — verified directly with an
            // isolated test harness (bypassing this app's code entirely):
            // sourceRect was set correctly (confirmed by logging it) and the
            // config/pixel-buffer dimensions matched the intended crop size,
            // but the actual captured pixels were still the full, uncropped
            // display scaled to fit — exactly "picked a window but recorded
            // the whole screen." SCContentFilter(desktopIndependentWindow:)
            // was already ruled out (crashes with CGS_REQUIRE_INIT on this OS
            // build — see the exit(1) path removed here). The combination
            // that actually works, confirmed by inspecting real captured
            // frames: SCContentFilter(display:including:[win]) — restricts
            // the display filter's content to just that window (still
            // composited at its real on-screen position, not
            // desktop-independent) and ScreenCaptureKit itself then crops the
            // stream to the window's bounds with no separate sourceRect needed.
            guard let display = content.displays.first(where: { d in
                CGRectContainsRect(CGDisplayBounds(d.displayID), win.frame) ||
                CGRectIntersectsRect(CGDisplayBounds(d.displayID), win.frame)
            }) ?? content.displays.first else {
                emit("error", ["code": "NO_DISPLAY", "message": "No display found for window"])
                exit(1)
            }

            filter = SCContentFilter(display: display, including: [win])

            pixelWidth = Int(win.frame.width)
            pixelHeight = Int(win.frame.height)

            // Use Retina scale from display
            let mode = CGDisplayCopyDisplayMode(display.displayID)
            let retinaScale = mode != nil && display.width > 0
                ? Double(mode!.pixelWidth) / Double(display.width)
                : 1.0
            pixelWidth = Int(win.frame.width * retinaScale)
            pixelHeight = Int(win.frame.height * retinaScale)

            let prePixelWidth = pixelWidth
            (pixelWidth, pixelHeight) = capResolution(width: pixelWidth, height: pixelHeight, maxHeight: args.maxHeight)
            // Combined points→final-pixels scale (Retina scale, then any maxHeight
            // downscale) — cursor-tracker reports in points, so Node must multiply
            // by this to land cursor coordinates on the actual video pixel grid.
            let pointsToPixels = prePixelWidth > 0 ? (Double(pixelWidth) / Double(prePixelWidth)) * retinaScale : retinaScale

            emit("display", [
                "id": win.windowID,
                "width": pixelWidth,
                "height": pixelHeight,
                "mode": "window",
                // Global-screen-coordinate origin of the captured region, in POINTS
                // (Sprint 20 US-159) — cursor-tracker's CGEventTap reports absolute
                // point coordinates regardless of capture mode, so the Node side
                // needs this origin (and pointsToPixels below) to clip/rebase cursor
                // events onto the captured frame's actual pixel grid.
                "originX": win.frame.origin.x,
                "originY": win.frame.origin.y,
                "pointsToPixels": pointsToPixels
            ])
        } else {
            // Full display capture
            let display: SCDisplay
            if args.displayId != 0,
               let found = content.displays.first(where: { $0.displayID == args.displayId }) {
                display = found
            } else {
                guard let primary = content.displays.first else {
                    emit("error", ["code": "NO_DISPLAY", "message": "No display found"])
                    exit(1)
                }
                display = primary
            }

            let cgDisplayMode = CGDisplayCopyDisplayMode(display.displayID)
            pixelWidth = cgDisplayMode?.pixelWidth ?? display.width
            if let mode = cgDisplayMode, mode.width > 0 {
                pixelHeight = Int(Double(display.height) * Double(mode.pixelWidth) / Double(mode.width))
            } else {
                pixelHeight = display.height
            }

            let prePixelWidth = pixelWidth
            (pixelWidth, pixelHeight) = capResolution(width: pixelWidth, height: pixelHeight, maxHeight: args.maxHeight)
            // Points→final-pixels scale (Sprint 20 US-159): native Retina scale
            // (prePixelWidth / display.width, in points) times any maxHeight
            // downscale applied above.
            let pointsToPixels = display.width > 0
                ? (Double(pixelWidth) / Double(prePixelWidth)) * (Double(prePixelWidth) / Double(display.width))
                : 1.0

            filter = SCContentFilter(display: display, excludingWindows: [])
            let displayBounds = CGDisplayBounds(display.displayID)
            emit("display", [
                "id": display.displayID,
                "width": pixelWidth,
                "height": pixelHeight,
                "mode": "display",
                // Global-screen-coordinate origin, in POINTS (Sprint 20 US-159) —
                // non-zero and possibly negative for any display that isn't the
                // main display in System Settings > Displays (e.g. one positioned
                // to the left). pointsToPixels converts cursor-tracker's point
                // coordinates onto this capture's actual pixel grid.
                "originX": displayBounds.origin.x,
                "originY": displayBounds.origin.y,
                "pointsToPixels": pointsToPixels
            ])
        }

        let config = SCStreamConfiguration()
        config.width = pixelWidth
        config.height = pixelHeight
        config.showsCursor = !args.hideCursor
        config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale(args.fps))
        // Sprint 25 US-190 — 10-bit capture preserves HDR content (video/photos
        // shown on an HDR display) instead of tone-mapping to SDR at capture
        // time, which would be unrecoverable at export. Opt-in only: doubles
        // per-pixel size (2 bytes/component vs 1), meaningfully increasing
        // disk write bandwidth — see US-192 disk-space warning.
        config.pixelFormat = args.hdr ? kCVPixelFormatType_ARGB2101010LEPacked : kCVPixelFormatType_32BGRA
        if args.hdr, let colorSpace = CGColorSpace(name: CGColorSpace.itur_2100_PQ) {
            config.colorSpaceName = colorSpace.name!
        }
        config.capturesAudio = args.captureAudio && args.windowId == 0  // audio only in display mode
        config.sampleRate = 48000
        config.channelCount = 2

        let outputURL = URL(fileURLWithPath: args.outputPath)
        let captureAudio = args.captureAudio && args.windowId == 0
        writer = try VideoWriter(
            url: outputURL,
            width: pixelWidth,
            height: pixelHeight,
            fps: args.fps,
            captureAudio: captureAudio,
            hdr: args.hdr
        )
        try writer!.start()

        stream = SCStream(filter: filter, configuration: config, delegate: self)
        try stream!.addStreamOutput(self, type: .screen, sampleHandlerQueue: DispatchQueue(label: "rs.capture.screen"))
        if captureAudio {
            try stream!.addStreamOutput(self, type: .audio, sampleHandlerQueue: DispatchQueue(label: "rs.capture.audio"))
        }

        try await stream!.startCapture()
        emit("started", ["outputPath": args.outputPath, "fps": args.fps])
    }

    func stopCapture() async {
        guard let stream = stream else { return }
        do {
            try await stream.stopCapture()
        } catch {
            emit("warning", ["message": "Stop capture error: \(error.localizedDescription)"])
        }
        await writer?.finish()
        emit("stopped", ["frames": frameCount, "outputPath": args.outputPath])
    }

    /// Pause/resume writing frames to disk. The stream keeps running (SCStream has no
    /// native pause), but VideoWriter drops frames and closes the resulting time gap
    /// so the output file has no frozen segment or audio/video drift.
    func setPaused(_ paused: Bool) {
        writer?.setPaused(paused, at: lastSampleTime)
        emit(paused ? "paused" : "resumed")
    }

    // MARK: - SCStreamOutput

    func stream(_ stream: SCStream, didOutputSampleBuffer buffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard CMSampleBufferDataIsReady(buffer) else { return }

        // SCK also delivers frames with status .idle/.blank/.suspended that carry
        // no image data — feeding those to AVAssetWriter poisons it (OSStatus
        // -16122, writer → .failed, file ends up without a moov atom). Only
        // .complete frames with an actual pixel buffer may be written.
        if type == .screen {
            guard let attachments = CMSampleBufferGetSampleAttachmentsArray(buffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
                  let statusRaw = attachments.first?[.status] as? Int,
                  let status = SCFrameStatus(rawValue: statusRaw),
                  status == .complete,
                  CMSampleBufferGetImageBuffer(buffer) != nil else { return }
        }

        let pts = CMSampleBufferGetPresentationTimeStamp(buffer)
        if startTime == nil {
            startTime = pts
        }
        lastSampleTime = pts

        switch type {
        case .screen:
            writer?.appendVideo(buffer)
            frameCount += 1
            if frameCount % (args.fps * 5) == 0 {
                let elapsed = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(buffer)) -
                              CMTimeGetSeconds(startTime!)
                emit("progress", ["frames": frameCount, "elapsed": elapsed])
            }
        case .audio:
            writer?.appendAudio(buffer)
        default:
            break
        }
    }

    // MARK: - SCStreamDelegate

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        emit("error", ["code": "STREAM_STOPPED", "message": error.localizedDescription])
        exit(1)
    }
}

// MARK: - Entry point

let args = Args.parse()

if #available(macOS 13.0, *) {
    // Window listing mode — no output path required
    if args.listWindows {
        let grp = DispatchGroup()
        grp.enter()
        Task {
            await listWindowsAndExit()
            grp.leave()
        }
        grp.wait()
        exit(0)
    }

    guard !args.outputPath.isEmpty else {
        fputs("Usage: capture --output <path> [--display-id <id>] [--window-id <id>] [--fps 60] [--no-audio] [--list-windows]\n", stderr)
        exit(1)
    }

    let controller = CaptureController(args: args)
    globalController = controller

    let stopGroup = DispatchGroup()
    stopGroup.enter()
    globalStopGroup = stopGroup

    signal(SIGTERM) { _ in
        guard let ctrl = globalController, let grp = globalStopGroup else { exit(0) }
        Task {
            await ctrl.stopCapture()
            grp.leave()
        }
    }
    signal(SIGINT) { _ in
        guard let ctrl = globalController, let grp = globalStopGroup else { exit(0) }
        Task {
            await ctrl.stopCapture()
            grp.leave()
        }
    }

    // Pause/resume are runtime toggles, not lifecycle transitions, so they travel over
    // stdin (line-delimited commands) rather than signals — Electron writes "pause\n" /
    // "resume\n" to the child process's stdin. Must run on a background queue: the
    // main thread is parked in stopGroup.wait() and never pumps the main dispatch
    // queue, so a .main-scheduled source would never fire.
    let stdinSource = DispatchSource.makeReadSource(
        fileDescriptor: FileHandle.standardInput.fileDescriptor,
        queue: DispatchQueue.global(qos: .userInitiated)
    )
    stdinSource.setEventHandler {
        guard let line = readLine(strippingNewline: true) else {
            // EOF (parent closed stdin) — cancel or the source spins forever.
            stdinSource.cancel()
            return
        }
        switch line.trimmingCharacters(in: .whitespaces) {
        case "pause":
            globalController?.setPaused(true)
        case "resume":
            globalController?.setPaused(false)
        default:
            break
        }
    }
    stdinSource.resume()

    Task {
        do {
            try await controller.startCapture()

            if args.duration > 0 {
                try await Task.sleep(nanoseconds: UInt64(args.duration * 1_000_000_000))
                await controller.stopCapture()
                stopGroup.leave()
            }
        } catch {
            emit("error", ["code": "START_FAILED", "message": error.localizedDescription])
            stopGroup.leave()
        }
    }

    stopGroup.wait()
    exit(0)
} else {
    fputs("Error: macOS 13+ required for ScreenCaptureKit\n", stderr)
    exit(1)
}

// Global controller reference — needed for C signal handlers which can't capture context
var globalController: CaptureController?
var globalStopGroup: DispatchGroup?
