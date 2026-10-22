import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Member } from '../types'
import { cardSvg, classOf, pctOf, statusOf, stepOf } from './sprites'

const PANE = 'demo-team-roster'
// Cells across the narrowest the pane can be, until the real one has been seen.
const MIN_COLS_GUESS = 32
const POLL_MS = 4000
const STEP_TOOL = 'mcp__demo-team-roster__roster_step'
const SNAP_TOOL = 'mcp__demo-team-roster__team_snapshot'
const PROGRESS_RULE =
  'This project has a team roster (_orchestration/roster.json) that a Team widget and a dashboard show live. Report your own progress with the roster_step tool. It is a deferred tool: load its schema first with ToolSearch (query "select:mcp__demo-team-roster__roster_step"), then call it when you start a task (task = short title, done = 0, total = the number of steps you plan) and after each finished step (done, note = what you do next). Do this before your first real action on a task. Skip it only for one-step work.'
const LIST_TOOL = 'mcp__ccd_session_mgmt__list_sessions'
const GET_TOOL = 'mcp__ccd_session_mgmt__get_session'
// An empty value keeps its row, so the tile never changes shape.
const EMPTY = '—'
const SNAP_STATUS: Record<string, string[]> = {
  done: ['done', 'виконано', 'готово'],
  working: ['in-progress', 'in progress', 'working', 'doing', 'в роботі', 'виконується'],
  paused: ['paused', 'blocked', 'пауза', 'заблок'],
  queued: ['pending', 'queued', 'todo', 'new', 'prep-done', 'в черзі', 'очікує'],
}
const statusClass = (raw: string): string => Object.keys(SNAP_STATUS).find(k => SNAP_STATUS[k]?.some(w => raw.startsWith(w))) ?? (raw ? 'queued' : 'unknown')

const members = atom({ plugin: 'demo-team-roster', key: 'members' } as const, [] as Member[])
const since = atom({ plugin: 'demo-team-roster', key: 'since' } as const, {} as Record<string, number>)
const isOrch = atom({ plugin: 'demo-team-roster', key: 'isOrchestrator' } as const, false)

type RosterEntry = { name: string; id: string; class?: string; cwd?: string }
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

// Where things live is derived from this plugin's own folder, which sits under ~/.claude.
const homeOf = (root: string): { home: string; sep: string } => {
  const sep = root.includes('\\') ? '\\' : '/'
  const i = root.toLowerCase().indexOf(`${sep}.claude${sep}`)
  return { home: i >= 0 ? root.slice(0, i) : root, sep }
}

const seenWorking = new Map<string, number>()

