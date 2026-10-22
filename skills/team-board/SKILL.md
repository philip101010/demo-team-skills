---
name: team-board
description: Add the current demo project's team roster to the Demo Team Roster dashboard (an artifact), or move it from "Stopped" back to "Watching" if it was already there; with "all" refresh every project. Use when the user types /team-board, or says "add the roster to the board/dashboard", "update the dashboard", "оновити дашборд", "додай ростер на борд".
user-invocable: true
---

# team-board

Put a project's roster on the Demo Team Roster dashboard. Safe to repeat: it checks first, then creates, revives or refreshes.

Reply in the user's language. Files and commands stay in English.

`<skill dir>` below is this skill's base directory, given when the skill loads.

## Inputs

- Board URL: `boardUrl` in `~/.claude/demo-team-roster/config.json`. When the file is missing, create the board once (step 0).
- Project: the folder whose `_orchestration/roster.json` belongs to this session. Resolve in this order: an explicit path or project name in the arguments; the working directory if it holds `_orchestration/roster.json`; otherwise the parents of the working directory up to `C:\Projects\Workspaces`. Nothing found: say there is no roster here (`new-demo-team` writes it) and stop.
- Argument `all`: every project under `C:\Projects\Workspaces` that has a roster.

## Steps

0. First run only. Publish `<skill dir>/assets/dashboard.html` with the Artifact tool: `capabilities: {"db": {}}`, title "Demo Team Roster", icon `dashboard`, a one-sentence description. Save the returned URL as `{"boardUrl": "<url>"}` in `~/.claude/demo-team-roster/config.json` (create the folder). The board is private to the user; sharing is theirs to do from the Share menu.
1. Collect the project document(s) into the scratchpad, never into the project folder:

   ```
   python -I "<skill dir>/scripts/collect.py" --project "<project folder>" --outdir "<scratchpad>/board"
   ```

   Leave out `--project` for `all`. It prints one slug per project and exits 3 when no roster matched.
2. For each slug read the board document with `ArtifactData` `get`, collection `projects`, `doc_id` = slug.
   - Missing: read `<scratchpad>/board/proj-<slug>.json`, add `"watching": true`, `set` it. Report "added".
   - Present with `watching: false`: `update` with the file's content plus `"watching": true`, pinned to the `version` you read. Report "moved back to Watching".
   - Present and watching: `update` with the file's content only (keeps the field), pinned. Report "refreshed".
   - For `all`, leave `watching: false` documents alone and say how many were skipped.
   Use one `batch` when there is more than one write.
3. Give the board URL and one short line per project saying what happened. Do not paste JSON.

## Notes

- A project the user stopped watching returns only when they name it, and then it is revived (step 2).
- "Working" is judged from the session's activity in the last 90 seconds, so a refresh is a snapshot, not a live feed.
- The documents hold names, roles, classes, task titles and progress only. Never write secrets or transcripts to the board.
