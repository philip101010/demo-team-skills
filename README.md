# demo-team-skills

Claude Code tools for running Creatio demo builds with a team of parallel chats. One plugin, `demo-team-roster`, carries everything:

| Part | What it does |
|---|---|
| Skill [`new-demo-team`](skills/new-demo-team/SKILL.md) | In a fresh chat: takes a customer scenario, creates the project folder and a sidebar group, starts helper sessions, becomes the orchestrator, runs a read-only wave 0, then produces the requirements table, roadmap timeline and approvals package and waits for the go. It also writes `_orchestration/roster.json` and asks helpers to report progress. |
| Skill [`team-board`](skills/team-board/SKILL.md) | `/team-board` adds the current project's roster to the Demo Team Roster dashboard (an artifact), moves it from "Stopped" back to "Watching", or refreshes it. `/team-board all` refreshes every project. |
| Team widget (mod) | A **Team** tab in the right panel: one pixel knight per helper, asleep when idle, fighting or casting when working, with a thin progress bar, percentage, elapsed time, ETA, task and current step. Opens by itself in the orchestrator chat. `/team` toggles it, and a chip above the prompt does the same. |
| Dashboard | One page for all your projects at once, styled after the Quest Board. Stop or resume watching a project with one button. |

## Install

```
/plugin marketplace add philip101010/demo-team-skills
/plugin install demo-team-roster@demo-team-skills
```

The widget (a mod) and the skills install together. Restart the session once after installing.

Skills only, without the widget: copy `skills/new-demo-team` and `skills/team-board` to `~/.claude/skills/` (`%USERPROFILE%\.claude\skills\` on Windows).

## Use

1. Open a new chat in Claude Code desktop (no working folder), drop the scenario file or text and say "new demo team" (or "новий проєкт"). The skill asks for what is missing in one message, proposes the folder name and the team, and waits for your OK before creating anything.
2. The Team tab opens in the orchestrator chat. Closed it by accident? Type `/team`, or click the chip above the prompt.
3. Put the roster on the dashboard: `/team-board`. The first run publishes the dashboard as a private artifact and remembers its URL in `~/.claude/demo-team-roster/config.json`.
4. Helpers report progress with the `roster_step` tool (task, steps done, steps in all). The helper prompt template tells them to.

## Notes

- Needs Claude Code desktop session tools: `start_session`, sidebar group tools, `change_directory`, `send_message`, `list_sessions`.
- The widget reads the other chats' state from the app's session metadata and `list_sessions`; helpers appear as working while their chat is running.
- The dashboard is a snapshot written by `/team-board`, not a live feed: "working" means active in the running at the moment of the refresh (the session that runs the command does not count).
- Passwords, tokens and clio environment registration stay with the user; the skills never handle them.
- The skills and the protocol are in English. They reply, and write project artifacts and helper briefs, in the language the user writes in (default English).
- To rebuild the dashboard page after editing `tools/dashboard.src.html` or `hooks/sprites.ts`: `node tools/build-dashboard.mjs` (Node 22.13+).
- Work in progress; the `new-demo-team` skill is not yet verified on a project with a non-git folder and a chat without a working folder.

## Credits

The pixel-knight construction (stamping a crab sprite from ASCII rows, one costume per class) comes from [savvy-progress](https://github.com/johnnyvizz/claude-kit) by johnnyvizz (MIT). The classes, sleep state, layout, widget and dashboard here are new.

## License

MIT, see [LICENSE](LICENSE).
