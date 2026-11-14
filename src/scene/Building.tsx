import { OrbitControls, OrthographicCamera, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { BuildingSummary, FloorDef, Snapshot } from '../types'
import { makeLayout } from './layout'
import { MiniFloor } from './Mini'
import { fitFor, FloorContent } from './Scene'
import { themeFor } from './themes'

/** 楼层间距（爆炸式展开：每层是一块悬浮托盘，才能同时看清每层里的小人） */
export const PITCH = 10.5
const LIFT = 34 // 进入某层时，上面的楼层向上 / 下面的楼层向下 移开的距离
const CAM = 15
const T_IN = 1.7 // 进入楼层的镜头时长（秒）
const T_OUT = 1.5 // 退出楼层的镜头时长
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

type Size = { width: number; height: number }

interface Dims {
  w: number
  d: number
}

function buildingFit(dims: Dims[], size: Size) {
  const maxW = Math.max(...dims.map((d) => d.w))
  const maxD = Math.max(...dims.map((d) => d.d))
  const n = dims.length
  const wProj = (maxW + maxD) * 0.7071 + 16 // 右侧留给楼层标签
  const hProj = (maxW + maxD) * 0.408 + (n - 1) * PITCH * 0.816 + 15
  return size.width < 600 ? size.width / (wProj * 0.9) : Math.min(size.width / wProj, size.height / hProj)
}

interface Want {
  y: number
  x: number
  z: number
  zoom: number
}

function Rig({ want, focusKey, resetKey, onZoomRatio, floorFit }: { want: Want; focusKey: string; resetKey: number; onZoomRatio: (r: number) => void; floorFit: number }) {
  const cam = useRef<THREE.OrthographicCamera>(null!)
  const controls = useRef<any>(null)
  const wantRef = useRef(want)
  wantRef.current = want
  const fitRef = useRef(floorFit)
  fitRef.current = floorFit
  const tw = useRef<{ t: number; dur: number; from: { x: number; y: number; z: number; zoom: number } } | null>(null)
  const cur = useRef({ y: want.y, x: want.x, z: want.z })
  const near = useRef(false)
  const first = useRef(true)
  const lastKey = useRef(focusKey)

  // 视角重置（以及首次摆放）
  useEffect(() => {
    const c = cam.current
    const ctl = controls.current
    if (!c || !ctl) return
    const w = wantRef.current
    cur.current = { y: w.y, x: w.x, z: w.z }
    c.position.set(w.x + CAM, w.y + CAM, w.z + CAM)
    ctl.target.set(w.x, w.y, w.z)
    c.zoom = w.zoom
    c.updateProjectionMatrix()
    ctl.update()
    tw.current = null
  }, [resetKey])

  // 聚焦楼层 / 尺寸变化：用带缓动的补间平滑飞过去（进入楼层 / 退出楼层 / 切换楼层时长不同）
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const c = cam.current
    if (!c) return
    const focusChanged = lastKey.current !== focusKey
    const dur = focusChanged ? (focusKey ? T_IN : T_OUT) : 0.6
    lastKey.current = focusKey
    tw.current = { t: 0, dur, from: { x: cur.current.x, y: cur.current.y, z: cur.current.z, zoom: c.zoom } }
  }, [focusKey, Math.round(want.zoom * 20), Math.round(want.y * 10)])

  useFrame((_, dt) => {
    const c = cam.current
    const ctl = controls.current
    if (!c || !ctl) return
    const w = wantRef.current
    const a = tw.current
    if (a) {
      a.t = Math.min(1, a.t + Math.min(dt, 0.05) / a.dur)
      const e = ease(a.t)
      const nx = a.from.x + (w.x - a.from.x) * e
      const ny = a.from.y + (w.y - a.from.y) * e
      const nz = a.from.z + (w.z - a.from.z) * e
      // 缩放按对数插值，视觉上匀速
      const nzoom = a.from.zoom * Math.pow(w.zoom / a.from.zoom, e)
      c.position.x += nx - cur.current.x
      c.position.y += ny - cur.current.y
      c.position.z += nz - cur.current.z
      ctl.target.set(nx, ny, nz)
      cur.current = { y: ny, x: nx, z: nz }
      c.zoom = nzoom
      c.updateProjectionMatrix()
      if (a.t >= 1) tw.current = null
    }
    const isNear = c.zoom / fitRef.current > 0.86
    if (isNear !== near.current) {
      near.current = isNear
      onZoomRatio(isNear ? 1 : 0)
    }
  })

  return (
    <>
      <OrthographicCamera ref={cam} makeDefault position={[want.x + CAM, want.y + CAM, want.z + CAM]} zoom={want.zoom} near={-120} far={260} />
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        minAzimuthAngle={Math.PI / 4 - 0.5}
        maxAzimuthAngle={Math.PI / 4 + 0.5}
        minPolarAngle={0.62}
        maxPolarAngle={1.2}
        minZoom={want.zoom * 0.65}
        maxZoom={want.zoom * 3}
        zoomSpeed={0.8}
        screenSpacePanning
        panSpeed={0.9}
        onStart={() => (tw.current = null)}
        onChange={() => {
          // 只在用户手动操作时限制平移；补间动画期间不干预（否则会让相机朝向漂移）
          if (tw.current) return
          const t = controls.current?.target as THREE.Vector3 | undefined
          const c = cam.current
          if (!t || !c) return
          const w = wantRef.current
          const lim = Math.max(0, (c.zoom / w.zoom - 1) * 6)
          const dx = THREE.MathUtils.clamp(t.x, w.x - lim, w.x + lim) - t.x
          const dz = THREE.MathUtils.clamp(t.z, w.z - lim, w.z + lim) - t.z
          const dy = w.y - t.y
          if (dx || dy || dz) {
            // 目标和相机一起平移，保持视角不变
            t.x += dx
            t.y += dy
            t.z += dz
            c.position.x += dx
            c.position.y += dy
            c.position.z += dz
          }
          cur.current = { y: t.y, x: t.x, z: t.z }
        }}
      />
    </>
  )
}

