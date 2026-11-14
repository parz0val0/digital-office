import { useEffect, useState } from 'react'
import {
  agentName,
  agentPlan,
  collabLinks,
  fmtAgo,
  fmtClock,
  fmtHM,
  itemProgress,
  overallProgress,
  parseTime,
  PLAN_STATUS_LABEL,
  STATUS_META,
} from '../meta'
import type { Agent, AgentStatus, FeedSource, Snapshot } from '../types'

function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now())
  useEffect(() => {
    const h = setInterval(() => setN(Date.now()), ms)
    return () => clearInterval(h)
  }, [ms])
  return n
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
function fmtDate(date: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return date
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日 · 周${WEEK[d.getDay()]}`
}

export function Bar({ value, color, h = 8 }: { value: number; color?: string; h?: number }) {
  return (
    <span className="pbar" style={{ height: h }}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </span>
  )
}

export function StatusChip({ status }: { status: AgentStatus }) {
  const m = STATUS_META[status]
  return (
    <span className="chip" style={{ ['--c' as any]: m.color }}>
      {m.label}
    </span>
  )
}

export function TopBar({ s, source, fetchedAt, onReset }: { s: Snapshot; source: FeedSource; fetchedAt: number; onReset: () => void }) {
  const now = useNow()
  const total = overallProgress(s)
  const counts: Partial<Record<AgentStatus, number>> = {}
  s.agents.forEach((a) => (counts[a.status] = (counts[a.status] ?? 0) + 1))
  const upd = parseTime(s.updatedAt)
  const stale = source === 'live' && !s.meta?.mock && upd && now - upd.getTime() > 10 * 60 * 1000
  const doneItems = s.plan.items.filter((i) => i.status === 'done').length
  const srcLabel =
    source === 'demo' ? '演示模式' : source === 'fallback' ? '示例数据（未连接 status.json）' : source === 'loading' ? '加载中…' : s.meta?.mock ? '示例数据' : stale ? '数据可能已过期' : '实时'
  const srcCls = source === 'live' && !s.meta?.mock && !stale ? 'live' : stale || source === 'fallback' ? 'warn' : 'demo'
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">🏢</span>
        <div>
          <h1>Jason 的数字办公室</h1>
          <div className="sub">{fmtDate(s.plan.date)}</div>
        </div>
      </div>
      <div className="overall">
        <div className="overall-head">
          <span>今日计划完成度</span>
          <b>{total}%</b>
          <em>
            {doneItems}/{s.plan.items.length} 项已完成
          </em>
        </div>
        <Bar value={total} h={14} />
      </div>
      <div className="counts">
        {(Object.keys(STATUS_META) as AgentStatus[])
          .filter((k) => counts[k])
          .map((k) => (
            <span key={k} className="count" title={STATUS_META[k].label} style={{ ['--c' as any]: STATUS_META[k].color }}>
              <i />
              {STATUS_META[k].label} {counts[k]}
            </span>
          ))}
      </div>
      <div className="meta">
        <span className={`src ${srcCls}`}>
          <i />
          {srcLabel}
        </span>
        <span className="upd">更新于 {fmtHM(s.updatedAt)}{source === 'live' ? ` · 拉取 ${fmtAgo(new Date(fetchedAt).toISOString(), now)}前` : ''}</span>
        <button className="btn" onClick={onReset} title="回到默认视角">
          重置视角
        </button>
      </div>
    </header>
  )
}

export function MemberList({ s, selectedId, onSelect, hoverId }: { s: Snapshot; selectedId: string | null; onSelect: (id: string) => void; hoverId: string | null }) {
  return (
    <aside className="left panel">
      <h2>成员任务 <small>{s.agents.length} 位</small></h2>
      <div className="list">
        {s.agents.map((a) => {
          const m = STATUS_META[a.status]
          const plan = agentPlan(s, a.id)
          const planDone = plan.filter((p) => p.status === 'done').length
          const p = a.status === 'offline' ? 0 : a.progress ?? 0
          return (
            <button key={a.id} className={`member ${selectedId === a.id ? 'sel' : ''} ${hoverId === a.id ? 'hov' : ''}`} onClick={() => onSelect(a.id)}>
              <span className="avatar" style={{ background: a.status === 'offline' ? '#c4c8ce' : a.color }}>
                {m.icon}
              </span>
              <span className="mid">
                <span className="row1">
                  <b>{a.name}</b>
                  <em>{a.role}</em>
                  <StatusChip status={a.status} />
                </span>
                <span className="task">{a.currentTask || (a.status === 'offline' ? '未连接' : '暂无任务')}</span>
                <span className="row3">
                  <Bar value={p} color={a.color} h={6} />
                  <small>{plan.length ? `${planDone}/${plan.length} 项` : `${Math.round(p)}%`}</small>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

export function FeedPanel({ s }: { s: Snapshot }) {
  const now = useNow(5000)
  const links = collabLinks(s)
  const active = links.filter((l) => {
    const a = s.agents.find((x) => x.id === l.a)
    const b = s.agents.find((x) => x.id === l.b)
    return a && b && a.status !== 'offline' && b.status !== 'offline'
  })
  const events = s.agents
    .flatMap((a) => (a.log ?? []).slice(0, 3).map((l) => ({ a, ...l, ts: parseTime(l.time)?.getTime() ?? 0 })))
    .sort((x, y) => y.ts - x.ts)
    .slice(0, 6)
  return (
    <section className="feed panel">
      <h2>协作动态 <small>{active.length} 组进行中</small></h2>
      {active.length === 0 && <div className="empty">大家各忙各的，暂时没有协作 ☕</div>}
      {active.map((l) => (
        <div className="collab" key={l.a + l.b}>
          <span className="pair">
            <i style={{ background: s.agents.find((x) => x.id === l.a)?.color }} />
            <i style={{ background: s.agents.find((x) => x.id === l.b)?.color, marginLeft: -6 }} />
          </span>
          <span className="txt">
            <b>{agentName(s, l.a)}</b> 正在和 <b>{agentName(s, l.b)}</b> 协作{l.topic ? `：${l.topic}` : ''}
            {l.since && <small> · {fmtAgo(l.since, now)}</small>}
          </span>
        </div>
      ))}
      <h3>最新动态</h3>
      <ul className="events">
        {events.map((e, i) => (
          <li key={i}>
            <time>{fmtHM(e.time)}</time>
            <span>
              <b style={{ color: e.a.color }}>{e.a.name}</b> {e.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DetailPanel({ s, agent, onClose }: { s: Snapshot; agent: Agent; onClose: () => void }) {
  const m = STATUS_META[agent.status]
  const plan = agentPlan(s, agent.id)
  const partners = collabLinks(s)
    .filter((l) => l.a === agent.id || l.b === agent.id)
    .map((l) => agentName(s, l.a === agent.id ? l.b : l.a))
  return (
    <section className="detail panel" style={{ ['--c' as any]: agent.color }}>
      <div className="dhead">
        <span className="avatar big" style={{ background: agent.status === 'offline' ? '#c4c8ce' : agent.color }}>
          {m.icon}
        </span>
        <div className="dtitle">
          <b>{agent.name}</b>
          <em>{agent.role}</em>
          <StatusChip status={agent.status} />
        </div>
        <button className="x" onClick={onClose} aria-label="关闭">
          ✕
        </button>
      </div>
      <div className="hint">{m.hint}{partners.length ? `（与 ${partners.join('、')}）` : ''}</div>
      <h3>当前任务</h3>
      <div className="cur">
        <div className="curtask">{agent.currentTask || '暂无'}</div>
        <div className="row3">
          <Bar value={agent.status === 'offline' ? 0 : agent.progress ?? 0} color={agent.color} h={10} />
          <small>{Math.round(agent.status === 'offline' ? 0 : agent.progress ?? 0)}%</small>
        </div>
      </div>
      <h3>今日任务 <small>{plan.length} 项</small></h3>
      {plan.length === 0 && <div className="empty">今天没有分配计划项</div>}
      <ul className="plan">
        {plan.map((p) => (
          <li key={p.id} className={p.status}>
            <span className="box">{p.status === 'done' ? '✓' : p.status === 'blocked' ? '!' : ''}</span>
            <span className="t">
              {p.title}
              <small>{PLAN_STATUS_LABEL[p.status]}</small>
            </span>
            <span className="pc">{Math.round(itemProgress(p))}%</span>
            <Bar value={itemProgress(p)} color={p.status === 'blocked' ? '#ff8787' : agent.color} h={5} />
          </li>
        ))}
      </ul>
      <h3>最近活动</h3>
      <ul className="events log">
        {(agent.log ?? []).slice(0, 12).map((l, i) => (
          <li key={i}>
            <time>{fmtClock(l.time)}</time>
            <span>{l.text}</span>
          </li>
        ))}
        {!(agent.log ?? []).length && <div className="empty">暂无记录</div>}
      </ul>
    </section>
  )
}

export function Legend() {
  return (
    <div className="legend">
      {(Object.keys(STATUS_META) as AgentStatus[]).map((k) => (
        <span key={k} style={{ ['--c' as any]: STATUS_META[k].color }}>
          <i />
          {STATUS_META[k].label}
        </span>
      ))}
      <span className="tip">拖动旋转 · 滚轮缩放 · 点击角色查看详情</span>
    </div>
  )
}
