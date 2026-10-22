# Parallel demo work protocol

Applies to the orchestrator and all parallel chats. One stand, many performers: work is divided by **entities** so tasks do not overlap in time.

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

`todo → claimed → in-progress → done`
Side states: `blocked` (waiting for a dependency or a lock), `paused` (see section 5), `blocked-approval` (a permission is needed, see section 6).

1. Check that all dependencies of the task are `done` and all its approvals are `granted`.
2. Acquire locks on **all** entities of your touch-set. Acquisition is atomic: the lock file is created only if it does not exist yet (`set -o noclobber`). If any lock is taken, release those already acquired and take another task (or wait).
3. Execute. Do not touch entities outside the touch-set. If a need appears: stop, add the entity to the task, acquire its lock, or tell the orchestrator.
4. Write the result and evidence into the task (what changed, how it was verified, links).
5. Release the locks, set `done`.

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

---

## Templates

### ROADMAP.md
```
# Roadmap: <demo> (instance: <env>)
## Waves
### Wave 1: foundation
- T-01 ...  (depends: -)
### Wave 2: parallel
- T-02 ...  (depends: T-01)
## Log
- <date> <who> <event>
```

### tasks/T-NN.md
```
# T-NN: <title>
Status: todo
Performer: -
Depends on: T-xx
Touch-set: page-Foo, process-Bar
Approvals: <list of needed permissions and their status from APPROVALS.md, or "none">
Scope: <what to do>
Acceptance: <how to tell it is done>
## Result
## Evidence
## Handoff (if paused)
```

### locks/<type>-<name>.lock
```
owner: chat-2 / T-04
since: 2026-10-13T15:00
note: (held-by-paused, if held during a pause)
```