/** 详情楼层的“生长/收起”：从总览小模型切到详细模型时，墙和家具从地板缓缓长出；退出时先缓缓收回再换回小模型，没有突兀的跳变 */
function GrowIn({ closing, onClosed, children }: { closing: boolean; onClosed: () => void; children: ReactNode }) {
  const g = useRef<THREE.Group>(null!)
  const t = useRef(0)
  const done = useRef(false)
  useEffect(() => {
    document.body.classList.toggle('floor-closing', closing)
    return () => document.body.classList.remove('floor-closing')
  }, [closing])
  useFrame((_, dt) => {
    if (!g.current) return
    const d = Math.min(dt, 0.05)
    t.current = closing ? Math.max(0, t.current - d / 0.8) : Math.min(1, t.current + d / 1.0)
    g.current.scale.y = 0.2 + 0.8 * ease(t.current)
    if (closing && t.current <= 0 && !done.current) {
      done.current = true
      onClosed()
    }
  })
  return (
    <group ref={g} scale={[1, 0.2, 1]}>
      {children}
    </group>
  )
}

/** 上层托盘下方的透明立柱：落在下一层的墙顶，让悬浮的楼层读起来是“一栋楼” */
function Pillars({ w, d, color, show }: { w: number; d: number; color: string; show: boolean }) {
  const mats = useRef<THREE.MeshStandardMaterial[]>([])
  const o = useRef(1)
  const h = PITCH - 1.5 - 0.85
  useFrame((_, dt) => {
    o.current += ((show ? 1 : 0) - o.current) * (1 - Math.exp(-Math.min(dt, 0.05) * 6))
    mats.current.forEach((m) => m && (m.opacity = 0.55 * o.current))
  })
  const pts: [number, number][] = [
    [-w / 2 - 0.1, -d / 2 - 0.1],
    [w / 2 + 0.1, -d / 2 - 0.1],
    [-w / 2 - 0.1, d / 2 + 0.1],
  ]
  return (
    <group>
      {pts.map(([x, z], i) => (
        <mesh key={i} position={[x, -0.85 - h / 2, z]}>
          <cylinderGeometry args={[0.13, 0.13, h, 10]} />
          <meshStandardMaterial ref={(m) => (mats.current[i] = m!)} color={color} transparent opacity={0.55} roughness={0.2} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** 底座：草地广场 + 小树，随最底层一起移动 */
function Plaza({ w, d }: { w: number; d: number }) {
  const W = w + 9
  const D = d + 9
  const tree = (x: number, z: number, s = 1) => (
    <group key={`${x},${z}`} position={[x, -1.2, z]} scale={s}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.24, 1, 8]} />
        <meshStandardMaterial color="#9b6b43" />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <coneGeometry args={[1.0, 1.9, 8]} />
        <meshStandardMaterial color="#58b368" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.6, 0]} castShadow>
        <coneGeometry args={[0.72, 1.5, 8]} />
        <meshStandardMaterial color="#6cc47a" roughness={0.8} />
      </mesh>
    </group>
  )
  return (
    <group>
      <RoundedBox args={[W, 0.7, D]} radius={0.5} smoothness={3} position={[0, -1.55, 0]} receiveShadow>
        <meshStandardMaterial color="#cfe9b4" roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[W - 1.2, 0.2, D - 1.2]} radius={0.3} smoothness={3} position={[0, -1.18, 0]} receiveShadow>
        <meshStandardMaterial color="#bfe0a2" roughness={0.95} />
      </RoundedBox>
      {/* 门前小路 */}
      <mesh position={[w / 2 + 3.4, -1.06, d / 2 + 3.4]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} receiveShadow>
        <planeGeometry args={[2.2, 9]} />
        <meshStandardMaterial color="#f1e4c8" roughness={0.9} />
      </mesh>
      {tree(-W / 2 + 1.8, -D / 2 + 1.8, 1.1)}
      {tree(-W / 2 + 1.6, D / 2 - 2.0, 0.9)}
      {tree(W / 2 - 2.0, D / 2 - 1.6, 1.0)}
      {tree(-W / 2 + 4.2, D / 2 - 1.6, 0.75)}
    </group>
  )
}

