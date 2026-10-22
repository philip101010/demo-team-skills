# demo-team-skills

Claude Code skills for running Creatio demo builds with a team of parallel chats.

## Skills

| Skill | What it does |
|---|---|
| [`new-demo-team`](skills/new-demo-team/SKILL.md) | In a fresh chat: takes a customer scenario, creates the project folder and a sidebar group, starts helper sessions, becomes the orchestrator, runs a read-only wave 0, then produces the requirements table, roadmap timeline and an approvals package and waits for the go. |

## Install

Copy the skill folder into your user skills directory:

```bash
cp -r skills/new-demo-team ~/.claude/skills/
```

On Windows: copy `skills\new-demo-team` to `%USERPROFILE%\.claude\skills\`.

## Use

Open a new chat in Claude Code desktop (no working folder), drop the scenario file or text and say, for example: "новий проєкт" or "new demo team". The skill asks for what is missing in one message, proposes the folder name and the team, and waits for your OK before creating anything.

## Notes

- Needs Claude Code desktop session tools: `start_session`, sidebar group tools, `change_directory`, `send_message`.
- Passwords, tokens and clio environment registration stay with the user; the skill never handles them.
- The skill and its protocol are in English. It replies, and writes project artifacts and helper briefs, in the language the user writes in (default English).
- The skill is a work in progress; not yet verified on a project with a non-git folder and a chat without a working folder.
