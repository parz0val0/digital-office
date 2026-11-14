import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { assignDesks, DESK_YAW, makeLayout, type Layout } from './layout'
import type { Theme } from './themes'
import { Whiteboard } from './Whiteboard'

const TARGET = new THREE.Vector3(0, 1.1, 0.3)
const SLIDE = 15 // 楼层切换时的垂直滑动距离
const SLIDE_SEC = 0.75

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

function fitFor(room: { w: number; d: number; wallH: number }, size: { width: number; height: number }) {
  const wProj = (room.w + room.d) * 0.7071 + 2
  const hProj = (room.w + room.d) * 0.408 + room.wallH * 0.82 + 3.2
  const narrow = size.width < 600
  return narrow ? size.width / (wProj * 0.88) : Math.min(size.width / wProj, size.height / hProj)
}

function CameraRig({ room, resetKey }: { room: { w: number; d: number; wallH: number }; resetKey: number }) {
  const { size } = useThree()
  const cam = useRef<THREE.OrthographicCamera>(null!)
  const controls = useRef<any>(null)
  const fitZoom = fitFor(room, size)
  const fitRef = useRef(fitZoom)
  fitRef.current = fitZoom
  const anim = useRef<{ from: number; to: number; t: number } | null>(null)
  const first = useRef(true)

  // 视角重置
  useEffect(() => {
    const c = cam.current
    const ctl = controls.current
    if (!c || !ctl) return
    c.position.set(TARGET.x + 15, TARGET.y + 15, TARGET.z + 15)
    ctl.target.copy(TARGET)
    c.zoom = fitRef.current
    c.updateProjectionMatrix()
    ctl.update()
    anim.current = null
  }, [resetKey])

  // 楼层大小/窗口大小变化：平滑缩放到新的“适配缩放”
  useEffect(() => {
    const c = cam.current
    if (!c) return
    if (first.current) {
      first.current = false
      c.zoom = fitZoom
      c.updateProjectionMatrix()
      return
    }
    anim.current = { from: c.zoom, to: fitZoom, t: 0 }
  }, [fitZoom])

  useFrame((_, dt) => {
    const a = anim.current
    const c = cam.current
    if (!a || !c) return
    a.t = Math.min(1, a.t + dt / SLIDE_SEC)
    const e = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2
    c.zoom = a.from + (a.to - a.from) * e
    c.updateProjectionMatrix()
    if (a.t >= 1) anim.current = null
  })

  return (
    <>
      <OrthographicCamera ref={cam} makeDefault position={[15, 16, 15]} zoom={fitZoom} near={-100} far={200} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minAzimuthAngle={Math.PI / 4 - 0.5}
        maxAzimuthAngle={Math.PI / 4 + 0.5}
        minPolarAngle={0.62}
        maxPolarAngle={1.2}
        minZoom={fitZoom * 0.7}
        maxZoom={fitZoom * 3.2}
        zoomSpeed={0.8}
        screenSpacePanning
        panSpeed={0.9}
        onChange={() => {
          const t = controls.current?.target as THREE.Vector3 | undefined
          if (!t) return
          const c = cam.current
          const zf = c ? c.zoom / fitRef.current : 1
          const lim = Math.max(0, (zf - 1) * 5)
          t.x = THREE.MathUtils.clamp(t.x, -lim, lim)
          t.z = THREE.MathUtils.clamp(t.z, -lim, lim)
          t.y = 1.1
        }}
      />
    </>
  )
}

interface FloorProps {
  view: FloorView
  selectedId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  interactive: boolean
}

