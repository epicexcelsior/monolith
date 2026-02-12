---
description: Analyze the current conversation and suggest improvements to skills and workflows for better automation.
---

# Improve Workflows

Review the current conversation to identify opportunities for workflow improvements.

## What to Analyze

1. **Pain Points**: Look for repeated manual steps, errors that required backtracking, or tedious patterns
2. **Missing Automation**: Identify tasks that could be automated with a skill or workflow
3. **Existing Skill Gaps**: Check if installed skills could have helped but weren't triggered (description issue)
4. **New Skill/Workflow Opportunities**: Suggest new skills and workflows (slash commands) based on the work done (prefer improvements that can be applied globally).

## Output Format

Provide a structured analysis:

### Pain Points Identified

- List specific friction points from this conversation

### Suggested Improvements

#### New Skills to Create

For each suggestion:

- **Name**: skill-name
- **Description**: What it would do
- **Trigger**: When the LLM should activate it

#### Workflow Updates

- Changes to existing `/commit`, `/wrapup`, `/learn`, and other workflows (both global and project-specific)

#### Skill Updates

- Improvements to installed skills (better descriptions, missing examples)

### Quick Wins

- Immediate changes that can be applied now

## Execution

After analysis, ask the user:

1. Which improvements to implement now?
2. Which to save for later?

Then proceed with approved changes using the skill-creator skill if creating new skills.
