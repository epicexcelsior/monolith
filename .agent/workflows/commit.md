---
description: Commit changes to GitHub with pre-commit checks.
---

# Commit

## 1. Pre-Commit Checks

Before committing, run relevant automated checks to catch issues:

**TypeScript/JavaScript projects:**
```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

**Rust/Anchor projects:**
```bash
anchor build 2>&1 | tail -5
```

**General tests (if configured):**
```bash
npm test 2>&1 | tail -20
```

If any checks fail, fix the issues before proceeding. Skip checks that aren't relevant to the project.

## 2. Review Changes

```bash
git status
git diff --stat
```

Ensure:
- Only intended files are being committed
- No sensitive files (`.env`, keys, secrets) are staged
- `.gitignore` is up to date for any new build artifacts
- No unrelated changes are being bundled in

If there are other uncommitted changes the user should be aware of, mention them.

## 3. Stage and Commit

```bash
git add <relevant files>
git commit -m "<type>: <concise description>

<optional body with details>"
```

Use conventional commit types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`.

Write adequate descriptions — the commit message should explain **what** changed and **why** at a glance.

## 4. Push

```bash
git push origin <current-branch>
```

If using WSL, prefer `git push` directly. Fall back to `gh` CLI if git credentials aren't configured.
