# Screen Studio Clone — Performance Benchmarks

**Version:** 1.0
**Date:** 2026-06-29
**Owner:** QA Engineering + Development

This document defines performance targets, measurement methodology, tooling, and pass/fail thresholds for each measurable aspect of the Screen Studio Clone application. Every benchmark listed here must be measured and recorded at each Phase milestone before release sign-off.

---

## 1. App Startup Time

### Definition
Time from user double-clicking the app icon (or process launch) until the main window is fully rendered and interactive — meaning the DisplayPicker is visible and the user can click it.

### Target
**Pass:** < 2.0 seconds
**Warning:** 2.0 – 3.0 seconds
**Fail:** > 3.0 seconds

### Measurement Method

**Option A — Manual Stopwatch (minimum viable)**
1. Completely quit the app (`Cmd+Q` or `kill -9`)
2. Wait 10 seconds (allow OS to clear file caches)
3. Start a stopwatch the moment you double-click the app icon in Finder
4. Stop the stopwatch when the DisplayPicker window is visible and the display list has loaded
5. Repeat 5 times, record all values, use the median

**Option B — Instruments (preferred for accuracy)**
1. Open Instruments > App Launch (or Time Profiler with launch tracking)
2. Select the Screen Studio process
3. Click Record — Instruments will launch the app and measure time to first meaningful paint
4. Inspect the "App Launch Duration" metric in the timeline
5. Report the p50 and p95 values across 5 launches

**Option C — electron-vite startup timing (for CI)**
In `src/main/index.ts`, add timing instrumentation:
```typescript
const launchStart = Date.now();
app.whenReady().then(() => {
  createWindow();
  // After window shows:
  const timeToReady = Date.now() - launchStart;
  console.log(`[PERF] startup_ms=${timeToReady}`);
});
```
CI parses this log line and fails if `startup_ms > 2000`.

### Baseline and Targets by Phase

| Phase | Target | Notes |
|-------|--------|-------|
| Phase 1 | < 2.0s | No effects or timeline loaded |
| Phase 2 | < 2.5s | Additional Swift binaries to initialize |
| Phase 3 | < 3.0s | Full feature set; acceptable slight increase |

### What to Measure and Record

| Measurement | Value | Date | Build |
|-------------|-------|------|-------|
| Cold launch p50 | | | |
| Cold launch p95 | | | |
| Warm launch p50 | | | |
| Time to window visible | | | |
| Time to display list loaded | | | |

---

## 2. Memory Usage at Idle

### Definition
RSS (Resident Set Size) / Real Memory of the Electron main process plus all helper processes, measured after the app has been idle for at least 60 seconds with no recording or editor open.

### Targets

| Process | Pass | Warning | Fail |
|---------|------|---------|------|
| Electron main process | < 150 MB | 150–200 MB | > 200 MB |
| Electron renderer process | < 80 MB | 80–120 MB | > 120 MB |
| GPU process (Electron) | < 50 MB | 50–80 MB | > 80 MB |
| Total all Screen Studio processes | < 300 MB | 300–400 MB | > 400 MB |

### Measurement Method

**Step 1 — Activity Monitor**
1. Launch the app and wait 60 seconds
2. Open Activity Monitor > Memory tab
3. Filter by "Screen Studio" in the search box
4. Record the "Real Memory" column for each process listed
5. Sum all Screen Studio-related processes (main, renderer, GPU, helper)

