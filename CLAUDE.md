# CLAUDE.md

## Daily routine

Each task has its own short name (for example: chat-language).

When I say "good night" or "eod":
1. Make sure the project builds successfully.
2. Write .claude/handoffs/<task-name>.md with: what we finished, files
   changed, decisions made, anything unfinished or buggy, the next step,
   and the branch name.
3. Commit and push this branch.
4. Tell me in 2-3 lines what we did and whether it's ready to merge
   into main.

When I say "good morning <task-name>":
1. Find .claude/handoffs/<task-name>.md on its branch and switch to
   that branch.
2. Check whether main has new changes since; if so, bring them in first.
3. Summarize where we left off and the next step in 2-3 lines, then
   wait for me to say go.

When I say "new task <task-name>":
1. Start a new branch from the latest main.
2. Ask me what the task is before making changes.

When I say "done <task-name>":
1. Make sure it builds, then open a pull request into main.
2. Delete .claude/handoffs/<task-name>.md in that pull request.

## Safety rules

1. Never lose or alter users' saved data (progress, history, scores,
   settings). Any change to the data format needs a migration that
   converts old data.
2. Never commit API keys or passwords to the repo.
3. If this builds an APK: never change the applicationId or signing
   key, and increase versionCode and versionName with every release.
4. Before changing how anything is scored, graded, or calculated, show
   me before/after results on sample data.
5. New work goes on a branch; merge to main only when the build passes.
6. Live sites must keep working. This project may be deployed on GitHub
   Pages and/or Render.
   - Don't change the GitHub Pages settings, base path, or deploy
     workflow, or Render's build command, start command, render.yaml, or
     environment variable names, without asking me first.
   - Never hardcode URLs or keys that the live site gets from environment
     variables.
   - Before saying a task is done, confirm the build that GitHub Pages or
     Render runs will succeed.
   - During "good night", tell me if anything we changed affects the live
     site, so I can check it after merging.
