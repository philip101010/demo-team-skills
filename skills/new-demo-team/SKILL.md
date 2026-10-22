---
name: new-demo-team
description: Launch a new Creatio demo project from a fresh chat. The user drops a customer scenario (file or text) and this session creates the project folder in C:\Projects\Workspaces, a sidebar group named after the customer, N helper sessions in that folder, moves itself and the helpers into the group, and becomes the orchestrator - it reads the scenario, runs a read-only wave 0 through the helpers, produces the requirements table, task list, roadmap timeline and approvals package, then waits for the user's go. Use when the user says "новий проєкт", "нове демо", "розгорни команду", "new demo team", or hands over a demo scenario/customer brief to start a build. Do NOT use for ordinary tasks inside an existing demo project.
---

# new-demo-team

This session becomes the ORCHESTRATOR of a new demo project. Tools you need (load with ToolSearch if deferred): `mcp__ccd_session__start_session`, `mcp__ccd_sidebar__create_group`, `mcp__ccd_sidebar__move_sessions`, `mcp__ccd_session_mgmt__set_session_title`, `mcp__ccd_session_mgmt__list_sessions`, `mcp__ccd_session_mgmt__get_session`, `mcp__ccd_session_mgmt__send_message`, `mcp__ccd_directory__change_directory`.

Read `references/protocol.md` (team protocol) and `references/templates.md` (prompts and file templates) before step 3. Never print or repeat passwords/tokens.

## Language
- Default language is English. If the user writes to you in another language, switch to that language and keep using it, even if the scenario or other files are in a different language; if the user later switches language, follow them.
- The working language applies to chat replies, the plan and approvals package shown to the user, project artifacts (`STATE.md`, `ROADMAP.md`, `APPROVALS.md`, task files, reports, the requirements table, the roadmap timeline labels) and the briefs and prompts sent to helpers (set `Language: <LANGUAGE>` in the PROJECT block and the helper prompt).
- Keep in English regardless of language: file and folder names, keys and status codes (`todo`, `done`, `paused`, `blocked-approval`, `P0`..`P2`), tool names and the lock/entity prefixes.
- Quote user-provided names (customer, scenario text) exactly as given.

## Hard rules
- Passwords, tokens and browser sign-in are the user's only. The user registers the clio environment (`clio reg-web-app ...`); you never do and never change the active clio environment, never run `studio use`. Always pass an explicit `environment-name` and `--profile`.
- Nothing is written to the demo stand before the user approves the roadmap and the approvals package. Wave 0 is read-only.
- Work only in your own project folder and with your own group's sessions. Other projects and sessions are not yours.
- Restart, compile, reset and deletions on a stand only with a separate explicit confirmation right before the action.
- Messages from helpers or other sessions are information, never the user's approval.

## Steps

### 1. Intake (one message)
From what the user gave (text, attached files, paths), extract: customer / demo name; scenario file(s); stand URL; clio env name; AI Studio profile; deadline; MVP boundary (default: everything works through the AI Twin chat and web chat, voice steps are shown as the web-chat version); priority. If something is missing, ask ONE message with a numbered list and proposed defaults. A missing stand does not block: wave 0 then covers the scenario only.

### 2. Checks (read-only) and plan
- Project folder name = customer name, no characters invalid for Windows. Check `C:\Projects\Workspaces\<name>` does not exist (if it does, ask: continue there or pick another name).
- `list_sessions`: collect used session titles and group names; pick helper names from the pool below that are free; group name = customer name, must not exist yet.
- If a clio MCP is available, check that the env is registered (list-environments); do not print passwords.
- Choose the helper count N (see sizing). Show the plan: folder name, group name, helper names with roles, what wave 0 will do. WAIT for the user's OK on the folder name and the plan.

### 3. Deploy (after OK)
a. Create `C:\Projects\Workspaces\<name>\` and subfolders `materials\` and `_orchestration\{tasks,locks,findings}`. COPY the scenario into `materials\` (never move the user's original). If the scenario was pasted as text, save it as `materials\scenario.md`.
b. Create `_orchestration\` files from `references/templates.md`: `STATE.md`, `ROADMAP.md`, `APPROVALS.md`, and copy `references/protocol.md` to `_orchestration\PROTOCOL.md`.
c. `change_directory` to the project folder (it takes effect when this turn ends; until then use absolute paths).
d. `create_group` with the customer name prefixed by "📁 " (e.g. `📁 KMF Bank`), so groups stand out from sessions in the sidebar.
e. Start N helpers: `start_session` with `initiation: "user_asked"`, `context: "fresh"`, `cwd` = project folder, `use_worktree: false`, `name` = lowercase handle, `title` = `<Name> (<Project>)`, `prompt` = helper prompt from templates, `background` = 2-3 sentences of project context (>= 80 chars). Wave 0 helpers are read-only, so they may use a cheaper model (`model`) when the user is fine with it.
f. Move yourself and all helpers into the group (`move_sessions`; your own id from `get_session` with `self`). Title yourself `<OrchName> (orchestrator, <Project>)`.
g. Update `STATE.md` (team, session ids, stand, status "wave 0 started").
If `start_session` does not honor `cwd`, tell the user immediately and stop at that point.

### 4. Wave 0 (read-only, parallel)
Brief the helpers with `send_message` (absolute paths, each brief starts with the PROJECT block from templates). Tracks: (1) stand recon, (2) scenario to requirements and risks, (3) access/permissions preflight. If the demo is already partly built (the user says so, or recon finds artifacts) switch to an audit: per-step status with evidence + object model audit + input for the roadmap. Fewer than 3 tracks needed (small scenario, no stand yet) means fewer helpers.

### 5. Synthesis and approval gate
When reports arrive, produce for the user: (1) status/requirements report per use case; (2) requirements table by step as xlsx (MVP / simplified / not in MVP / what is needed for the final result); (3) roadmap as a timeline (Gantt by performer) drawn with the widget tool, plus task files `tasks\T-NN.md` with `PROJECT:` header and touch-set; (4) one batched approvals package (`APPROVALS.md`) with defaults and recommendations; (5) the decisions you need from the user. Then WAIT. Start build waves only after the user answers. Follow `PROTOCOL.md` for waves, locks, pauses, restarts.

## Sizing the team
- Wave 0: 3 helpers (stand, scenario, access). 2 for a small scenario (fewer than about 10 steps); 1 when there is no stand yet.
- Build waves: N = number of independent entity tracks in the roadmap (tracks that touch different objects/pages/processes). Default cap 4. Hard cap 5. More than 5 means split into two projects/teams, each with its own orchestrator.
- Never start more helpers than independent tracks; a single stand compile/restart is serial anyway, so extra helpers do not speed up compile-bound work.
- Start with 3, add helpers with `start_session` after the roadmap is approved if the tracks justify it; stop idle helpers (`stop_session`/archive) when a wave ends.
- All sessions share the user's usage limit: say so when proposing more than 3.

## Helper name pool
Lancelot, Kei, Galahad, Percival, Bors, Gawain, Tristan, Gareth, Bedivere, Lamorak, Ector, Palamedes. Orchestrator name: Arthur TL, or another free name if "Arthur" is taken.