**Step 2 — Detailed Node.js Heap Analysis**
In Electron renderer DevTools:
```javascript
// In DevTools console:
const used = process.memoryUsage();
console.log(`Heap used: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
console.log(`Heap total: ${Math.round(used.heapTotal / 1024 / 1024)}MB`);
console.log(`External: ${Math.round(used.external / 1024 / 1024)}MB`);
console.log(`RSS: ${Math.round(used.rss / 1024 / 1024)}MB`);
```

**Step 3 — Memory Leak Check**
After measuring idle memory, leave the app open for 30 minutes without interaction and measure again. Memory should not grow by more than 5 MB over this period. Growing memory indicates a leak.

**Step 4 — Instruments Allocations**
For deeper analysis:
1. Open Instruments > Allocations
2. Attach to the Screen Studio process
3. Mark heap baseline after 60-second idle
4. Perform recording + export + close editor cycle
5. Mark heap again
6. Verify memory returns to near-baseline (within 20 MB)

### What to Measure and Record

| Process | Idle Memory (MB) | Date | Build |
|---------|-----------------|------|-------|
| Main process | | | |
| Renderer process | | | |
| GPU process | | | |
| cursor-tracker binary | | | |
| Other helpers | | | |
| **Total** | | | |
| Memory after 30 min idle (leak check) | | | |

---

## 3. CPU Usage During Active Recording

### Definition
CPU percentage across all Screen Studio processes during active screen recording, measured after the first 10 seconds of recording to allow stabilization.

### Targets

| Condition | Pass | Warning | Fail |
|-----------|------|---------|------|
| Idle (no recording) | < 3% | 3–8% | > 8% |
| Active recording (Apple Silicon) | < 20% avg | 20–30% avg | > 30% avg |
| Active recording peak (Apple Silicon) | < 40% | 40–60% | > 60% |
| Active recording (Intel Mac) | < 40% avg | 40–60% avg | > 60% avg |
| `capture` binary alone | < 15% | 15–25% | > 25% |
| Thermal throttling during 10-min record | Not triggered | | Triggered = Fail |

**Rationale:** The `capture` binary uses VideoToolbox HEVC hardware encoding. On Apple Silicon, this is done by the media engine, not the CPU cores — so CPU should be very low. Higher than expected CPU usage suggests the hardware encoder is not being used (falling back to software).

### Measurement Method

**Method A — Activity Monitor**
1. Start a recording
2. Wait 15 seconds for startup to stabilize
3. Open Activity Monitor > CPU tab
4. Filter by "Screen Studio"
5. Record CPU % for each process every 30 seconds for 5 minutes
6. Calculate average and peak CPU across all Screen Studio processes

**Method B — Instruments Time Profiler**
1. Open Instruments > Time Profiler
2. Start recording the Screen Studio process
3. Start a screen recording in the app
4. Let it run for 5 minutes
5. Stop Instruments recording
6. Inspect the CPU usage graph for average and peak values
7. Drill into the heaviest call stacks to identify bottlenecks

**Method C — Command Line**
```bash
# Sample CPU every 5 seconds for 60 samples (5 minutes):
for i in $(seq 1 60); do
  ps aux | grep -E "(capture|cursor-tracker|audio-composer|Screen Studio)" | grep -v grep | \
    awk '{sum += $3} END {print NR" processes, total CPU: "sum"%"}'
  sleep 5
done
```

**Method D — Instruments Energy Log (for battery impact)**
1. Open Instruments > Energy Log
2. Start the Screen Studio recording
3. Let it run for 10 minutes
4. Check "Energy Impact" — should be "Low" or "Medium", never "High" during normal recording

### Hardware Encoder Verification
To verify VideoToolbox hardware encoder is active:
```bash
# While capture binary is running, check for hardware encoder activity:
sudo powermetrics --samplers gpu_power -i 1000 -n 5
```
The `media_en_usage` field should show activity during recording, confirming hardware encoding.

### What to Measure and Record

| Metric | Value | Date | Build | Architecture |
|--------|-------|------|-------|-------------|
| Avg CPU during recording | | | | |
| Peak CPU during recording | | | | |
| `capture` binary CPU % | | | | |
| cursor-tracker CPU % | | | | |
| audio-composer CPU % | | | | |
| Thermal throttled after 10 min | Yes/No | | | |
| Hardware encoder confirmed active | Yes/No | | | |

---

## 4. Export Pipeline Performance

### Definition
Wall-clock time from the moment the user clicks "Export" (and the FFmpeg process starts) to when the output file is fully written to disk. Measured for standardized clip lengths and resolutions.

### Primary Benchmark: 60-Second 1080p MP4 Export

**Source:** 60-second `capture.mov` (HEVC lossless, 1920x1080 @ 60fps)
**Output:** 1920x1080 MP4, H.264 CRF 18, `preset fast`, with solid background and 40px padding
**Target platform:** Apple Silicon M2 or better

| Platform | Pass | Warning | Fail |
|----------|------|---------|------|
| Apple Silicon M2+ | < 30 seconds | 30–60 seconds | > 60 seconds |
| Intel Mac (Core i7/i9) | < 60 seconds | 60–120 seconds | > 120 seconds |

### Additional Benchmarks

| Benchmark | Source | Output | Pass Threshold |
|-----------|--------|--------|----------------|
| 60-second 4K MP4 | 4K 60fps HEVC | 3840x2160 MP4 | < 120s (Apple Silicon) |
| 10-minute 1080p MP4 | 10min 1080p | 1920x1080 MP4 | < 4 minutes |
| 30-second GIF | 30s 1080p | 800px GIF @12fps | < 20 seconds |
| Export with zoom effects | 60s 1080p | 1920x1080 + zoom | < 45s (Apple Silicon) |

### Measurement Method

**Method A — Manual Timer**
```bash
# From command line, measure FFmpeg invocation directly:
time ./resources/bin/ffmpeg/ffmpeg \
  -i fixture_60s_1080p.mov \
  -filter_complex "[0:v]scale=1920:1080,pad=2000:1160:40:40:color=ff0000[v]" \
  -map "[v]" -map 0:a \
  -c:v libx264 -crf 18 -preset fast \
  output.mp4
