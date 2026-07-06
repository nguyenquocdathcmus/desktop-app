# Test Run Report — Phase 1, Run 001

**Date:**
**Version:** Phase 1 MVP (v0.1.0)
**Tester:**
**Build:** (commit hash)
**Environment:** macOS XX.X, Apple Silicon M_ / Intel
**Branch:** main (or release/phase1)
**Test Plan Version:** 1.0

---

## Scope

This is the first test run for Phase 1. It covers all P0 and P1 test cases in the recording, IPC, preview canvas, export, project file, and code signing categories. Phase 2 and Phase 3 test cases are out of scope for this run.

**Phase 1 Entry Criteria Verification:**
- [ ] Swift `capture` binary compiles and runs on test machine
- [ ] Electron app launches without errors
- [ ] Basic IPC contract (`ipc-types.ts`) implemented
- [ ] At least one display can be selected in the DisplayPicker

If any entry criterion is not met, this test run cannot begin. Document the blocking issue and file a bug.

---

## Summary

| Total | Pass | Fail | Blocked | Not Run |
|-------|------|------|---------|---------|
| 36    | 0    | 0    | 0       | 36      |

**Pass Rate:** — (not yet run)

---

## Test Cases for This Run

### Priority 1: Recording (P0 first)

| TC ID | Test Case Name | Type | Priority | Status | Tester | Date | Notes |
|-------|----------------|------|----------|--------|--------|------|-------|
| TC-025 | All Binaries Correctly Signed | Manual | P0 | Not Run | | | Must pass before any other test |
| TC-026 | Universal Binary Architecture Check | Integration | P0 | Not Run | | | Run on both architectures |
| TC-036 | FFmpeg Universal Binary Functional Test | Integration | P0 | Not Run | | | |
| TC-005 | Screen Recording Permission Denied | Manual | P0 | Not Run | | | Use dedicated test account |
| TC-004 | Accessibility Permission Denied | Integration | P0 | Not Run | | | Use dedicated test account |
| TC-007 | State Machine Transitions (Unit) | Unit | P0 | Not Run | | | Run in Vitest |
| TC-001 | Start Recording Happy Path | E2E | P0 | Not Run | | | |
| TC-002 | Stop Recording and Verify Output File | Integration | P0 | Not Run | | | Requires TC-001 passing |
| TC-003 | Cursor JSON Stream Format | Integration | P0 | Not Run | | | |
| TC-040 | Clean Shutdown During Recording | Manual | P0 | Not Run | | | |
| TC-032 | CPU Usage During Active Recording | Performance | P0 | Not Run | | | Use Instruments |
| TC-010 | Renderer Cannot Access Node.js APIs | Security | P0 | Not Run | | | |
| TC-027 | Child Process Spawn Only From Main Process | Security | P0 | Not Run | | | Code review |
| TC-009 | Typed Channel Roundtrip | Integration | P0 | Not Run | | | |
| TC-011 | Solid Background Rendering | E2E | P0 | Not Run | | | |
| TC-016 | MP4 Export Happy Path | E2E | P0 | Not Run | | | |
| TC-017 | FFmpeg Command Construction (Unit) | Unit | P0 | Not Run | | | |
| TC-018 | FFmpeg Path Injection Prevention | Security | P0 | Not Run | | | |
| TC-021 | Save Project (.screenstudio Bundle) | E2E | P0 | Not Run | | | |
| TC-022 | Open Saved Project | E2E | P0 | Not Run | | | Requires TC-021 |
| TC-023 | Manifest Serialization Round-Trip | Unit | P0 | Not Run | | | |
| TC-037 | 60-Second 1080p Export Performance | Performance | P0 | Not Run | | | Requires fixture file |

### Priority 2: P1 Test Cases

| TC ID | Test Case Name | Type | Priority | Status | Tester | Date | Notes |
|-------|----------------|------|----------|--------|--------|------|-------|
| TC-006 | Multiple Displays Available | E2E | P1 | Not Run | | | Mark Blocked if only 1 display |
| TC-008 | App Recovery After Crash | Manual | P1 | Not Run | | | |
| TC-012 | Gradient Background Rendering | E2E | P1 | Not Run | | | |
| TC-013 | Image Background Rendering | E2E | P1 | Not Run | | | |
| TC-014 | Blur Background Rendering | E2E | P1 | Not Run | | | |
| TC-015 | Padding Controls | E2E | P1 | Not Run | | | |
| TC-019 | Export Progress IPC Events | Integration | P1 | Not Run | | | |
| TC-020 | Export Cancelled Midway | Integration | P1 | Not Run | | | |
| TC-024 | Corrupted Manifest Handling | Integration | P1 | Not Run | | | |
| TC-028 | Microphone Recording Integration | Integration | P1 | Not Run | | | |
| TC-029 | App Startup Time to Interactive | Performance | P1 | Not Run | | | |
| TC-030 | Memory Usage at Idle | Performance | P1 | Not Run | | | |
| TC-031 | Privacy Manifest Validation | Manual | P1 | Not Run | | | macOS 15+ only |
| TC-033 | Microphone Permission Denied | Manual | P1 | Not Run | | | |
| TC-034 | Display Picker No Display | Unit | P1 | Not Run | | | |
| TC-035 | Recording Store State Integrity | Unit | P1 | Not Run | | | |
| TC-038 | Konva Rendering Performance | Performance | P1 | Not Run | | | |
| TC-039 | Save to Read-Only Location | Integration | P1 | Not Run | | | |

