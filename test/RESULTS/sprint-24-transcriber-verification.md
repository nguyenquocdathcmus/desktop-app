# Sprint 24 US-183 — Transcriber Binary Verification

## What was built and verified

- `swift/transcriber/` — a new Swift package using `SFSpeechRecognizer` with
  `requiresOnDeviceRecognition = true` (audio never leaves the machine, same
  commitment as `face-detector`'s on-device Vision framework use).
- **Compiles cleanly**: `swift build -c release` succeeds, binary runs, links
  against `Speech`/`AVFoundation`.
- **Registered in the real build pipeline**: added to `scripts/build-swift.sh`
  alongside `capture`/`cursor-tracker`/`face-detector` — same universal-binary
  (arm64 + x86_64) + ad-hoc codesign flow.
- **JSON output format verified by direct inspection of `main.swift`**: one
  line per word, `{"word":"...","startTime":N,"endTime":N,"confidence":N}`,
  matching the streaming-JSON-over-stdout convention `face-detector` and
  `cursor-tracker` already use, so `transcript-handlers.ts` reuses the exact
  same buffered-line-parsing pattern as `face-handlers.ts`.

## What could NOT be verified end-to-end in this environment, and why

Running the compiled binary directly from a terminal — `./transcriber --input
test.m4a` — reproducibly **aborts** (SIGABRT, exit 134) with:

```
[com.apple.TCC:access] This app has crashed because it attempted to access
privacy-sensitive data without a usage description. The app's Info.plist
must contain an NSSpeechRecognitionUsageDescription key with a string value
explaining to the user how the app uses this data.
```

This was reproduced 3 times with escalating fixes, each confirmed via
`log show --predicate 'process == "transcriber"'` against the real crash log
(not guessed):

1. Raw binary, no Info.plist at all → crash, log says "Application does not
   have a bundle identifier."
2. Binary with an `Info.plist` embedded via linker `-sectcreate __TEXT
   __info_plist` (a technique that works for some Info.plist-dependent APIs)
   → still crashes; the bundle-identifier warning is gone but TCC still can't
   resolve `NSSpeechRecognitionUsageDescription`.
3. Binary copied into a hand-built minimal `.app/Contents/{MacOS,Info.plist}`
   and executed directly (not via `open`/LaunchServices) → still crashes,
   because launching a `.app`'s binary directly (bypassing `open`) does not
   give it "real" bundle identity for TCC purposes either.

The one remaining thing to try — launching the `.app` via `open -a` so
LaunchServices assigns it real bundle identity — was blocked by this
session's sandbox (launching arbitrary apps is a reasonable thing to
restrict, and correctly so). This is a genuine environment limitation, not a
design guess papered over.

## Why the fix should work anyway, and what it is

`NSSpeechRecognitionUsageDescription` has been added to `electron-builder.yml`
(the **app's** Info.plist, not the helper binary's) alongside the existing
`NSCameraUsageDescription`/`NSMicrophoneUsageDescription`. When `transcriber`
is spawned as a **child process of the real, signed, packaged Electron.app**
(exactly how `transcript-handlers.ts` invokes it via `spawn(binPath(...))`,
never as a standalone terminal binary), it should inherit the parent app's
TCC identity and authorization — this is precisely the same mechanism
`cursor-tracker` already relies on for Accessibility permission and `capture`
relies on for Screen Recording permission, both documented in `PLAN.md`
("CGEventTap — Accessibility Permission": *"Binary must be signed with the
same Team ID or be blessed by the app bundle"*).

**This is the one manual verification step left before shipping**: build the
full packaged app (`npm run build` + `electron-builder`, not `npm run dev`),
launch the real `.app`, trigger transcript generation from the Editor UI, and
confirm the TCC prompt appears and the transcript comes back instead of the
process aborting. If it still aborts even from inside the real app bundle,
the fallback is to give `transcriber` its own minimal `.app` bundle inside
`resources/bin/` and invoke `open -a` instead of `spawn` directly — a real
but more invasive change, only needed if the simpler path fails.

## Current status

`transcript:generate` in `transcript-handlers.ts` handles the failure
explicitly — if `transcriber` aborts, `proc.on('close')` sees a non-zero exit
code with no words parsed and returns `{ ok: false, error: stderr }` up to
the UI, which shows the error text in the Transcript panel rather than
hanging or silently producing an empty transcript. So the feature fails
loud and specific if the packaged-app verification above doesn't pan out,
never silently.
