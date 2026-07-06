# BUG-[ID]: [Title]

**Reported By:**
**Date:**
**Severity:** Critical / High / Medium / Low
**Priority:** P0 / P1 / P2
**Status:** Open / In Progress / Fixed / Verified / Closed
**Version Found:**
**Version Fixed:**
**Assignee:**
**Test Case:** TC-XXX (if found during a test case)

---

## Environment

- macOS:
- Architecture: Apple Silicon M_ / Intel
- App Version:
- Build: (commit hash or build number)
- Electron Version:
- Node.js Version:
- Xcode Version (if Swift-related):

---

## Description

<!-- A concise one-paragraph description of the bug. What is the wrong behavior, and why is it a problem? -->

---

## Steps to Reproduce

1.
2.
3.
4.
5.

**Reproducibility:** Always / Intermittent (X/10 times) / Only once

---

## Expected Behavior

<!-- What should happen according to the spec, test case, or user expectation? -->

---

## Actual Behavior

<!-- What actually happens? Be specific — include error messages, wrong values, missing UI elements. -->

---

## Screenshots / Logs

<!-- Attach screenshots, screen recordings, or log excerpts below. -->
<!-- For crash logs: attach the full .crash file from ~/Library/Logs/DiagnosticReports/ -->
<!-- For console errors: paste the relevant Electron console output or main process log -->

```
[Paste log output here]
```

---

## Impact Assessment

**Who is affected:** All users / Users with X configuration / Intel users only / etc.
**Frequency:** Every session / Specific conditions / Rare
**Data loss risk:** Yes / No
**Security risk:** Yes / No (explain if yes)
**Workaround available:** Yes (describe) / No

---

## Root Cause

<!-- To be filled by the developer investigating the bug -->
<!-- Include file name, line number, and a brief explanation of why it happened -->

**File:**
**Line:**
**Cause:**

---

## Fix Description

<!-- To be filled by the developer after fixing -->
<!-- Describe what was changed and why the fix resolves the root cause -->

**Commit:**
**Files Changed:**
**Fix Summary:**

---

## Verification Steps

<!-- How QA should verify the fix is working -->

1.
2.
3.

**Verification Result:** Pass / Fail
**Verified By:**
**Verified Date:**

---

# Example Bug Reports (for reference — delete when using this template)

---

# BUG-001: capture binary exits with code 0 but produces empty MOV file when Screen Recording permission was previously granted then revoked

**Reported By:** QA Team
**Date:** 2026-06-29
**Severity:** Critical
**Priority:** P0
**Status:** Open
**Version Found:** 0.1.0-alpha
**Version Fixed:**
**Assignee:**
**Test Case:** TC-005

## Environment
- macOS: 14.5 (Sonoma)
- Architecture: Apple Silicon M3
- App Version: 0.1.0-alpha
- Build: abc123

## Description
When Screen Recording permission is revoked from System Settings after having been previously granted, the `capture` binary exits with code 0 (success) but produces a MOV file of 0 bytes. The Electron app interprets the 0 exit code as success and attempts to open the 0-byte file in the editor, resulting in an unhandled exception.

## Steps to Reproduce
1. Grant Screen Recording permission on first launch
2. Start a recording once to confirm it works
3. Go to System Settings > Privacy & Security > Screen Recording
4. Remove the app from the list
5. Return to the app and start a new recording
6. Wait 5 seconds, stop recording

**Reproducibility:** Always

## Expected Behavior
- App detects that capture failed (0-byte output or ScreenCaptureKit error)
- User sees: "Screen Recording permission is required. Please re-grant it in System Settings."
- State machine returns to `idle` without leaving a 0-byte file on disk

## Actual Behavior
- `capture` binary exits with code 0
- 0-byte `capture.mov` is left in the session directory
- Electron app attempts to open the file in the editor
- Unhandled rejection: `FFmpegWrapper: Input file has no streams`
- App shows a blank editor window with a spinner that never stops

## Impact Assessment
**Who is affected:** Any user who revokes Screen Recording permission
**Frequency:** Every time permission is revoked mid-session
**Data loss risk:** No (no actual data captured)
**Security risk:** No
**Workaround available:** Quit and relaunch the app

## Root Cause
<!-- To be investigated -->

## Fix Description
<!-- To be filled after investigation -->

## Verification Steps
1. Follow reproduction steps above
2. Verify error dialog appears with correct message
3. Verify state machine returns to `idle`
4. Verify no 0-byte file remains on disk
5. Verify re-granting permission allows recording to succeed without app restart

---

# BUG-002: Cursor position in exported video drifts 50px right on Retina displays

**Reported By:** QA Team
**Date:** 2026-06-29
**Severity:** High
**Priority:** P1
**Status:** Open
**Version Found:** 0.1.0-alpha
**Version Fixed:**
**Assignee:**
**Test Case:** TC-044, TC-046

## Environment
- macOS: 14.5 (Sonoma)
- Architecture: Apple Silicon M3
- Display: Built-in Retina (2560x1600 logical 1280x800)
- App Version: 0.1.0-alpha
- Build: def456

## Description
When exporting a recording made on a Retina display, the cursor overlay position is consistently 50 pixels to the right of the actual cursor position in the recording. This is visible throughout the export, affecting the visual quality of the zoom/pan and cursor highlight effects.

## Steps to Reproduce
1. On a MacBook with Retina display, start a recording
2. Move the cursor to the left edge of the screen
3. Stop recording
4. Export to MP4
5. Play the exported video and observe cursor position

**Reproducibility:** Always on Retina displays

## Expected Behavior
- Cursor overlay is centered exactly on the actual cursor position (tolerance ±2px)

## Actual Behavior
- Cursor overlay is consistently ~50px to the right of actual cursor position
- Drift is constant (not proportional to cursor position), suggesting a fixed offset bug

## Impact Assessment
**Who is affected:** All users with Retina/HiDPI displays (virtually all modern Mac users)
**Frequency:** Every export on Retina display
**Data loss risk:** No
**Security risk:** No
**Workaround available:** No

## Root Cause
<!-- Hypothesis: cursor coordinates from CGEventTap are in logical (point) space, but video frame coordinates are in pixel space (2x on Retina). A missing scale factor multiplication in CursorOverlay rendering is the likely cause. -->

## Fix Description
<!-- To be filled after investigation -->

## Verification Steps
1. Record cursor at left edge, center, and right edge of Retina display
2. Export and verify cursor overlay is within 2px of actual position at all three positions
3. Verify on non-Retina display (Intel Mac with external 1080p monitor) that fix doesn't break non-Retina case
