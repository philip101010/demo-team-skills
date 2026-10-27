import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ClosedStats, Member, ProjectSummary } from '../types'
import { cardSvg, classOf, pctOf, statusOf, stepOf, summarySvg } from './sprites'

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
  working: ['in-progress', 'in progress', 'working', 'doing', 'rework', 'в роботі', 'виконується'],
  paused: ['paused', 'blocked', 'пауза', 'заблок'],
  review: ['review', 'plan-review', 'на перевірці'],
  queued: ['pending', 'queued', 'todo', 'new', 'prep-done', 'в черзі', 'очікує'],
}
const statusClass = (raw: string): string => Object.keys(SNAP_STATUS).find(k => SNAP_STATUS[k]?.some(w => raw.startsWith(w))) ?? (raw ? 'queued' : 'unknown')

const members = atom({ plugin: 'demo-team-roster', key: 'members' } as const, [] as Member[])
const since = atom({ plugin: 'demo-team-roster', key: 'since' } as const, {} as Record<string, number>)
const isOrch = atom({ plugin: 'demo-team-roster', key: 'isOrchestrator' } as const, false)
const summary = atom({ plugin: 'demo-team-roster', key: 'summary' } as const, null as ProjectSummary | null)

type RosterEntry = { name: string; id: string; class?: string; cwd?: string }
type RosterFile = { orchestrator?: RosterEntry; members?: RosterEntry[] }
type Progress = { task?: string; note?: string; done?: number; total?: number; startedAt?: number; updatedAt?: number }
type TaskRec = {
  mtime: number
  id: string
  title: string
  status: string
  performer: string
  priority: string
  depends: string
  wave?: number
  estimate?: number
  started?: number
  finished?: number
  blocker: string
  boxesDone: number
  boxesTotal: number
  /** Lines of the Review section that send the task back. */
  reworks: number
  /** A 'Verified by' line stands under Review. */
  verified: boolean
}

