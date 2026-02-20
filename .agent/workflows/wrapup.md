---
description: Wrap up current progress. Review, test, and clean up before committing.
---

# Wrapup

As we finish the current feature/implementation/progress:

## 1. Code Quality Review

Review all changes made in this session to ensure:
- Implemented correctly according to solid SWE standards and best practices for the relevant stack
- Reasonable error catching and handling throughout
- No security issues (hardcoded secrets, unsafe operations, unvalidated inputs)

## 2. Run Automated Checks

Run all relevant automated checks. Detect what applies to this project and run accordingly:

**TypeScript/JavaScript projects:**
```bash
# This is a pnpm monorepo — always use pnpm, never npm/npx for installs
# Scope tsc to the mobile app to avoid monorepo-wide compilation hangs
timeout 90 pnpm --filter @monolith/mobile exec tsc --noEmit --skipLibCheck 2>&1; echo "EXIT=$?"
```

**Rust/Anchor projects:**
```bash
# If Anchor.toml exists at project root
anchor build 2>&1 | tail -10
anchor test 2>&1
```

**General:**
```bash
# This project uses pnpm — never use npm directly
pnpm test 2>&1 | tail -30
```

Only run the checks that are relevant to the project. If a check doesn't exist or isn't configured, skip it.

## 3. Test Coverage

If the project uses tests, ensure that all new code has thorough tests:
- New functions/modules have corresponding unit tests
- Edge cases and error paths are covered
- All existing tests still pass

## 4. Clean Up

Remove any dead code or leftover artifacts:
- Delete unused imports, variables, and functions
- Remove commented-out code that was part of experimentation
- Remove any duplicate implementations (e.g., if you tried multiple approaches, keep only the final one)
- Ensure no debug logs or temporary code remain

## 5. Update CONTEXT.md

Update the project's living state document (`CONTEXT.md` at project root):

1. **Current State**: Move completed features between Working/Mocked/Not Started sections
2. **File Map**: Add any new core files created this session (skip test files, minor helpers)
3. **Gotchas**: Add any new critical patterns discovered
4. **System Dependencies**: Add any new "Change X → Must Update Y" relationships discovered
5. **Recent Changes**: Add a 1-line summary of this session's work at the top (format: `- **YYYY-MM-DD**: description`)

Use Edit tool to update specific sections — don't rewrite the entire file.

## 6. Report

If there are any issues, blockers, or things the user should be aware of, surface them now before committing.

## 7. Verify Git Status

Before declaring wrapup complete, check if changes are properly staged/committed:

```bash
timeout 10 git status --short
timeout 10 git log --oneline -1
```

If files are staged but not committed, attempt commit. If the commit command hangs for >10 seconds, verify it succeeded anyway by checking `git log -1` — git commits can succeed even when the terminal doesn't return to prompt.

