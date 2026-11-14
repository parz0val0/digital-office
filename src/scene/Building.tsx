import { Environment, Lightformer, OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import type { BuildingSummary, FloorDef, Snapshot } from '../types'
import { FLOOR_H, Ground, PITCH, RoofDeck } from './Exterior'
import { makeLayout } from './layout'
import { MiniFloor } from './Mini'
import { fitFor, FloorContent } from './Scene'
import { themeFor } from './themes'
import { mix, NIGHT } from './tod'

const LIFT = 34 // 进入某层时，上面的楼层向上 / 下面的楼层向下 移开的距离
const CAM = 15
const EL_FLOOR = Math.atan(1 / Math.SQRT2) // 35.26°：楼层内部的等距视角
const EL_BUILDING = 0.5 // ≈24°：看大楼时略低，能透过玻璃幕墙看到楼里的小人
const T_IN = 1.7 // 进入楼层的镜头时长（秒）
const T_OUT = 1.5 // 退出楼层的镜头时长
const DT_MAX = new URLSearchParams(location.search).get('fast') === '1' ? 1 : 0.05 // ?fast=1：截图/测试用，补间不受帧率限制
const AO_BUILDING = Number(new URLSearchParams(location.search).get('aob') ?? 0.5)
const AO_FLOOR = 2.4
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
  const wProj = (maxW + maxD) * 0.7071 + 15 // 右侧留给楼层标签
  const hProj = (maxW + maxD) * 0.7071 * Math.sin(EL_BUILDING) + n * PITCH * Math.cos(EL_BUILDING) + 14
  return size.width < 600 ? size.width / (wProj * 0.9) : Math.min(size.width / wProj, size.height / hProj)
}

interface Want {
  el: number
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
  const tw = useRef<{ t: number; dur: number; from: { x: number; y: number; z: number; zoom: number; el: number; az: number; R: number } } | null>(null)
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
    const R = CAM * Math.sqrt(3) // ≈ 26
    c.position.set(w.x + R * Math.cos(w.el) * Math.sin(Math.PI / 4), w.y + R * Math.sin(w.el), w.z + R * Math.cos(w.el) * Math.cos(Math.PI / 4))
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
    const off = c.position.clone().sub(new THREE.Vector3(cur.current.x, cur.current.y, cur.current.z))
    const R = off.length()
    tw.current = { t: 0, dur, from: { x: cur.current.x, y: cur.current.y, z: cur.current.z, zoom: c.zoom, el: Math.asin(off.y / R), az: Math.atan2(off.x, off.z), R } }
  }, [focusKey, Math.round(want.zoom * 20), Math.round(want.y * 10), Math.round(want.el * 50)])

  useFrame((_, dt) => {
    const c = cam.current
    const ctl = controls.current
    if (!c || !ctl) return
    const w = wantRef.current
    const a = tw.current
    if (a) {
      a.t = Math.min(1, a.t + Math.min(dt, DT_MAX) / a.dur)
      const e = ease(a.t)
      const nx = a.from.x + (w.x - a.from.x) * e
      const ny = a.from.y + (w.y - a.from.y) * e
      const nz = a.from.z + (w.z - a.from.z) * e
      // 缩放按对数插值，视觉上匀速
      const nzoom = a.from.zoom * Math.pow(w.zoom / a.from.zoom, e)
      const el = a.from.el + (w.el - a.from.el) * e
      c.position.set(nx + a.from.R * Math.cos(el) * Math.sin(a.from.az), ny + a.from.R * Math.sin(el), nz + a.from.R * Math.cos(el) * Math.cos(a.from.az))
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
      <OrthographicCamera ref={cam} makeDefault position={[want.x + 15, want.y + 15, want.z + 15]} zoom={want.zoom} near={-120} far={260} />
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
    const d = Math.min(dt, DT_MAX)
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

interface SlotProps {
  idx: number // 用于和焦点楼层比较的序号（屋面 = 楼层号 + 0.5：它是这一层的“天花板”，进入这一层时跟着上面的楼层一起升走）
  focusIdx: number | null
  baseY: number
  pos: [number, number] // 该层在平面上的偏移（上层与底层后左角对齐）
  reg?: (g: THREE.Group | null) => void
  children: ReactNode
}

function FloorSlot({ idx, focusIdx, baseY, pos, reg, children }: SlotProps) {
  const g = useRef<THREE.Group>(null!)
  const off = useRef(0)
  const tw = useRef<{ t: number; dur: number; from: number } | null>(null)
  const prev = useRef<number | null | undefined>(undefined)
  const target = focusIdx == null ? 0 : idx > focusIdx ? LIFT : idx < focusIdx ? -LIFT : 0
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
    const d = Math.min(dt, DT_MAX)
    const a = tw.current
    if (a) {
      a.t = Math.min(1, a.t + d / a.dur)
      off.current = a.from + (targetRef.current - a.from) * ease(a.t)
      if (a.t >= 1) tw.current = null
    }
    if (g.current) {
      g.current.position.y = baseY + off.current
      g.current.visible = !(Math.abs(off.current) > LIFT * 0.97 && !tw.current)
    }
  })
  return (
    <group
      ref={(el) => {
        g.current = el!
        reg?.(el)
      }}
      position={[pos[0], baseY, pos[1]]}
    >
      {children}
    </group>
  )
}

/** 天空渐变背景：顶部偏冷的浅蓝灰 → 地平线暖奶油色 */
function Backdrop() {
  const { scene } = useThree()
  useEffect(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 256
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, mix('#cfdeec', '#6f7db8', NIGHT))
    gr.addColorStop(0.55, mix('#ece6dd', '#e6c3bd', NIGHT))
    gr.addColorStop(1, mix('#f6e6d2', '#fbd0a2', NIGHT))
    g.fillStyle = gr
    g.fillRect(0, 0, 4, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    const prev = scene.background
    scene.background = t
    return () => {
      scene.background = prev
      t.dispose()
    }
  }, [scene])
  return null
}

