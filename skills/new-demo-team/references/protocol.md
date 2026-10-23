# Parallel demo work protocol

Applies to the orchestrator and all parallel chats. One stand, many performers: work is divided by **entities** so tasks do not overlap in time.

Contents: 1 Structure · 2 Roles · 3 Task lifecycle · 4 Rules on a shared stand · 5 Pause on limits · 6 Preflight: permissions and approvals · 7 Demo start · 8 Small task in an existing demo · 9 Conflicts · 10 Report and priorities · 11 Project and team isolation · 12 Where we are, quality gates, verification · 13 Quality and communication · 14 Learning loop · Templates (ROADMAP, task file, lock).

## 1. Structure in the demo folder

```
<demo>/_orchestration/
  ROADMAP.md        # all tasks, dependencies, waves
  tasks/T-NN.md     # one task = one file
  locks/<type>-<name>.lock   # one entity = one lock
```

Entity types for locks: `object-`, `lookup-`, `page-`, `process-`, `aiskill-`, `dashboard-`, `landing-`, `template-`, `data-`, `syssetting-`.
Global (exclusive) locks: `GLOBAL-compile.lock`, `GLOBAL-base-objects.lock`, `GLOBAL-localization.lock`.

## 2. Roles

- **Orchestrator:** stand recon, roadmap, slicing tasks, briefs for chats, lock control, final compile/publish, readiness, ClickPass.
- **Performer chat:** takes a task, works (with its own subagents) strictly within the touch-set, reports into the task file.
- **Chat subagents:** recon, checks, small subtasks. They never go beyond the touch-set.

## 3. Task lifecycle

`todo → claimed → [plan-review, for Risk: high] → in-progress → review → done`
Side states: `blocked` (waiting for a dependency or a lock), `paused` (see section 5), `blocked-approval` (a permission is needed, see section 6), `rework` (the reviewer sent it back, see section 12).
The performer never sets `done` itself: it sets `review`, and a reviewer sets `done` (section 12).

1. Check that all dependencies of the task are `done` and all its approvals are `granted`.
2. Acquire locks on **all** entities of your touch-set. Acquisition is atomic: the lock file is created only if it does not exist yet (`set -o noclobber`). If any lock is taken, release those already acquired and take another task (or wait).
3. Execute. Do not touch entities outside the touch-set. If a need appears: stop, add the entity to the task, acquire its lock, or tell the orchestrator.
4. Write the result and evidence into the task (what changed, how it was verified, links), tick the acceptance boxes, write `Started:` when you took it and `Finished:` now.
5. Release the locks, set `review` (not `done`).

