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
# Find the right tsconfig and run type check
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

**Rust/Anchor projects:**
```bash
# If Anchor.toml exists at project root
anchor build 2>&1 | tail -10
anchor test 2>&1
```

**General:**
```bash
# If package.json has a test script
npm test 2>&1 | tail -30
# or
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

## 5. Report

If there are any issues, blockers, or things the user should be aware of, surface them now before committing.