/** 帧率监测：持续偏低就自动降级到 low 画质 */
function PerfWatch({ onLow }: { onLow: () => void }) {
  const acc = useRef({ t: 0, n: 0, time: 0 })
  useFrame((_, dt) => {
    const a = acc.current
    a.time += dt
    if (a.time < 4) return
    a.t += dt
    a.n++
    if (a.n >= 90) {
      if (a.t / a.n > 1 / 22) onLow()
      a.t = 0
      a.n = 0
      a.time = 0
    }
  })
  return null
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
  quality: 'high' | 'low'
  onLowFps: () => void
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
  // 统一楼板：所有楼层同样大小（按人数最多的那层、至少 8 人规格），像真正的塔楼
  const plateN = Math.max(8, ...ordered.map((f) => nOf(f)))
  const layouts = ordered.map(() => makeLayout(plateN))
  const dims = layouts.map((l) => ({ w: l.room.w, d: l.room.d }))
  const bFit = buildingFit(dims, size)

  const focusIdx = focusId ? ordered.findIndex((f) => f.id === focusId) : null
  const lastIdx = lastFocus.current ? ordered.findIndex((f) => f.id === lastFocus.current) : -1
  const fOf = (i: number) => fitFor(layouts[i].room, size)
  const N = ordered.length
  const maxW = Math.max(...dims.map((d) => d.w))
  const maxD = Math.max(...dims.map((d) => d.d))
  // 上层与底层的后左角对齐 → 在等距视角里上层不会遮住下层
  const posOf = (_i: number): [number, number] => [0, 0]
  const want: Want =
    focusIdx != null && focusIdx >= 0
      ? { x: posOf(focusIdx)[0], z: posOf(focusIdx)[1] + 0.3, y: focusIdx * PITCH + 1.1, zoom: fOf(focusIdx), el: EL_FLOOR }
      : { x: 3.5, z: -3.5, y: (N * PITCH) / 2 + 9.8, zoom: bFit, el: EL_BUILDING }
  const floorFit = lastIdx >= 0 ? fOf(lastIdx) : bFit
  const dataFor = detail?.floorId ?? null
  // 镜头接近目标楼层且数据到位 → 切到详情；楼层不再是焦点时先“收起”再换回小模型
  useEffect(() => {
    if (near && focusId && dataFor === focusId && detailId == null) setDetailId(focusId)
  }, [near, focusId, dataFor, detailId])
  const closing = detailId != null && detailId !== focusId

  const ao = useRef<any>(null)
  const aoI = useRef(AO_FLOOR)
  const projVec = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    // 看整栋楼时 AO 轻一些（否则楼板下方的玻璃里会被压暗），进入楼层后加强
    aoI.current += ((focusId == null ? AO_BUILDING : AO_FLOOR) - aoI.current) * (1 - Math.exp(-Math.min(dt, DT_MAX) * 3))
    const cfg = ao.current?.configuration
    if (cfg) cfg.intensity = aoI.current
    ordered.forEach((f, i) => {
      const el = labelEls.current[f.id]
      const g = slots.current[f.id]
      if (!el || !g) return
      projVec.set(dims[i].w / 2 + 0.55, FLOOR_H * 0.5, -dims[i].d / 2 - 0.55)
      g.localToWorld(projVec)
      projVec.project(camera)
      el.style.transform = `translate3d(${((projVec.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${((-projVec.y * 0.5 + 0.5) * size.height).toFixed(1)}px, 0)`
    })
  })

  return (
    <>
      <Rig want={want} focusKey={focusId ?? ''} resetKey={p.resetKey} onZoomRatio={(r) => setNear(r > 0)} floorFit={floorFit} />
      <Backdrop />
      <ambientLight intensity={0.28 - NIGHT * 0.08} color={mix('#ffffff', '#c9c6ff', NIGHT)} />
      <hemisphereLight args={[mix('#dfeaf5', '#aab6e8', NIGHT), mix('#eadcc6', '#d2b9a0', NIGHT), 0.95 - NIGHT * 0.45]} />
      <directionalLight
        position={[14, 26 - NIGHT * 8, 11]}
        color={mix('#fff0da', '#ffbf8a', NIGHT)}
        intensity={2.5 - NIGHT * 1.35}
        castShadow
        shadow-mapSize={p.quality === 'high' ? [4096, 4096] : [2048, 2048]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={150}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-radius={5}
      />
      <directionalLight position={[-12, 9, -9]} color={mix('#cfe0ff', '#8da6ff', NIGHT)} intensity={0.55 + NIGHT * 0.3} />
      <Environment resolution={64} environmentIntensity={0.45 - NIGHT * 0.17}>
        <Lightformer form="rect" intensity={2.2} color={mix('#fff1dc', '#ffb88a', NIGHT)} position={[6, 9, 7]} scale={[12, 8, 1]} onUpdate={(l) => l.lookAt(0, 0, 0)} />
        <Lightformer form="rect" intensity={1.2} color={mix('#c9dcf5', '#8c9ce6', NIGHT)} position={[-8, 5, -4]} scale={[10, 6, 1]} onUpdate={(l) => l.lookAt(0, 0, 0)} />
        <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[0, 12, 0]} scale={10} onUpdate={(l) => l.lookAt(0, 0, 0)} />
      </Environment>
      {ordered.map((f, i) => {
        const theme = themeFor(f.theme, i)
        const inf = info(f.id)
        const showDetail = !!detail && detail.floorId === f.id && detailId === f.id
        const roamers = (summary?.roamers ?? []).filter((r) => r.floor === f.id)
        const inBuilding = focusId == null
        const hov = p.hoverFloor === f.id && inBuilding
        const ev = {
          onOver: inBuilding ? () => p.onHoverFloor(f.id) : undefined,
          onOut: inBuilding ? () => p.onHoverFloor(null) : undefined,
          onClick: inBuilding ? () => p.onFloorClick(f.id) : undefined,
        }
        const top = i === N - 1
        return (
          <group key={f.id}>
            <FloorSlot idx={i} focusIdx={focusIdx} baseY={i * PITCH} pos={posOf(i)} reg={(g) => (slots.current[f.id] = g)}>
              {i === 0 && <Ground w={maxW} d={maxD} accent={theme.accent} hideFront={focusId != null} />}
              {showDetail ? (
                <GrowIn key="detail" closing={closing} onClosed={() => setDetailId(null)}>
                  <FloorContent view={{ floor: f, snapshot: detail!.snapshot, theme }} selectedId={p.selectedId} onSelect={p.onSelect} onHover={p.onHoverAgent} interactive plateN={plateN} />
                </GrowIn>
              ) : (
                <MiniFloor key="mini" plateN={plateN} theme={theme} members={inf?.members ?? []} roamers={roamers} facade={inBuilding} hover={hov} {...ev} />
              )}
            </FloorSlot>
            {/* 屋面 / 天花板：进入这一层时随上面的楼层一起升走 */}
            <FloorSlot idx={i + 0.5} focusIdx={focusIdx} baseY={i * PITCH + FLOOR_H} pos={posOf(i)}>
              <group
                onPointerOver={ev.onOver ? (e) => (e.stopPropagation(), ev.onOver!()) : undefined}
                onPointerOut={ev.onOut ? (e) => (e.stopPropagation(), ev.onOut!()) : undefined}
                onClick={ev.onClick ? (e) => (e.stopPropagation(), ev.onClick!()) : undefined}
              >
                <RoofDeck w={dims[i].w} d={dims[i].d} accent={theme.accent} top={top} />
              </group>
            </FloorSlot>
          </group>
        )
      })}
      {p.quality === 'high' && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO ref={ao} aoRadius={1.4} distanceFalloff={1.2} intensity={2.4} quality="medium" halfRes />
          <Bloom intensity={0.45} luminanceThreshold={0.92} luminanceSmoothing={0.2} mipmapBlur />
          <ToneMapping mode={TM} />
          <Vignette offset={0.32} darkness={0.35} />
          <SMAA />
        </EffectComposer>
      )}
      <PerfWatch onLow={p.onLowFps} />
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
      <i className={`flline ${show ? '' : 'off'} ${hov ? 'hov' : ''}`} style={{ ['--a' as any]: th.accent }} />
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

