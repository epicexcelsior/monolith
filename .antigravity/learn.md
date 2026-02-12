---
description: Log recent learnings and lessons to guide future development
---

When the user wants to document a lesson, gotcha, or important discovery for the future:

1. **Identify Documentation File**:
   - Look for an existing file or docs folder designated for agent knowledge or developer notes.
   - Priority: `AGENTS.md`, `docs/LEARNINGS.md`, `docs/DEVELOPMENT.md` etc.
   - If none exist, propose creating `AGENTS.md` and/or docs folder in the root.

2. **Format the Lesson**:
   - **Date**: YYYY-MM-DD
   - **User Input**: Ask the user to describe the lesson in 1-2 sentences if not already provided.
   - **Section**: Add under "## Recent Lessons Learned" or a similar relevant section.

3. **Update File**:
   - Append the lesson to the file.
   - Format: `- **YYYY-MM-DD**: [Description of lesson]`

4. **Commit (Optional)**:
   - If inside a git repo, offer to commit: `docs: update lessons learned`
