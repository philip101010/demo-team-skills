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
}

declare module 'claude-code' {
  interface PluginState {
    'demo-team-roster': {
      members: Member[]
      /** When each member was first seen working, by session id. */
      since: Record<string, number>
      /** True in the chat that watches the roster (the orchestrator), false in the listed helpers. */
      isOrchestrator: boolean
      /** One line about the last poll, shown at the bottom of the pane. */
      debug: string
    }
  }
}
