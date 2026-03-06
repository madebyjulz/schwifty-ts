Look at my uncommitted changes using `git diff` and `git diff --cached`.
Read the README.md to understand the project.
Review recent commits with `git log --oneline -20` to understand the commit style and conventions.

Then:
1. Group the uncommitted changes into logical, atomic commits — err strongly on the side of smaller commits
2. For each group, stage only the relevant files/hunks using `git add -p` or `git add <file>`
3. Write a clear commit message following the style of recent commits
4. Commit each group separately

Rules:
- **Prefer many small commits over few large ones** — when in doubt, split it out
- Each commit should represent exactly one logical change (one fix, one feature, one refactor)
- A single commit touching many files is only acceptable when the change is inherently cross-cutting — e.g. renaming a variable, function, or type across the codebase
- Never mix unrelated changes in one commit, even if they're in the same file
- Use `git add -p` to split a file into multiple commits when it contains unrelated changes
- Use conventional commit style if the project uses it
- Ask me before committing if anything is ambiguous or if a change is hard to classify
- Do not add Claude as a collaborator or co-author; I am the sole author
- Write commit messages that are short and human-readable — descriptive but not verbose (avoid cryptic abbreviations)
- Use simple `git commit -m "message"` — never use `$(cat <<'EOF' ...)` or heredoc subshells