interface SlotProps {
  index: number // 0 = 最底层
  focusIdx: number | null
  hover: boolean
  pos: [number, number] // 该层在平面上的偏移（上层与底层后左角对齐）
  reg: (g: THREE.Group | null) => void
  children: ReactNode
}

function FloorSlot({ index, focusIdx, hover, pos, reg, children }: SlotProps) {
  const g = useRef<THREE.Group>(null!)
  const off = useRef(0)
  const hov = useRef(0)
  const tw = useRef<{ t: number; dur: number; from: number } | null>(null)
  const prev = useRef<number | null | undefined>(undefined)
  const base = index * PITCH
  const target = focusIdx == null ? 0 : index > focusIdx ? LIFT : index < focusIdx ? -LIFT : 0
  const targetRef = useRef(target)
  targetRef.current = target
  useEffect(() => {
    if (prev.current === undefined) {
      prev.current = focusIdx
      off.current = target
      return
    }
    const entering = prev.current == null && focusIdx != null
    prev.current = focusIdx
    tw.current = { t: 0, dur: focusIdx != null ? (entering ? T_IN : 1.2) : T_OUT, from: off.current }
  }, [focusIdx])
  useFrame((_, dt) => {
    const d = Math.min(dt, 0.05)
    const a = tw.current
    if (a) {
      a.t = Math.min(1, a.t + d / a.dur)
      off.current = a.from + (targetRef.current - a.from) * ease(a.t)
      if (a.t >= 1) tw.current = null
    }
    hov.current += ((hover ? 0.7 : 0) - hov.current) * (1 - Math.exp(-d * 9))
    if (g.current) {
      g.current.position.y = base + off.current + hov.current
      g.current.visible = !(Math.abs(off.current) > LIFT * 0.97 && !tw.current)
    }
  })
  return (
    <group
      ref={(el) => {
        g.current = el!
        reg(el)
      }}
      position={[pos[0], base, pos[1]]}
    >
      {children}
    </group>
  )
}

