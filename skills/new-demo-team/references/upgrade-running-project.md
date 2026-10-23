# Moving a running project to protocol 2

For the orchestrator of a project that started before sections 12 to 14 of the protocol existed (for example one whose `_orchestration/PROTOCOL.md` ends at section 11). Do this only when the user decides to; it changes how the team works from the next wave on, not what was already done. Nothing on the stand is touched.

## 1. Adopt the new rules

1. Copy sections 12, 13 and 14 and the new task template from the plugin's `references/protocol.md` into the project's `_orchestration/PROTOCOL.md`. Add the new statuses to section 3 (`review`, `rework`, `plan-review`). This is the user's decision, as `PROTOCOL.md` says.
2. Tell every helper, in one message: from now on a finished task goes to `review` (never `done`), every task starts with a short `## Understanding`, a `Risk: high` task gets a `## Plan` and waits for `Plan approved`, assumptions go under `## Assumptions`, reports have five lines. Point them to `PROTOCOL.md` sections 12 and 13.
3. Copy the plugin's `scripts/kb.py` to `_orchestration/kb.py` (the tool the protocol refers to: `lint`, `predict`, `harvest`, `calibrate`).
4. Start a reviewer: a helper that is not the author of the tasks it checks (a cheaper model is fine), with the reviewer prompt from the plugin's `references/templates.md`.

## 2. Bring the open tasks up to date

For each task that is not `done`: add `Wave`, `Estimate` (hours, at most about 3, split bigger ones), `Type`, `Risk`, and an `Acceptance` checklist where each line names its evidence. Get the estimate from `kb.py predict --type <type> --guess <hours>` when there is history. For tasks already `done`: leave them; they stay as they are (they count as done, without verification data).

Add `Stage:` and `Progress:` to `STATE.md`. When all open tasks are converted, add the line `Protocol: 2` to `STATE.md`: from then on `kb.py lint` treats its findings as errors.

## 3. Verify what is already built

Done tasks that carry no verification are the biggest risk to the result. Have the reviewer re-check the ones that matter most (anything a use case of the scenario depends on): read the evidence, make one independent read-only check, and write a `- <date time> done: Verified by <name>` line or a `rework (<category>)` line under `## Review`. The final verification (protocol section 12.3) covers the rest.

## 4. From then on

Keep to sections 12 to 14: lint at every checkpoint, the wave exit gate, the wave retro, lessons into `_orchestration/LESSONS.md`.
