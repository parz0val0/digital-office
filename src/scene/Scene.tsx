import { OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { collabLinks, agentName, STATUS_META } from '../meta'
import type { Snapshot } from '../types'
import { Character } from './Character'
import { CollabLinks } from './CollabLinks'
import {
  Bookshelf,
  Chair,
  CoffeeStation,
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
  Box,
  Cyl,
} from './Furniture'
import { assignDesks, DESK_YAW, deskPos, ROOM, seatPos } from './layout'
import { Whiteboard } from './Whiteboard'

const TARGET = new THREE.Vector3(0, 1.1, 0.3)

function CameraRig({ resetKey }: { resetKey: number }) {
  const { size } = useThree()
  const cam = useRef<THREE.OrthographicCamera>(null!)
  const controls = useRef<any>(null)
  const narrow = size.width < 600
  const fitZoom = narrow ? size.width / 22 : Math.min(size.width / 25.5, size.height / 18.5)

  useEffect(() => {
    const c = cam.current
    const ctl = controls.current
    if (!c || !ctl) return
    c.zoom = fitZoom
    c.position.set(15, 15, 15).add(TARGET).sub(new THREE.Vector3(0, 0, 0))
    c.position.set(TARGET.x + 15, TARGET.y + 15, TARGET.z + 15)
    c.updateProjectionMatrix()
    ctl.target.copy(TARGET)
    ctl.update()
  }, [fitZoom, resetKey])

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
        minZoom={fitZoom * 0.8}
        maxZoom={fitZoom * 3.2}
        zoomSpeed={0.8}
        screenSpacePanning
        panSpeed={0.9}
        onChange={() => {
          const t = controls.current?.target as THREE.Vector3 | undefined
          if (!t) return
          const c = cam.current
          const zf = c ? c.zoom / fitZoom : 1
          const lim = Math.max(0, (zf - 1) * 5)
          t.x = THREE.MathUtils.clamp(t.x, -lim, lim)
          t.z = THREE.MathUtils.clamp(t.z, -lim, lim)
          t.y = 1.1
        }}
      />
    </>
  )
}

export interface SceneProps {
  snapshot: Snapshot
  selectedId: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  resetKey: number
}

export function Scene({ snapshot, selectedId, onSelect, onHover, resetKey }: SceneProps) {
  const desks = useMemo(() => assignDesks(snapshot.agents), [snapshot.agents.map((a) => a.id + a.desk).join()])
  const links = useMemo(() => collabLinks(snapshot), [snapshot.agents, snapshot.collaborations])
  const colors = useMemo(() => Object.fromEntries(snapshot.agents.map((a) => [a.id, a.color])), [snapshot.agents])
  const activeLinks = links.filter((l) => {
    const a = snapshot.agents.find((x) => x.id === l.a)
    const b = snapshot.agents.find((x) => x.id === l.b)
    return a && b && a.status !== 'offline' && b.status !== 'offline'
  })
  const { d } = ROOM

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      flat
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => onSelect(null)}
      style={{ position: 'absolute', inset: 0 }}
    >
      <CameraRig resetKey={resetKey} />
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

      <Room />
      <Whiteboard snapshot={snapshot} />
      <WallClock x={7.0} y={3.1} z={-d / 2 + 0.1} />
      <WindowFrame x={-9.98} z={-4.4} />
      <WindowFrame x={-9.98} z={-0.8} />
      <Poster x={-9.95} y={2.3} z={6.1} rotY={Math.PI / 2} c1="#ffd166" c2="#ef476f" />
      <Poster x={-7.2} y={3.1} z={-d / 2 + 0.05} c1="#9ad0f5" c2="#ff9f68" />
      <Bookshelf x={-9.7} z={2.3} rotY={Math.PI / 2} />
      <Plant x={-9.1} z={4.1} s={1.2} />
      <Plant x={9.2} z={-6.2} s={1.25} c="#5cb85c" />
      <Plant x={9.3} z={2.2} s={1.0} c="#3f9d5d" />
      <Plant x={-9.1} z={-6.2} s={1.0} />
      <CoffeeStation x={7.2} z={-6.4} />
      <Sofa x={-9.0} z={5.7} rotY={Math.PI / 2} />
      <Cyl p={[-7.5, 0.3, 5.7]} r={0.5} h={0.12} c="#fff1d6" />
      <Cyl p={[-7.5, 0.15, 5.7]} r={0.08} h={0.3} c="#c99562" />
      <Mug x={-7.5} z={5.6} c="#ff7a7a" />
      <Box p={[-7.5, 0.04, 5.7]} s={[2.2, 0.04, 2.2]} c="#ffd7a8" r={0.02} shadow={false} />

      <MeetingTable />
      {Array.from({ length: 12 }).map((_, i) => {
        const s = seatPos(i)
        return <Chair key={i} x={s.x} z={s.z} yaw={s.yaw} c="#7fb5c9" />
      })}

      {snapshot.agents.map((a, i) => {
        const slot = desks[a.id]
        const p = deskPos(slot)
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
        const partners = links
          .filter((l) => l.a === a.id || l.b === a.id)
          .map((l) => agentName(snapshot, l.a === a.id ? l.b : l.a))
        return (
          <Character
            key={a.id}
            agent={a}
            index={i}
            deskSlot={desks[a.id]}
            seat={desks[a.id]}
            selected={selectedId === a.id}
            partnerNames={a.status === 'collaborating' ? partners : []}
            onSelect={onSelect}
            onHover={onHover}
          />
        )
      })}
      <CollabLinks links={activeLinks} colors={colors} />
    </Canvas>
  )
}
