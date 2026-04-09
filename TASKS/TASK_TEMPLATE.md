# Task: [TASK_NAME]

## Status

- [ ] Pending
- [ ] In Progress
- [ ] Verified
- [ ] Complete

## Pillars

### 1. Model

<!-- haiku (simple) | sonnet (default) | opus (complex reasoning) -->

sonnet

### 2. Tools Required

- [ ] Read, Edit, Write (file operations)
- [ ] Bash: `[specific commands]`
- [ ] Grep, Glob (search)
- [ ] WebFetch (external docs)
- [ ] Task (sub-agents)

### 3. Guardrails (DO NOT)

- [ ] Do NOT modify: [protected files]
- [ ] Do NOT delete: [protected data]
- [ ] Do NOT expose: [secrets, PII]
- [ ] Do NOT skip: [tests, validation]

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] PROJECT_SCOPE.md
- [ ] Specific files: [list]
- [ ] External docs: [URLs]
- [ ] Current state audit: [run ui-reviewer/code-reviewer first if modifying existing code]

### 5. Memory

- [ ] Load instincts: [names]
- [x] N/A (fresh context)

### 6. Success Criteria

- [ ] Criterion 1: [exact measurable check]
- [ ] Criterion 2: [exact measurable check]
- [ ] Verification command: `[command that returns 0 on success]`

### 7. Dependencies

- [ ] Task [ID] must be complete
- [ ] File [path] must exist
- [ ] Service [name] must be running
- [ ] None (can start immediately)

### 8. Failure Handling

**Max attempts:** 3

**On failure (per attempt):**

- [ ] Retry with same approach
- [ ] Retry with different approach
- [ ] Rollback: `git checkout HEAD~1`

**After max attempts exhausted:**

- [ ] Save error to `ERRORS/[task-name].md` and STOP
- [ ] Save error and SKIP to next task
- [ ] Escalate to human immediately

**Rollback command:** `git stash && git checkout HEAD~1`

**Error log format:**

```markdown
## Failed Task: [TASK_NAME]

**Attempts:** 3/3
**Last error:** [error message]
**Tried approaches:**

1. [what was tried]
2. [what was tried]
3. [what was tried]
   **Suggested fix:** [if known]
   **Files affected:** [list]
   **Rollback performed:** yes/no
```

### 9. Learning

**Log to LEARNINGS.md if:**

- [ ] Unexpected error encountered
- [ ] Workaround discovered
- [ ] External API behaved differently than documented
- [ ] Performance issue found

---

## Human Checkpoint

- [ ] **NONE** - proceed automatically
- [ ] **REQUIRED** - approval needed (migrations, deployments, destructive ops)

---

## Description

<!-- One paragraph: what this task accomplishes. Single outcome. -->

## Acceptance Criteria

<!-- When is this task DONE? Be specific. -->

- [ ] [Specific deliverable 1]
- [ ] [Specific deliverable 2]

## Steps (high-level, /plan will expand)

1. [Step]
2. [Step]

## On Completion

- **Commit:** `[type]: [description]`
- **Update:** [ ] PROJECT_SCOPE.md [ ] CLAUDE.md
- **Handoff notes:** [What next task needs to know - keep minimal]

## Notes

<!-- Implementation decisions, questions, blockers -->
