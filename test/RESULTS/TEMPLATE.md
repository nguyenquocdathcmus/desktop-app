# Test Run Report

**Date:**
**Version:**
**Tester:**
**Build:** (commit hash or build number)
**Environment:** macOS XX.X, Apple Silicon M_ / Intel
**Branch:**
**Test Plan Version:** 1.0

---

## Summary

| Total | Pass | Fail | Blocked | Not Run |
|-------|------|------|---------|---------|
| 0     | 0    | 0    | 0       | 0       |

**Pass Rate:** 0% (Pass / (Total - Not Run - Blocked))

---

## Results by Feature

### Recording
| TC ID | Test Case Name | Type | Priority | Status | Notes |
|-------|----------------|------|----------|--------|-------|
| TC-001 | Start Recording Happy Path | E2E | P0 | Not Run | |
| TC-002 | Stop Recording and Verify Output File | Integration | P0 | Not Run | |
| TC-003 | Cursor JSON Stream Format | Integration | P0 | Not Run | |
| TC-004 | Accessibility Permission Denied | Integration | P0 | Not Run | |
| TC-005 | Screen Recording Permission Denied | Manual | P0 | Not Run | |
| TC-006 | Multiple Displays Available | E2E | P1 | Not Run | |
| TC-007 | State Machine Transitions | Unit | P0 | Not Run | |
| TC-008 | App Recovery After Crash During Recording | Manual | P1 | Not Run | |
| TC-028 | Microphone Recording Integration | Integration | P1 | Not Run | |
| TC-032 | CPU Usage During Active Recording | Performance | P0 | Not Run | |
| TC-033 | Microphone Permission Denied | Manual | P1 | Not Run | |
| TC-040 | Clean Shutdown During Recording | Manual | P0 | Not Run | |

### IPC and Security
| TC ID | Test Case Name | Type | Priority | Status | Notes |
|-------|----------------|------|----------|--------|-------|
| TC-009 | Typed Channel Roundtrip | Integration | P0 | Not Run | |
| TC-010 | Renderer Cannot Access Node.js APIs | Security | P0 | Not Run | |
| TC-027 | Child Process Spawn Only From Main Process | Security | P0 | Not Run | |

### Preview Canvas
| TC ID | Test Case Name | Type | Priority | Status | Notes |
|-------|----------------|------|----------|--------|-------|
| TC-011 | Solid Background Rendering | E2E | P0 | Not Run | |
| TC-012 | Gradient Background Rendering | E2E | P1 | Not Run | |
| TC-013 | Image Background Rendering | E2E | P1 | Not Run | |
| TC-014 | Blur Background Rendering | E2E | P1 | Not Run | |
| TC-015 | Padding Controls | E2E | P1 | Not Run | |
| TC-038 | Konva Rendering Performance | Performance | P1 | Not Run | |

### Export
| TC ID | Test Case Name | Type | Priority | Status | Notes |
|-------|----------------|------|----------|--------|-------|
| TC-016 | MP4 Export Happy Path | E2E | P0 | Not Run | |
| TC-017 | FFmpeg Command Construction | Unit | P0 | Not Run | |
| TC-018 | FFmpeg Path Injection Prevention | Security | P0 | Not Run | |
| TC-019 | Export Progress IPC Events | Integration | P1 | Not Run | |
| TC-020 | Export Cancelled Midway | Integration | P1 | Not Run | |
| TC-037 | 60-Second 1080p Export Performance | Performance | P0 | Not Run | |
| TC-039 | Save to Read-Only Location Handling | Integration | P1 | Not Run | |

### Project File
| TC ID | Test Case Name | Type | Priority | Status | Notes |
|-------|----------------|------|----------|--------|-------|
| TC-021 | Save Project (.screenstudio Bundle) | E2E | P0 | Not Run | |
| TC-022 | Open Saved Project | E2E | P0 | Not Run | |
| TC-023 | Manifest Serialization Round-Trip | Unit | P0 | Not Run | |
| TC-024 | Corrupted Manifest Handling | Integration | P1 | Not Run | |

### Code Signing and Build
| TC ID | Test Case Name | Type | Priority | Status | Notes |
|-------|----------------|------|----------|--------|-------|
| TC-025 | All Binaries Correctly Signed | Manual | P0 | Not Run | |
| TC-026 | Universal Binary Architecture Check | Integration | P0 | Not Run | |
| TC-031 | Privacy Manifest Validation | Manual | P1 | Not Run | |
| TC-036 | FFmpeg Universal Binary Functional Test | Integration | P0 | Not Run | |

