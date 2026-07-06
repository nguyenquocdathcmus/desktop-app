# Sprint 25 — HDR Capture/Export & High-FPS Verification

## Environment used for verification

This machine has a real **Liquid Retina XDR** built-in display (confirmed via
`system_profiler SPDisplaysDataType`) and, per Electron's `screen.getAllDisplays()`,
reports `displayFrequency: 120`, `colorDepth: 30`, `depthPerComponent: 10` — a
genuine ProMotion + HDR-capable panel, not a guess. All findings below are from
running the real `capture` binary and real bundled `ffmpeg` against this
hardware, not simulated.

## US-189 — High frame rate

- `swift/capture` already accepted `--fps` as an arbitrary CLI int with no
  ceiling — the gap was entirely on the Electron side, which hardcoded `fps: 60`
  in `useRecordingStore.ts` and `RecordingSession.ts`'s manifest write (a real,
  pre-existing bug: the manifest recorded `fps: 60` even if some other value had
  ever been passed).
- Added `DisplayInfo.refreshRate` (from `Display.displayFrequency`, confirmed
  real value `120` on this hardware) and gate the fps picker in
  `RecordingControls.tsx` to only offer 90/120 when the selected display
  supports it. `selectDisplay()` clamps `selectedFps` down when switching to a
  lower-refresh-rate display.
- Fixed the manifest bug: `fps: this._opts?.fps ?? 60` instead of a hardcoded 60.
- Export modal's fps picker similarly extended to 90/120, gated on the
  source's actual captured fps (`project.manifest.fps`).
- Not independently load-tested at sustained 120fps for dropped frames (would
  need a longer real recording session, which risks capturing this session's
  actual screen content) — the plumbing is verified correct end-to-end, but
  "no dropped frames over N minutes at 120fps" is a manual QA item for someone
  running a real long recording, not something proven here.

## US-190 — HDR capture

**Fully verified end-to-end against real hardware.** Added `--hdr` flag to
`capture`: switches `SCStreamConfiguration.pixelFormat` to
`kCVPixelFormatType_ARGB2101010LEPacked` and sets `colorSpaceName` to
`CGColorSpace.itur_2100_PQ`; `VideoWriter.swift` correspondingly uses
HEVC Main10 profile (`kVTProfileLevel_HEVC_Main10_AutoLevel`) with
BT.2020/PQ `AVVideoColorPropertiesKey` tags.

Ran the compiled binary for real:
```
capture --output test.mov --fps 30 --duration 3 --hdr --no-audio
```
Result, verified via `ffprobe`:
```
Video: hevc (Main 10) (hvc1 / 0x31637668), yuv420p10le(tv, bt2020nc/bt2020/smpte2084), 3024x1964
```
Correct 10-bit HEVC Main10 with BT.2020 primaries and SMPTE ST 2084 (PQ)
transfer function — a real HDR file, not just wider bit depth with no
metadata.

**Measured bandwidth** (3s @ 3024×1964, same content, same machine):
- SDR: 141MB → ~362 Mbps
- HDR: 189MB → ~499 Mbps
- **Real ratio: ~1.4x**, not the "roughly 2x" guessed in the original sprint
  plan (VideoToolbox's quality-mode HEVC encoding doesn't scale bandwidth
  linearly with bit depth the way raw/uncompressed would). The disk-space
  warning in `RecordingControls.tsx` and the export bitrate multiplier in
  `Exporter.ts` both use this measured 1.4x, not the original guess.

## US-191 — Export with HDR preserved

**Fully verified end-to-end**, but the implementation path changed
significantly from the sprint plan after hitting two real, reproducible
ffmpeg/VideoToolbox issues:

1. **`hevc_videotoolbox` (hardware) fails to open a Main10 encoding session on
   this machine**: `Cannot create compression session: -12908`. Reproduced by
   running the exact ffmpeg command directly, independent of this app's code.
   `-allow_sw 1` (forcing VideoToolbox to fall back to software) fixes it, but
   at that point there's no hardware-acceleration benefit left.
