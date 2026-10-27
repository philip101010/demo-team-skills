# Changelog

Versions of the `demo-team-roster` plugin, newest first. Details are in the git history.

## 0.8.0 (2026-10-27): closed-task statistics instead of a progress bar
- A member card shows what it has closed: the count by the name, the share that passed the review first time, one square per closed task (green first time, amber after one rework, red after more, grey no review data), "N closed · M today", and time on the current task against its estimate. The progress bar is gone.

## 0.7.x (2026-10-23): the protocol checked by a tool
- `kb.py lint`: finds what the protocol forbids (a task done without `Verified by`, verified by its own performer, unticked acceptance, no evidence, a high-risk task without an approved plan, no estimate). Errors in a `Protocol: 2` project, warnings in older ones.
- A project now carries its own copy of the tool (`_orchestration/kb.py`); the canonical roadmap and task templates live only in `PROTOCOL.md`; `upgrade-running-project.md` moves a running project to protocol 2.
- `new-demo-team` description shortened to what the skill is and when to use it; the workflow stays in the body.

## 0.6 and 0.7.0 (2026-10-23): quality gates and a learning loop
- Protocol sections 12 to 14: stage and time left, `review` before `done`, a reviewer who is never the author, wave exit gates, final verification, read-back, plan before build for risky tasks, assumptions, a fixed report format, rework categories, wave retro, lessons.
- `kb.py` (harvest, predict, calibrate): real against estimated hours by task type, first-pass rate and rework causes across projects; estimates are corrected from history.
- Project card above the members: stage, tasks verified of all, blocked, waiting for the user, time left from estimates by wave. Blockers and steps are read from task files.
- Tasks the user types into a chat get a task file at once.

## 0.5 (2026-10-22 to 10-23): live dashboard data
- Each watching Team pane publishes `live-<project>.json`; `team_snapshot` reads those files; the dashboard takes the newest per project and shows its age instead of a false "Live".
- Count of finished tasks beside each member's name.

## 0.4 (2026-10-22): the card
- One SVG card per member (knight, name and percent, bar, elapsed and ETA, task, step or blocker, dashes for empty values), drawn at the pane's real width; knights animate out of step; the dashboard uses the same cards in its own palette, the orchestrator's in amber.

## 0.3 (2026-10-22): finding the team
- The pane finds the roster by chat id, or builds the team from the chats this chat started (a fork of the lead is not a helper); working state from the linked list; progress stored under the app id; a failed `list_sessions` call is retried.

## 0.1 and 0.2 (2026-10-15 to 10-22)
- `new-demo-team` skill, the Team widget and the dashboard packaged as one plugin; `roster_step` progress tool; task-file fallback for progress; `team_snapshot` tool; `team-board` skill.