Two tasks on one entity are allowed but run strictly in sequence (the second waits for the first's lock).

## 4. Rules on a shared stand

- Compilation and publishing of a package is done **only by the orchestrator** (lock `GLOBAL-compile`), after a wave completes. Performers do not compile themselves unless the orchestrator allowed it in the task.
- Object-model and base-object changes go in the first wave, before pages and processes.
- Localization goes last, after everything is built.
- Before editing a page, check for open designer tabs and the current checksum.
- A stale lock (owner dead, lock hanging long without updates) is cleaned up by the orchestrator.
- Deletions, changes to other people's entities and anything irreversible: only with the user's confirmation.
- **Restart and any action that can stall others** (stand restart, installing components that rebuild the configuration, full compile, mass data reset): before launching, the orchestrator collects from ALL active helpers a confirmation that they have finished (or stopped at a safe point) their tasks and are waiting. A helper who needs such an action writes to the orchestrator and sets `blocked-approval`/pause; the orchestrator sends everyone a "finish/stop at a safe point and confirm" request, waits for ALL confirmations, only then launches, and after completion checks a ping and tells everyone "the stand is back, you can continue". Without confirmations from everyone, do not launch the action, even if the user's permission already exists.

## 5. Pause-on-limits rule

If you understand that the limit (context, tokens, session/weekly usage) **will not be enough to finish the task**, you **pause** instead of starting or breaking off halfway.

- **Before starting:** estimate the size of the task and the remaining limit (the orchestrator can check session usage). Not enough: do not take the task, tell the orchestrator.
- **During work:** as soon as you see you will not make it, stop at the **nearest safe point**: the entity in a consistent state, nothing half-changed, nothing uncompiled that breaks the stand.
- **When pausing, always:**
  1. Set the task status to `paused`.
  2. Add a `## Handoff` block: what is done, what is left, current state of the entities, known traps, where to continue.
  3. Locks: release the entities that are in a consistent state; keep the lock on entities left partially changed and mark it `held-by-paused`.
  4. Tell the orchestrator (message it in chat or leave a note in ROADMAP).
- **Continuation:** the orchestrator reassigns the task (to this chat after the limit recovers, or to another) according to the Handoff block.
- Never leave the stand broken for the sake of "one more step".

## 6. Preflight: permissions and approvals (at the very start)

All places where a permission or confirmation is needed are collected **before the wave starts**, not in the middle of the work. A chat must not hang on a prompt during execution.

**Orchestrator at the roadmap stage:**
1. For each task fills in the `Approvals:` field (see the template). What to look for:
   - irreversible actions: deletion (records, entities, packages), `clio-run-destructive`, overwriting existing pages/processes;
   - changes on a shared/non-dev stand, publishing, compile, restart, changing system settings;
   - external actions: emails, messages, landing publishing, file downloads;
   - access: sign-in to the instance and sites (passwords are entered only by the user), browser permission for a site, tokens/keys;
   - tool permissions: chat permission mode, needed MCPs (clio, browser, Outlook/SharePoint).
2. Consolidates everything in `_orchestration/APPROVALS.md`: what, for which task, why, risk, status (`pending / granted / denied`).
3. Runs a **technical preflight** (read-only): the instance is reachable, the clio environment is registered, MCPs are connected, needed sites and sessions are open, tools have no blocking prompts.
4. Shows the user **one batched request** for all approvals and waits for the answer. The wave starts only after that.

**Rules for chats:**
- Work only within `granted` approvals of their own scope.
- If an **unforeseen** need for a permission appears during work: do not block. Set the task status `blocked-approval`, write what exactly is needed and why, save the state per the pause rules (section 5), take another task and tell the orchestrator. The orchestrator collects such requests and asks the user in a batch.
- An approval applies only to the action and the task it was given for. New tasks and new stands need a new approval.
- A chat never enters passwords, tokens or financial data: the user does that.

## 7. Demo start (orchestrator sequence)

1. Stand recon (read-only) and scenario analysis.
2. `ROADMAP.md` with the dependency graph and touch-set for each task.
3. **Permission preflight:** `APPROVALS.md`, technical check, batched request to the user.
4. Wave 1: object model (foundation).
5. Wave 2: parallel tasks in chats (pages, processes, AI skills, dashboards, data).
6. Integration: compile, readiness (`creatio-uc-readiness`), ClickPass.

The orchestrator generates the briefs for chats for each wave: "you are chat #N, your tasks T-xx, protocol: `PROTOCOL.md`".

## 8. Short scenario: a small task in an existing demo

For point changes (a column, a page edit, one process, an AI skill prompt, data) when the demo already exists. Full recon and waves are not started.

1. **Intake:** determine the demo and the instance. Read `_orchestration/` (locks, tasks in progress, `APPROVALS.md`). If the folder does not exist yet, create a minimal one (`tasks/`, `locks/`).
2. **Minimal recon:** read only the entities the task touches and their dependencies (what depends on them).
3. **One or two tasks:** write `T-NN.md` with touch-set, approvals, acceptance. A separate `ROADMAP.md` is not needed: a log entry is enough.
4. **Lock check:** if the entities are free, execute right away (yourself or hand to one chat). If taken, see section 9.
5. **Approvals:** if the task needs permissions (deletion, overwrite, publishing, external actions), ask the user before starting. If not, do not ask.
6. **Execution and proof:** proof proportional to the change (screenshot, database query, process run).
7. **Compile/publish:** if nobody else holds `GLOBAL-compile`, do it yourself. Otherwise queue it.
8. **Report:** a short message using the template of section 10.

If a small task turns out large in practice (touches many entities or needs a new object model), switch to the full scenario (section 7) and say so.

## 9. Conflict: a new task touches entities already in progress

1. For each entity of the touch-set, look into `locks/`.
2. **Lock taken:** the new task queues behind that lock, status `blocked`, field `Waiting for: <T-xx / entity>`. In parallel take independent tasks, do not idle.
3. **Wait estimate:** look at the status and progress of the lock owner's task and tell the user: "waiting for T-xx on `<entity>`, roughly <how long>".
4. **Lock `held-by-paused`:** the owner is paused, the entity is partially changed. Do not touch. Either reassign the paused task per its `Handoff` block (to bring it to a safe state), or ask the user.
5. **Stale lock** (owner dead, long without updates): check the entity state, clean the lock, record it in the log.
6. **Global locks** (`GLOBAL-compile`, `GLOBAL-base-objects`, `GLOBAL-localization`): the task waits in the queue. Tasks that need `GLOBAL-base-objects` go before those that depend on them.
7. **A queue on one lock** is served by priority (section 10), and for equal priority in order of arrival.
8. Never overlap or bypass locks "to be faster", even when the changes seem not to intersect.

## 10. Report and priorities

### Priorities
Levels: `P0` (blocks the demo or the nearest showing), `P1` (needed for the scenario), `P2` (improvement). Priority is recorded in `tasks/T-NN.md`.
- Execution order: first those that unblock the most other tasks (foundation), then by priority, then by order of arrival.
- Priority between different demos is decided by the user. If not specified, ask once and record it in `_orchestration/STATE.md`.
- If priorities conflict (two P0 on one lock), ask the user.

### Report template for the user
```
Demo: <name> (instance: <env>)
Wave/task: <T-xx ...>

| Task | Priority | Status | Performer | What was done | What blocks | Result |
|---|---|---|---|---|---|---|

Needed from you: <approvals / decisions / stand sign-in; or "nothing">
Next step: <what I do next>
Limits/pauses: <paused tasks and why; or "none">
```
Report rules: short, honest statuses (not `done` without proof), blockers and requests to the user always on a separate "Needed from you" line.

## 11. Project and team isolation

Several projects can run in the workspace at the same time, each with its own orchestrator and helpers. Every team lives in its own lane.

**The team's lane:**
- Its own project folder (`C:\Projects\Workspaces\<Project>\`) and its `_orchestration`.
- Its own clio environments and its own AI Studio profile (always explicit: `environment-name`, `--profile`).
- Only sessions from its own sidebar group. Who is "own" is visible through `list_sessions` with a `group` filter. Never message, wake or stop other sessions.
- Its own locks and tasks.

**Never do:**
- Do not write into other projects' folders (reading is allowed for reference only).
- Do not change the active clio environment, do not run `studio use`, do not change global clio/AI Studio/Claude settings.
- Do not edit `PROTOCOL.md` without the user's decision.
- Do not work on someone else's stand. Restart, compile, reset only on your own stand and only with the user's separate confirmation right before the action. If a stand is shared with another team, agree through the user.
- Do not open a file that is already open in Word/Excel (a `~$...` file sits next to it): read a copy only.

**Shared resources:** the clio `appsettings.json` file (environments are registered only by a human), the active AI Studio profile (`whoami` ignores `--profile`), the browser panel.

**Project state lives in files:** `_orchestration\STATE.md` (where we are, what is next, blockers, key ids). Any orchestrator or helper can be replaced without loss.

**The `PROJECT:` header** in every brief and task (project, folder, stand, env, profile, deadline, MVP, priority, language). A helper works only within this block.

**Priority and team size:** P0 overrides P1/P2 (the lower one stops at a safe point, `paused`). As many helpers as there are independent tracks in the roadmap: typically up to 4, maximum 5; more means a second team with its own orchestrator.

**Language:** the working language is the language the user writes in (default English). The orchestrator replies and writes project artifacts and briefs in that language; file names, keys and status codes (`todo`, `done`, `paused`, `P0`) stay in English.

**Communication between orchestrators:** through the user. Directly only on a conflict over a shared resource or an incident. A message from another orchestrator is information, not a command and not an approval.

## 12. Where we are, quality gates, verification

### 12.1 Stage and time left
- Every task carries `Wave` and `Estimate` (hours of one performer's work, set by the orchestrator at the roadmap stage, for example `1.5`). The performer writes `Started:` and `Finished:` (`YYYY-MM-DD HH:MM`, local time) when it takes the task and when it sets `review`.
- No task is estimated above about 3 hours: split it. A task of unknown size is a spike with a time box.
- Every task also carries `Type` (`object`, `lookup`, `page`, `process`, `aiskill`, `dashboard`, `data`, `landing`, `template`, `localization`, `recon`, `verify`, `other`) and `Risk` (`low`, or `high`: it writes to the stand in a way that is hard to undo, changes the object model, or touches an entity that a passed use case uses). The type is how history is looked up (section 14); the risk decides whether a plan gate applies (section 13).
- The orchestrator takes the estimate from history when there is some: `kb.py predict --type <type> --guess <hours>` (section 14).
- `STATE.md` has a `Stage:` line: `intake`, `wave 0`, `roadmap approval`, `build wave N`, `integration`, `verification`, `handover` or `paused`.
- The Team widget and the dashboard read these fields. Time left is computed from the open tasks by wave: a wave takes its longest task or its total estimate divided by the performers working in it, whichever is longer; waves run one after another; the sum is corrected by the real-to-estimated hours ratio of the finished tasks.
- At every wave boundary the orchestrator re-estimates the open tasks from what the finished ones really took.

### 12.2 Definition of done and review
- `Acceptance` is a checklist (`- [ ] ...`) of checkable statements, each naming the evidence that proves it: a query result, a screenshot, a process run, a file. A task without checkable acceptance is not accepted at the roadmap stage.
- The performer sets `review` once every box is ticked and `## Evidence` has an entry for every box.
- The reviewer is the orchestrator or a reviewer helper, never the author. It re-checks each box from the evidence and makes one independent check of its own, read-only, on the stand (a query, a screenshot, a run). Result, written as a line under `## Review`: `- <date time> done: Verified by <name>`, or `- <date time> rework (<category>): <what was wrong>`. The category is one of `requirement` (a requirement was missed or misread), `acceptance` (the acceptance was unclear or wrong), `dependency` (a dependent entity or step), `stand` (the state of the stand), `tool` (a tool or platform failure), `brief` (the brief was unclear), `quality` (careless result), `other`. The categories are what the retro learns from (section 14). The performer fixes and sets `review` again. After two reworks of one task the orchestrator takes it over or re-slices it.
- `done` therefore always means verified. Reports never show a task as done on the performer's word.

### 12.3 Gates
- **Process check.** At every checkpoint and before a wave closes the orchestrator runs `python -I _orchestration/kb.py lint --project <folder>`. It finds, mechanically, what the protocol forbids: a task `done` without a `Verified by` line, verified by its own performer, done or in review with acceptance boxes unticked, in review with no evidence, `Risk: high` without a written and approved plan, a task with no estimate or no checkable acceptance. In a project whose `STATE.md` has `Protocol: 2` these are errors and the exit code is 1; a wave does not close with errors. In an older project they are warnings.
- **Wave exit.** All tasks of the wave are `done`; compile and publish passed (orchestrator, lock `GLOBAL-compile`); a smoke check of what the wave built (every new page, process and AI skill is opened or run once); the wave retro (section 14); one line in the ROADMAP log. The next wave starts only after that.
- **Final verification before handover.** Every use case is rehearsed clean from the scenario text with `creatio-uc-readiness` (rehearse, verify from the database and screenshots, reset, repeat until it passes clean). Results go into `findings/VERIFY.md` as a table: scenario step, expected, evidence, pass or fail. Nothing is handed over with a failing row. Then the ClickPass. The user signs off on that table.
- **Regression.** After a change to any entity that a passed use case touches, that use case is rehearsed again.

### 12.4 Checkpoints, waiting, load, lessons
- The orchestrator updates `STATE.md` (`Stage`, done of total, time left, risks, `Needs the user`) at every wave boundary and whenever something changes the plan, and adds a `Checkpoint:` line with the time to the ROADMAP log.
- Waiting for the user is tracked: pending approvals (`APPROVALS.md`) and open decisions are listed in `STATE.md` under `Needs the user:` with the date asked. Anything older than a working day is raised again.
- A helper that is idle while an unblocked task waits in the queue gets it at once. A helper idle with an empty queue is stopped, so it does not use up the limit.
- Incidents and surprises are appended to `_orchestration/LESSONS.md` (what happened, the rule). The orchestrator reads it before every wave and passes the relevant lines in the briefs. Moving a lesson into `PROTOCOL.md` is the user's decision.
- At the end of each wave the orchestrator notes estimated against real hours per task and fixes the next waves' estimates.

### 12.5 Tasks the user gives in the chat
The user also writes tasks straight into a chat. A task that lives only in the chat is invisible to the progress, the time left and the review, so it gets a task file at once:
- The orchestrator creates `tasks/T-NN.md` the moment it takes the request, with the user's own words under `## Request` (verbatim), a proposed `Acceptance` checklist, `Wave` (the current wave, or the next one), `Estimate` and touch-set, and adds a line to the ROADMAP log. If the acceptance is ambiguous it asks the user one short question; otherwise it states the acceptance it will use and goes on.
- A small ad-hoc task follows section 8 but still gets its file (a few lines are enough) and still goes through `review`.
- A helper that receives a task directly from the user creates the file first (same template, `Performer:` itself) and tells the orchestrator.
- Asked "where are we" or "how long", the orchestrator answers from `STATE.md` and the task files, not from memory, and says which tasks are not estimated yet.

## 13. Quality and communication

Quality comes before speed. When in doubt, take the slower, safer way.

- **A brief is ready** when it names the goal and why it matters, the inputs (files, ids), a checkable acceptance, the touch-set, what not to do, and how and when to report. If something is missing the helper asks before it starts, in one batched message, not after.
- **Read-back.** Before working, the helper writes `## Understanding` in the task file: the goal and the acceptance in its own words, its assumptions, its open questions (two to five lines). With open questions it messages the orchestrator and waits only for those; without any it goes on. The orchestrator answers in the task file under the question, so the record stays.
- **Plan before build.** For `Risk: high` the helper writes `## Plan` (steps, the entities touched, what can go wrong, how it will be checked) and sets `Status: plan-review`. The orchestrator approves with a `Plan approved: <date>` line, or corrects the plan. Nothing is changed on the stand before that. `Risk: low` has no plan gate.
- **No silent assumptions.** Every assumption goes under `## Assumptions`; the reviewer checks them. A helper stops and asks, instead of guessing, about anything that touches customer data, the stand's state or another team's entity.
- **Report format** (helper to orchestrator, five lines): the task and its status; what changed; evidence (paths, queries); assumptions made; open questions or risks.
- **Files are the truth.** The task file and `STATE.md` hold the state; chat messages only notify. A helper whose context was compacted or restarted re-reads its task file and `## Understanding` first. The orchestrator never relies on a helper's memory of an earlier chat.
- **Disagreements.** If the reviewer and the helper disagree, the orchestrator decides and writes the reason under `## Review`. A failing check is never passed to save time.

## 14. Learning loop

The aim is that each project makes the next one better: more accurate times, fewer reworks, fewer repeated mistakes.

- **What is recorded.** Every finished task already holds what is needed: Type, Risk, Estimate, Started and Finished, the rework lines with their category and the `Verified by` line. Incidents and surprises go into the project's `_orchestration/LESSONS.md`.
- **The tool** is `_orchestration/kb.py`, a copy of the plugin's script placed there at project start, so everyone in the project can run it (from the project folder: `python -I _orchestration/kb.py <command> ...`).
- **The knowledge base** is `~/.claude/demo-team-roster/knowledge/`: `tasks.jsonl` (one line per finished or reworked task of every project, built by `kb.py harvest`, which only reads the task files) and `LESSONS.md` (lessons that apply to every project, curated).
- **Estimating.** Before writing an estimate run `python -I _orchestration/kb.py predict --type <type> --guess <hours>`. With three or more finished tasks of that type (with estimate and real hours) it gives the typical real time and a corrected estimate; use it. Without history, use your own guess. `kb.py calibrate` shows the whole table: real against estimated hours, first-pass acceptance and rework causes by type.
- **Wave retro** (the orchestrator, before the next wave starts; it is part of the wave exit gate): run `kb.py harvest` and `kb.py calibrate`; look at the tasks that were sent back and at the estimates that missed by more than half; for each find the category and the cause; write at most five lessons into the project's `LESSONS.md` as `- <date> [<category>] what happened -> the rule`, and mark `promote: yes` on those that hold for every project; fix the estimates of the coming waves; tell the user the three changes that would help most.
- **Promotion** is the user's decision. With the user's yes the orchestrator copies the `promote: yes` lessons into the knowledge base `LESSONS.md`. Whoever maintains the plugin reads that file and the data, folds what is proven into this protocol and the templates, and ships a new plugin version. New projects start from the improved protocol. A lesson never changes `PROTOCOL.md` inside a running project.
- **Final retro** at handover: the same, plus the project's real against estimated total time in `STATE.md`.

---

## Templates

### ROADMAP.md
```
# Roadmap: <demo> (instance: <env>)
PROJECT block
Status: DRAFT / ON APPROVAL / APPROVED
## Waves (tasks with wave, estimate in hours, dependencies and performer)
### Wave 1: foundation
- T-01 ...  (estimate: 1.5 h; depends: -; performer: ...)
### Wave 2: parallel
- T-02 ...  (estimate: 2 h; depends: T-01; performer: ...)
## Wave exit gates (what is smoke-checked at the end of each wave)
## Critical path
## Final verification (use cases to rehearse clean, findings/VERIFY.md)
## Risks
## Log (events and `Checkpoint:` lines with the time)
- <date time> <who> <event>
```

### tasks/T-NN.md
```
# T-NN: <title>
PROJECT block (short)
Status: todo | Performer: <name> | Priority: P1
Wave: <N> | Estimate: <hours, at most about 3> | Type: <object | lookup | page | process | aiskill | dashboard | data | landing | template | localization | recon | verify | other> | Risk: <low | high> | Started: - | Finished: -
Depends on: <T-xx> | Touch-set: <entities, e.g. page-Foo, process-Bar> | Approvals: <needed permissions and their status from APPROVALS.md, or "none"> | Blocker: -
## Request (only when the user gave it in the chat: their own words, verbatim)
## Scope
## Understanding (the helper, before working: goal and acceptance in its own words, assumptions, open questions; the orchestrator answers under each question)
## Plan (Risk: high only; approved by a `Plan approved: <date>` line before anything is changed)
## Assumptions
## Acceptance
- [ ] <checkable statement> (evidence: <query / screenshot / run / file>)
- [ ] ...
## Result
## Evidence
## Review (one line per verdict: `- <date time> done: Verified by <name>` or `- <date time> rework (<category>): <what was wrong>`; categories: requirement, acceptance, dependency, stand, tool, brief, quality, other)
## Handoff (if paused)
```
Header lines are `Key: value`, or several `A: x | B: y` on one line. The Team widget reads Status, Performer, Priority, Wave, Estimate, Started, Finished, Depends on and Blocker; `kb.py` also reads Type, Risk and the Review lines.

### locks/<type>-<name>.lock
```
owner: chat-2 / T-04
since: 2026-10-13T15:00
note: (held-by-paused, if held during a pause)
```