const tmQ = new URLSearchParams(location.search).get('tm')
const TM = tmQ === 'agx' ? ToneMappingMode.AGX : tmQ === 'aces' ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.NEUTRAL
const qParam = new URLSearchParams(location.search).get('quality')

export function BuildingScene(p: Omit<BuildingSceneProps, 'quality' | 'onLowFps'>) {
  const slots = useRef<Record<string, THREE.Group | null>>({})
  const labelEls = useRef<Record<string, HTMLDivElement | null>>({})
  const ordered = p.floors
  // 画质：?quality=high|low 强制；否则默认 high，帧率持续偏低时自动降到 low
  const [quality, setQuality] = useState<'high' | 'low'>(qParam === 'low' ? 'low' : 'high')
  const full: BuildingSceneProps = { ...p, quality, onLowFps: () => qParam !== 'high' && quality === 'high' && setQuality('low') }
  return (
    <>
      <Canvas key={quality} shadows="percentage" dpr={[1, quality === 'high' ? 1.75 : 1.5]} flat={quality === 'high'} gl={{ antialias: quality === 'low', preserveDrawingBuffer: true, powerPreference: 'high-performance' }} onPointerMissed={() => p.onSelect(null)} style={{ position: 'absolute', inset: 0 }}>
        <Scene3D {...full} slots={slots} labelEls={labelEls} onDims={() => {}} />
      </Canvas>
      {/* 楼层标牌：普通 DOM，位置每帧由 3D 锚点投影得到（不依赖 drei Html） */}
      <div className="flayer">
        {ordered.map((f, idx) => (
          <FloorLabel key={f.id} f={f} i={ordered.length - 1 - idx} n={ordered.length} p={full} el={(e) => (labelEls.current[f.id] = e)} />
        ))}
      </div>
    </>
  )
}
