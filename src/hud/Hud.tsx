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
import type { Agent, AgentStatus, BuildingSummary, FeedSource, FloorDef, Snapshot } from '../types'

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
  onBack,
  floor,
  floorLabel,
}: {
  s: Snapshot
  source: FeedSource
  fetchedAt: number
  onReset: () => void
  onBack: () => void
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
          <h1>Jason's Digital Office</h1>
          <div className="sub crumbs">
            <button className="crumb" onClick={onBack} title="Back to the whole building (Esc)">
              ← Building
            </button>
            {floor && (
              <>
                <span className="sep">/</span>
                <span className="crumb here">
                  {floorLabel} {floor.name}
                </span>
              </>
            )}
            <span className="sep">·</span>
            <span>{fmtLongDate(s.plan.date)}</span>
          </div>
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

export function Legend({ building }: { building?: boolean }) {
  return (
    <div className="legend">
      {(Object.keys(STATUS_META) as AgentStatus[]).map((k) => (
        <span key={k} style={{ ['--c' as any]: STATUS_META[k].color }}>
          <i />
          {STATUS_META[k].label}
        </span>
      ))}
      <span className="tip">{building ? 'Click a floor to step inside · Drag to rotate · Scroll to zoom' : 'Drag to rotate · Scroll to zoom · Click a bot for details · ↑/↓ change floor · Esc: building'}</span>
    </div>
  )
}

const STATUS_KEYS = Object.keys(STATUS_META) as AgentStatus[]

export function buildingTotals(b: BuildingSummary) {
  const withItems = b.floors.filter((f) => f.items.total > 0)
  const overall = withItems.length ? Math.round(withItems.reduce((a, f) => a + f.completion, 0) / withItems.length) : 0
  const counts: Partial<Record<AgentStatus, number>> = {}
  b.floors.forEach((f) => f.members.forEach((m) => (counts[m.status] = (counts[m.status] ?? 0) + 1)))
  b.roamers.forEach((r) => (counts[r.status] = (counts[r.status] ?? 0) + 1))
  const items = b.floors.reduce((a, f) => ({ done: a.done + f.items.done, total: a.total + f.items.total }), { done: 0, total: 0 })
  const bots = b.floors.reduce((a, f) => a + f.members.length, 0) + b.roamers.length
  return { overall, counts, items, bots }
}

/** Top bar for the whole-building view. Numbers come from building.json only. */
export function BuildingTopBar({ b, error, fetchedAt, onReset }: { b: BuildingSummary | null; error: boolean; fetchedAt: number; onReset: () => void }) {
  const now = useNow()
  const t = b ? buildingTotals(b) : null
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">🏢</span>
        <div>
          <h1>Jason's Digital Office</h1>
          <div className="sub crumbs">
            <span className="crumb here">Building</span>
            <span className="sep">·</span>
            <span>{fmtLongDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }))}</span>
          </div>
        </div>
      </div>
      <div className="overall">
        <div className="overall-head">
          <span>Whole building · Today's plan</span>
          <b>{t ? t.overall : '–'}%</b>
          <em>{t ? `${t.items.done}/${t.items.total} items done` : ''}</em>
        </div>
        <Bar value={t?.overall ?? 0} h={14} />
      </div>
      <div className="counts">
        {t &&
          STATUS_KEYS.filter((k) => t.counts[k]).map((k) => (
            <span key={k} className="count" title={STATUS_META[k].label} style={{ ['--c' as any]: STATUS_META[k].color }}>
              <i />
              {STATUS_META[k].label} {t.counts[k]}
            </span>
          ))}
      </div>
      <div className="meta">
        <span className={`src ${error ? 'warn' : b?.mock ? 'demo' : 'live'}`}>
          <i />
          {error ? 'building.json not reachable' : !b ? 'Loading…' : b.mock ? 'Example data' : 'Live'}
        </span>
        <span className="upd">{b ? `Updated ${fmtHM(b.updatedAt)} · fetched ${fmtAgo(new Date(fetchedAt).toISOString(), now)} ago` : ''}</span>
        <button className="btn" onClick={onReset} title="Back to the default camera angle">
          Reset view
        </button>
      </div>
    </header>
  )
}