```
Record the "real" time from the `time` command output.

**Method B — Application-Level Timing (Integration Test)**
```typescript
// In test:
const startTime = Date.now();
await triggerExport(exportOptions);
const endTime = Date.now();
const durationMs = endTime - startTime;
expect(durationMs).toBeLessThan(30_000); // 30 seconds
console.log(`[PERF] export_duration_ms=${durationMs}`);
```

**Method C — Instruments for Bottleneck Analysis**
1. Open Instruments > Time Profiler
2. Attach to FFmpeg process (or run via Instruments from the beginning)
3. Look for where FFmpeg spends the most time:
   - Decoding input (HEVC): should be fast with VideoToolbox
   - Applying filters: scaling, padding
   - Encoding output (H.264 libx264): most time here
4. If encoding is slow, consider using VideoToolbox H.264 hardware encoder (`-c:v h264_videotoolbox`)

### Fixture Files Required

| Fixture | Description | How to Create |
|---------|-------------|---------------|
| `fixtures/60s_1080p.mov` | 60-second HEVC lossless 1920x1080 60fps | Record actual session with capture binary |
| `fixtures/60s_4k.mov` | 60-second HEVC lossless 3840x2160 60fps | Record on 4K display |
| `fixtures/600s_1080p.mov` | 10-minute HEVC lossless 1080p | Long recording session |
| `fixtures/cursor_events.json` | 60-second cursor log with 5 clicks | Paired with 60s_1080p fixture |

### What to Measure and Record

| Benchmark | Duration (s) | Date | Build | Platform |
|-----------|-------------|------|-------|----------|
| 60s 1080p MP4 | | | | |
| 60s 4K MP4 | | | | |
| 10min 1080p MP4 | | | | |
| 30s GIF | | | | |
| 60s 1080p with zoom effects | | | | |

---

## 5. Preview Canvas Frame Rate (Konva.js Rendering)

### Definition
Actual rendered frame rate of the Konva.js canvas during video playback preview in the editor, measured in frames per second (fps). Target is to match the monitor refresh rate (typically 60fps or 120fps on ProMotion displays).

### Targets

| Display Type | Pass | Warning | Fail |
|-------------|------|---------|------|
| 60Hz display | >= 58 fps | 45–58 fps | < 45 fps |
| 120Hz ProMotion display | >= 90 fps | 60–90 fps | < 60 fps |
| Jank (frame > 33ms) | < 5% of frames | 5–10% | > 10% |
| Frame drop during background change | 0 frames dropped | 1–2 frames | > 2 frames |

**Background complexity impact:**
- Solid color: minimal rendering cost, should easily hit refresh rate
- Gradient: moderate cost, CSS or Canvas gradient
- Image background: higher cost — must be pre-scaled to canvas size
- Blur background: highest cost — must be pre-computed and cached

### Measurement Method

**Method A — Chrome DevTools Performance Profiler**
1. Open Electron DevTools (`Cmd+Option+I` in development build)
2. Go to Performance tab
3. Click Record
4. Play the preview video for 10 seconds
5. Click Stop
6. In the "Frames" track, count frames and identify long frames (orange/red)
7. Read "Frames per second" from the summary panel

**Method B — Custom FPS Counter in Renderer**
```typescript
// Add to PreviewCanvas.tsx during development/testing:
let frameCount = 0;
let lastTime = performance.now();