type TaskFacts = {
  current?: string
  done: number
  total: number
  steps?: { done: number; total: number }
  startedAt?: number
  blocker?: string
  estimateH?: number
  closed?: ClosedStats
}
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
  const taskCache = new Map<string, TaskRec>()
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
      const mine = JSON.parse(textOf(me) || '{}') as { sessionId?: string; title?: string }
      const selfLocal = mine.sessionId
      if (!selfLocal) return undefined
      // The lead carries this chat's own name ("Merlin TL (orchestrator, SGH)" is Merlin TL).
      const selfName = (mine.title ?? '').split(' (')[0]?.trim() || 'Lead'
      const res = await $.tool.call({ tool: LIST_TOOL, linked: true, limit: 100 } as never)
      const rows = JSON.parse(textOf(res) || '[]') as { sessionId: string; title?: string; name?: string; cwd?: string; startedBy?: string; isArchived?: boolean; isRunning?: boolean }[]
      // A fork of the lead has the lead's own title: it is another view of the lead, not a helper.
      const helpers = rows.filter(r => r.startedBy === selfLocal && !r.isArchived && (!mine.title || r.title !== mine.title))
      if (helpers.length === 0) return undefined
      // The same list says who is running right now.
      linkedRunning = new Set(helpers.filter(r => r.isRunning).map(r => r.sessionId))
      const nameOf = (r: { title?: string; name?: string }): string => (r.title ? r.title.split(' (')[0] : (r.name ?? 'helper')) ?? 'helper'
      return {
        orchestrator: { name: selfName, id: selfLocal, class: 'king' },
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

  // The task files: header lines are 'Key: value', or several of them on one line separated by '|'; the
  // checkboxes in the body (steps and acceptance) are counted as the task's own progress.
  const ACTIVE = ['in-progress', 'in progress', 'working', 'doing', 'rework', 'в роботі', 'виконується']
  const DONE = ['done', 'виконано', 'готово']
  const REVIEW = ['review', 'plan-review', 'на перевірці']
  const BLOCKED = ['blocked', 'paused', 'пауза', 'заблок']
  const NL = String.fromCharCode(10)
  const stamp = (s: string): number | undefined => {
    const m = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s)
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime() : undefined
  }
  const readText = async (path: string): Promise<string | undefined> => {
    try {
      const t = await $.fs.read(path)
      return typeof t === 'string' ? t : undefined
    } catch {
      return undefined
    }
  }

  const loadTasks = async (cwd: string): Promise<TaskRec[]> => {
    const out: TaskRec[] = []
    try {
      const dir = [cwd, '_orchestration', 'tasks'].join(sep)
      for (const f of await $.fs.list(dir)) {
        if (f.kind !== 'file' || !f.name.endsWith('.md')) continue
        const path = [dir, f.name].join(sep)
        let c = taskCache.get(path)
        if (!c || c.mtime !== f.mtimeMs) {
          const all = String(await $.fs.read(path)).split(NL)
          const lines = all.slice(0, 24)
          const title = (lines.find(l => l.startsWith('# ')) ?? '').slice(2).trim()
          let status = ''
          let performer = ''
          let priority = ''
          let depends = ''
          let wave: number | undefined
          let estimate: number | undefined
          let started: number | undefined
          let finished: number | undefined
          let blocker = ''
          for (const line of lines) {
            for (const part of line.split('|')) {
              const i = part.indexOf(':')
              if (i < 0) continue
              const key = part.slice(0, i).trim().toLowerCase()
              const raw = part.slice(i + 1).trim()
              const val = raw.toLowerCase()
              if ((key === 'status' || key === 'статус') && !status) status = val
              if ((key === 'performer' || key === 'виконавець') && !performer) performer = val
              if ((key === 'priority' || key === 'пріоритет') && !priority) priority = raw
              if ((key === 'depends on' || key === 'залежить від') && !depends) depends = raw
              if ((key === 'wave' || key === 'хвиля') && wave === undefined && /\d/.test(raw)) wave = parseInt(raw.replace(/\D+/g, ''), 10)
              if ((key === 'estimate' || key === 'оцінка') && estimate === undefined) {
                const n = parseFloat(raw.replace(',', '.'))
                if (n > 0) estimate = n
              }
              if ((key === 'started' || key === 'початок') && started === undefined) started = stamp(raw)
              if ((key === 'finished' || key === 'завершено') && finished === undefined) finished = stamp(raw)
              if ((key === 'blocker' || key === 'блокер') && !blocker && raw !== '-') blocker = raw.slice(0, 90)
            }
          }
          let boxesDone = 0
          let boxesTotal = 0
          let reworks = 0
          let verified = false
          let inReview = false
          for (const line of all) {
            if (line.startsWith('## ')) inReview = line.slice(3).trim().toLowerCase().startsWith('review')
            if (inReview) {
              if (/^\s*[-*]\s*(?:\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}\s*)?rework/i.test(line)) reworks += 1
              if (/verified by\s*:?\s*\S/i.test(line)) verified = true
            }
            const m = /^\s*[-*] \[( |x|X)\]/.exec(line)
            if (!m) continue
            boxesTotal += 1
            if (m[1] !== ' ') boxesDone += 1
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
            wave,
            estimate,
            started,
            finished,
            blocker,
            boxesDone,
            boxesTotal,
            reworks,
            verified,
          }
          taskCache.set(path, c)
        }
        out.push(c)
      }
    } catch {
      // no tasks folder
    }
    return out
  }

  // What the task files say about a helper: its current task, how many of its tasks are done, the steps of the
  // current one (its checkboxes) and what blocks it.
  const tasksFor = async (cwd: string, name: string): Promise<TaskFacts> => {
    const res: TaskFacts = { done: 0, total: 0 }
    const first = name.toLowerCase().replace(/[^a-z]+/g, ' ').trim().split(' ')[0] ?? ''
    if (!first) return res
    const closed: TaskRec[] = []
    for (const c of await loadTasks(cwd)) {
      if (!c.performer.includes(first)) continue
      res.total += 1
      if (DONE.some(w => c.status.startsWith(w))) {
        res.done += 1
        closed.push(c)
      } else if (!res.current && (ACTIVE.some(w => c.status.startsWith(w)) || REVIEW.some(w => c.status.startsWith(w)))) {
        res.current = c.title
        res.startedAt = c.started
        res.estimateH = c.estimate
        if (c.boxesTotal > 0) res.steps = { done: c.boxesDone, total: c.boxesTotal }
      }
      if (!res.blocker && BLOCKED.some(w => c.status.startsWith(w))) {
        // A blocked member still shows its task and how far it got.
        if (!res.current) res.current = c.title
        if (!res.steps && c.boxesTotal > 0) res.steps = { done: c.boxesDone, total: c.boxesTotal }
        res.blocker = c.blocker || (c.status.startsWith('blocked-approval') ? 'approval needed' : c.status.startsWith('blocked') ? 'waiting for a dependency' : '')
      }
    }
    if (res.total > 0) {
      // What it has closed: how many, how many today, how often the review passed first time, and the latest
      // ones one by one (0 passed first time, 1 after one rework, 2 after more, -1 no review data).
      const today = new Date(Number(await $.clock.now())).toDateString()
      closed.sort((a, b) => (a.finished ?? 0) - (b.finished ?? 0))
      const reviewed = closed.filter(c => c.verified || c.reworks > 0)
      res.closed = {
        total: closed.length,
        today: closed.filter(c => c.finished !== undefined && new Date(c.finished).toDateString() === today).length,
        ...(reviewed.length >= 2 ? { firstPass: reviewed.filter(c => c.reworks === 0).length / reviewed.length } : {}),
        recent: closed.slice(-12).map(c => (c.reworks > 0 ? Math.min(2, c.reworks) : c.verified ? 0 : -1)),
      }
    }
    return res
  }

  const listTasks = async (dir: string) => {
    const out: { id: string; title: string; priority: string; status: string; performer: string; depends: string; wave: number | null; estimate: number | null }[] = []
    for (const c of await loadTasks(dir)) {
      const dep = c.depends.replace('(', ',').split(',')[0]?.trim() ?? ''
      out.push({
        id: c.id,
        title: c.title.slice(0, 110),
        priority: c.priority,
        status: statusClass(c.status),
        performer: (c.performer.split('.')[0] ?? '').slice(0, 40),
        depends: ['-', '0', 'none', 'немає'].includes(dep) ? '' : dep.slice(0, 40),
        wave: c.wave ?? null,
        estimate: c.estimate ?? null,
      })
    }
    return out
  }

  // Where the project stands: the stage (STATE.md), tasks verified of all, what blocks, what waits for the
  // user (pending rows of APPROVALS.md) and the hours left. Time left runs wave after wave: a wave takes its
  // longest task or its total divided by the performers in it, whichever is longer; the sum is corrected by
  // how long the finished tasks really took against their estimates.
  const projSummary = async (dir: string): Promise<ProjectSummary | null> => {
    const tasks = await loadTasks(dir)
    let stage = ''
    for (const line of ((await readText([dir, '_orchestration', 'STATE.md'].join(sep))) ?? '').split(NL).slice(0, 60)) {
      const m = /^\s*(?:stage|етап)\s*:\s*(.+)$/i.exec(line)
      if (m) {
        stage = (m[1] ?? '').trim().slice(0, 40)
        break
      }
    }
    let needsUser = 0
    for (const line of ((await readText([dir, '_orchestration', 'APPROVALS.md'].join(sep))) ?? '').split(NL)) {
      if (line.trim().startsWith('|') && line.split('|').some(cell => ['pending', 'очікує'].includes(cell.trim().toLowerCase()))) needsUser += 1
    }
    if (tasks.length === 0 && !stage) return null
    const isDone = (c: TaskRec): boolean => DONE.some(w => c.status.startsWith(w))
    const open = tasks.filter(c => !isDone(c))
    const known = tasks.map(c => c.estimate).filter((e): e is number => typeof e === 'number').sort((x, y) => x - y)
    let hoursLeft: number | undefined
    if (tasks.length > 0 && open.length === 0) hoursLeft = 0
    else if (known.length > 0) {
      const dflt = known[Math.floor(known.length / 2)] ?? 1
      const now = Number(await $.clock.now())
      const left = (c: TaskRec): number => {
        const est = c.estimate ?? dflt
        if (REVIEW.some(w => c.status.startsWith(w))) return est * 0.2
        if (ACTIVE.some(w => c.status.startsWith(w)) && c.started) return Math.max(est * 0.1, est - (now - c.started) / 3600000)
        return est
      }
      const waves = new Map<number, TaskRec[]>()
      for (const c of open) waves.set(c.wave ?? 0, [...(waves.get(c.wave ?? 0) ?? []), c])
      let sum = 0
      for (const list of waves.values()) {
        const parts = list.map(left)
        const total = parts.reduce((x, y) => x + y, 0)
        const workers = new Set(list.map(c => c.performer).filter(Boolean)).size
        sum += Math.max(Math.max(...parts), total / Math.min(Math.max(1, workers), list.length))
      }
      let estimated = 0
      let real = 0
      for (const c of tasks) {
        if (isDone(c) && c.estimate && c.started && c.finished && c.finished > c.started) {
          estimated += c.estimate
          real += (c.finished - c.started) / 3600000
        }
      }
      const k = estimated > 0 ? Math.min(3, Math.max(0.5, real / estimated)) : 1
      hoursLeft = Math.round(sum * k * 2) / 2
    }
    return {
      stage,
      total: tasks.length,
      done: tasks.length - open.length,
      review: tasks.filter(c => REVIEW.some(w => c.status.startsWith(w))).length,
      blocked: tasks.filter(c => BLOCKED.some(w => c.status.startsWith(w))).length,
      working: tasks.filter(c => ACTIVE.some(w => c.status.startsWith(w))).length,
      needsUser,
      ...(hoursLeft === undefined ? {} : { hoursLeft }),
    }
  }

  // The pane of a watching chat writes what it shows, one file per project, so the dashboard reads those
  // (a chat cannot read the other projects' folders itself).
  const slugOf = (name: string): string => {
    const plain = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (plain) return plain
    let h = 0
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 1000003
    return 'p' + h
  }
  const lastLive = new Map<string, { key: string; at: number }>()
  const publishLive = async (dir: string, members: Record<string, unknown>[], sum: ProjectSummary | null): Promise<void> => {
    const name = dir.slice(dir.lastIndexOf(sep) + 1)
    const slug = slugOf(name)
    const now = Number(await $.clock.now())
    const project = { slug, name, members, working: members.filter(m => m.state === 'working').length, tasks: await listTasks(dir), summary: sum }
    const key = JSON.stringify(project)
    const prev = lastLive.get(slug)
    if (prev && prev.key === key && now - prev.at < 8000) return
    lastLive.set(slug, { key, at: now })
    await $.fs.write([rosterDir, `live-${slug}.json`].join(sep), JSON.stringify({ ...project, generatedAt: now }))
  }
  const readLive = async (): Promise<{ slug: string; generatedAt?: number }[]> => {
    const out: { slug: string; generatedAt?: number }[] = []
    try {
      for (const f of await $.fs.list(rosterDir)) {
        if (f.kind !== 'file' || !f.name.startsWith('live-') || !f.name.endsWith('.json')) continue
        const p = await readJson<{ slug: string; generatedAt?: number }>([rosterDir, f.name].join(sep))
        if (p?.slug) out.push(p)
      }
    } catch {
      // nothing published yet
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
    const projects: { slug: string; generatedAt?: number }[] = []
    try {
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
          const total = reported ? prog?.total : tf.steps ? tf.steps.total : tf.total > 0 ? tf.total : undefined
          const done = typeof total === 'number' ? Math.min(total, reported ? (prog?.done ?? 0) : tf.steps ? tf.steps.done : tf.done) : undefined
          if (isRun && !seenWorking.has(e.id)) seenWorking.set(e.id, now)
          if (!isRun) seenWorking.delete(e.id)
          const base = prog?.startedAt && fresh ? prog.startedAt : (tf.startedAt ?? seenWorking.get(e.id))
          const elapsed = isRun && base ? now - base : undefined
          const eta = isRun && typeof total === 'number' && done && done > 0 && elapsed !== undefined && total > done ? (elapsed / done) * (total - done) : undefined
          const summary = meta?.postTurnSummary
          out.push({
            id: e.id,
            name: e.name,
            role,
            cls: classOf(e.name, e.class),
            state: isRun ? 'working' : 'idling',
            blocked: !!tf.blocker || (!isRun && summary?.status_category === 'blocked'),
            task: (fresh ? prog?.task : undefined) ?? tf.current ?? (isRun ? undefined : summary?.status_detail) ?? '',
            note: tf.blocker || ((isRun && fresh ? prog?.note : undefined) ?? ''),
            done: done ?? null,
            total: total ?? null,
            elapsedMs: elapsed ?? null,
            etaMs: eta ?? null,
            tasksDone: tf.total > 0 ? tf.done : null,
            closed: tf.closed ?? null,
            estimateH: tf.estimateH ?? null,
          })
        }
        projects.push({
          slug: slugOf(d.name),
          generatedAt: now,
          name: d.name,
          members: out,
          working: out.filter(m => m.state === 'working').length,
          tasks: await listTasks(dir),
          summary: await projSummary(dir),
        } as { slug: string; generatedAt?: number })
      }
    } catch {
      // the other projects' folders are not readable from here: the published files carry them
    }
    const bySlug = new Map<string, { slug: string; generatedAt?: number }>()
    for (const p of [...(await readLive()), ...projects]) {
      const old = bySlug.get(p.slug)
      if (!old || (p.generatedAt ?? 0) >= (old.generatedAt ?? 0)) bySlug.set(p.slug, p)
    }
    return { generatedAt: now, projects: [...bySlug.values()] }
  }
  return { sep, rosterDir, projectsDir, readJson, findMeta, findRosterDir, linkedRoster, linkedRunningIds: () => linkedRunning, progressFor, runningIds, tasksFor, snapshot, publishLive, projSummary, diag }
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

    const { sep, rosterDir, projectsDir, readJson, findMeta, findRosterDir, linkedRoster, linkedRunningIds, progressFor, runningIds, tasksFor, publishLive, projSummary } = makeTools($)
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
          const total = reported ? prog?.total : tf.steps ? tf.steps.total : tf.total > 0 ? tf.total : undefined
          const hasSteps = typeof total === 'number' && total > 0
          const done = hasSteps ? Math.min(total ?? 0, reported ? (prog?.done ?? 0) : tf.steps ? tf.steps.done : tf.done) : undefined
          const base = prog?.startedAt && isFresh ? prog.startedAt : (tf.startedAt ?? nextSince[entry.id])
          const elapsed = isRun && base ? now - base : undefined
          const eta = isRun && hasSteps && done && done > 0 && elapsed !== undefined && (total ?? 0) > done ? (elapsed / done) * ((total ?? 0) - done) : undefined
          const summary = meta?.postTurnSummary
          const task = (isFresh ? prog?.task : undefined) ?? tf.current ?? (isRun ? undefined : summary?.status_detail)
          out.push({
            id: entry.id,
            name: entry.name,
            cls: classOf(entry.name, entry.class),
            state: isRun ? 'working' : 'idling',
            isBlocked: !!tf.blocker || (!isRun && summary?.status_category === 'blocked'),
            task,
            note: tf.blocker ? tf.blocker : isRun ? (isFresh ? prog?.note : undefined) : !isRun && task === summary?.status_detail ? undefined : summary?.status_detail,
            done,
            total: hasSteps ? total : undefined,
            elapsedMs: elapsed,
            etaMs: eta,
            tasksDone: tf.total > 0 ? tf.done : undefined,
            closed: tf.closed,
            estimateH: tf.estimateH,
          })
        }
        await update($, members, () => out)
        await update($, since, () => nextSince)
        // The team is watched by the orchestrator and by any other chat in the project folder that is
        // not a listed helper (a fork or a resumed copy of the orchestrator has a new session id).
        const isWatcher = selfRole !== 'member'
        await update($, isOrch, () => isWatcher)
        // A project folder (a roster file, or a folder under Workspaces): publish what this pane shows.
        const projDir = fromFile ? projectDir : cwd.toLowerCase().includes(`${sep}workspaces${sep}`) ? cwd : undefined
        const sum = projDir ? await projSummary(projDir) : null
        await update($, summary, () => sum)
        if (isWatcher && projDir) {
          const lead = roster.orchestrator?.id
          await publishLive(
            projDir,
            out.map((m, i) => ({
              id: m.id,
              name: m.name,
              role: entries[i]?.id === lead ? 'orchestrator' : 'helper',
              cls: m.cls,
              state: m.state,
              blocked: m.isBlocked,
              task: m.task ?? '',
              note: m.note ?? '',
              done: m.done ?? null,
              total: m.total ?? null,
              elapsedMs: m.elapsedMs ?? null,
              etaMs: m.etaMs ?? null,
              tasksDone: m.tasksDone ?? null,
              closed: m.closed ?? null,
              estimateH: m.estimateH ?? null,
            })),
            sum,
          )
        }
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
    const sum = await read($, summary)
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
        {sum && Svg ? (
          <Svg
            source={summarySvg(sum)}
            alt={`Project: ${sum.stage || 'no stage set'}. ${sum.done} of ${sum.total} tasks verified. ${sum.hoursLeft === undefined ? '' : `About ${sum.hoursLeft} hours left. `}${sum.blocked} blocked, ${sum.needsUser} waiting for you.`}
          />
        ) : null}
        {rows.map(row => (
          <Box flexDirection="row">
            {row.map(m => (
              <Box width={width}>
                {Svg ? (
                  <Svg source={cardSvg(m)} alt={`${m.name}, ${m.cls}, ${statusOf(m)}. ${m.task ?? ''} ${stepOf(m)} ${m.closed ? `${m.closed.total} closed, ${m.closed.today} today.` : ''}`.trim()} />
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
