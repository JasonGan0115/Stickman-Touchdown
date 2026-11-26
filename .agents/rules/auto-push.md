---
description: Always stage, commit, and push to GitHub after verified code changes
---

After completing and verifying code changes in this workspace:
1. Run `git status -s` to confirm only intended project files are modified/added (never commit `.env` or ignored artifacts).
2. Stage and commit the changes with a concise, descriptive commit message (`git add -A && git commit -m "..."`).
3. If an `origin` remote is configured (`git remote get-url origin`), run `git push` so Render and Netlify auto-deploy. If `origin` is not configured yet, remind the user to paste their GitHub repo URL.
