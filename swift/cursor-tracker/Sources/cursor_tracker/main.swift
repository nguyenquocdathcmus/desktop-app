import Foundation
import CoreGraphics
import AppKit

// MARK: - JSON event output (streamed to Electron via stdout)

func emit(_ event: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: event),
       let str = String(data: data, encoding: .utf8) {
        print(str)
        fflush(stdout)
    }
}

// Millisecond timestamp
func nowMs() -> Double {
    Date().timeIntervalSince1970 * 1000
}

// MARK: - Cursor event tap

// Sprint 29 (round 2) — holds the tap's CFMachPort so eventTapCallback can
// re-enable it after macOS auto-disables it (see the .tapDisabledByTimeout/
// .tapDisabledByUserInput case below). Declared here, before the callback,
// and assigned once `tapCreate` succeeds further down — Swift top-level
// code runs top-to-bottom like a script, so a `guard let tap = ...` declared
// after this function is NOT visible inside it; this global var is.
private var globalEventTap: CFMachPort?

// CGEventTap callback — runs on event tap queue
private func eventTapCallback(
    proxy: CGEventTapProxy,
    type: CGEventType,
    event: CGEvent,
    refcon: UnsafeMutableRawPointer?
) -> Unmanaged<CGEvent>? {
    let loc = event.location

    switch type {
    case .mouseMoved, .leftMouseDragged, .rightMouseDragged, .otherMouseDragged:
        emit(["t": nowMs(), "x": loc.x, "y": loc.y, "type": "move"])

    case .leftMouseDown:
        emit(["t": nowMs(), "x": loc.x, "y": loc.y, "type": "click", "button": "left"])

    case .rightMouseDown:
        emit(["t": nowMs(), "x": loc.x, "y": loc.y, "type": "click", "button": "right"])

    case .otherMouseDown:
        emit(["t": nowMs(), "x": loc.x, "y": loc.y, "type": "click", "button": "middle"])

    case .scrollWheel:
        let dx = event.getDoubleValueField(.scrollWheelEventDeltaAxis2)
        let dy = event.getDoubleValueField(.scrollWheelEventDeltaAxis1)
        emit(["t": nowMs(), "x": loc.x, "y": loc.y, "type": "scroll", "dx": dx, "dy": dy])

    case .keyDown:
        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        let flags = event.flags
        var modifiers: [String] = []
        if flags.contains(.maskCommand)  { modifiers.append("cmd") }
        if flags.contains(.maskShift)    { modifiers.append("shift") }
        if flags.contains(.maskAlternate){ modifiers.append("opt") }
        if flags.contains(.maskControl)  { modifiers.append("ctrl") }
        let display = keyDisplay(keyCode: keyCode, flags: flags)
        emit(["t": nowMs(), "type": "keydown", "keyCode": keyCode, "modifiers": modifiers, "display": display])

    case .tapDisabledByUserInput, .tapDisabledByTimeout:
        // Sprint 29 (round 2) — real bug fixed here: this used to just
        // `break`, with a comment claiming re-enable was "handled by setting
        // up new tap if needed" — no such handling existed anywhere. macOS
        // disables a tap on its own (delivering exactly this event type)
        // after the callback stalls past its timeout, or when something
        // else on the system enters secure-input mode. Without calling
        // tapEnable again here, the tap stayed off for the rest of the
        // process's life — cursor/click/scroll/keystroke capture silently
        // stopped for the remainder of the recording with no error
        // surfaced to Electron, since every other event type still had
        // `break` as a legitimate no-op default. `tap` is the top-level
        // `globalEventTap`, set once immediately after tapCreate below.
        if let tap = globalEventTap {
            CGEvent.tapEnable(tap: tap, enable: true)
        }

    default:
        break
    }

    return Unmanaged.passRetained(event)
}

// MARK: - Key display name helper

func keyDisplay(keyCode: Int64, flags: CGEventFlags) -> String {
    var parts: [String] = []
    if flags.contains(.maskControl)   { parts.append("⌃") }
    if flags.contains(.maskAlternate) { parts.append("⌥") }
    if flags.contains(.maskShift)     { parts.append("⇧") }
    if flags.contains(.maskCommand)   { parts.append("⌘") }

    let keyNames: [Int64: String] = [
        0: "A", 1: "S", 2: "D", 3: "F", 4: "H", 5: "G", 6: "Z", 7: "X",
        8: "C", 9: "V", 11: "B", 12: "Q", 13: "W", 14: "E", 15: "R",
        16: "Y", 17: "T", 18: "1", 19: "2", 20: "3", 21: "4", 22: "6",
        23: "5", 24: "=", 25: "9", 26: "7", 27: "-", 28: "8", 29: "0",
        30: "]", 31: "O", 32: "U", 33: "[", 34: "I", 35: "P", 36: "↩",
        37: "L", 38: "J", 39: "'", 40: "K", 41: ";", 42: "\\", 43: ",",
        44: "/", 45: "N", 46: "M", 47: ".", 48: "⇥", 49: "Space",
        51: "⌫", 53: "⎋", 55: "⌘", 56: "⇧", 57: "⇪", 58: "⌥",
        59: "⌃", 60: "⇧", 61: "⌥", 62: "⌃", 63: "fn",
        96: "F5", 97: "F6", 98: "F7", 99: "F3", 100: "F8", 101: "F9",
        103: "F11", 109: "F10", 111: "F12", 122: "F1", 120: "F2",
        118: "F4", 123: "←", 124: "→", 125: "↓", 126: "↑",
    ]

    let name = keyNames[keyCode] ?? "Key\(keyCode)"
    parts.append(name)
    return parts.joined()
}

// MARK: - Main

// Check Accessibility permission
guard AXIsProcessTrusted() else {
    let options: [String: Any] = [kAXTrustedCheckOptionPrompt.takeRetainedValue() as String: true]
    AXIsProcessTrustedWithOptions(options as CFDictionary)
    fputs("Error: Accessibility permission required. Please grant it in System Settings → Privacy → Accessibility.\n", stderr)
    exit(1)
}

// Create event tap
let eventMask: CGEventMask =
    (1 << CGEventType.mouseMoved.rawValue) |
    (1 << CGEventType.leftMouseDown.rawValue) |
    (1 << CGEventType.rightMouseDown.rawValue) |
    (1 << CGEventType.otherMouseDown.rawValue) |
    (1 << CGEventType.leftMouseDragged.rawValue) |
    (1 << CGEventType.rightMouseDragged.rawValue) |
    (1 << CGEventType.scrollWheel.rawValue) |
    (1 << CGEventType.keyDown.rawValue)

guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: eventMask,
    callback: eventTapCallback,
    userInfo: nil
) else {
    fputs("Error: Failed to create event tap. Accessibility permission may be missing.\n", stderr)
    exit(1)
}

globalEventTap = tap

let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

// Emit ready signal
emit(["event": "ready", "t": nowMs()])

// Handle stop signals
signal(SIGTERM) { _ in exit(0) }
signal(SIGINT)  { _ in exit(0) }

// Run until terminated
CFRunLoopRun()
