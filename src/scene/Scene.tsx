import { useMemo } from 'react'
import * as THREE from 'three'
import { agentName, allAgents, collabLinks, STATUS_META } from '../meta'
import type { FloorDef, Snapshot } from '../types'
import { Character, type RoamPlan } from './Character'
import { CollabLinks } from './CollabLinks'
import { FloorSign } from './FloorSign'
import {
  Bookshelf,
  Box,
  Chair,
  CoffeeStation,
  Cyl,
  Desk,
  DeskLamp,
  Laptop,
  MeetingTable,
  Mug,
  Plant,
  Poster,
  Room,
  Sofa,
  WallClock,
  WindowFrame,
} from './Furniture'
import { EmptyDesk } from './Mini'
import { Zones } from './Zones'
import { assignDesks, DESK_YAW, makeLayout, type Layout } from './layout'
import type { Theme } from './themes'
import { Whiteboard } from './Whiteboard'


/** 漫游成员（如 office）的活动路线：白板前 → 过道 → 会议桌旁，是一条链 */
function roamChain(layout: Layout): Omit<RoamPlan, 'mode' | 'target'> {
  const { w: _w, d } = layout.room
  const wallZ = -d / 2 + 0.75
  const x0 = layout.deskPos(0).x
  const laneX = x0 + 3 * Math.floor((layout.perRow - 1) / 2) + 1.5
  const tx = layout.table.w / 2 + 0.9
  const V = (x: number, z: number) => new THREE.Vector3(x, 0, z)
  return {
    points: [V(-2.2, wallZ), V(2.2, wallZ), V(laneX, wallZ), V(laneX, layout.aisleZ), V(tx, layout.aisleZ), V(tx, layout.table.z)],
    faces: [Math.PI, Math.PI, Math.PI, 0.3, 0.8, -Math.PI / 2],
    pauses: [5, 5, 0.6, 0.6, 2.4, 0],
    write: [true, true, false, false, false, false],
    patrolMax: 4,
  }
}

function roamModeFor(status: string): { mode: RoamPlan['mode']; target: number } {
  if (status === 'working') return { mode: 'patrol', target: 0 }
  if (status === 'collaborating') return { mode: 'goto', target: 5 }
  if (status === 'thinking') return { mode: 'goto', target: 0 }
  return { mode: 'goto', target: 1 }
}

export interface FloorView {
  floor: FloorDef
  snapshot: Snapshot
  theme: Theme
}

export function fitFor(room: { w: number; d: number; wallH: number }, size: { width: number; height: number }) {
  const wProj = (room.w + room.d) * 0.7071 + 2
  const hProj = (room.w + room.d) * 0.408 + room.wallH * 0.82 + 3.2
  const narrow = size.width < 600
  return narrow ? size.width / (wProj * 0.88) : Math.min(size.width / wProj, size.height / hProj)
}

export interface FloorProps {
  view: FloorView
  selectedId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  interactive: boolean
  plateN?: number
}