function countFrame() {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    console.log(`[PERF] preview_fps=${frameCount}`);
    frameCount = 0;
    lastTime = now;
  }
  requestAnimationFrame(countFrame);
}
requestAnimationFrame(countFrame);
```

**Method C — Instruments Core Animation**
1. Open Instruments > Core Animation (or "Animation Hitches")
2. Select the Screen Studio renderer process
3. Start recording while preview is playing
4. Check "Display Refresh" vs "Commit Transaction" timing
5. Identify any "hitch" frames (frame took longer than one display interval)

### Canvas Rendering Cost Breakdown

Test each background type individually to identify which is most expensive:

| Background Type | Expected FPS | Acceptable FPS | Measurement |
|----------------|-------------|----------------|-------------|
| Solid color | 60+ | 58+ | DevTools Performance |
| Gradient (CSS) | 60+ | 55+ | DevTools Performance |
| Image (pre-cached) | 60+ | 50+ | DevTools Performance |
| Blur (pre-computed) | 60+ | 45+ | DevTools Performance |
| Blur (live) | NOT ACCEPTABLE | — | Must be pre-computed |

### What to Measure and Record

| Metric | Value | Background Type | Date | Build |
|--------|-------|----------------|------|-------|
| Average FPS during playback | | solid | | |
| Average FPS during playback | | gradient | | |
| Average FPS during playback | | image | | |
| Average FPS during playback | | blur | | |
| % frames > 33ms (jank) | | solid | | |
| % frames > 33ms (jank) | | image | | |
| Memory growth over 10-min playback | | any | | |

---

## 6. Recording Frame Drop Rate

### Definition
Percentage of video frames that are dropped (not captured) during a screen recording session. Dropped frames reduce visual fidelity of the recording. Measured by comparing the expected frame count (duration × fps) with the actual frame count in the output file.

### Targets

| Condition | Pass | Warning | Fail |
|-----------|------|---------|------|
| 60fps recording (normal desktop activity) | < 0.1% frames dropped | 0.1–1% | > 1% |
| 60fps recording (heavy GPU load on screen) | < 1% frames dropped | 1–5% | > 5% |
| 30fps recording | < 0.05% frames dropped | 0.05–0.5% | > 0.5% |

**Note:** Some frame drops are expected during macOS transitions (Mission Control, Spotlight) as ScreenCaptureKit may skip frames during those moments.

### Measurement Method

**Step 1 — Record a test session**
Record a 60-second session with known desktop activity (e.g., scrolling a webpage at constant speed).

**Step 2 — Count frames with ffprobe**
```bash
ffprobe -v quiet -select_streams v:0 \
  -count_packets -show_entries stream=nb_read_packets \
  -of csv=p=0 capture.mov
```
This returns the total number of video packets (frames) in the file.

**Step 3 — Calculate expected frames**
`expected_frames = recording_duration_seconds × fps`

**Step 4 — Calculate drop rate**
`drop_rate = (expected_frames - actual_frames) / expected_frames × 100%`

**Step 5 — Inspect for timestamps**
Use ffprobe to check for timestamp gaps (frames where PTS jumps by more than 2× the expected interval):
```bash
ffprobe -v quiet -select_streams v:0 \
  -show_entries packet=pts_time \
  -of csv=p=0 capture.mov | \
  awk 'NR>1 {diff=$1-prev; if(diff>0.05) print "Gap at "prev"s: "diff"s"} {prev=$1}'
