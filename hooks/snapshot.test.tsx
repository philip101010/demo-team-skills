import { expect, test } from 'claude-code/testing'

const ROSTER = JSON.stringify({
  orchestrator: { name: 'Merlin TL', id: 'local_o', class: 'king' },
  members: [{ name: 'Gareth', id: 'local_g', class: 'barbarian' }],
})
const TASK = `# T-11: Track A
Priority: P0 | Status: in-progress | Performer: Gareth | Depends on: T-10 (approval)
`

test('team_snapshot returns every project with its members and tasks', async ($, on) => {
  on('command.register', () => ({ value: { command: 'team' } }))
  on('tool.register', () => ({ value: {} }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:\\Projects\\Workspaces\\Proj One' }))
  on('session.id', () => ({ value: 'cli-self' }))
  on('clock.now', () => ({ value: 1000000 }))
  on('clock.every', () => ({ value: undefined }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.read', (_, e: any) => ({ value: String(e.path).endsWith('roster.json') ? ROSTER : String(e.path).endsWith('T-11.md') ? TASK : '{}' }))
  on('fs.list', (_, e: any) => ({
    value: (String(e.path).endsWith('tasks')
      ? [{ kind: 'file', name: 'T-11.md', mtimeMs: 1 }]
      : String(e.path).toLowerCase().endsWith('workspaces')
        ? [{ kind: 'directory', name: 'Proj One', mtimeMs: 0 }]
        : []) as never,
  }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => ({ value: { mtimeMs: 0 } }))
  on('tool.call', () => ({ result: { text: '[]' } }))

  await $.session.start({ cwd: 'C:\\Projects\\Workspaces\\Proj One', surface: 'desktop', isInteractive: true })
  const res = (await $.tool.call({ tool: 'mcp__demo-team-roster__team_snapshot' } as never)) as { result?: string }
  const snap = JSON.parse(String(res.result ?? res)) as { projects: { slug: string; members: { name: string; total: number | null; role: string }[]; tasks: { id: string; status: string; depends: string }[] }[] }
  expect(snap.projects.length).toBe(1)
  expect(snap.projects[0]?.slug).toBe('proj-one')
  expect(snap.projects[0]?.members.map(m => m.name)).toEqual(['Merlin TL', 'Gareth'])
  expect(snap.projects[0]?.members[1]?.total).toBe(1)
  expect(snap.projects[0]?.tasks[0]).toMatchObject({ id: 'T-11', status: 'working', depends: 'T-10' })
  await new Promise(r => setTimeout(r, 300)) // let the poll's own pane open settle
})
