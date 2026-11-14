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
  floor?: string // 可选：该 feed 所属楼层 id（仅作校验/提示）
  updatedAt: string
  meta?: { mock?: boolean; note?: string }
  plan: { date: string; items: PlanItem[] }
  agents: Agent[]
  collaborations: Collaboration[]
  // 以下由前端合并（来自 roaming.json），不属于楼层 feed
  roamers?: Agent[]
  roamPlan?: PlanItem[]
}

export interface RoamerInfo {
  id: string
  name: string
  color: string
  currentFloor: string
}

export type FeedSource = 'live' | 'demo' | 'fallback' | 'loading'

export interface FloorDef {
  id: string
  name: string
  order: number // 楼层号：数字越大越靠上（4 = 4F）
  feed: string // 该楼层独立的 status.json 地址（相对 floors.json 所在目录或绝对 URL）
  label?: string // 默认 `${order}F`
  theme?: string // warm | mint | night | sunset，默认按顺序轮换
  default?: boolean // 默认进入的楼层 / 新 bot 默认归属
  note?: string
}

export interface BuildingMember {
  id: string
  name: string
  color: string
  status: AgentStatus
  desk?: number
}

export interface BuildingFloorSummary {
  id: string
  completion: number // 0-100
  agents: number
  items: { done: number; total: number }
  counts: Partial<Record<AgentStatus, number>>
  members: BuildingMember[] // 总览里小人 + 状态色圆点所需
  updatedAt?: string
}

export interface BuildingRoamer {
  id: string
  floor: string
  name: string
  color: string
  status: AgentStatus
}

export interface BuildingSummary {
  updatedAt: string
  mock?: boolean
  roamers: BuildingRoamer[]
  floors: BuildingFloorSummary[]
}