export interface BuildingSceneProps {
  floors: FloorDef[] // 高 → 低
  summary: BuildingSummary | null
  focusId: string | null // null = 整栋楼视图
  hoverFloor: string | null
  onHoverFloor: (id: string | null) => void
  onFloorClick: (id: string) => void
  detail: { floorId: string; snapshot: Snapshot } | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  onHoverAgent: (id: string | null) => void
  resetKey: number
}

interface Internal {
  slots: React.MutableRefObject<Record<string, THREE.Group | null>>
  labelEls: React.MutableRefObject<Record<string, HTMLDivElement | null>>
  onDims: (d: Record<string, Dims>) => void
}

function Scene3D({ slots, labelEls, ...p }: BuildingSceneProps & Internal) {
  const { size, camera } = useThree()
  const { floors, summary, focusId, detail } = p
  const ordered = useMemo(() => floors.slice().reverse(), [floors]) // 0 = 最底层
  const lastFocus = useRef<string | null>(focusId)
  if (focusId) lastFocus.current = focusId
  const [near, setNear] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const info = (id: string) => summary?.floors.find((f) => f.id === id)
  const nOf = (f: FloorDef) => (detail && detail.floorId === f.id ? detail.snapshot.agents.length : info(f.id)?.members.length ?? 2)
  const layouts = ordered.map((f) => makeLayout(Math.max(nOf(f), 2)))
  const dims = layouts.map((l) => ({ w: l.room.w, d: l.room.d }))
  const bFit = buildingFit(dims, size)

  const focusIdx = focusId ? ordered.findIndex((f) => f.id === focusId) : null
  const lastIdx = lastFocus.current ? ordered.findIndex((f) => f.id === lastFocus.current) : -1
  const fOf = (i: number) => fitFor(layouts[i].room, size)
  const N = ordered.length
  const maxW = Math.max(...dims.map((d) => d.w))
  const maxD = Math.max(...dims.map((d) => d.d))
  // 上层与底层的后左角对齐 → 在等距视角里上层不会遮住下层
  const posOf = (i: number): [number, number] => [-(maxW - dims[i].w) / 2, -(maxD - dims[i].d) / 2]
  const want: Want =
    focusIdx != null && focusIdx >= 0
      ? { x: posOf(focusIdx)[0], z: posOf(focusIdx)[1] + 0.3, y: focusIdx * PITCH + 1.1, zoom: fOf(focusIdx) }
      : { x: 2.6, z: -2.6, y: ((N - 1) * PITCH) / 2 + 3.0, zoom: bFit }
  const floorFit = lastIdx >= 0 ? fOf(lastIdx) : bFit
  const dataFor = detail?.floorId ?? null
  // 镜头接近目标楼层且数据到位 → 切到详情；楼层不再是焦点时先“收起”再换回小模型
  useEffect(() => {
    if (near && focusId && dataFor === focusId && detailId == null) setDetailId(focusId)
  }, [near, focusId, dataFor, detailId])
  const closing = detailId != null && detailId !== focusId

  const projVec = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    ordered.forEach((f, i) => {
      const el = labelEls.current[f.id]
      const g = slots.current[f.id]
      if (!el || !g) return
      projVec.set(dims[i].w / 2 + 0.9, 0.2, -dims[i].d / 2 - 0.1)
      g.localToWorld(projVec)
      projVec.project(camera)
      el.style.transform = `translate3d(${((projVec.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-projVec.y * 0.5 + 0.5) * size.height).toFixed(1)}px, 0)`
    })
  })

  return (
    <>
      <Rig want={want} focusKey={focusId ?? ''} resetKey={p.resetKey} onZoomRatio={(r) => setNear(r > 0)} floorFit={floorFit} />
      <ambientLight intensity={0.95} />
      <hemisphereLight args={['#fff7e8', '#e8c9a0', 0.9]} />
      <directionalLight
        position={[9, 22, 8]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-radius={4}
      />
      <directionalLight position={[-8, 8, 10]} intensity={0.5} />
      {ordered.map((f, i) => {
        const theme = themeFor(f.theme, i)
        const inf = info(f.id)
        const showDetail = !!detail && detail.floorId === f.id && detailId === f.id
        const roamers = (summary?.roamers ?? []).filter((r) => r.floor === f.id)
        const inBuilding = focusId == null
        return (
          <FloorSlot key={f.id} index={i} focusIdx={focusIdx} pos={posOf(i)} reg={(g) => (slots.current[f.id] = g)} hover={p.hoverFloor === f.id && inBuilding}>
            {i > 0 && <Pillars w={dims[i].w} d={dims[i].d} color={theme.accent} show={inBuilding} />}
            {i === 0 && <Plaza w={maxW} d={maxD} />}
            {showDetail ? (
              <GrowIn key="detail" closing={closing} onClosed={() => setDetailId(null)}>
                <FloorContent view={{ floor: f, snapshot: detail!.snapshot, theme }} selectedId={p.selectedId} onSelect={p.onSelect} onHover={p.onHoverAgent} interactive />
              </GrowIn>
            ) : (
              <MiniFloor
                key="mini"
                label={f.label ?? `${f.order}F`}
                name={f.name}
                theme={theme}
                members={inf?.members ?? []}
                roamers={roamers}
                info={inf}
                showLabel={inBuilding}
                hover={p.hoverFloor === f.id && inBuilding}
                onOver={inBuilding ? () => p.onHoverFloor(f.id) : undefined}
                onOut={inBuilding ? () => p.onHoverFloor(null) : undefined}
                onClick={inBuilding ? () => p.onFloorClick(f.id) : undefined}
              />
            )}
          </FloorSlot>
        )
      })}
    </>
  )
}