export function FloorContent({ view, selectedId, onSelect, onHover, interactive, plateN = 0 }: FloorProps) {
  const { floor, snapshot, theme } = view
  const n = snapshot.agents.length
  const layout = useMemo(() => makeLayout(Math.max(n, 2, plateN), Math.max(n, 1)), [n, plateN])
  const desks = useMemo(() => assignDesks(snapshot.agents), [snapshot.agents.map((a) => a.id + a.desk).join()])
  const everyone = useMemo(() => allAgents(snapshot), [snapshot.agents, snapshot.roamers])
  const links = useMemo(() => collabLinks(snapshot), [snapshot.agents, snapshot.roamers, snapshot.collaborations])
  const colors = useMemo(() => Object.fromEntries(everyone.map((a) => [a.id, a.color])), [everyone])
  const chain = useMemo(() => roamChain(layout), [layout])
  const activeLinks = links.filter((l) => {
    const a = everyone.find((x) => x.id === l.a)
    const b = everyone.find((x) => x.id === l.b)
    return a && b && a.status !== 'offline' && b.status !== 'offline'
  })
  const { w, d } = layout.room
  const label = floor.label ?? `${floor.order}F`
  const noop = () => {}

  return (
    <group>
      <Room room={layout.room} theme={theme} />
      <FloorSign label={label} name={floor.name} theme={theme} room={layout.room} />
      <Whiteboard snapshot={snapshot} room={layout.room} />
      <WallClock x={Math.min(7, w / 2 - 1.2)} y={3.4} z={-d / 2 + 0.1} />
      <WindowFrame x={-w / 2 + 0.02} z={-d / 2 + 2.7 + 0} y={2.1} />
      {d >= 13 && <WindowFrame x={-w / 2 + 0.02} z={-d / 2 + 6.3} y={2.1} />}
      <Poster x={-w / 2 + 0.05} y={2.3} z={d / 2 - 0.9} rotY={Math.PI / 2} c1="#ffd166" c2="#ef476f" />
      <Bookshelf x={-w / 2 + 0.3} z={d / 2 - 4.7} rotY={Math.PI / 2} />
      {layout.full && d >= 13 && <Plant x={-w / 2 + 0.9} z={d / 2 - 2.9} s={1.2} />}
      <CoffeeStation x={w / 2 - 1.2} z={-d / 2 + 0.6} />
      <Zones layout={layout} theme={theme} />

      <MeetingTable table={layout.table} theme={theme} />
      {Array.from({ length: layout.sps * 2 }).map((_, i) => {
        const s = layout.seatPos(i)
        return <Chair key={i} x={s.x} z={s.z} yaw={s.yaw} c={theme.chair} />
      })}

      {Array.from({ length: Math.max(0, layout.n - n) }).map((_, k) => {
        const p = layout.deskPos(n + k)
        return <EmptyDesk key={`e${k}`} x={p.x} z={p.z} />
      })}
      {snapshot.agents.map((a) => {
        const p = layout.deskPos(desks[a.id])
        const meta = STATUS_META[a.status]
        const on = a.status !== 'offline'
        return (
          <group key={a.id}>
            <Desk x={p.x} z={p.z} />
            <Chair x={p.x} z={p.z - 0.8} yaw={DESK_YAW} c={a.color} />
            <Laptop x={p.x - 0.1} z={p.z + 0.05} glow={a.status === 'working' || a.status === 'thinking' ? a.color : meta.color} on={on} />
            <DeskLamp x={p.x - 0.85} z={p.z - 0.1} color={meta.color} on={on} />
            <Mug x={p.x + 0.55} z={p.z - 0.1} c={a.color} />
          </group>
        )
      })}
      {snapshot.agents.map((a, i) => {
        const partners = links.filter((l) => l.a === a.id || l.b === a.id).map((l) => agentName(snapshot, l.a === a.id ? l.b : l.a))
        return (
          <Character
            key={a.id}
            layout={layout}
            agent={a}
            index={i}
            deskSlot={desks[a.id]}
            seat={desks[a.id]}
            selected={interactive && selectedId === a.id}
            partnerNames={a.status === 'collaborating' ? partners : []}
            onSelect={interactive ? onSelect : noop}
            onHover={interactive ? onHover : noop}
          />
        )
      })}
      {(snapshot.roamers ?? []).map((a, i) => {
        const partners = links.filter((l) => l.a === a.id || l.b === a.id).map((l) => agentName(snapshot, l.a === a.id ? l.b : l.a))
        return (
          <RoamerChar
            key={a.id}
            layout={layout}
            chain={chain}
            agent={a}
            index={n + i}
            selected={interactive && selectedId === a.id}
            partners={a.status === 'collaborating' ? partners : []}
            onSelect={interactive ? onSelect : noop}
            onHover={interactive ? onHover : noop}
          />
        )
      })}
      <CollabLinks links={activeLinks} colors={colors} />
    </group>
  )
}

function RoamerChar({ layout, chain, agent, index, selected, partners, onSelect, onHover }: { layout: Layout; chain: Omit<RoamPlan, 'mode' | 'target'>; agent: Snapshot['agents'][number]; index: number; selected: boolean; partners: string[]; onSelect: (id: string) => void; onHover: (id: string | null) => void }) {
  const { mode, target } = roamModeFor(agent.status)
  const roam = useMemo<RoamPlan>(() => ({ ...chain, mode, target }), [chain, mode, target])
  return <Character layout={layout} roam={roam} agent={agent} index={index} deskSlot={0} seat={0} selected={selected} partnerNames={partners} onSelect={onSelect} onHover={onHover} />
}