const makeTools = ($: any) => {
  const { home, sep } = homeOf($.plugin.root)
  const sessionsRoot = [home, 'AppData', 'Roaming', 'Claude', 'claude-code-sessions'].join(sep)
  const rosterDir = [home, '.claude', 'demo-team-roster'].join(sep)
  const projectsDir = [home, '.claude', 'projects'].join(sep)
  const metaPaths = new Map<string, string>()
  const taskCache = new Map<string, { mtime: number; id: string; title: string; status: string; performer: string; priority: string; depends: string }>()
  let canList = true
  let listFailedAt = 0

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
    } catch (error) {
      diag.metaError = String((error as Error)?.message ?? error).slice(0, 60)
    }
    return undefined
  }

  // The helper's own progress report: a file per chat, named by its app id (known to the watcher) or its engine id.
  const progressFor = async (id: string, meta?: SessionMeta): Promise<Progress | undefined> =>
    (await readJson<Progress>([rosterDir, `${id}.json`].join(sep))) ?? (meta?.cliSessionId ? await readJson<Progress>([rosterDir, `${meta.cliSessionId}.json`].join(sep)) : undefined)

  // A failed call is not forever: try again after a while (the tool may not be ready at start).
  const diag = { listError: '', metaError: '' }
  let linkedRunning: Set<string> | undefined
  const runningIds = async (): Promise<Set<string> | undefined> => {
    const now = Number(await $.clock.now())
    if (!canList && now - listFailedAt < 20000) return undefined
    // Two reads, either may fail: the chats of this chat's own family (a short list), and the latest chats
    // overall (kept short: a list of 100 came back as an error text, too big to return). A running chat is
    // among the latest, so a short list sees it.
    const running = new Set<string>()
    let isRead = false
    let lastError = ''
    for (const args of [{ linked: true, limit: 100 }, { limit: 25 }]) {
      try {
        const text = textOf(await $.tool.call({ tool: LIST_TOOL, ...args } as never)) || '[]'
        if (!text.trimStart().startsWith('[')) throw new Error(text.slice(0, 70))
        for (const r of JSON.parse(text) as { sessionId: string; isRunning?: boolean }[]) if (r.isRunning) running.add(r.sessionId)
        isRead = true
      } catch (error) {
        lastError = String((error as Error)?.message ?? error).slice(0, 60)
      }
    }
    canList = isRead
    if (!isRead) listFailedAt = now
    diag.listError = isRead ? '' : lastError
    return isRead ? running : undefined
  }

  // A tool call comes back as text, or wrapped in a result; take whichever is there.
  const textOf = (res: unknown): string => {
    const r = res as { text?: string; result?: { text?: string } | string } | string | undefined
    if (typeof r === 'string') return r
    const inner = r?.result
    return r?.text ?? (typeof inner === 'string' ? inner : inner?.text) ?? ''
  }

  // No roster file: the team is the chats this chat started (its helper sub-sessions), read live from the app.
  const linkedRoster = async (): Promise<RosterFile | undefined> => {
    try {
      const me = await $.tool.call({ tool: GET_TOOL, session_id: 'self' } as never)
      const selfLocal = (JSON.parse(textOf(me) || '{}') as { sessionId?: string }).sessionId
      if (!selfLocal) return undefined
      const res = await $.tool.call({ tool: LIST_TOOL, linked: true, limit: 100 } as never)
      const rows = JSON.parse(textOf(res) || '[]') as { sessionId: string; title?: string; name?: string; cwd?: string; startedBy?: string; isArchived?: boolean; isRunning?: boolean }[]
      const helpers = rows.filter(r => r.startedBy === selfLocal && !r.isArchived)
      if (helpers.length === 0) return undefined
      // The same list says who is running right now.
      linkedRunning = new Set(helpers.filter(r => r.isRunning).map(r => r.sessionId))
      const nameOf = (r: { title?: string; name?: string }): string => (r.title ? r.title.split(' (')[0] : (r.name ?? 'helper')) ?? 'helper'
      return {
        orchestrator: { name: 'Lead', id: selfLocal, class: 'king' },
        // The list is ordered by recent activity; a fixed order (by name) keeps the knights in place.
        members: helpers.map(r => ({ name: nameOf(r), id: r.sessionId, cwd: r.cwd })).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
      }
    } catch {
      return undefined
    }
  }

  // The project folder whose roster lists this chat. Its own folder first; a chat opened elsewhere
  // (the orchestrator in a work folder) is found by id among the projects next to it and under the workspaces root.
  const rosterAt = (dir: string): string => [dir, '_orchestration', 'roster.json'].join(sep)
  let foundDir: { selfId: string; dir?: string; at: number } | undefined
  const findRosterDir = async (cwd: string, selfId: string): Promise<string | undefined> => {
    if (await readJson<RosterFile>(rosterAt(cwd))) return cwd
    const now = await $.clock.now()
    if (foundDir && foundDir.selfId === selfId && (foundDir.dir ? !!(await readJson<RosterFile>(rosterAt(foundDir.dir))) : now - foundDir.at < 30000)) return foundDir.dir
    const cfg = await readJson<{ workspaces?: string }>([rosterDir, 'config.json'].join(sep))
    const parent = cwd.slice(0, Math.max(cwd.lastIndexOf(sep), 0))
    const roots = [cfg?.workspaces, parent, parent ? [parent, 'Workspaces'].join(sep) : undefined].filter((r, i, all): r is string => !!r && all.indexOf(r) === i)
    let dir: string | undefined
    scan: for (const root of roots) {
      try {
        for (const d of await $.fs.list(root)) {
          if (d.kind !== 'directory') continue
          const candidate = [root, d.name].join(sep)
          const roster = await readJson<RosterFile>(rosterAt(candidate))
          if (!roster) continue
          for (const entry of [...(roster.orchestrator ? [roster.orchestrator] : []), ...(roster.members ?? [])]) {
            const file = await findMeta(entry.id)
            const meta = file ? await readJson<SessionMeta>(file) : undefined
            if (meta?.cliSessionId === selfId) {
              dir = candidate
              break scan
            }
          }
        }
      } catch {
        // root not readable: try the next one
      }
    }
    foundDir = { selfId, dir, at: now }
    return dir
  }

  // What the task files say about a helper: its current task and how many of its tasks are done.
  // Header lines are 'Key: value', or several of them on one line separated by '|'.
  const ACTIVE = ['in-progress', 'in progress', 'working', 'doing', 'в роботі', 'виконується']
  const DONE = ['done', 'виконано', 'готово']
  const tasksFor = async (cwd: string, name: string): Promise<{ current?: string; done: number; total: number }> => {
    const res: { current?: string; done: number; total: number } = { done: 0, total: 0 }
    try {
      const dir = [cwd, '_orchestration', 'tasks'].join(sep)
      const first = name.toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ')[0] ?? ''
      if (!first) return res
      for (const f of await $.fs.list(dir)) {
        if (f.kind !== 'file' || !f.name.endsWith('.md')) continue
        const path = [dir, f.name].join(sep)
        let c = taskCache.get(path)
        if (!c || c.mtime !== f.mtimeMs) {
          const lines = String(await $.fs.read(path)).split(String.fromCharCode(10)).slice(0, 14)
          const title = (lines.find(l => l.startsWith('# ')) ?? '').slice(2).trim()
          let status = ''
          let performer = ''
          let priority = ''
          let depends = ''
          for (const line of lines) {
            for (const part of line.split('|')) {
              const i = part.indexOf(':')
              if (i < 0) continue
              const key = part.slice(0, i).trim().toLowerCase()
              const val = part.slice(i + 1).trim().toLowerCase()
              if ((key === 'status' || key === 'статус') && !status) status = val
              if ((key === 'performer' || key === 'виконавець') && !performer) performer = val
              if ((key === 'priority' || key === 'пріоритет') && !priority) priority = part.slice(i + 1).trim()
              if ((key === 'depends on' || key === 'залежить від') && !depends) depends = part.slice(i + 1).trim()
            }
          }
          const colon = title.indexOf(':')
          c = {
            mtime: f.mtimeMs,
            id: (colon > 0 ? title.slice(0, colon) : f.name.replace('.md', '')).slice(0, 22),
            title: colon > 0 ? title.slice(colon + 1).trim() : title,
            status,
            performer,
            priority,
            depends,
          }
          taskCache.set(path, c)
        }
        if (!c.performer.includes(first)) continue
        res.total += 1
        if (DONE.some(w => c.status.startsWith(w))) res.done += 1
        else if (!res.current && ACTIVE.some(w => c.status.startsWith(w))) res.current = c.title
      }
    } catch {
      // no tasks folder
    }
    return res
  }

  const listTasks = async (dir: string) => {
    const out: { id: string; title: string; priority: string; status: string; performer: string; depends: string }[] = []
    try {
      const tdir = [dir, '_orchestration', 'tasks'].join(sep)
      await tasksFor(dir, '~') // fills the task cache for every file in the folder
      for (const f of await $.fs.list(tdir)) {
        if (f.kind !== 'file' || !f.name.endsWith('.md')) continue
        const c = taskCache.get([tdir, f.name].join(sep))
        if (!c) continue
        const dep = c.depends.replace('(', ',').split(',')[0]?.trim() ?? ''
        out.push({
          id: c.id,
          title: c.title.slice(0, 110),
          priority: c.priority,
          status: statusClass(c.status),
          performer: (c.performer.split('.')[0] ?? '').slice(0, 40),
          depends: ['-', '0', 'none', 'немає'].includes(dep) ? '' : dep.slice(0, 40),
        })
      }
    } catch {
      // no tasks folder
    }
    return out
  }

  // Every project's roster in one reading: what the dashboard shows live.
  const snapshot = async () => {
    const cwd = String(await $.session.cwd())
    const at = cwd.toLowerCase().indexOf(`${sep}workspaces`)
    const cfg = await readJson<{ workspaces?: string }>([rosterDir, 'config.json'].join(sep))
    const root = cfg?.workspaces ?? (at >= 0 ? cwd.slice(0, at + 11) : [cwd.slice(0, Math.max(cwd.lastIndexOf(sep), 0)), 'Workspaces'].join(sep))
    const running = await runningIds()
    const now = await $.clock.now()
    const projects: unknown[] = []
    for (const d of await $.fs.list(root)) {
      if (d.kind !== 'directory') continue
      const dir = [root, d.name].join(sep)
      const roster = await readJson<RosterFile>([dir, '_orchestration', 'roster.json'].join(sep))
      if (!roster) continue
      const entries: { e: RosterEntry; role: string }[] = [
        ...(roster.orchestrator ? [{ e: roster.orchestrator, role: 'orchestrator' }] : []),
        ...(roster.members ?? []).map(e => ({ e, role: 'helper' })),
      ]
      const out: Record<string, unknown>[] = []
      for (const { e, role } of entries) {
        const file = await findMeta(e.id)
        const meta = file ? await readJson<SessionMeta>(file) : undefined
        const isRun = running ? running.has(e.id) : false
        const prog = await progressFor(e.id, meta)
        const tf = await tasksFor(dir, e.name)
        const fresh = !!prog?.updatedAt && now - prog.updatedAt < 6 * 3600 * 1000
        const reported = fresh && typeof prog?.total === 'number' && prog.total > 0
        const total = reported ? prog?.total : tf.total > 0 ? tf.total : undefined
        const done = typeof total === 'number' ? Math.min(total, reported ? (prog?.done ?? 0) : tf.done) : undefined
        if (isRun && !seenWorking.has(e.id)) seenWorking.set(e.id, now)
        if (!isRun) seenWorking.delete(e.id)
        const base = prog?.startedAt && fresh ? prog.startedAt : seenWorking.get(e.id)
        const elapsed = isRun && base ? now - base : undefined
        const eta = isRun && typeof total === 'number' && done && done > 0 && elapsed !== undefined && total > done ? (elapsed / done) * (total - done) : undefined
        const summary = meta?.postTurnSummary
        out.push({
          id: e.id,
          name: e.name,
          role,
          cls: classOf(e.name, e.class),
          state: isRun ? 'working' : 'idling',
          blocked: !isRun && summary?.status_category === 'blocked',
          task: (fresh ? prog?.task : undefined) ?? (isRun ? tf.current : undefined) ?? (isRun ? undefined : summary?.status_detail) ?? '',
          note: (isRun && fresh ? prog?.note : undefined) ?? '',
          done: done ?? null,
          total: total ?? null,
          elapsedMs: elapsed ?? null,
          etaMs: eta ?? null,
        })
      }
      projects.push({
        slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: d.name,
        members: out,
        working: out.filter(m => m.state === 'working').length,
        tasks: await listTasks(dir),
      })
    }
    return { generatedAt: now, projects }
  }
  return { sep, rosterDir, projectsDir, readJson, findMeta, findRosterDir, linkedRoster, linkedRunningIds: () => linkedRunning, progressFor, runningIds, tasksFor, snapshot, diag }
}

