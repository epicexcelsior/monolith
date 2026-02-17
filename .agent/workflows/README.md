# Monolith Workflows & Skills

This project uses a unified workflow system shared with Antigravity.

## Available Commands

### Global (all projects)
- `/commit` — Pre-commit checks, conventional commits, push
- `/wrapup` — Quality audit, tests, cleanup
- `/context` — Load project docs
- `/improve` — Suggest workflow improvements
- `/learn` — Log lessons to AGENTS.md
- `/interview` — Requirements interview
- `/solana-dev` — Solana development playbook
- `/frontend-design` — Production UI generation

### Monolith-Specific
- `/perf` — 3D tower performance audit (geometry, shaders, lights, particles)
- `/build` — Build/install mobile app (debug, hot reload, APK)
- `/anchor-test` — Build + test Anchor program, sync IDL to mobile
- `/ui-standards` — Check solarpunk design system compliance

## How It Works

**Global workflows**: `~/.workflows/*.md` (shared content)
**Global skills**: `~/.agents/skills/*/SKILL.md` (import workflows via `@~/.workflows/*.md`)
**Project workflows**: `.agent/workflows/*.md` (monolith-specific)
**Project skills**: `.claude/skills/*/SKILL.md` (import via `@../../.agent/workflows/*.md`)

Both Claude Code and Antigravity symlink to the same shared directories.

## Adding a Project Workflow

```bash
# 1. Create the workflow file
nano .agent/workflows/my-thing.md

# 2. Create the skill wrapper
mkdir -p .claude/skills/my-thing
cat > .claude/skills/my-thing/SKILL.md << 'EOF'
---
name: my-thing
description: What it does.
---

@../../.agent/workflows/my-thing.md
EOF

# 3. Use it: /my-thing
```

## Documentation

- `~/.workflows/README.md` — Complete system architecture
- `~/.workflows/setup.sh` — Re-sync everything if needed
- MEMORY.md — Project-specific workflow notes
