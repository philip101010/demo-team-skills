# demo-team-skills: working context

This folder is the working folder for one product: the `demo-team-roster` Claude Code plugin and the skills in it. Work here, not in any demo project folder (`C:\Projects\Workspaces\*`). Never edit another project's files for a test; use a throwaway folder and clean it up.

Owner and language: the user writes Ukrainian; reply in Ukrainian. Files, code, commits, README and artifacts are in English.

## What the product is

A plugin that helps run Creatio demo builds with a team of parallel chats (an orchestrator plus helpers):

- Skill `new-demo-team` (`skills/new-demo-team/`): from a fresh chat creates the project folder, sidebar group, helper sessions, orchestrator role, wave 0, roadmap and approvals. Writes `_orchestration/roster.json`.
- Skill `team-board` (`skills/team-board/`, command `/team-board`): puts a project's roster on the Demo Team Roster dashboard artifact; revives it from "Stopped"; `all` refreshes every project. Holds `scripts/collect.py` and `assets/dashboard.html`.
- Mod (the Team widget): a **Team** tab (pixel knights per helper), `/team` toggle, chip above the prompt, `roster_step` tool for progress, `team_snapshot` tool (all projects, read-only), task-file fallback for progress. Code in `hooks/register.tsx`, `hooks/sprites.ts`, contract in `types/index.d.ts`.
- Dashboard artifact: https://claude.ai/artifact/Ff1LqznXwT46ff9qr4ZJoU (private, owner only). Capabilities `db` and `mcp` (`host:demo-team-roster`, tool `team_snapshot`). DB collection `projects`, one doc per project slug, field `watching: false` means stopped. The board URL is saved in `~/.claude/demo-team-roster/config.json`.

Plugin name is `demo-team-roster` (the mod's state key must equal the plugin name). Marketplace is `demo-team-skills` (`.claude-plugin/marketplace.json`), repo `philip101010/demo-team-skills`, branch `main`.

## Files

- `hooks/register.tsx`: the mod. `makeTools($)` builds readers (roster, session metadata, `list_sessions`, task files, snapshot). It is a top-level factory because tool hooks run outside `session.start` and cannot see its closure.
- `hooks/register.test.tsx`, `hooks/snapshot.test.tsx`: tests for the pane and the snapshot tool.
- `tools/dashboard.src.html` + `tools/build-dashboard.mjs` build `skills/team-board/assets/dashboard.html` (inlines the sprite code from `hooks/sprites.ts`). Run `node tools/build-dashboard.mjs` from the repo root after editing either.
- `skills/team-board/scripts/collect.py`: collects roster, state and tasks for the dashboard. Args: `--project DIR`, `--running id1,id2|none` (ids from `list_sessions`), `--outdir DIR`.

## Release loop

1. Edit. Keep line endings as they are; Git on this machine converts LF/CRLF.
2. `claude plugin validate .` (warnings are expected).
3. Run tests from a copy outside the repo, because the harness writes next to the test files: copy `hooks`, `types`, `.claude-plugin` to a temp folder and run `claude plugin test <folder>`. Tests mount the pane on several widths and validate the tree the way the engine does.
4. Bump `version` in `.claude-plugin/plugin.json`, commit, `git push origin HEAD`.
5. `claude plugin marketplace update demo-team-skills` then `claude plugin update demo-team-roster@demo-team-skills`. The user restarts the app to apply. Never restart for them.
6. Dashboard: `node tools/build-dashboard.mjs`, then publish `skills/team-board/assets/dashboard.html` with the Artifact tool to the URL above and `capabilities {"db": {}, "mcp": {"servers": [{"server": "host:demo-team-roster", "tools": ["team_snapshot"]}]}}`. Data docs are written with `ArtifactData` (pin writes with `if_version`).
7. Commit messages end with the Co-Authored-By line the session gives.

## Lessons (each cost time once)

- A `Box width` must be a number or a whole-number percentage. `33.333%` makes the engine refuse the whole pane ("has not drawn in this pane"). The test catches it.
- A mod in `~/.claude/dev-mods/<session>/` belongs to that one session only. Real use is the installed plugin.
- A helper function that receives `$` must be top-level (validator).
- Tools registered with `$.tool.register` reach the model as deferred tools: it must load the schema with ToolSearch before calling. A progress rule has to say so.
- The hook `prompt.compose` of this plugin is skipped: the engine reports "cc-plugin-sec-default runs first and sent the event on past it". Do not rely on it to brief helpers. Brief helpers through the helper prompt template in `new-demo-team` and through the orchestrator.
- File mtime of a session's metadata json says nothing about work. "Working" comes from `list_sessions` (`isRunning`). Exclude the session that runs the command.
- Progress without reports: the bar falls back to the helper's own task files (done of its own). Task headers may be `Key: value` lines or `A: x | B: y` on one line; English and Ukrainian keys.
- Writing code through shell heredocs mangled backslashes (`\\n`, `\\r`) and once put NUL bytes into a file. Write patch scripts to a file with the Write tool, avoid backslashes in generated code (use `String.fromCharCode(10)`, `chr(92)`), and check `grep -c` for stray bytes before committing.
- A second Merlin-style chat (a fork of the orchestrator) is not in `roster.json`. The widget treats every chat in the project folder that is not a listed helper as a watcher.
- The dashboard "Go live" path (page calls `host:demo-team-roster` through the desktop app, owner only) is published but was not seen working in a real app yet. The first press asks for consent.

## Open items

- Verify "Go live" in the desktop app; read the reason in the header if it falls back to the snapshot.
- Helpers report progress only if told. Find a reliable way (helper prompt template wording, or a way around the skipped `prompt.compose` hook).
- Publish the mod to the organization library only after the user has seen it work and says so.
- Credits: sprite construction comes from savvy-progress by johnnyvizz (MIT); keep the README credit.

## Working agreements

- Confirm before deleting or overwriting anything that is not your own scratch file; look at the target first.
- Tests with helper chats: only when the user allows it, in a throwaway folder outside any demo project, archive the chats and delete the folder afterwards.
- Do not touch demo projects (Golden, SGH, others) except to read them or to write a roster the user asked for.
