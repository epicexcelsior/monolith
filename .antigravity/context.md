---
description: Load project context
---

Before starting work, the agent should orient themselves with the current project by finding and reading key documentation.

1. **Locate Context Files**:
   - Look for high-level documentation files in the project root or `docs/` folder.
   - Priority files: `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/CONTEXT.md` (and any other relevant ones you find).
   - Use `find_by_name` or `list_dir` if needed to discover them.

2. **Read Context**:
   - Read the content of the identified priority files.

3. **Acknowledge**:
   - Summarize the project's core specificities, tech stack, and current goals.
   - If `AGENTS.md` exists, check for any recent "Lessons Learned" or "Current Focus" sections.

4. **Missing Context**:
   - If no substantial context is found, kindly ask the user for a brief overview or if they would like to generate an `AGENTS.md` file.
