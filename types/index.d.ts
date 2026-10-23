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

declare module 'claude-code' {
  interface PluginState {
    'demo-team-roster': {
      members: Member[]
      /** When each member was first seen working, by session id. */
      since: Record<string, number>
      /** True in the chat that watches the roster (the orchestrator), false in the listed helpers. */
      isOrchestrator: boolean
    }
  }
}