function FloorContent({ view, selectedId, onSelect, onHover, interactive }: FloorProps) {
  const { floor, snapshot, theme } = view
  const n = snapshot.agents.length
  const layout = useMemo(() => makeLayout(Math.max(n, 2)), [n])
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
      {d >= 13 && <Plant x={-w / 2 + 0.9} z={d / 2 - 2.9} s={1.2} />}
      <Plant x={-w / 2 + 0.9} z={-d / 2 + 0.8} s={1.0} />
      <CoffeeStation x={w / 2 - 1.2} z={-d / 2 + 0.6} />
      <Plant x={w / 2 - 0.8} z={layout.aisleZ + 0.9} s={1.05} c="#3f9d5d" />
      <Sofa x={-w / 2 + 1.0} z={d / 2 - 1.3} rotY={Math.PI / 2} />
      <Cyl p={[-w / 2 + 2.5, 0.3, d / 2 - 1.3]} r={0.5} h={0.12} c="#fff1d6" />
      <Cyl p={[-w / 2 + 2.5, 0.15, d / 2 - 1.3]} r={0.08} h={0.3} c="#c99562" />
      <Mug x={-w / 2 + 2.5} z={d / 2 - 1.4} c="#ff7a7a" />
      <Box p={[-w / 2 + 2.5, 0.04, d / 2 - 1.3]} s={[2.2, 0.04, 2.2]} c="#ffd7a8" r={0.02} shadow={false} />

      <MeetingTable table={layout.table} theme={theme} />
      {Array.from({ length: layout.sps * 2 }).map((_, i) => {
        const s = layout.seatPos(i)
        return <Chair key={i} x={s.x} z={s.z} yaw={s.yaw} c={theme.chair} />
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

/** 楼层电梯式切换：新楼层从上/下滑入，旧楼层向反方向滑出 */
function FloorStack({ view, selectedId, onSelect, onHover }: Omit<FloorProps, 'interactive'> & { view: FloorView }) {
  const [leaving, setLeaving] = useState<{ view: FloorView; dir: number } | null>(null)
  const lastView = useRef(view)
  const lastFloorId = useRef(view.floor.id)
  const t = useRef(1)
  const dir = useRef(1)
  const curG = useRef<THREE.Group>(null!)
  const leaveG = useRef<THREE.Group>(null!)

  useEffect(() => {
    if (lastFloorId.current !== view.floor.id) {
      const dr = Math.sign(view.floor.order - lastView.current.floor.order) || 1
      setLeaving({ view: lastView.current, dir: dr })
      dir.current = dr
      t.current = 0
      lastFloorId.current = view.floor.id
    }
  }, [view.floor.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    lastView.current = view
  })

  useFrame((_, dt) => {
    if (t.current >= 1) {
      if (curG.current) curG.current.position.y = 0
      return
    }
    t.current = Math.min(1, t.current + dt / SLIDE_SEC)
    const k = t.current
    const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
    // 上行：新楼层从下方升入，旧楼层向上离开
    if (curG.current) curG.current.position.y = -dir.current * SLIDE * (1 - e)
    if (leaveG.current) leaveG.current.position.y = dir.current * SLIDE * e
    if (k >= 1) setLeaving(null)
  })

  return (
    <>
      <group ref={curG}>
        <FloorContent key={view.floor.id} view={view} selectedId={selectedId} onSelect={onSelect} onHover={onHover} interactive />
      </group>
      {leaving && (
        <group ref={leaveG}>
          <FloorContent key={'leave-' + leaving.view.floor.id} view={leaving.view} selectedId={null} onSelect={() => {}} onHover={() => {}} interactive={false} />
        </group>
      )}
    </>
  )
}

export interface SceneProps {
  view: FloorView
  selectedId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  resetKey: number
}

export function Scene({ view, selectedId, onSelect, onHover, resetKey }: SceneProps) {
  const room = useMemo(() => makeLayout(Math.max(view.snapshot.agents.length, 2)).room, [view.snapshot.agents.length])
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      flat
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => onSelect(null)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <CameraRig room={room} resetKey={resetKey} />
      <ambientLight intensity={0.95} />
      <hemisphereLight args={['#fff7e8', '#e8c9a0', 0.9]} />
      <directionalLight
        position={[9, 18, 8]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-radius={4}
      />
      <directionalLight position={[-8, 8, 10]} intensity={0.5} />
      <FloorStack view={view} selectedId={selectedId} onSelect={onSelect} onHover={onHover} />
    </Canvas>
  )
}
