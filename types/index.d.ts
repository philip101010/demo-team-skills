export type Cls = 'mage' | 'paladin' | 'rogue' | 'cleric' | 'ranger' | 'barbarian' | 'king'

/** What a member has closed (tasks of its own with status done), from the task files. */
export type ClosedStats = {
  total: number
  /** Closed on the same day as now (needs a `Finished` time). */
  today: number
  /** Share of the reviewed closed tasks that passed the review the first time; absent under two reviewed tasks. */
  firstPass?: number
  /** The latest closed tasks, oldest first: 0 passed first time, 1 after one rework, 2 after more, -1 no review data. */
  recent: number[]
}

export type Member = {
  id: string
  name: string
  cls: Cls
  state: 'working' | 'idling'
  /** Idle but its last turn ended blocked (the app's own summary says so). */
  isBlocked: boolean
  task?: string
  note?: string
  done?: number
  total?: number
  elapsedMs?: number
  etaMs?: number
  /** Tasks of its own that are done (from the task files); absent when it has none. */
  tasksDone?: number
  /** Statistics of the tasks it has closed. */
  closed?: ClosedStats
  /** The estimate (hours) of the task it is on now. */
  estimateH?: number
  /** Only the dashboard knows it: the orchestrator card is drawn in the accent colour. */
  role?: string
}

/** One line about a whole project: where it stands and how long is left. */
export type ProjectSummary = {
  stage: string
  total: number
  done: number
  review: number
  blocked: number
  working: number
  /** Pending approvals waiting for the user. */
  needsUser: number
  /** Hours left, from the open tasks' estimates; absent when no task has an estimate. */
  hoursLeft?: number
}

declare module 'claude-code' {
  interface PluginState {
    'demo-team-roster': {
      members: Member[]
      /** When each member was first seen working, by session id. */
      since: Record<string, number>
      /** True in the chat that watches the roster (the orchestrator), false in the listed helpers. */
      isOrchestrator: boolean
      /** The summary of the project this chat shows, or null. */
      summary: ProjectSummary | null
    }
  }
}