---

## Recommended Test Execution Order

Run in this sequence to catch blocking issues early:

**Day 1 — Build Validation (before functional testing)**
1. TC-025: Code signing validation — if this fails, all on-device tests are blocked
2. TC-026: Universal binary check — fail here = blocked on target architecture
3. TC-036: FFmpeg functional test — fail here = all export tests blocked
4. TC-027: Renderer process security — code review, no device needed

**Day 1 — Unit Tests (can run in parallel with device tests)**
5. TC-007: State machine unit tests (Vitest)
6. TC-017: FFmpeg command construction unit test (Vitest)
7. TC-018: FFmpeg path injection unit test (Vitest)
8. TC-023: Manifest serialization unit test (Vitest)
9. TC-034: Display picker unit test (Vitest)
10. TC-035: Recording store unit test (Vitest)

**Day 2 — Permission Testing (use dedicated test accounts)**
11. TC-005: Screen Recording permission denied
12. TC-004: Accessibility permission denied
13. TC-033: Microphone permission denied

**Day 2 — Core Recording Flow**
14. TC-001: Start recording happy path
15. TC-002: Stop recording and verify output
16. TC-003: Cursor JSON stream format
17. TC-009: IPC typed channel roundtrip
18. TC-010: Renderer Node.js API access check

**Day 3 — Preview Canvas**
19. TC-011: Solid background rendering
20. TC-012: Gradient background rendering
21. TC-013: Image background rendering
22. TC-014: Blur background rendering
23. TC-015: Padding controls

**Day 3 — Export Pipeline**
24. TC-016: MP4 export happy path
25. TC-019: Export progress IPC events
26. TC-020: Export cancelled midway
27. TC-039: Save to read-only location

**Day 4 — Project File**
28. TC-021: Save project bundle
29. TC-022: Open saved project
30. TC-024: Corrupted manifest handling

**Day 4 — Performance**
31. TC-029: App startup time
32. TC-030: Memory at idle
33. TC-032: CPU during recording
34. TC-037: 60-second export performance
35. TC-038: Konva canvas performance

**Day 5 — Miscellaneous and Cleanup**
36. TC-006: Multiple displays (if hardware available)
37. TC-008: Crash recovery
38. TC-028: Microphone recording
39. TC-031: Privacy manifest (macOS 15+)
40. TC-040: Clean shutdown during recording

---

## Phase 1 Exit Criteria Checklist

Complete this checklist at the end of the test run to determine Go/No-Go for Phase 1 release.

**Required (all must be checked):**
- [ ] All 22 P0 test cases: PASS
- [ ] At least 13 of 18 P1 test cases (80%): PASS
- [ ] No Critical severity bugs open
- [ ] No High severity bugs blocking the core recording-to-export workflow
- [ ] TC-001 (Start Recording) passes on both Apple Silicon and Intel
- [ ] TC-016 (MP4 Export) produces a playable file verified by QuickTime
- [ ] TC-021/TC-022 (Project Save/Open) round-trip preserves all settings
- [ ] TC-032 (CPU during recording): average CPU < 30%
- [ ] TC-037 (Export performance): 60-second 1080p export < 30 seconds on Apple Silicon
- [ ] TC-029 (Startup): app interactive within 2 seconds

**Phase 1 Release Decision:**

| Criterion | Result | Met? |
|-----------|--------|------|
| All P0 tests pass | / 22 | |
| P1 tests 80% pass | / 18 | |
| No open Critical bugs | | |
| No open blocking High bugs | | |
| Recording works on Apple Silicon | | |
| Recording works on Intel | | |
| MP4 export produces valid file | | |
| Project save/open round-trip | | |
| CPU < 30% during recording | | |
| Export < 30 seconds (60s clip) | | |
| Startup < 2 seconds | | |

**Overall Decision:** Go / No-Go

---

## Bugs Found

| ID | Title | Severity | Priority | Status | Component | TC Found In |
|----|-------|----------|----------|--------|-----------|-------------|
| | | | | | | |

---

## Automated Test Results

### Vitest Unit Tests
```
Test Files:
Tests:
Duration:
Coverage:
```

### Playwright E2E Tests
```
Results:
Duration:
```

### XCTest (Swift capture binary)
```
Results:
```

### XCTest (Swift cursor-tracker binary)
```
Results:
```

---

## Environment

- macOS Version:
- Architecture:
- Xcode Version:
- Node.js Version:
- FFmpeg Version:
- Swift Version:
- Electron Version:
- React Version:

---

## Observations and Notes

<!-- Fill in during or after testing -->

---

## Sign-Off

| Role | Name | Date | Decision |
|------|------|------|----------|
| QA Tester | | | |
| QA Lead | | | Go / No-Go |
| Dev Lead | | | Acknowledged |