2. **Neither `hevc_videotoolbox` nor `libx265`'s generic output-level
   `-color_primaries`/`-color_trc`/`-colorspace` flags actually bake
   BT.2020/PQ into the HEVC bitstream's VUI parameters on this ffmpeg build**
   (8.1.2-tessus) — `ffprobe` on the result always showed
   `bt2020nc/unknown/unknown` no matter the flag combination or ordering
   tried (5+ variations tested directly against ffmpeg, bypassing this app's
   code entirely, to isolate whether it was an argument-construction bug here
   or an ffmpeg-level limitation — it's the latter).

**What actually works**, confirmed by real `ffprobe` round-trip:
`-c:v libx265 -pix_fmt p010le -x265-params colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc -tag:v hvc1`
— `-x265-params` bakes the color tags directly into the codec's own bitstream
syntax rather than relying on ffmpeg's generic (and, on this build, apparently
non-functional for this codec/muxer combination) output-tagging flags.

**Decision**: `preserveHdr: true` now always uses `libx265` (software), never
`hevc_videotoolbox`, regardless of the `codec` option — this is the only
combination verified to produce a file that actually signals HDR to a player,
which is the entire point of the feature. Slower than hardware encoding, but
correctness (`ffprobe` showing `bt2020nc/bt2020/smpte2084`, not
`bt2020nc/unknown/unknown`) matters more for a feature whose only reason to
exist is preserving HDR metadata.

Real test: `test/integration/export-hdr.test.ts` — generates a real 10-bit
HEVC Main10 source, exports it with `preserveHdr: true`, and asserts the
output via real `ffprobe` shows `Main 10`, `yuv420p10le`/`p010le`, and
`bt2020nc/bt2020/smpte2084` (not `unknown/unknown`). Also verifies: the
default (non-HDR) export path is completely unaffected, and a blur region
(Sprint 19's boxblur/crop/overlay filter chain) still works correctly when
composited into the 10-bit pipeline. All 3 tests pass against the real
bundled ffmpeg binary — not mocked.

## US-193 — pipeline audit found a real, pre-existing bug (not HDR-specific)

Adding a zoom-event test case to the new HDR export test (to check the
zoompan filter specifically for 8-bit/10-bit assumptions) surfaced a real,
independently-reproducible bug that has nothing to do with HDR:
`buildZExpr`/`buildXExpr`/`buildYExpr` in `Exporter.ts` build ffmpeg
`zoompan` filter expressions referencing the variable `t` for current time —
but ffmpeg's `zoompan` filter's eval context exposes current output time as
`time`, not `t` (`t` is used by other filters like `crop`/`drawtext`/`geq`,
which this codebase also uses correctly elsewhere — the bug was assuming all
ffmpeg filter eval contexts share one variable set, which they don't).

**Impact**: `between(t,...)` inside a `zoompan` z/x/y expression makes ffmpeg
reject the filter graph outright (`Unknown function`) and the encoder never
opens — meaning **any export of a recording with `zoomEvents` present has
been failing** for as long as this code path has existed. The existing unit
tests (`test/unit/exporter-filters.test.ts`) never caught this because they
only assert the expression's *string shape* (`toContain('between(t,...)')`)
without ever running it through real ffmpeg — the tests encoded the bug as
correct behavior.

**Confirmed via direct reproduction**, isolated from this app's code
entirely: ran `ffmpeg -vf "zoompan=z='between(t,1,3)'..."` directly and got
the identical "Unknown function" error; switching to `time` fixed it
immediately, confirmed by a clean successful encode.

**Fix**: all three functions now emit `time` instead of `t`. `buildCropXExpr`
(used in a `crop` filter, a different eval context) was left unchanged after
confirming directly that `crop`'s `t` variable does work correctly.

**New regression coverage**: `test/integration/export-real-ffmpeg.test.ts`
gained a `zoom events` describe block that actually calls `exportVideo()`
with real `zoomEvents` and asserts success against real ffmpeg — this is the
test that should have existed from Sprint 4 and would have caught the bug
immediately.

## Net effect on existing behavior

Zero change to the default export path when no zoom events and no HDR are
involved. Full existing integration test suite (18 tests total across
`export-real-ffmpeg.test.ts` + `export-hdr.test.ts` + notification detector)
passes. The zoom fix is a strict correctness improvement — zoom exports that
previously failed outright now succeed — with no behavior change for anyone
not using zoom.
