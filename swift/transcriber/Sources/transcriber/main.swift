import Foundation
import Speech
import AVFoundation

// transcriber — Sprint 24 US-183. Reads an audio/video file, runs on-device
// speech recognition (SFSpeechRecognizer, requiresOnDeviceRecognition = true
// so audio never leaves the machine — consistent with face-detector and the
// rest of the app's "no cloud AI" commitment), and prints one JSON line per
// recognized word with its timestamp:
//   {"word":"hello","startTime":1.230,"endTime":1.410,"confidence":0.94}
// Consumed by the Electron main process to build the Transcript panel.

func emitLine(_ word: String, _ start: Double, _ end: Double, _ confidence: Float) {
    let escaped = word.replacingOccurrences(of: "\"", with: "\\\"")
    print(String(format: "{\"word\":\"%@\",\"startTime\":%.3f,\"endTime\":%.3f,\"confidence\":%.3f}",
                 escaped, start, end, confidence))
    fflush(stdout)
}

func emitError(_ message: String) {
    fputs("transcriber error: \(message)\n", stderr)
}

// --- Parse args ---
var inputPath = ""
var localeIdentifier = Locale.current.identifier
var i = 1
let argv = CommandLine.arguments
while i < argv.count {
    switch argv[i] {
    case "--input":
        i += 1; inputPath = i < argv.count ? argv[i] : ""
    case "--locale":
        i += 1; localeIdentifier = i < argv.count ? argv[i] : localeIdentifier
    default: break
    }
    i += 1
}

guard !inputPath.isEmpty, FileManager.default.fileExists(atPath: inputPath) else {
    fputs("Usage: transcriber --input <audio-or-video> [--locale en-US]\n", stderr)
    exit(1)
}

guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeIdentifier)) else {
    emitError("no speech recognizer available for locale \(localeIdentifier)")
    exit(1)
}

guard recognizer.supportsOnDeviceRecognition else {
    emitError("on-device recognition not supported for locale \(localeIdentifier) on this system")
    exit(1)
}

let group = DispatchGroup()
group.enter()

// SFSpeechRecognizer requires authorization even for on-device-only
// recognition; request it synchronously since this is a short-lived CLI tool.
SFSpeechRecognizer.requestAuthorization { status in
    guard status == .authorized else {
        emitError("speech recognition authorization denied (status: \(status.rawValue))")
        group.leave()
        exit(1)
    }

    let request = SFSpeechURLRecognitionRequest(url: URL(fileURLWithPath: inputPath))
    request.requiresOnDeviceRecognition = true
    request.shouldReportPartialResults = false

    recognizer.recognitionTask(with: request) { result, error in
        if let error = error {
            emitError(error.localizedDescription)
            group.leave()
            return
        }
        guard let result = result, result.isFinal else { return }

        for segment in result.bestTranscription.segments {
            emitLine(segment.substring, segment.timestamp, segment.timestamp + segment.duration, segment.confidence)
        }
        group.leave()
    }
}

// On-device transcription of a multi-minute recording can take a while;
// give it a generous ceiling rather than hanging the caller forever if
// something in Speech.framework wedges.
let timeoutResult = group.wait(timeout: .now() + 600)
if timeoutResult == .timedOut {
    emitError("timed out after 600s")
    exit(1)
}
exit(0)
