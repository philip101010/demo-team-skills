import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Member } from '../types'
import { ACCENT, BAR_H, SPRITE_H, SPRITE_W, barSvg, classOf, pctOf, spriteSvg, statusOf, timesOf } from './sprites'

const PANE = 'demo-team-roster'
// Cells across the narrowest the pane can be, until the real one has been seen.
const MIN_COLS_GUESS = 32
const POLL_MS = 4000
const STEP_TOOL = 'mcp__demo-team-roster__roster_step'
const LIST_TOOL = 'mcp__ccd_session_mgmt__list_sessions'

const members = atom({ plugin: 'demo-team-roster', key: 'members' } as const, [] as Member[])
const since = atom({ plugin: 'demo-team-roster', key: 'since' } as const, {} as Record<string, number>)
const isOrch = atom({ plugin: 'demo-team-roster', key: 'isOrchestrator' } as const, false)

type RosterEntry = { name: string; id: string; class?: string }
type RosterFile = { orchestrator?: RosterEntry; members?: RosterEntry[] }
type Progress = { task?: string; note?: string; done?: number; total?: number; startedAt?: number; updatedAt?: number }
type SessionMeta = {
  cliSessionId?: string
  cwd?: string
  title?: string
  lastActivityAt?: number
  postTurnSummary?: { status_category?: string; status_detail?: string }
}

// One toggle for the command and the chip: open it, or close it and remember that it was closed.
const toggle = async ($: any): Promise<string> => {
  const cwd = String(await $.session.cwd())
  const key = `closed:${cwd}`
  const panes = (await $.ui.panes()) as readonly { id: string }[]
  if (panes.some(p => p.id === PANE)) {
    await $.store.set(key, true)
    await $.ui.close({ id: PANE })
    return 'Team pane closed.'
  }
  await $.store.delete(key)
  await $.ui.open({ id: PANE, title: 'Team' })
  return 'Team pane opened.'
}