export const register: Register = on => {
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

    await $.tool.register({
      name: 'team_snapshot',
      description: 'Read-only: every demo project roster under the workspaces folder (members with state and progress, task list) as JSON. Used by the Demo Team Roster dashboard.',
      inputSchema: { type: 'object', properties: {} },
    })

    const { sep, rosterDir, projectsDir, readJson, findMeta, findRosterDir, linkedRoster, linkedRunningIds, progressFor, runningIds, tasksFor } = makeTools($)
    let wasOpened = false
    const closedKey = (cwd: string): string => `closed:${cwd}`

    const poll = async (): Promise<void> => {
      try {
        const cwd = await $.session.cwd()
        const selfCli = await $.session.id()
        const projectDir = await findRosterDir(cwd, selfCli)
        const fileRoster = projectDir ? await readJson<RosterFile>([projectDir, '_orchestration', 'roster.json'].join(sep)) : undefined
        const fromFile = !!fileRoster
        const roster = fileRoster ?? (await linkedRoster())
        if (!roster) {
          await update($, members, () => [])
          return
        }
        const entries: RosterEntry[] = [...(roster.orchestrator ? [roster.orchestrator] : []), ...(roster.members ?? [])]
        let selfRole: 'orchestrator' | 'member' | 'outsider' = 'outsider'
        const running = (!fromFile ? linkedRunningIds() : undefined) ?? (await runningIds())
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
          const prog = await progressFor(entry.id, meta)
          if (isRun && !nextSince[entry.id]) nextSince[entry.id] = now
          if (!isRun) delete nextSince[entry.id]
          const tf = await tasksFor(entry.cwd ?? meta?.cwd ?? projectDir ?? cwd, entry.name)
          const isFresh = !!prog?.updatedAt && now - prog.updatedAt < 6 * 3600 * 1000
          // The helper's own reports win; without them the bar is its task files: done of its own.
          const reported = isFresh && typeof prog?.total === 'number' && prog.total > 0
          const total = reported ? prog?.total : tf.total > 0 ? tf.total : undefined
          const hasSteps = typeof total === 'number' && total > 0
          const done = hasSteps ? Math.min(total ?? 0, reported ? (prog?.done ?? 0) : tf.done) : undefined
          const base = prog?.startedAt && isFresh ? prog.startedAt : nextSince[entry.id]
          const elapsed = isRun && base ? now - base : undefined
          const eta = isRun && hasSteps && done && done > 0 && elapsed !== undefined && (total ?? 0) > done ? (elapsed / done) * ((total ?? 0) - done) : undefined
          const summary = meta?.postTurnSummary
          const task = (isFresh ? prog?.task : undefined) ?? (isRun ? tf.current : undefined) ?? (isRun ? undefined : summary?.status_detail)
          out.push({
            id: entry.id,
            name: entry.name,
            cls: classOf(entry.name, entry.class),
            state: isRun ? 'working' : 'idling',
            isBlocked: !isRun && summary?.status_category === 'blocked',
            task,
            note: isRun ? (isFresh ? prog?.note : undefined) : !isRun && task === summary?.status_detail ? undefined : summary?.status_detail,
            done,
            total: hasSteps ? total : undefined,
            elapsedMs: elapsed,
            etaMs: eta,
          })
        }
        await update($, members, () => out)
        await update($, since, () => nextSince)
        // The team is watched by the orchestrator and by any other chat in the project folder that is
        // not a listed helper (a fork or a resumed copy of the orchestrator has a new session id).
        const isWatcher = selfRole !== 'member'
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

  on('tool.call', { tool: SNAP_TOOL }, async $ => ({ result: JSON.stringify(await makeTools($).snapshot()) }))

  // Every chat in a roster project is told how to report progress, so nobody has to brief the helpers.
  on('prompt.compose', async ($, e, next) => {
    const res = await next(e)
    try {
      const cwd = String(await $.session.cwd())
      const { sep } = homeOf($.plugin.root)
      if (!(await $.fs.exists([cwd, '_orchestration', 'roster.json'].join(sep)))) return res
    } catch {
      return res
    }
    return { sections: [...res.sections, { id: 'demo-team-roster:progress', text: PROGRESS_RULE, scope: 'session' as const }] }
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
    // The watcher knows a helper by its app id, so the same report is kept under that name too.
    try {
      const me = await $.tool.call({ tool: GET_TOOL, session_id: 'self' } as never)
      const text = String((me as { text?: string; result?: { text?: string } })?.text ?? (me as { result?: { text?: string } })?.result?.text ?? '')
      const local = (JSON.parse(text || '{}') as { sessionId?: string }).sessionId
      if (local) await $.fs.write([home, '.claude', 'demo-team-roster', `${local}.json`].join(sep), JSON.stringify(data))
    } catch {
      // the engine-id file is still there
    }
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
    const width = `${Math.floor(100 / perRow)}%`
    const rows: Member[][] = []
    for (let i = 0; i < list.length; i += perRow) rows.push(list.slice(i, i + perRow))
    return (
      <Box flexDirection="column">
        {rows.map(row => (
          <Box flexDirection="row">
            {row.map(m => (
              <Box width={width}>
                {Svg ? (
                  <Svg source={cardSvg(m)} alt={`${m.name}, ${m.cls}, ${statusOf(m)}. ${pctOf(m)} ${m.task ?? ''} ${stepOf(m)}`.trim()} />
                ) : (
                  <Text wrap="truncate-end">
                    {m.state === 'working' ? '>' : 'z'} {m.name} {pctOf(m) || EMPTY} {m.task ?? EMPTY}
                  </Text>
                )}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
