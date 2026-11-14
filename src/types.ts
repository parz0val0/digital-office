// 数据契约类型（与 docs/DATA_CONTRACT.md、docs/status.schema.json 保持一致）

export type AgentStatus =
  | 'working'
  | 'thinking'
  | 'collaborating'
  | 'waiting'
  | 'done'
  | 'error'
  | 'offline'

export type PlanItemStatus = 'todo' | 'doing' | 'done' | 'blocked'

export interface LogEntry {
  time: string // ISO 8601（建议带时区），或 "HH:mm"
  text: string
}

export interface PlanItem {
  id: string
  title: string
  owner: string // agent.id
  status: PlanItemStatus
  progress: number // 0-100
}

export interface Agent {
  id: string
  name: string
  role: string
  color: string // #rrggbb
  desk: number // 工位编号（0 起），超出范围会自动排到空位
  status: AgentStatus
  currentTask?: string
  progress?: number // 0-100，当前任务进度
  collaboratingWith?: string[]
  log?: LogEntry[]
}

export interface Collaboration {
  from: string
  to: string
  topic: string
  since: string
}

export interface Snapshot {
  updatedAt: string
  meta?: { mock?: boolean; note?: string }
  plan: { date: string; items: PlanItem[] }
  agents: Agent[]
  collaborations: Collaboration[]
}

export type FeedSource = 'live' | 'demo' | 'fallback' | 'loading'