export const register: Register = on => {
  // Where things live is derived from this plugin's own folder, which sits under ~/.claude.
  const homeOf = (root: string): { home: string; sep: string } => {
    const sep = root.includes('\\') ? '\\' : '/'
    const i = root.toLowerCase().indexOf(`${sep}.claude${sep}`)
    return { home: i >= 0 ? root.slice(0, i) : root, sep }
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'team', description: 'Open the Team pane (your helper chats as pixel knights)' })
    await $.tool.register({
      name: 'roster_step',
      description:
        'Report your own task progress to the team roster the orchestrator watches. Call it when you start a task (task, done 0, total = number of steps you plan) and after each finished step (done, note = what you do next). Cheap and silent.',
      inputSchema: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Short task title, e.g. "G-01 Sales audit"' },
          done: { type: 'number', description: 'Steps finished so far' },
          total: { type: 'number', description: 'Steps planned in all' },
          note: { type: 'string', description: 'The step in progress, a few words' },
        },
      },
    })

    const { home, sep } = homeOf($.plugin.root)
    const sessionsRoot = [home, 'AppData', 'Roaming', 'Claude', 'claude-code-sessions'].join(sep)
    const rosterDir = [home, '.claude', 'demo-team-roster'].join(sep)
    const projectsDir = [home, '.claude', 'projects'].join(sep)
    const metaPaths = new Map<string, string>()
    const taskCache = new Map<string, { mtime: number; title: string; status: string; performer: string }>()
    let wasOpened = false
    let canList = true
    const closedKey = (cwd: string): string => `closed:${cwd}`

    const readJson = async <T,>(path: string): Promise<T | undefined> => {
      try {
        const text = await $.fs.read(path)
        return JSON.parse(typeof text === 'string' ? text : '') as T
      } catch {
        return undefined
      }
    }

    // The app keeps one small json per chat; find it once, under its two id folders.
    const findMeta = async (id: string): Promise<string | undefined> => {
      const known = metaPaths.get(id)
      if (known) return known
      try {
        for (const a of await $.fs.list(sessionsRoot)) {
          if (a.kind !== 'directory') continue
          for (const b of await $.fs.list([sessionsRoot, a.name].join(sep))) {
            if (b.kind !== 'directory') continue
            const file = [sessionsRoot, a.name, b.name, `${id}.json`].join(sep)
            if (await $.fs.exists(file)) {
              metaPaths.set(id, file)
              return file
            }
          }
        }
      } catch {
        // no sessions folder: nothing to show
      }
      return undefined
    }

    const runningIds = async (): Promise<Set<string> | undefined> => {
      if (!canList) return undefined
      try {
        const res = (await $.tool.call({ tool: LIST_TOOL, limit: 100 } as never)) as { text?: string }
        const rows = JSON.parse(res.text ?? '[]') as { sessionId: string; isRunning?: boolean }[]
        return new Set(rows.filter(r => r.isRunning).map(r => r.sessionId))
      } catch {
        canList = false
        return undefined
      }
    }

    // The task file of a helper: the one it performs that is in progress.
    const taskOf = async (cwd: string, name: string): Promise<string | undefined> => {
      try {
        const dir = [cwd, '_orchestration', 'tasks'].join(sep)
        const first = name.toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ')[0] ?? ''
        for (const f of await $.fs.list(dir)) {
          if (f.kind !== 'file' || !f.name.endsWith('.md')) continue
          const path = [dir, f.name].join(sep)
          let c = taskCache.get(path)
          if (!c || c.mtime !== f.mtimeMs) {
            const text = String(await $.fs.read(path))
            const pick = (re: RegExp) => (text.match(re)?.[1] ?? '').trim()
            c = {
              mtime: f.mtimeMs,
              title: pick(/^#\s*(.+)$/m),
              status: pick(/^(?:Status|Статус):\s*(.+)$/im).toLowerCase(),
              performer: pick(/^(?:Performer|Виконавець):\s*(.+)$/im).toLowerCase(),
            }
            taskCache.set(path, c)
          }
          if (c.status.startsWith('in-progress') && first && c.performer.includes(first)) return c.title
        }
      } catch {
        // no tasks folder
      }
      return undefined
    }

    const poll = async (): Promise<void> => {
      try {
        const cwd = await $.session.cwd()
        const roster = await readJson<RosterFile>([cwd, '_orchestration', 'roster.json'].join(sep))
        if (!roster) {
          await update($, members, () => [])
          return
        }
        const entries: RosterEntry[] = [...(roster.orchestrator ? [roster.orchestrator] : []), ...(roster.members ?? [])]
        const selfCli = await $.session.id()
        let selfRole: 'orchestrator' | 'member' | 'outsider' = 'outsider'
        const running = await runningIds()
        const now = await $.clock.now()
        const started = await read($, since)
        const nextSince: Record<string, number> = { ...started }
        const out: Member[] = []
        for (const entry of entries) {
          const file = await findMeta(entry.id)
          const meta = file ? await readJson<SessionMeta>(file) : undefined
          let isRun = running ? running.has(entry.id) : false
          if (!running && meta?.cliSessionId && meta.cwd) {
            // Fallback: the transcript was written to a moment ago.
            const folder = meta.cwd.replace(/[^A-Za-z0-9]/g, '-')
            const stat = await $.fs.stat([projectsDir, folder, `${meta.cliSessionId}.jsonl`].join(sep)).catch(() => undefined)
            isRun = !!stat && now - stat.mtimeMs < 45000
          }
          if (meta?.cliSessionId && meta.cliSessionId === selfCli) selfRole = roster.orchestrator && entry.id === roster.orchestrator.id ? 'orchestrator' : 'member'
          const prog = meta?.cliSessionId ? await readJson<Progress>([rosterDir, `${meta.cliSessionId}.json`].join(sep)) : undefined
          if (isRun && !nextSince[entry.id]) nextSince[entry.id] = now
          if (!isRun) delete nextSince[entry.id]
          const hasSteps = typeof prog?.total === 'number' && prog.total > 0
          const done = hasSteps ? Math.min(prog?.total ?? 0, prog?.done ?? 0) : undefined
          const isFresh = !!prog?.updatedAt && now - prog.updatedAt < 6 * 3600 * 1000
          const base = prog?.startedAt && isFresh ? prog.startedAt : nextSince[entry.id]
          const elapsed = isRun && base ? now - base : undefined
          const eta = isRun && hasSteps && done && done > 0 && elapsed !== undefined && prog && (prog.total ?? 0) > done ? (elapsed / done) * ((prog.total ?? 0) - done) : undefined
          const summary = meta?.postTurnSummary
          const task = (isFresh ? prog?.task : undefined) ?? (isRun ? await taskOf(meta?.cwd ?? cwd, entry.name) : undefined) ?? (isRun ? undefined : summary?.status_detail)
          out.push({
            id: entry.id,
            name: entry.name,
            cls: classOf(entry.name, entry.class),
            state: isRun ? 'working' : 'idling',
            isBlocked: !isRun && summary?.status_category === 'blocked',
            task,
            note: isRun ? (isFresh ? prog?.note : undefined) : !isRun && task === summary?.status_detail ? undefined : summary?.status_detail,
            done,
            total: hasSteps ? prog?.total : undefined,
            elapsedMs: elapsed,
            etaMs: eta,
          })
        }
        await update($, members, () => out)
        await update($, since, () => nextSince)
        // The orchestrator watches the team: the chats listed in the roster do not open it for themselves.
        const isWatcher = selfRole === 'orchestrator' || (selfRole === 'outsider' && !roster.orchestrator)
        await update($, isOrch, () => isWatcher)
        if (!wasOpened && out.length > 0 && isWatcher && !(await $.store.get(closedKey(cwd)))) {
          wasOpened = true
          void $.ui.open({ id: PANE, title: 'Team' })
        }
      } catch (error) {
        $.ui.status(`demo-team-roster: ${String((error as Error)?.message ?? error).slice(0, 80)}`)
      }
    }

    $.clock.every(POLL_MS, () => void poll())
    void poll()
    return next(e)
  })

  on('command.run', { command: 'team' }, async $ => ({ text: await toggle($) }))

  // Closing it by hand is remembered too, so it does not come back by itself in this project.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') await $.store.set(`closed:${await $.session.cwd()}`, true)
    return next(e)
  })

  // A one-line chip above the prompt: always visible, one press opens or closes the pane.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, members)
    const watching = await read($, isOrch)
    if (e.props.hasSurvey || !watching || list.length === 0) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const working = list.filter(m => m.state === 'working').length
    return (
      <Box>
        <Button key="team" plain onPress={() => void toggle($)}>
          {working > 0 ? '●' : '○'} {working} working · {list.length - working} idling <Text dimColor>team</Text>
        </Button>
      </Box>
    )
  })

  // The model's own progress reports: one small file per chat, read by the orchestrator's pane.
  on('tool.call', { tool: STEP_TOOL }, async ($, e) => {
    const input = e as unknown as { task?: string; done?: number; total?: number; note?: string }
    const { home, sep } = homeOf($.plugin.root)
    const id = await $.session.id()
    const file = [home, '.claude', 'demo-team-roster', `${id}.json`].join(sep)
    let prev: Progress = {}
    try {
      prev = JSON.parse(String(await $.fs.read(file))) as Progress
    } catch {
      prev = {}
    }
    const now = await $.clock.now()
    const isNewTask = input.task !== undefined && input.task !== prev.task
    const data: Progress = {
      task: input.task ?? prev.task,
      done: input.done ?? prev.done,
      total: input.total ?? prev.total,
      note: input.note ?? prev.note,
      startedAt: isNewTask || !prev.startedAt ? now : prev.startedAt,
      updatedAt: now,
    }
    await $.fs.write(file, JSON.stringify(data))
    return { result: 'ok' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Svg } = $.ui.resolve(e) as unknown as {
      Box: (p: Record<string, unknown>) => unknown
      Text: (p: Record<string, unknown>) => unknown
      Svg?: (p: Record<string, unknown>) => unknown
    }
    const list = await read($, members)
    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No roster yet. Put _orchestration/roster.json in the project folder.</Text>
        </Box>
      )
    }
    const working = list.filter(m => m.state === 'working').length
    // The tile is as wide as the narrowest the pane can be. The pane's minimum is learned:
    // the smallest body width ever drawn is kept across sessions (a guess until then).
    const cols = Number((e.props as { bodyColumns?: number }).bodyColumns ?? e.viewport?.columns ?? 0)
    let minCols = Number(await $.store.get('minCols')) || MIN_COLS_GUESS
    if (cols > 0 && cols < minCols) {
      minCols = cols
      await $.store.set('minCols', cols).catch(() => undefined)
    }
    // Two minimums wide: two to a row, three: three, and so on. A little slack for the frame.
    const perRow = Math.max(1, Math.floor(((cols || minCols) + 2) / minCols))
    const width = `${(100 / perRow).toFixed(3)}%`
    const rows: Member[][] = []
    for (let i = 0; i < list.length; i += perRow) rows.push(list.slice(i, i + perRow))
    return (
      <Box flexDirection="column" gap={1}>
        {rows.map(row => (
          <Box flexDirection="row">
            {row.map(m => (
              <Box width={width} flexDirection="row" gap={1}>
                {Svg ? (
                  <Svg source={spriteSvg(m)} alt={`${m.name}, ${m.cls}, ${m.state}`} width={SPRITE_W} height={SPRITE_H} />
                ) : (
                  <Text>{m.state === 'working' ? '>' : 'z'}</Text>
                )}
                <Box flexDirection="column" flexGrow={1}>
                  <Box justifyContent="space-between">
                    <Text weight="semibold">{m.name}</Text>
                    <Text color={m.state === 'working' ? ACCENT[m.cls] : m.isBlocked ? '#c0392b' : undefined} dimColor={m.state !== 'working' && !m.isBlocked} size="footnote">
                      {statusOf(m)}
                    </Text>
                  </Box>
                  <Text wrap="truncate-end" size="footnote" dimColor={m.state !== 'working'}>
                    {m.task ?? (m.state === 'working' ? 'working…' : ' ')}
                  </Text>
                  <Box flexDirection="row" gap={1} alignItems="center">
                    <Box flexGrow={1}>{Svg ? <Svg source={barSvg(m)} alt="progress" height={BAR_H} /> : null}</Box>
                    <Box width={4} justifyContent="flex-end">
                      <Text size="caption" dimColor>
                        {pctOf(m) || ' '}
                      </Text>
                    </Box>
                  </Box>
                  <Box justifyContent="space-between">
                    <Text wrap="truncate-end" size="caption" dimColor>
                      {m.note ?? ' '}
                    </Text>
                    <Text size="caption" dimColor>
                      {timesOf(m) || ' '}
                    </Text>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        ))}
        <Text dimColor size="caption">
          {working} working, {list.length - working} idling · {cols} cols, min {minCols}, {perRow} per row
        </Text>
      </Box>
    )
  })
}