### App Performance and Startup
| TC ID | Test Case Name | Type | Priority | Status | Notes |
|-------|----------------|------|----------|--------|-------|
| TC-029 | App Startup Time to Interactive | Performance | P1 | Not Run | |
| TC-030 | Memory Usage at Idle | Performance | P1 | Not Run | |

### State Management
| TC ID | Test Case Name | Type | Priority | Status | Notes |
|-------|----------------|------|----------|--------|-------|
| TC-034 | Display Picker Handles No Display | Unit | P1 | Not Run | |
| TC-035 | Recording Store State Integrity | Unit | P1 | Not Run | |

### Phase 2 — Effects
| TC ID | Test Case Name | Type | Priority | Status | Notes |
|-------|----------------|------|----------|--------|-------|
| TC-041 | ZoomPathGenerator Unit Test | Unit | P0 | Not Run | |
| TC-042 | Spring Physics Convergence | Unit | P0 | Not Run | |
| TC-043 | Cursor Smoother Accuracy | Unit | P1 | Not Run | |
| TC-044 | Cursor Highlight Position Accuracy | E2E | P0 | Not Run | |
| TC-045 | Click Ripple Animation | E2E | P1 | Not Run | |
| TC-046 | Cursor Desync Detection | Integration | P0 | Not Run | |
| TC-047 | Frosted Glass Blur Export Quality | Manual | P1 | Not Run | |
| TC-048 | Keyboard Shortcut Overlay | Manual | P1 | Not Run | |
| TC-049 | Zoom Renderer Metal Shader Validation | Integration | P0 | Not Run | |
| TC-050 | Device Frame SVG Overlay | E2E | P2 | Not Run | |

### Phase 3 — Polish
| TC ID | Test Case Name | Type | Priority | Status | Notes |
|-------|----------------|------|----------|--------|-------|
| TC-081 | Timeline Trim Handle Accuracy | E2E | P0 | Not Run | |
| TC-082 | Timeline Playhead Scrubbing | E2E | P1 | Not Run | |
| TC-083 | Zoom Event Track Visualization | E2E | P1 | Not Run | |
| TC-084 | GIF Export Palette Generation | Integration | P0 | Not Run | |
| TC-085 | GIF gifsicle Optimization | Integration | P1 | Not Run | |
| TC-086 | Webcam Overlay in Export | Integration | P1 | Not Run | |
| TC-087 | All Social Media Presets | Integration | P0 | Not Run | |
| TC-088 | Auto-Update Detection | Integration | P1 | Not Run | |
| TC-089 | Audio Waveform in Timeline | E2E | P1 | Not Run | |
| TC-090 | Full Regression Smoke Test | E2E | P0 | Not Run | |

---

## Detailed Results (Fail and Blocked only)

### Failures

<!-- Document each failing test case in detail below -->

#### TC-XXX: [Test Case Name]
**Status:** Fail
**Failure Description:**
**Steps Taken:**
**Actual vs Expected:**
**Bug Report Filed:** BUG-XXX
**Screenshot/Log Path:**

---

### Blocked Test Cases

<!-- Document each blocked test case and the reason -->

#### TC-XXX: [Test Case Name]
**Status:** Blocked
**Blocking Reason:**
**Depends On:**
**Unblocked When:**

---

## Bugs Found

| ID | Title | Severity | Priority | Status | Component |
|----|-------|----------|----------|--------|-----------|
| BUG-001 | | | | Open | |

---

## Automated Test Results

### Vitest Unit Tests
```
Test Files:  X passed, X failed (X total)
Tests:       X passed, X failed, X skipped (X total)
Duration:    X.XXs
Coverage:    XX% lines, XX% branches, XX% functions
```

### Playwright E2E Tests
```
X passed, X failed, X skipped (X total)
Duration: Xm Xs
```

### XCTest (Swift)
```
Test Suite 'All tests' started
Test Suite 'capture' started
  X test cases run, X passed, X failed
Test Suite 'cursor-tracker' started
  X test cases run, X passed, X failed
```

---

## Environment Details

- macOS Version:
- Architecture: Apple Silicon M_ / Intel
- Xcode Version:
- Node.js Version:
- FFmpeg Version: (from `./bin/ffmpeg/ffmpeg -version`)
- Swift Version: (from `swift --version`)
- Memory Available:
- Disk Space Available:

---

## Notes and Observations

<!-- Any additional observations, environmental issues, or anomalies not captured above -->

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Tester | | | |
| QA Lead | | | |
| Dev Lead | | | |

**Release Decision:** Go / No-Go

**Rationale:**
