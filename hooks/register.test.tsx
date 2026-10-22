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
  const written: Record<string, string> = {}
  on('fs.write', (_, e: any) => {
    written[String(e.path)] = String(e.content ?? e.data ?? e.text ?? '')
    return { value: undefined }
  })
  // The list says Gareth is running (his roster entry is `local_g`): a roster file still shows who works.
  on('tool.call', () => ({ result: { text: JSON.stringify([{ sessionId: 'local_g', isRunning: true }]) } }))

  await $.session.start({ cwd: 'C:\proj', surface: 'desktop', isInteractive: true })
  await new Promise(r => setTimeout(r, 200))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // Each member is one drawing; its markup carries the name, and an empty value keeps its row as a dash.
  const cards = (await ui.findAll({ type: 'Svg' })).map(c => String(c.props.source))
  expect(cards.some(s => s.includes('>Gareth<'))).toBe(true)
  expect(cards.some(s => s.includes('>—<'))).toBe(true)
  const alts = (await ui.findAll({ type: 'Svg' })).map(c => String(c.props.alt))
  expect(alts.some(a => a.startsWith('Gareth') && a.includes('working'))).toBe(true)
  expect(alts.some(a => a.startsWith('Lamorak') && a.includes('idling'))).toBe(true)
  // The pane publishes what it shows, so the dashboard can read it from any chat.
  const live = Object.entries(written).find(([path]) => path.includes('live-'))
  expect(live).toBeDefined()
  expect(live?.[1].includes('Gareth')).toBe(true)
  expect(live?.[1].includes('working')).toBe(true)
  await ui.unmount()

  // Wider panes put two or three to a row; the widths must stay ones the engine accepts.
  for (const bodyColumns of [64, 96, 130]) {
    const wide = await $.ui.mount({ ...PANE, props: { ...PANE.props, bodyColumns }, surface: 'desktop' })
    expect((await wide.findAll({ type: 'Svg' })).some(c => String(c.props.source).includes('>Lamorak<'))).toBe(true)
    await wide.unmount()
  }
})
