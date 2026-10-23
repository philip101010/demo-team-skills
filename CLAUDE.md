# demo-team-skills: working context

This folder is the working folder for one product: the `demo-team-roster` Claude Code plugin and the skills in it. Work here, not in any demo project folder (`C:\Projects\Workspaces\*`). Never edit another project's files for a test; use a throwaway folder and clean it up.

Owner and language: the user writes Ukrainian; reply in Ukrainian. Files, code, commits, README and artifacts are in English.

## What the product is

A plugin that helps run Creatio demo builds with a team of parallel chats (an orchestrator plus helpers):

- Skill `new-demo-team` (`skills/new-demo-team/`): from a fresh chat creates the project folder, sidebar group, helper sessions, orchestrator role, wave 0, roadmap and approvals. Writes `_orchestration/roster.json`.
- Skill `team-board` (`skills/team-board/`, command `/team-board`): puts a project's roster on the Demo Team Roster dashboard artifact; revives it from "Stopped"; `all` refreshes every project. Holds `scripts/collect.py` and `assets/dashboard.html`.
- Mod (the Team widget): a **Team** tab with one card per member (pixel knight, name with the count of its finished tasks (from its task files) and percent, bar, elapsed and ETA, task, step or blocker; an empty value is a dash so the card never changes shape), `/team` toggle, chip above the prompt, `roster_step` tool for progress, `team_snapshot` tool (all projects, read-only), task-file fallback for progress. Code in `hooks/register.tsx`, `hooks/sprites.ts`, contract in `types/index.d.ts`.
  - The project card above the members (`summarySvg`, `projSummary` in `register.tsx`): stage (`Stage:` line of `STATE.md`), tasks verified of all, in review, blocked, pending approvals of `APPROVALS.md` ("waiting for you"), and time left. Time left is computed from the open tasks' `Estimate` by `Wave` (a wave takes its longest task or its total over its performers, waves in turn), corrected by real over estimated hours of finished tasks (`Started`/`Finished`); unknown without any estimate. Task files are read by one parser (`loadTasks`): header keys Status, Performer, Priority, Wave, Estimate, Started, Finished, Depends on, Blocker (English or Ukrainian) and the body's checkboxes (a member's progress when it sends no `roster_step`; a `Blocker:` line or a blocked status shows in red on its performer's card). `review` is a status between in-progress and done; only a reviewer sets `done` (protocol section 12). The same summary rides in `live-<slug>.json` and on the dashboard.
  - Who is on the team: `_orchestration/roster.json` (in the chat's folder, or found by chat id in sibling folders, `config.json` `workspaces` and a sibling `Workspaces`), else the chats this chat started (`get_session self` plus `list_sessions` with `linked: true`, `startedBy` equal to me). The lead is the chat that shows the pane.
  - The card is one SVG (`cardSvg` in `sprites.ts`, 264x94 plus a 10px gap), shown by the pane as an `Svg` and by the dashboard as an `<img>` data URI with `cardSvg(m, true)` (the olive and bone palette).
  - Live data for the dashboard: the pane of a watching chat (lead or fork, not a listed helper) in a project folder writes what it shows to `~/.claude/demo-team-roster/live-<slug>.json` (members, tasks, `generatedAt`); `team_snapshot` reads those files (plus its own folder scan, which may find nothing: a chat cannot read other projects' folders). A project is live while its lead's chat is open; otherwise the file just ages.
- Dashboard artifact: https://claude.ai/artifact/Ff1LqznXwT46ff9qr4ZJoU (private, owner only), the Papers, Please look with the same cards. Without Go live it shows the saved snapshot (written by `/team-board`, can be hours old; its age is on each project). With Go live it reads `team_snapshot` every 5 seconds and takes, per project, the newest of the live file and the snapshot; a project is "live" when its file is under 45 seconds old, the header says how many of them update. Capabilities `db` and `mcp` (`host:demo-team-roster`, tool `team_snapshot`). DB collection `projects`, one doc per project slug, field `watching: false` means stopped. The board URL is saved in `~/.claude/demo-team-roster/config.json`.

Plugin name is `demo-team-roster` (the mod's state key must equal the plugin name). Marketplace is `demo-team-skills` (`.claude-plugin/marketplace.json`), repo `philip101010/demo-team-skills`, branch `main`.

## Files

- `hooks/register.tsx`: the mod. `makeTools($)` builds readers (roster, session metadata, `list_sessions`, task files, snapshot). It is a top-level factory because tool hooks run outside `session.start` and cannot see its closure.
- `hooks/register.test.tsx`, `hooks/linked.test.tsx`, `hooks/snapshot.test.tsx`: tests for the pane (roster file and linked chats; they read the card markup from the `Svg` element's `props.source` and `props.alt`) and the snapshot tool.
- `tools/dashboard.src.html` + `tools/build-dashboard.mjs` build `skills/team-board/assets/dashboard.html` (inlines the sprite code from `hooks/sprites.ts`). Run `node tools/build-dashboard.mjs` from the repo root after editing either.
- `skills/new-demo-team/scripts/kb.py` (+ `test_kb.py`, run `python -I skills/new-demo-team/scripts/test_kb.py`): the knowledge base of the teams. `harvest` reads every project's task files (read-only) into `~/.claude/demo-team-roster/knowledge/tasks.jsonl`, `predict --type T --guess H` corrects an estimate from history, `calibrate` prints real against estimated hours, first-pass rate and rework causes by type, `lint --project DIR` checks a project's task files against the protocol (errors in a `Protocol: 2` project, warnings in older ones). `skills/new-demo-team/references/upgrade-running-project.md` is the procedure for moving a running project to the new protocol (only when the user decides; this chat never edits a project).
- `skills/team-board/scripts/collect.py`: collects roster, state and tasks for the dashboard. Args: `--project DIR`, `--running id1,id2|none` (ids from `list_sessions`), `--outdir DIR`.

## The improvement loop (the maintainer's side)

The user cares first about quality, then about the orchestrator and helpers working well together, and only then about speed and the visuals (the widget and dashboard are for the user's own view). The system learns from every project; this chat is where it is turned into a better protocol:
- At the start of work here, read `~/.claude/demo-team-roster/knowledge/LESSONS.md` and the `_orchestration/LESSONS.md` of recent projects (read only), and run `kb.py harvest` then `kb.py calibrate` to see the data.
- Fold what is proven (a lesson repeated, or a rework cause that keeps coming back) into `protocol.md`, `templates.md` or the skills, add a test or a rule where one fits, and ship a new version. Note why in the commit.
- When the user says something went wrong in a project, record it as a lesson here too: the rule, not the story.
- Do not edit a running project's `PROTOCOL.md`; new projects start from the new one.

## Release loop

1. Edit. Keep line endings as they are; Git on this machine converts LF/CRLF.
2. `claude plugin validate .` (warnings are expected, `✘` is not). Read its result before the bump: a chain that pipes it through `tail` goes on after a failure (0.3.5 was pushed with a broken types contract that way).
3. Run `python -I skills/new-demo-team/scripts/test_kb.py` when `kb.py` changed, and the mod tests from a copy outside the repo, because the harness writes next to the test files: copy `hooks`, `types`, `.claude-plugin` to a temp folder and run `claude plugin test <folder>`. Tests mount the pane on several widths and validate the tree the way the engine does.
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
- Inside the mod, `$.tool.call` for `list_sessions` without `linked` came back as an error text, not JSON, and a session's metadata json was not found (`meta 0/3`). Do not rely on either. Use the `linked: true` list (it carries `isRunning`, `title`, `cwd`, `startedBy`) and read replies with `textOf` (text, or `result.text`). Never switch a check off forever after one failure.
- `roster_step` writes the helper's progress under its engine id and under its app id (`local_...`, from `get_session self`); the watcher reads the app id first, so it needs no metadata.
- The pane lays text in character-cell rows (about 18px), so a dense card cannot be built from `Text`. Draw the card as one `Svg`: its width and height are CSS px, the drawing takes its own width up to the slot (31 columns is about 264px; a wider design is scaled down, text with it). The `Svg` is an image: no page fonts, no theme tokens (colors follow `prefers-color-scheme` inside it), so cut long text by hand.
- A temporary diagnostics line in the pane (poll count, source, running of N, meta found, last error) found three bugs in minutes. Do it again when the pane shows something the data does not explain, and remove it after.
- Your own session id is only from `get_session self`. The "Linked sessions now" reminder names the session that started you, not you; using it sent every helper's report to nowhere.
- The pane test can time out (5s) when the machine is busy; a rerun passes. Check the output, not only the last line.
- A live progress test needs real work: a helper told to use `Start-Sleep` cannot (the environment blocks it); give it real work (reading files, one tool call per step).
- The dashboard "Go live" path (page calls `host:demo-team-roster` through the desktop app, owner only) is published but was not seen working in a real app yet. The first press asks for consent.

## Open items

- Verify "Go live" in the desktop app; read the reason in the header if it falls back to the snapshot.
- Helpers report progress only if told. Tested 2026-10-22: a helper told to use `roster_step` (and to load it with ToolSearch first) does; one without the instruction falls back to its task file. Still no reliable way without telling it (helper prompt template wording, or a way around the skipped `prompt.compose` hook).
- Check the card's look in the real pane at 31 columns and in the wide case after each change; the mockup widgets and the browser preview are not the engine.
- Publish the mod to the organization library only after the user has seen it work and says so.
- Credits: sprite construction comes from savvy-progress by johnnyvizz (MIT); keep the README credit.

## Working agreements

- Confirm before deleting or overwriting anything that is not your own scratch file; look at the target first.
- Tests with helper chats: only when the user allows it, in a throwaway folder outside any demo project, archive the chats and delete the folder afterwards.
- Do not touch demo projects (Golden, SGH, others) except to read them or to write a roster the user asked for.
