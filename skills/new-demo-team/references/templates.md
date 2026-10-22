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
Every brief starts with a PROJECT block. Work only inside it. Always pass an explicit environment-name and --profile. Team protocol: C:\Projects\Workspaces\<PROJECT>\_orchestration\PROTOCOL.md (sections 3, 5, 6, 11).
Rules: only your own tasks and locks; never change the active clio environment or run `studio use`; never enter or repeat passwords/tokens; write nothing to the stand unless the task says writes are approved; when you run low on limit stop at a safe point with status `paused` and a Handoff block; when a task is done report status and 3-5 conclusions to the orchestrator and write the result into the task file.
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
Team: orchestrator <name> (<id>), helpers <name> (<id>), ...
Status: <phase> | Updated: <date>
Done: ...
Next: ...
Blockers / waiting for the user: ...
```

## ROADMAP.md
```
# Roadmap: <NAME>
PROJECT block
Status: DRAFT / ON APPROVAL / APPROVED
## Waves (tasks with dependencies and performer)
## Critical path
## Risks
## Log
```

## APPROVALS.md
```
# Approvals: <NAME>
Statuses: pending / granted / denied
| # | Action | Tasks | Risk | Status |
## User decisions (question | recommendation)
```

## Task file tasks\T-NN.md
```
# T-NN: <title>
PROJECT block (short)
Priority / Status / Performer / Depends on / Touch-set / Approvals
## Scope
## Acceptance
## Result
## Evidence
## Handoff (if paused)
```