/** Left panel in building view: floors top → bottom. Reads building.json data only. */
export function FloorList({ floors, b, hoverId, onHover, onGo }: { floors: FloorDef[]; b: BuildingSummary | null; hoverId: string | null; onHover: (id: string | null) => void; onGo: (id: string) => void }) {
  return (
    <aside className="panel left">
      <h2>
        Floors <small>{floors.length} floors · top → bottom</small>
      </h2>
      <div className="list">
        {floors.map((f, i) => {
          const th = themeFor(f.theme, floors.length - 1 - i)
          const sum = b?.floors.find((x) => x.id === f.id)
          const here = b?.roamers.filter((r) => r.floor === f.id) ?? []
          return (
            <button key={f.id} className={`fcard ${hoverId === f.id ? 'hov' : ''}`} style={{ ['--a' as any]: th.accent }} onMouseEnter={() => onHover(f.id)} onMouseLeave={() => onHover(null)} onClick={() => onGo(f.id)}>
              <span className="fnum">{f.label ?? `${f.order}F`}</span>
              <span className="fbody">
                <span className="ftop">
                  <b>{f.name}</b>
                  {here.map((r) => (
                    <span key={r.id} className="rmark" style={{ background: r.color }} title={`${r.name} is on this floor (roaming)`}>
                      {r.name}
                    </span>
                  ))}
                  <em>{sum ? `${Math.round(sum.completion)}%` : '–'}</em>
                </span>
                <Bar value={sum?.completion ?? 0} color={th.accent} h={6} />
                <span className="fdots2">
                  {sum?.members.map((m) => (
                    <i key={m.id} title={`${m.name} · ${STATUS_META[m.status].label}`} style={{ background: STATUS_META[m.status].color }} />
                  ))}
                  {here.map((r) => (
                    <i key={r.id} className="ro" title={`${r.name} (roaming) · ${STATUS_META[r.status].label}`} style={{ background: STATUS_META[r.status].color }} />
                  ))}
                  <small>{sum ? `${sum.members.length} bots` : 'Loading…'}</small>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

/** Right panel in building view: building-wide summary. */
export function BuildingPanel({ floors, b, onGo }: { floors: FloorDef[]; b: BuildingSummary | null; onGo: (id: string) => void }) {
  const t = b ? buildingTotals(b) : null
  return (
    <section className="panel feed">
      <h2>Building today</h2>
      {t && b ? (
        <>
          <div className="bsum">
            <b>{t.overall}%</b>
            <span>
              {t.items.done}/{t.items.total} plan items done · {t.bots} bots
            </span>
          </div>
          <Bar value={t.overall} h={10} />
          <h3>Bot status</h3>
          <div className="statgrid">
            {STATUS_KEYS.map((k) => (
              <span key={k} className={`statcell ${t.counts[k] ? '' : 'zero'}`} style={{ ['--c' as any]: STATUS_META[k].color }}>
                <i />
                {STATUS_META[k].label}
                <b>{t.counts[k] ?? 0}</b>
              </span>
            ))}
          </div>
          <h3>Roaming</h3>
          {b.roamers.length ? (
            b.roamers.map((r) => {
              const f = floors.find((x) => x.id === r.floor)
              return (
                <button key={r.id} className="roamrow" onClick={() => f && onGo(f.id)}>
                  <span className="rmark" style={{ background: r.color }}>
                    {r.name}
                  </span>
                  is on <b>{f ? `${f.label ?? f.order + 'F'} ${f.name}` : r.floor}</b>
                  <span className="chip" style={{ ['--c' as any]: STATUS_META[r.status].color }}>
                    {STATUS_META[r.status].label}
                  </span>
                </button>
              )
            })
          ) : (
            <div className="empty">No roaming bots</div>
          )}
          <h3>On-demand loading</h3>
          <p className="note">This view reads only a tiny building.json. A floor&apos;s own feed (and roaming.json) is fetched only when you step into it — other floors stay untouched.</p>
        </>
      ) : (
        <div className="empty" style={{ padding: '0 14px' }}>
          Loading building summary…
        </div>
      )}
    </section>
  )
}

/** Slim vertical floor strip on the right edge of the stage (takes its own column — never covers the 3D scene). */
export function FloorStrip({ floors, currentId, loading, hoverId, onHover, onGo, onBuilding }: { floors: FloorDef[]; currentId: string | null; loading: boolean; hoverId: string | null; onHover: (id: string | null) => void; onGo: (id: string) => void; onBuilding: () => void }) {
  return (
    <nav className="strip" aria-label="Floors">
      <button className={`sbtn bld ${currentId == null ? 'cur' : ''}`} onClick={onBuilding} title="Whole building (Esc)">
        🏢
      </button>
      <span className="sline" />
      {floors.map((f, i) => {
        const th = themeFor(f.theme, floors.length - 1 - i)
        const cur = f.id === currentId
        return (
          <button
            key={f.id}
            className={`sbtn ${cur ? 'cur' : ''} ${hoverId === f.id ? 'hov' : ''}`}
            style={{ ['--a' as any]: th.accent }}
            onMouseEnter={() => onHover(f.id)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onGo(f.id)}
            title={`${f.label ?? f.order + 'F'} ${f.name}`}
          >
            {f.label ?? `${f.order}F`}
            {cur && loading && <span className="spin" />}
          </button>
        )
      })}
    </nav>
  )
}
