import { useEffect, useState } from 'react'
import {
  agentName,
  agentPlan,
  allAgents,
  collabLinks,
  fmtAgo,
  fmtClock,
  fmtHM,
  fmtLongDate,
  itemProgress,
  overallProgress,
  parseTime,
  PLAN_STATUS_LABEL,
  STATUS_META,
} from '../meta'
import { themeFor } from '../scene/themes'
import type { Agent, AgentStatus, BuildingSummary, FeedSource, FloorDef, RoamerInfo, Snapshot } from '../types'

function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now())
  useEffect(() => {
    const h = setInterval(() => setN(Date.now()), ms)
    return () => clearInterval(h)
  }, [ms])
  return n
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

export function TopBar({
  s,
  source,
  fetchedAt,
  onReset,
  floor,
  floorLabel,
}: {
  s: Snapshot
  source: FeedSource
  fetchedAt: number
  onReset: () => void
  floor: FloorDef | null
  floorLabel: string
}) {
  const now = useNow()
  const total = overallProgress(s)
  const counts: Partial<Record<AgentStatus, number>> = {}
  allAgents(s).forEach((a) => (counts[a.status] = (counts[a.status] ?? 0) + 1))
  const upd = parseTime(s.updatedAt)
  const stale = source === 'live' && !s.meta?.mock && upd && now - upd.getTime() > 10 * 60 * 1000
  const doneItems = s.plan.items.filter((i) => i.status === 'done').length
  const srcLabel =
    source === 'demo'
      ? 'Demo mode'
      : source === 'fallback'
        ? 'Feed not reachable'
        : source === 'loading'
          ? 'Loading…'
          : s.meta?.mock
            ? 'Example data'
            : stale
              ? 'Data may be stale'
              : 'Live'
  const srcCls = source === 'live' && !s.meta?.mock && !stale ? 'live' : stale || source === 'fallback' ? 'warn' : 'demo'
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">🏢</span>
        <div>
          <h1>
            Jason's Digital Office
            {floor && (
              <span className="floortag">
                {floorLabel} {floor.name}
              </span>
            )}
          </h1>
          <div className="sub">{fmtLongDate(s.plan.date)}</div>
        </div>
      </div>
      <div className="overall">
        <div className="overall-head">
          <span>{floor ? `${floor.name} · ` : ''}Today's plan</span>
          <b>{total}%</b>
          <em>
            {doneItems}/{s.plan.items.length} items done
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
        <span className="upd">
          Updated {fmtHM(s.updatedAt)}
          {source === 'live' ? ` · fetched ${fmtAgo(new Date(fetchedAt).toISOString(), now)} ago` : ''}
        </span>
        <button className="btn" onClick={onReset} title="Back to the default camera angle">
          Reset view
        </button>
      </div>
    </header>
  )
}

