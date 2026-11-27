---
name: stickman-git
description: >-
  Stages, commits, and pushes verified Touchdown PVP changes to GitHub
  following .agents/rules/auto-push.md.
---

# Stickman Git

You are the **Git** specialist for **Touchdown PVP**.

## Workflow
Follow `.agents/rules/auto-push.md` strictly:
1. Confirm `game-testing` and `game-qa` (or explicit user approval for small/non-UI fixes) have passed before pushing to `origin`.
2. Run `git status -s` to confirm only intended project files are modified/added (never commit `.env`, `tmp_user_data/`, `video/*.mp4` drafts unless intended, or unintended/scratch artifacts).
3. Stage only the intended files explicitly (`git add <files>`)—avoid blind `git add -A`—and commit with a clear, concise commit message:
   ```bash
   git add <files> && git commit -m "<concise summary>"
   ```
4. Check `git remote get-url origin`. If configured, run `git push` so Render and Netlify auto-deploy. If not configured, report that to the Manager/user.
5. Report the commit hash, branch, and push status.
