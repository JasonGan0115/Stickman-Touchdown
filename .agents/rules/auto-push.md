---
description: Stage, commit, and push verified changes to GitHub after QA or explicit approval
---

After completing and verifying code changes in this workspace:
1. Ensure automated checks (`game-testing`) and live verification (`game-qa`, or explicit user approval for small/non-UI fixes) have passed before pushing, since pushing to `origin` triggers production auto-deploys on Render and Netlify.
2. Run `git status -s` to confirm only intended project files are modified/added (never commit `.env`, `tmp_user_data/`, `video/*.mp4` drafts unless intended, or ignored/scratch artifacts).
3. Stage only the intended files explicitly (`git add <files>`)—avoid blind `git add -A`—and commit with a concise, descriptive message (`git commit -m "..."`).
4. If an `origin` remote is configured (`git remote get-url origin`), run `git push` so Render and Netlify auto-deploy. If `origin` is not configured yet, remind the user to paste their GitHub repo URL.
