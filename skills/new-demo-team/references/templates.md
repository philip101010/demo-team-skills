# Templates for new-demo-team

Write the content of every generated file and brief in the working language (the user's language, default English). File names, keys and status codes (`todo`, `done`, `paused`, `P0`) stay in English.

## PROJECT block (start of every brief and every task file)
```
PROJECT: <NAME>
Folder: C:\Projects\Workspaces\<NAME>
Stand: <URL>   clio env: <ENV> (always pass environment-name)   AI Studio profile: <PROFILE> (always pass --profile)
Deadline: <DATE>   MVP: <BOUNDARY>   Priority: <P0/P1/P2>   Language: <LANGUAGE>
Orchestrator: <ORCH NAME> (session_id <ID>)
Ignore the context of any other project.
```

## Helper prompt (start_session prompt)
```
You are helper <NAME> in the team of project <PROJECT> (group "<GROUP>"). Work in <LANGUAGE>.
Your folder: C:\Projects\Workspaces\<PROJECT>. Your orchestrator: <ORCH NAME> (session_id <ID>); briefs arrive from the orchestrator through messages. Do nothing until the first brief.
Quality comes before speed: when in doubt, take the slower, safer way, and ask instead of guessing about customer data, the stand's state or another team's entity.
Every brief starts with a PROJECT block. Work only inside it. Always pass an explicit environment-name and --profile. Team protocol: C:\Projects\Workspaces\<PROJECT>\_orchestration\PROTOCOL.md (sections 3, 5, 6, 11).
Rules: before working on a task write `## Understanding` in its file (goal and acceptance in your own words, assumptions, open questions) and message the orchestrator only if you have questions; for a task with `Risk: high` also write a `## Plan` (steps, entities, what can go wrong, how you will check it), set `Status: plan-review` and change nothing on the stand until a `Plan approved:` line appears; list every assumption under `## Assumptions`; report to the orchestrator in five lines (task and status, what changed, evidence, assumptions, open questions or risks); only your own tasks and locks; never change the active clio environment or run `studio use`; never enter or repeat passwords/tokens; write nothing to the stand unless the task says writes are approved; when you run low on limit stop at a safe point with status `paused` and a Handoff block; if the `roster_step` tool is available, call it when you start a task (task title, done 0, total = planned steps) and after each finished step (done, note = next step), so the team widget shows your progress; when you finish a task tick every acceptance box of its file, give the evidence for each, write `Started:` and `Finished:` and set `Status: review` (never `done`: a reviewer sets `done`, protocol section 12), then report status and 3-5 conclusions to the orchestrator; if you are stuck (a permission, a dependency, a lock) set `Status: blocked-approval` or `blocked` and write one line `Blocker: <what is needed from whom>` in the task file, so the Team widget shows it in red; keep your steps as `- [ ]` boxes in the task file and tick them as you go, which is also how progress is counted; if the user gives you a task straight in your chat, first create its task file (the template in `PROTOCOL.md`, the user's words under `## Request`, yourself as Performer) and tell the orchestrator, so it is counted.
```

## Reviewer helper prompt (build waves)
```
You are reviewer <NAME> in the team of project <PROJECT> (group "<GROUP>"). Work in <LANGUAGE>. Folder: C:\Projects\Workspaces\<PROJECT>. Orchestrator: <ORCH NAME> (session_id <ID>).
You never review a task you did, and you change nothing on the stand (read-only: queries, screenshots, opening pages, running a process only if the task says it is safe). For every task the orchestrator names, whose status is `review`: read its Acceptance and Evidence, check each box against the evidence, then make one independent check of your own on the stand. Also check the task's `## Assumptions`. Write the verdict as one line under `## Review` in the task file and set the status: `- <date time> done: Verified by <NAME>` with `Status: done`, or `- <date time> rework (<category>): <exactly what to fix>` with `Status: rework`; the category is one of requirement, acceptance, dependency, stand, tool, brief, quality, other (protocol section 12.2). Report to the orchestrator with one line per task (done or rework, why).
```

## Wave 0 briefs (read-only)
Task T-01 stand recon: version/platform, packages, what already exists from the scenario (objects, lookups, pages, processes, AI skills, data), reusable objects, user/role/culture, risks. Report `findings/T-01_stand.md`.
Task T-02 scenario to requirements: list artifacts (objects, fields, lookups with values, pages, processes, AI skills, data, simulated parts) with no-code/low-code/needs-dev, bottlenecks and gaps (creatio-script-bottlenecks approach), dependency graph, open questions. Report `findings/T-02_requirements.md`.
Task T-03 access preflight: env registered and reachable (read-only call), login rights, clio version, MCP tool availability, designer tabs/active users, missing permissions, proposed approvals. Report `findings/T-03_preflight.md`.
Each brief ends with: read-only, do not create/compile/restart, report path, message the orchestrator with status + 3-5 conclusions.

## STATE.md
```
# STATE: <NAME>
PROJECT block (see above)
Protocol: 2
Team: orchestrator <name> (<id>), helpers <name> (<id>), ...
Stage: <intake | wave 0 | roadmap approval | build wave N | integration | verification | handover | paused>
Status: <phase> | Updated: <date time>
Progress: <done> of <total> tasks verified | time left: <hours, from the Team widget or your own estimate>
Done: ...
Next: ...
Blockers: ...
Needs the user: <pending approvals and decisions, each with the date asked; or "nothing">
```

## ROADMAP.md, tasks/T-NN.md, locks
The canonical templates are in `PROTOCOL.md` (section "Templates"), so a helper in the project sees the same text. Write the project's files from there; do not keep a second copy of them here.

## APPROVALS.md
```
# Approvals: <NAME>
Statuses: pending / granted / denied
| # | Action | Tasks | Risk | Status |
## User decisions (question | recommendation)
```
