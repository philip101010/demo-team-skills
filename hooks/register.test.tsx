import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'demo-team-roster',
  component: 'Pane',
  requestId: 'demo-team-roster',
  props: { title: 'Team', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const ROSTER = JSON.stringify({
  orchestrator: { name: 'Merlin TL', id: 'local_o', class: 'king' },
  members: [{ name: 'Gareth', id: 'local_g', class: 'barbarian' }, { name: 'Lamorak', id: 'local_l', class: 'rogue' }],
})

const TASK = `# T-11: Track A
Priority: P0 | Status: todo | Performer: Gareth | Depends on: -
`

test('the pane draws the team', async ($, on) => {
  on('command.register', () => ({ value: { command: 'team' } }))
  on('tool.register', () => ({ value: {} }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:\proj' }))
  on('session.id', () => ({ value: 'cli-self' }))
  on('clock.now', () => ({ value: 1000000 }))
  on('clock.every', () => ({ value: undefined }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.read', (_, e: any) => ({ value: String(e.path).endsWith('roster.json') ? ROSTER : String(e.path).endsWith('T-11.md') ? TASK : '{}' }))
  on('fs.list', () => ({ value: [{ kind: 'file', name: 'T-11.md', mtimeMs: 1 }] as never }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => ({ value: { mtimeMs: 0 } }))
  on('tool.call', () => ({ result: { text: '[]' } }))

  await $.session.start({ cwd: 'C:\proj', surface: 'desktop', isInteractive: true })
  await new Promise(r => setTimeout(r, 200))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const row = await ui.find({ type: 'Text', text: /Gareth/ })
  expect(row?.text).toBe('Gareth')
  // No progress report: the bar falls back to the helper's own task files, read from a one-line header.
  expect((await ui.find({ type: 'Text', text: /0\/1/ }))?.text).toContain('0/1')
  await ui.unmount()

  // Wider panes put two or three to a row; the widths must stay ones the engine accepts.
  for (const bodyColumns of [64, 96, 130]) {
    const wide = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns }, surface: 'desktop' })
    expect((await wide.find({ type: 'Text', text: /Lamorak/ }))?.text).toBe('Lamorak')
    await wide.unmount()
  }
})