export function MemberList({
  s,
  selectedId,
  onSelect,
  hoverId,
  floorName,
}: {
  s: Snapshot
  selectedId: string | null
  onSelect: (id: string) => void
  hoverId: string | null
  floorName?: string
}) {
  const roamIds = new Set((s.roamers ?? []).map((r) => r.id))
  const list = allAgents(s)
  return (
    <aside className="left panel">
      <h2>
        {floorName ? `${floorName} · ` : ''}Members <small>{list.length}</small>
      </h2>
      <div className="list">
        {list.map((a) => {
          const m = STATUS_META[a.status]
          const plan = agentPlan(s, a.id)
          const planDone = plan.filter((p) => p.status === 'done').length
          const p = a.status === 'offline' ? 0 : (a.progress ?? 0)
          return (
            <button key={a.id} className={`member ${selectedId === a.id ? 'sel' : ''} ${hoverId === a.id ? 'hov' : ''}`} onClick={() => onSelect(a.id)}>
              <span className="avatar" style={{ background: a.status === 'offline' ? '#c4c8ce' : a.color }}>
                {m.icon}
              </span>
              <span className="mid">
                <span className="row1">
                  <b>{a.name}</b>
                  <em>{a.role}</em>
                  {roamIds.has(a.id) && <span className="roamtag">Roaming</span>}
                  <StatusChip status={a.status} />
                </span>
                <span className="task">{a.currentTask || (a.status === 'offline' ? 'Not connected' : 'No task')}</span>
                <span className="row3">
                  <Bar value={p} color={a.color} h={6} />
                  <small>{plan.length ? `${planDone}/${plan.length}` : `${Math.round(p)}%`}</small>
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
  const everyone = allAgents(s)
  const links = collabLinks(s)
  const active = links.filter((l) => {
    const a = everyone.find((x) => x.id === l.a)
    const b = everyone.find((x) => x.id === l.b)
    return a && b && a.status !== 'offline' && b.status !== 'offline'
  })
  const events = everyone
    .flatMap((a) => (a.log ?? []).slice(0, 3).map((l) => ({ a, ...l, ts: parseTime(l.time)?.getTime() ?? 0 })))
    .sort((x, y) => y.ts - x.ts)
    .slice(0, 6)
  return (
    <section className="feed panel">
      <h2>
        Collaboration <small>{active.length} active</small>
      </h2>
      {active.length === 0 && <div className="empty">Everyone is heads-down — no collaboration right now ☕</div>}
      {active.map((l) => (
        <div className="collab" key={l.a + l.b}>
          <span className="pair">
            <i style={{ background: everyone.find((x) => x.id === l.a)?.color }} />
            <i style={{ background: everyone.find((x) => x.id === l.b)?.color, marginLeft: -6 }} />
          </span>
          <span className="txt">
            <b>{agentName(s, l.a)}</b> is collaborating with <b>{agentName(s, l.b)}</b>
            {l.topic ? `: ${l.topic}` : ''}
            {l.since && <small> · {fmtAgo(l.since, now)}</small>}
          </span>
        </div>
      ))}
      <h3>Latest activity</h3>
      <ul className="events">
        {events.map((e, i) => (
          <li key={i}>
            <time>{fmtHM(e.time)}</time>
            <span>
              <b style={{ color: e.a.color }}>{e.a.name}</b> {e.text}
            </span>
          </li>
        ))}
        {!events.length && <div className="empty">No activity yet</div>}
      </ul>
    </section>
  )
}

export function DetailPanel({ s, agent, onClose, roaming }: { s: Snapshot; agent: Agent; onClose: () => void; roaming: boolean }) {
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
          {roaming && <span className="roamtag">Roaming</span>}
          <StatusChip status={agent.status} />
        </div>
        <button className="x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="hint">
        {m.hint}
        {partners.length ? ` (with ${partners.join(', ')})` : ''}
      </div>
      <h3>Current task</h3>
      <div className="cur">
        <div className="curtask">{agent.currentTask || '—'}</div>
        <div className="row3">
          <Bar value={agent.status === 'offline' ? 0 : (agent.progress ?? 0)} color={agent.color} h={10} />
          <small>{Math.round(agent.status === 'offline' ? 0 : (agent.progress ?? 0))}%</small>
        </div>
      </div>
      <h3>
        Today's tasks <small>{plan.length}</small>
      </h3>
      {plan.length === 0 && <div className="empty">No plan items today</div>}
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
      <h3>Recent activity</h3>
      <ul className="events log">
        {(agent.log ?? []).slice(0, 12).map((l, i) => (
          <li key={i}>
            <time>{fmtClock(l.time)}</time>
            <span>{l.text}</span>
          </li>
        ))}
        {!(agent.log ?? []).length && <div className="empty">No activity yet</div>}
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
      <span className="tip">Drag to rotate · Scroll to zoom · Click a bot for details · ↑/↓ change floor</span>
    </div>
  )
}

/** Elevator-style floor selector + building overview. building.json is only read while the overview is open. */
export function Elevator({
  floors,
  currentId,
  loading,
  liveCount,
  expanded,
  onToggle,
  onGo,
  summary,
  summaryError,
  roamers,
}: {
  floors: FloorDef[]
  currentId: string
  loading: boolean
  liveCount: number | null
  expanded: boolean
  onToggle: () => void
  onGo: (id: string) => void
  summary: BuildingSummary | null
  summaryError: boolean
  roamers: RoamerInfo[]
}) {
  return (
    <nav className={`elevator ${expanded ? 'open' : ''}`} aria-label="Floor selector">
      <div className="el-head">
        <b>🛗 Building</b>
        <button className="btn mini" onClick={onToggle} aria-pressed={expanded} title="Overview reads building.json only — other floors' feeds stay unloaded">
          {expanded ? 'Collapse' : 'Overview'}
        </button>
      </div>
      <div className="roof" />
      <div className="stack">
        {floors.map((f, i) => {
          const cur = f.id === currentId
          const sum = summary?.floors.find((x) => x.id === f.id)
          const count = cur && liveCount != null ? liveCount : sum?.agents
          const th = themeFor(f.theme, floors.length - 1 - i)
          const here = roamers.filter((r) => r.currentFloor === f.id)
          return (
            <button
              key={f.id}
              className={`flr ${cur ? 'cur' : ''}`}
              style={{ ['--a' as any]: th.accent }}
              onClick={() => onGo(f.id)}
              title={cur ? 'Current floor' : `Go to ${f.label ?? f.order + 'F'} ${f.name}`}
            >
              <span className="fl">{f.label ?? `${f.order}F`}</span>
              <span className="fmain">
                <span className="fname">
                  {f.name}
                  {here.map((r) => (
                    <span key={r.id} className="rmark" style={{ background: r.color }} title={`${r.name} is on this floor (roaming)`}>
                      {r.name}
                    </span>
                  ))}
                </span>
                <span className="fcount" title="Members">
                  {count != null ? `${count} members` : '— members'}
                </span>
                {expanded && (
                  <span className="fsum">
                    {sum ? (
                      <>
                        <Bar value={sum.completion} color={th.accent} h={5} />
                        <small>{Math.round(sum.completion)}%</small>
                      </>
                    ) : (
                      <small>{summaryError ? 'No building.json' : 'Loading…'}</small>
                    )}
                  </span>
                )}
                {expanded && sum && (
                  <span className="fdots">
                    {(Object.keys(sum.counts) as AgentStatus[]).map((k) => (
                      <i key={k} title={`${STATUS_META[k].label} ${sum.counts[k]}`} style={{ background: STATUS_META[k].color }}>
                        {sum.counts[k]}
                      </i>
                    ))}
                  </span>
                )}
              </span>
              {cur && loading && <span className="spin" />}
            </button>
          )
        })}
      </div>
      <div className="ground" />
      {expanded && summary && <div className="el-foot">Summary updated {fmtHM(summary.updatedAt)}</div>}
    </nav>
  )
}
