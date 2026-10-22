import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'demo-team-roster',
  component: 'Pane',
  requestId: 'demo-team-roster',
  props: { title: 'Team', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const ROWS = [
  { sessionId: 'local_k', title: 'Kei (Test)', name: 'kei', startedBy: 'local_me', isRunning: true },
  { sessionId: 'local_x', title: 'Other (Test)', name: 'other', startedBy: 'local_else', isRunning: false },
  { sessionId: 'local_a', title: 'Old (Test)', name: 'old', startedBy: 'local_me', isArchived: true },
]

test('without a roster file the pane lists the chats this chat started', async ($, on) => {
  on('command.register', () => ({ value: { command: 'team' } }))
  on('tool.register', () => ({ value: {} }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: 'C:\work' }))
  on('session.id', () => ({ value: 'cli-self' }))
  on('clock.now', () => ({ value: 1000000 }))
  on('clock.every', () => ({ value: undefined }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('fs.read', () => ({ value: '' }))
  on('fs.list', () => ({ value: [] as never }))
  on('fs.exists', () => ({ value: false }))
  on('fs.stat', () => ({ value: { mtimeMs: 0 } }))
  on('tool.call', (_, e: any) => ({
    result: { text: e.session_id === 'self' || e.input?.session_id === 'self' ? JSON.stringify({ sessionId: 'local_me' }) : JSON.stringify(ROWS) },
  }))

  await $.session.start({ cwd: 'C:\work', surface: 'desktop', isInteractive: true })
  await new Promise(r => setTimeout(r, 200))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Kei/ }))?.text).toBe('Kei')
  expect(await ui.find({ type: 'Text', text: /Other/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Old/ })).toBeUndefined()
  await ui.unmount()
})
