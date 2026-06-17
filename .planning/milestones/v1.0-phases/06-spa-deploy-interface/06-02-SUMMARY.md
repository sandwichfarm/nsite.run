---
phase: 06-spa-deploy-interface
plan: 02
subsystem: lib
tags: [crypto, files, scanner, vitest, fflate, nanotar, secret-scanning, tdd]

# Dependency graph
requires: ["06-01"]
provides:
  - "apps/spa/src/lib/crypto.js — SHA-256 hashing via WebCrypto"
  - "apps/spa/src/lib/files.js — ZIP/TAR.GZ extraction, file tree builder, VCS auto-exclude"
  - "apps/spa/src/lib/scanner.js — Dangerous filename and secret content pattern scanning"
  - "61 unit tests covering all non-browser-API paths"
affects: [06-03, 06-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fflate unzip callback pattern: Promise wrapper around unzip(Uint8Array, cb)"
    - "nanotar parseTar: filter e.type === 'file' || undefined for file-only entries"
    - "ZIP root prefix stripping: detect single shared top-level dir and strip it"
    - "File tree builder: Map-based recursive insertion, sortNodes dirs-first alphabetical"
    - "Scanner binary skip: BINARY_EXTENSIONS regex checked before TextDecoder"
    - "SECRET_CONTENT_PATTERNS: reset re.lastIndex after each global regex test"
    - "TDD RED-GREEN pattern: tests written first, verified failing, then implementation"

key-files:
  created:
    - "apps/spa/src/lib/crypto.js"
    - "apps/spa/src/lib/files.js"
    - "apps/spa/src/lib/scanner.js"
    - "apps/spa/src/lib/__tests__/files.test.js"
    - "apps/spa/src/lib/__tests__/scanner.test.js"
  modified: []

key-decisions:
  - "ZIP prefix stripping: only strip when ALL files share a single top-level dir — prevents stripping when files are already at root"
  - "nanotar type filter: accept type === 'file' OR type === undefined (nanotar omits type for regular files)"
  - "scanFilename uses basename only — full path passed in, but only last path component is pattern-matched"
  - "scanFileContent skips binary extensions before TextDecoder to avoid false positives and performance hit"
  - "GitHub token test fixture fixed from 34 chars to 36 chars to match real PAT format"

patterns-established:
  - "TDD with test fixtures: use fflate zip() in test setup to create roundtrip ZIP fixtures"
  - "nanotar createTar + fflate gzip() to create TAR.GZ test fixtures"
  - "Scanner content patterns: always reset re.lastIndex=0 after global regex test"

requirements-completed: [SPA-04, SPA-05, SPA-06, SPA-07, SPA-08]

# Metrics
duration: 4min
completed: 2026-03-17
---

# Phase 6 Plan 02: File Processing and Secret Scanning Library Summary

**ZIP/TAR.GZ extraction, file tree builder, and client-side secret scanner implemented with 61 unit tests — all passing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T12:40:35Z
- **Completed:** 2026-03-17T12:44:52Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- crypto.js: SHA-256 hashing via WebCrypto `crypto.subtle.digest`, returns hex string
- files.js: ZIP extraction with common root prefix stripping, TAR.GZ extraction, VCS auto-exclude (`autoExcludeVCS`), nested file tree builder (`buildFileTree`), browser folder and archive pickers
- scanner.js: 21 dangerous filename patterns, 14 secret content patterns, binary extension skip, `scanFilename`, `scanFileContent`, `scanFiles` integration function
- files.test.js: 21 tests — extractZip (6), extractTarGz (3), autoExcludeVCS (5), buildFileTree (6), edge cases
- scanner.test.js: 40 tests — constants (3), scanFilename (11), scanFileContent (15), scanFiles (5) plus warning structure tests
- Full test suite: 86 tests across 5 test files, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: crypto.js + files.js + files.test.js** — `b6c4ca6` (feat)
2. **Task 2: scanner.js + scanner.test.js** — `f01ae2c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/spa/src/lib/crypto.js` — hashFile(ArrayBuffer): WebCrypto SHA-256 → hex string
- `apps/spa/src/lib/files.js` — extractZip, extractTarGz, autoExcludeVCS, buildFileTree, pickDirectory, pickArchive, readDirectoryHandle
- `apps/spa/src/lib/scanner.js` — DANGEROUS_FILENAME_PATTERNS, SECRET_CONTENT_PATTERNS, AUTO_EXCLUDE_DIRS, scanFilename, scanFileContent, scanFiles
- `apps/spa/src/lib/__tests__/files.test.js` — 21 unit tests using fflate zip + nanotar createTar fixtures
- `apps/spa/src/lib/__tests__/scanner.test.js` — 40 unit tests with ArrayBuffer fixtures

## Decisions Made

- ZIP prefix stripping only applied when ALL files share the same single top-level directory — prevents accidental stripping when archive already has flat structure
- nanotar `parseTar` returns entries with `type === undefined` for regular files (not `type === 'file'`) — filter accepts both to ensure compatibility
- `scanFilename` extracts basename from path for pattern matching — enables scanning paths like `/deep/path/.env` correctly
- Binary extension check before TextDecoder prevents false positives on image/font/binary files and avoids performance hit
- GitHub token regex requires 36+ chars after `ghp_` prefix — test fixture corrected from 34 to 36 chars to match real PAT format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed GitHub token test fixture length**
- **Found during:** Task 2 (scanner.test.js)
- **Issue:** Test used `ghp_ABCDEFghijklmnop1234567890abcdefgh` (34 chars after prefix), but regex requires 36+ chars per actual GitHub PAT format
- **Fix:** Updated test fixture to use 36-char token: `ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij`
- **Files modified:** `apps/spa/src/lib/__tests__/scanner.test.js`
- **Commit:** f01ae2c

---

**Total deviations:** 1 auto-fixed (1 bug in test fixture)
**Impact on plan:** None — implementation was correct, test fixture was wrong.

## Issues Encountered

None — implementation and tests passed after the test fixture correction.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- crypto.js hashFile ready for use in upload.js (BUD-02 blob hash)
- files.js extractors ready for use in DeployZone component
- scanner.js ready for use in FileTree component (warning icons, exclude checkboxes)
- All non-browser-API paths covered by 61 unit tests
- Browser API paths (pickDirectory, pickArchive, readDirectoryHandle) deferred to manual browser testing

---
*Phase: 06-spa-deploy-interface*
*Completed: 2026-03-17*

## Self-Check: PASSED

All 5 source files found on disk. Both task commits (b6c4ca6, f01ae2c) confirmed in git log.
