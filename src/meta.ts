import type { Agent, AgentStatus, PlanItem, Snapshot } from './types'

export const STATUS_META: Record<AgentStatus, { label: string; color: string; icon: string; hint: string }> = {
  working: { label: '工作中', color: '#3b82f6', icon: '⌨️', hint: '正在专注处理任务' },
  thinking: { label: '思考中', color: '#a855f7', icon: '💭', hint: '正在分析 / 规划' },
  collaborating: { label: '协作中', color: '#14b8a6', icon: '🤝', hint: '正在会议桌与同事协作' },
  waiting: { label: '等待确认', color: '#f59e0b', icon: '❗', hint: '需要 Jason 确认后继续' },
  done: { label: '已完成', color: '#22c55e', icon: '✅', hint: '今日任务已完成' },
  error: { label: '出错了', color: '#ef4444', icon: '⚠️', hint: '遇到错误，需要关注' },
  offline: { label: '离线', color: '#9ca3af', icon: '💤', hint: '未连接 / 未启用' },
}

export const PLAN_STATUS_LABEL: Record<PlanItem['status'], string> = {
  todo: '待开始',
  doing: '进行中',
  done: '已完成',
  blocked: '受阻',
}

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

export function itemProgress(i: PlanItem): number {
  if (i.status === 'done') return 100
  const p = Number.isFinite(i.progress) ? i.progress : 0
  return Math.max(0, Math.min(100, p))
}

export function overallProgress(s: Snapshot): number {
  const items = s.plan.items
  if (!items.length) return 0
  return Math.round(items.reduce((a, i) => a + itemProgress(i), 0) / items.length)
}

export function agentPlan(s: Snapshot, agentId: string): PlanItem[] {
  return s.plan.items.filter((i) => i.owner === agentId)
}

export function agentName(s: Snapshot, id: string): string {
  return s.agents.find((a) => a.id === id)?.name ?? id
}

/** 汇总：collaborations 数组 ∪ agent.collaboratingWith，去重后的无向连线 */
export function collabLinks(s: Snapshot): { a: string; b: string; topic: string; since?: string }[] {
  const out = new Map<string, { a: string; b: string; topic: string; since?: string }>()
  const ids = new Set(s.agents.map((a) => a.id))
  const key = (a: string, b: string) => [a, b].sort().join('|')
  for (const c of s.collaborations) {
    if (!ids.has(c.from) || !ids.has(c.to) || c.from === c.to) continue
    out.set(key(c.from, c.to), { a: c.from, b: c.to, topic: c.topic, since: c.since })
  }
  for (const ag of s.agents) {
    for (const o of ag.collaboratingWith ?? []) {
      if (!ids.has(o) || o === ag.id) continue
      const k = key(ag.id, o)
      if (!out.has(k)) out.set(k, { a: ag.id, b: o, topic: ag.currentTask ?? '', since: undefined })
    }
  }
  return [...out.values()]
}

export function parseTime(t: string): Date | null {
  if (!t) return null
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d
}

export function fmtClock(t: string): string {
  const d = parseTime(t)
  if (!d) return t
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export function fmtHM(t: string): string {
  const d = parseTime(t)
  if (!d) return t
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function fmtAgo(t?: string, now = Date.now()): string {
  if (!t) return ''
  const d = parseTime(t)
  if (!d) return ''
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000))
  if (s < 60) return `${s} 秒`
  if (s < 3600) return `${Math.round(s / 60)} 分钟`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时`
  return `${Math.floor(s / 86400)} 天`
}

/** 校验 + 容错：缺字段不崩溃 */
export function normalize(raw: any): Snapshot {
  const agents: Agent[] = (Array.isArray(raw?.agents) ? raw.agents : []).map((a: any, i: number) => ({
    id: String(a.id ?? `agent-${i}`),
    name: String(a.name ?? a.id ?? `bot-${i}`),
    role: String(a.role ?? ''),
    color: /^#[0-9a-fA-F]{6}$/.test(a.color) ? a.color : '#4dabf7',
    desk: Number.isInteger(a.desk) ? a.desk : i,
    status: a.status in STATUS_META ? a.status : 'offline',
    currentTask: a.currentTask ?? '',
    progress: typeof a.progress === 'number' ? a.progress : 0,
    collaboratingWith: Array.isArray(a.collaboratingWith) ? a.collaboratingWith.map(String) : [],
    log: Array.isArray(a.log) ? a.log.map((l: any) => ({ time: String(l.time ?? ''), text: String(l.text ?? '') })) : [],
  }))
  return {
    floor: raw?.floor ? String(raw.floor) : undefined,
    updatedAt: String(raw?.updatedAt ?? new Date().toISOString()),
    meta: raw?.meta,
    plan: {
      date: String(raw?.plan?.date ?? new Date().toISOString().slice(0, 10)),
      items: (Array.isArray(raw?.plan?.items) ? raw.plan.items : []).map((p: any, i: number) => ({
        id: String(p.id ?? `p${i}`),
        title: String(p.title ?? ''),
        owner: String(p.owner ?? ''),
        status: ['todo', 'doing', 'done', 'blocked'].includes(p.status) ? p.status : 'todo',
        progress: typeof p.progress === 'number' ? p.progress : 0,
      })),
    },
    agents,
    collaborations: (Array.isArray(raw?.collaborations) ? raw.collaborations : []).map((c: any) => ({
      from: String(c.from ?? ''),
      to: String(c.to ?? ''),
      topic: String(c.topic ?? ''),
      since: String(c.since ?? ''),
    })),
  }
}