function FloorLabel({ f, i, n, p, el }: { f: FloorDef; i: number; n: number; p: BuildingSceneProps; el: (e: HTMLDivElement | null) => void }) {
  const th = themeFor(f.theme, i)
  const inf = p.summary?.floors.find((x) => x.id === f.id)
  const roamers = (p.summary?.roamers ?? []).filter((r) => r.floor === f.id)
  const pct = Math.round(inf?.completion ?? 0)
  const hov = p.hoverFloor === f.id
  const show = p.focusId == null
  return (
    <div ref={el} className="flpos">
      <div
        className={`flabel ${hov ? 'hov' : ''} ${show ? '' : 'off'}`}
        style={{ ['--a' as any]: th.accent }}
        onMouseEnter={() => p.onHoverFloor(f.id)}
        onMouseLeave={() => p.onHoverFloor(null)}
        onClick={() => p.onFloorClick(f.id)}
      >
        <span className="flnum">{f.label ?? `${f.order}F`}</span>
        <span className="flbody">
          <span className="flname">
            {f.name}
            {roamers.map((r) => (
              <span key={r.id} className="rmark" style={{ background: r.color }} title={`${r.name} is on this floor (roaming)`}>
                {r.name}
              </span>
            ))}
          </span>
          <span className="flrow">
            <span className="flbar">
              <i style={{ width: `${pct}%` }} />
            </span>
            <b>{pct}%</b>
          </span>
          <span className="flmeta">
            {inf?.members.length ?? 0} bots{inf && inf.items.total ? ` · ${inf.items.done}/${inf.items.total} done` : ''}
          </span>
        </span>
      </div>
    </div>
  )
}

export function BuildingScene(p: BuildingSceneProps) {
  const slots = useRef<Record<string, THREE.Group | null>>({})
  const labelEls = useRef<Record<string, HTMLDivElement | null>>({})
  const ordered = p.floors
  return (
    <>
      <Canvas shadows="percentage" dpr={[1, 2]} flat gl={{ antialias: true, preserveDrawingBuffer: true }} onPointerMissed={() => p.onSelect(null)} style={{ position: 'absolute', inset: 0 }}>
        <Scene3D {...p} slots={slots} labelEls={labelEls} onDims={() => {}} />
      </Canvas>
      {/* 楼层标牌：普通 DOM，位置每帧由 3D 锚点投影得到（不依赖 drei Html） */}
      <div className="flayer">
        {ordered.map((f, idx) => (
          <FloorLabel key={f.id} f={f} i={ordered.length - 1 - idx} n={ordered.length} p={p} el={(e) => (labelEls.current[f.id] = e)} />
        ))}
      </div>
    </>
  )
}