```

### What to Measure and Record

| Metric | Value | Condition | Date | Build |
|--------|-------|-----------|------|-------|
| Expected frames (60s @60fps) | 3600 | | | |
| Actual frames captured | | Normal desktop | | |
| Actual frames captured | | Heavy GPU load | | |
| Drop rate (normal) | | | | |
| Drop rate (heavy GPU) | | | | |
| Max timestamp gap found | | | | |

---

## 7. IPC Round-Trip Latency

### Definition
Time from when the renderer sends an IPC message to when it receives the response from the main process. Measured for the most critical IPC channels.

### Targets

| Channel | Pass | Warning | Fail |
|---------|------|---------|------|
| `recording:start` → `recording:status` (first status) | < 500 ms | 500ms–2s | > 2s |
| `recording:stop` → `recording:status` (processing state) | < 200 ms | 200ms–500ms | > 500ms |
| `export:start` → first `export:progress` | < 2s | 2s–5s | > 5s |
| Any general IPC round-trip (echo test) | < 10 ms | 10–50 ms | > 50 ms |

**Note:** `recording:start` involves spawning the Swift binary, which has process startup overhead. The 500ms budget accounts for this.

### Measurement Method

**Integration Test (Vitest)**
```typescript
import { performance } from 'perf_hooks';

test('IPC roundtrip latency', async () => {
  const start = performance.now();
  
  await ipcRenderer.invoke('recording:start', { displayId: 0 });
  
  const latency = performance.now() - start;
  console.log(`[PERF] ipc_start_latency_ms=${latency.toFixed(2)}`);
  expect(latency).toBeLessThan(500);
});
```

**Manual Measurement with DevTools**
1. Open Electron DevTools
2. In Console, use `performance.mark()` before and after IPC calls
3. Use `performance.measure()` to calculate duration

### What to Measure and Record

| Channel | Latency (ms) | Date | Build |
|---------|-------------|------|-------|
| `recording:start` → first status | | | |
| `recording:stop` → processing state | | | |
| `export:start` → first progress | | | |
| Echo IPC round-trip (p50) | | | |
| Echo IPC round-trip (p99) | | | |

---

## 8. Performance Regression Tracking

### Benchmark History Table

Append a row every time benchmarks are measured (at each Phase and each major build).

| Date | Build | Phase | Startup (s) | Idle Mem (MB) | CPU Recording (%) | Export 60s (s) | Preview FPS |
|------|-------|-------|------------|--------------|-----------------|----------------|-------------|
| | | | | | | | |

### Regression Alerts

A **performance regression** is defined as any single metric worsening by more than:
- Startup time: +0.5 seconds
- Idle memory: +50 MB
- CPU during recording: +10 percentage points
- Export time: +20% for the same fixture
- Preview FPS: -10 fps

When a regression is detected:
1. File a bug with Severity = High if it crosses a Warning threshold
2. File a bug with Severity = Critical if it crosses a Fail threshold
3. Block the release until the regression is investigated and either fixed or explicitly accepted with documented rationale

---

## 9. Running All Benchmarks

### Quick Benchmark Suite (CI)
The following benchmarks can be automated in CI on every pull request:
- Startup time (via console log instrumentation): `npm run bench:startup`
- IPC round-trip latency (Vitest integration test): `npm run test:integration -- --grep perf`
- Export duration for 60s fixture (integration test): `npm run bench:export`
- Vitest unit test suite duration (should stay under 2 minutes): `time npm run test:unit`

### Full Benchmark Suite (Pre-Release)
Run manually on physical hardware before each Phase release:
1. App startup time (5 cold launches, report median)
2. Memory at idle (Activity Monitor, 60 seconds settled)
3. CPU during 5-minute recording (Activity Monitor or Instruments)
4. Thermal behavior during 10-minute recording (powermetrics)
5. Export benchmark: 60s 1080p MP4 (3 runs, report median)
6. Export benchmark: 10-minute 1080p MP4 (1 run)
7. Preview FPS with each background type (DevTools Performance)
8. Recording frame drop rate (ffprobe frame count)
9. IPC latency (integration test)
10. Memory after export cycle (Instruments Allocations leak check)

Record all results in the Phase release test run report (e.g., `RESULTS/PHASE1_RUN_001.md`).
