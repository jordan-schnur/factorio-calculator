# Merging (MUST follow)

- Every merge lands green: `npm run verify` (all checks, then the whole e2e suite) passes on the merged result, with zero failed tests.
- Run it after the merge commit, on the target branch, before calling the work done. A unit passing on its own branch is not enough.
- A flaky test is a failing test. Fix its cause (in the app or the test), never rerun until it passes and move on.
- Never `test.skip` or `test.fixme` a test to get green, and never `--update-snapshots` without saying which snapshots changed and why.
- `scripts/rules-baseline.json` only goes down; never edit it upward.
