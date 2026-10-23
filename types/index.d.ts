export type Cls = 'mage' | 'paladin' | 'rogue' | 'cleric' | 'ranger' | 'barbarian' | 'king'

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
