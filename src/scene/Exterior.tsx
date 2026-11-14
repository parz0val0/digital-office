import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { Plant } from './Furniture'
import { NIGHT } from './tod'

/** 楼层净高 / 楼板厚度 / 层距（紧贴堆叠，像真的大楼） */
export const FLOOR_H = 5.2
export const ROOF_T = 0.5
export const PITCH = FLOOR_H + ROOF_T

export const PAL = {
  concrete: '#efe8dc',
  concreteDark: '#dccfbc',
  trim: '#f6f1e8',
  mullion: '#d2c7b6',
  glass: '#8fb4cc',
  plaza: '#e6dfd1',
  plazaLine: '#d6ccba',
  grass: '#a9c98f',
  grassDark: '#98ba80',
  metal: '#c9ced3',
  dark: '#3a3447',
}

const lerpCol = (a: string, b: string, k: number) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString()

function Blk({ p, s, c, r = 0.03, shadow = false, rough = 0.85, emissive, ei = 0, rot }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: number; shadow?: boolean; rough?: number; emissive?: string; ei?: number; rot?: [number, number, number] }) {
  return (
    <RoundedBox args={s} radius={Math.min(r, Math.min(...s) / 2 - 0.001)} smoothness={2} position={p} rotation={rot} castShadow={shadow} receiveShadow>
      <meshStandardMaterial color={c} roughness={rough} emissive={emissive ?? '#000'} emissiveIntensity={ei} />
    </RoundedBox>
  )
}

/** 玻璃幕墙的“天空倒影”贴图：上浅下深的蓝灰渐变 + 几道斜向高光 */
function useGlassTex() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 256
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, '#b9d3e4')
    gr.addColorStop(0.5, '#86abc4')
    gr.addColorStop(1, '#5f86a3')
    g.fillStyle = gr
    g.fillRect(0, 0, 512, 256)
    const streak = (x: number, wd: number, a: number) => {
      g.save()
      g.translate(x, 0)
      g.transform(1, 0, -0.6, 1, 0, 0)
      const lg = g.createLinearGradient(-wd, 0, wd, 0)
      lg.addColorStop(0, 'rgba(255,255,255,0)')
      lg.addColorStop(0.5, `rgba(255,255,255,${a})`)
      lg.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = lg
      g.fillRect(-wd, 0, wd * 2, 256)
      g.restore()
    }
    streak(140, 40, 0.34)
    streak(215, 9, 0.3)
    streak(380, 56, 0.26)
    streak(470, 12, 0.22)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * 外立面：封闭的玻璃幕墙大楼。镜头看得到的两面（前 +z / 右 +x）画上：带天空倒影的有色反光玻璃、
 * 纤细窗框网格、窗下裙板和顶梁，以及一部分亮灯的窗（暖光 + 该层强调色，晚上更亮；hover 时整层窗户亮起）。
 * show=false 时整体淡出（进入该层时外壳褪去，露出详情房间）。
 */
export function Facade({ w, d, accent, show, hover, lit, seed = 0 }: { w: number; d: number; accent: string; show: boolean; hover: boolean; lit: boolean; seed?: number }) {
  const g = useRef<THREE.Group>(null!)
  const mats = useRef<Map<string, { m: THREE.Material; base: number }>>(new Map())
  const o = useRef(1)
  const glow = useRef(0)
  const tex = useGlassTex()
  const reg = (base: number) => (m: THREE.Material | null) => {
    if (m) mats.current.set(m.uuid, { m, base })
  }
  const litMats = useRef<THREE.MeshStandardMaterial[]>([])
  const beamMats = useRef<THREE.MeshStandardMaterial[]>([])
  const baseLit = lit ? 0.12 + NIGHT * 1.6 : 0
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 5)
    o.current += ((show ? 1 : 0) - o.current) * k
    glow.current += ((hover ? 1 : 0) - glow.current) * (1 - Math.exp(-Math.min(dt, 0.05) * 8))
    mats.current.forEach(({ m, base }) => {
      m.transparent = o.current < 0.995
      m.opacity = base * o.current
    })
    litMats.current.forEach((m) => m && (m.emissiveIntensity = baseLit + glow.current * 2.2))
    beamMats.current.forEach((m) => m && (m.emissiveIntensity = glow.current * 1.4))
    if (g.current) g.current.visible = o.current > 0.01
  })
  const H = FLOOR_H
  const SP = 0.5 // 裙板高
  const TOP = 0.38 // 顶梁高
  const gh = H - SP - TOP
  const faces: { len: number; along: 'x' | 'z'; at: number }[] = [
    { len: w, along: 'x', at: d / 2 },
    { len: d, along: 'z', at: w / 2 },
  ]
  const warm = lerpCol('#ffe2b0', accent, 0.2)
  const band = (len: number, y: number, h: number, c: string, i: number, track?: 'beam') => (
    <mesh key={`b${i}-${y}`} position={[0, y, 0]} receiveShadow>
      <boxGeometry args={[len + 0.5, h, 0.3]} />
      <meshStandardMaterial ref={(m) => { reg(1)(m); if (track && m) beamMats.current[i] = m }} color={c} roughness={0.8} emissive={accent} emissiveIntensity={0} />
    </mesh>
  )
  return (
    <group ref={g}>
      {faces.map((f, i) => {
        const n = Math.max(2, Math.round(f.len / 2.3))
        const step = f.len / n
        const rows = 2
        const rh = gh / rows
        return (
          <group key={i} position={f.along === 'x' ? [0, 0, f.at] : [f.at, 0, 0]} rotation={[0, f.along === 'x' ? 0 : Math.PI / 2, 0]}>
            {band(f.len, SP / 2, SP, PAL.concrete, i)}
            {band(f.len, H - TOP / 2, TOP, lerpCol(PAL.trim, accent, 0.14), i, 'beam')}
            {/* 反光玻璃幕墙 */}
            <mesh position={[0, SP + gh / 2, -0.02]}>
              <planeGeometry args={[f.len, gh]} />
              <meshStandardMaterial ref={reg(1)} map={tex} roughness={0.3} metalness={0.12} envMapIntensity={0.9} />
            </mesh>
            {/* 亮灯的窗格 */}
            {Array.from({ length: n * rows }).map((_, k) => {
              const c = k % n
              const r = Math.floor(k / n)
              if (hash(k * 7.3 + i * 31 + seed * 13) > 0.34) return null
              return (
                <mesh key={k} position={[-f.len / 2 + step * (c + 0.5), SP + rh * (r + 0.5), 0.0]}>
                  <planeGeometry args={[step - 0.12, rh - 0.1]} />
                  <meshStandardMaterial
                    ref={(m) => {
                      reg(1)(m)
                      if (m) litMats.current[i * 100 + k] = m
                    }}
                    color={warm}
                    emissive={warm}
                    emissiveIntensity={baseLit}
                    roughness={0.4}
                    toneMapped={false}
                  />
                </mesh>
              )
            })}
            {/* 窗框网格 */}
            {Array.from({ length: n + 1 }).map((_, k) => (
              <mesh key={k} position={[-f.len / 2 + k * step, SP + gh / 2, 0.03]} receiveShadow>
                <boxGeometry args={[0.08, gh, 0.12]} />
                <meshStandardMaterial ref={reg(1)} color={PAL.mullion} roughness={0.5} metalness={0.25} />
              </mesh>
            ))}
            {Array.from({ length: rows - 1 }).map((_, k) => (
              <mesh key={`h${k}`} position={[0, SP + rh * (k + 1), 0.03]}>
                <boxGeometry args={[f.len, 0.07, 0.12]} />
                <meshStandardMaterial ref={reg(1)} color={PAL.mullion} roughness={0.5} metalness={0.25} />
              </mesh>
            ))}
          </group>
        )
      })}
      {/* 转角立柱 */}
      <mesh position={[w / 2, H / 2, d / 2]} receiveShadow>
        <boxGeometry args={[0.32, H, 0.32]} />
        <meshStandardMaterial ref={reg(1)} color={PAL.concreteDark} roughness={0.85} />
      </mesh>
    </group>
  )
}

function Sign() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1400
    c.height = 280
    const g = c.getContext('2d')!
    const r = 40
    g.fillStyle = '#2f2a3c'
    g.beginPath()
    g.roundRect(0, 0, 1400, 280, r)
    g.fill()
    g.strokeStyle = '#ffb571'
    g.lineWidth = 8
    g.beginPath()
    g.roundRect(18, 18, 1364, 244, r - 14)
    g.stroke()
    // 小图标：三层楼
    const cols = ['#f4a99d', '#a9d9a0', '#ffc38a']
    cols.forEach((col, i) => {
      g.fillStyle = col
      g.beginPath()
      g.roundRect(90 + i * 22, 190 - i * 50 - 40 + 60, 140 - i * 44, 38, 8)
      g.fill()
    })
    g.fillStyle = '#fff4e4'
    g.font = '700 100px "Helvetica Neue", Arial, sans-serif'
    g.textBaseline = 'middle'
    g.fillText("Jason's Digital Office", 290, 140)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group>
      <mesh position={[0, 0, 0.06]} castShadow>
        <boxGeometry args={[7.0, 1.4, 0.18]} />
        <meshStandardMaterial color="#2f2a3c" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.16]}>
        <planeGeometry args={[6.8, 1.36]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {[-2.8, 2.8].map((x) => (
        <mesh key={x} position={[x, -0.95, 0.04]} castShadow>
          <boxGeometry args={[0.16, 0.7, 0.16]} />
          <meshStandardMaterial color={PAL.metal} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function ACUnit({ x, z, rot = 0 }: { x: number; z: number; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <Blk p={[0, 0.5, 0]} s={[1.5, 1.0, 1.1]} c="#dfe3e6" r={0.06} shadow rough={0.6} />
      <mesh position={[0, 1.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.38, 20]} />
        <meshStandardMaterial color="#8d949b" roughness={0.5} metalness={0.3} />
      </mesh>
      <Blk p={[0, 0.06, 0]} s={[1.6, 0.12, 1.2]} c="#aab0b6" r={0.02} />
    </group>
  )
}

function SolarRow({ x, z, n = 4 }: { x: number; z: number; n?: number }) {
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: n }).map((_, i) => (
        <group key={i} position={[i * 2.05, 0.2, 0]} rotation={[-0.38, 0, 0]}>
          <Blk p={[0, 0.5, 0]} s={[1.95, 0.07, 1.3]} c="#dfe6ee" r={0.02} shadow rough={0.5} />
          <mesh position={[0, 0.55, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.8, 1.16]} />
            <meshStandardMaterial color="#35508f" roughness={0.25} metalness={0.5} envMapIntensity={1.4} />
          </mesh>
          {[-0.45, 0, 0.45].map((gx) => (
            <mesh key={gx} position={[gx, 0.556, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.02, 1.16]} />
              <meshBasicMaterial color="#9db4e6" />
            </mesh>
          ))}
          <mesh position={[0, 0.556, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.8, 0.02]} />
            <meshBasicMaterial color="#9db4e6" />
          </mesh>
        </group>
      ))}
      <Blk p={[(n - 1) * 1.025, 0.1, 0.35]} s={[n * 2.05, 0.1, 0.12]} c="#aab0b6" r={0.02} />
    </group>
  )
}

function Bed({ x, z, w, d, flowers }: { x: number; z: number; w: number; d: number; flowers?: boolean }) {
  const dots = useMemo(() => {
    const out: { x: number; z: number; c: string }[] = []
    const cols = ['#ff9eb5', '#ffd166', '#ffffff', '#ffb27a']
    for (let i = 0; i < Math.round(w * d * 1.4); i++) out.push({ x: (Math.sin(i * 12.9898) * 0.5) * (w - 0.4), z: (Math.sin(i * 78.233 + 1) * 0.5) * (d - 0.4), c: cols[i % cols.length] })
    return out
  }, [w, d])
  return (
    <group position={[x, 0, z]}>
      <Blk p={[0, 0.2, 0]} s={[w, 0.4, d]} c="#e7ddcc" r={0.1} shadow />
      <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w - 0.3, d - 0.3]} />
        <meshStandardMaterial color="#8fbf7c" roughness={1} />
      </mesh>
      {flowers &&
        dots.map((f, i) => (
          <mesh key={i} position={[f.x, 0.5, f.z]}>
            <sphereGeometry args={[0.09, 6, 5]} />
            <meshStandardMaterial color={f.c} roughness={0.9} />
          </mesh>
        ))}
    </group>
  )
}

/**
 * 楼板 / 屋顶：实心楼板 + 出挑檐口（强调色细线）。
 * 顶层（top）是一个精心布置的屋顶：女儿墙、楼梯间、空调外机、水箱、太阳能板、屋顶花园 + 小树 + 长椅、招牌、天线。
 */
export function RoofDeck({ w, d, accent, top, onGlass }: { w: number; d: number; accent: string; top: boolean; onGlass?: boolean }) {
  void onGlass
  const T = ROOF_T
  const dw = w + 1.1
  const dd = d + 1.1
  const beacon = useRef<THREE.MeshStandardMaterial>(null!)
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 3) * 0.9
  })
  const rim = lerpCol(PAL.trim, accent, 0.5)
  return (
    <group>
      {/* 楼板：主体 + 下沿阴影缝 + 檐口 */}
      <Blk p={[0, T / 2 - 0.05, 0]} s={[dw, T - 0.1, dd]} c={PAL.concrete} r={0.05} />
      <Blk p={[0, T - 0.07, 0]} s={[dw + 0.18, 0.14, dd + 0.18]} c={rim} r={0.05} />
      <Blk p={[0, 0.0, 0]} s={[dw - 0.5, 0.1, dd - 0.5]} c={PAL.concreteDark} r={0.02} />
      {top && (
        <>
          {/* 女儿墙 */}
          {[
            { p: [0, T + 0.2, dd / 2 - 0.08] as [number, number, number], s: [dw, 0.4, 0.16] as [number, number, number] },
            { p: [dw / 2 - 0.08, T + 0.2, 0] as [number, number, number], s: [0.16, 0.4, dd] as [number, number, number] },
            { p: [0, T + 0.2, -dd / 2 + 0.08] as [number, number, number], s: [dw, 0.4, 0.16] as [number, number, number] },
            { p: [-dw / 2 + 0.08, T + 0.2, 0] as [number, number, number], s: [0.16, 0.4, dd] as [number, number, number] },
          ].map((b, i) => (
            <Blk key={i} p={b.p} s={b.s} c={PAL.trim} r={0.04} />
          ))}
          {/* 屋面 */}
          <mesh position={[0, T + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[dw - 0.3, dd - 0.3]} />
            <meshStandardMaterial color="#e8e2d6" roughness={0.95} />
          </mesh>
          {/* 走道铺装 */}
          <mesh position={[0, T + 0.006, 1.2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[dw - 2.4, 1.2]} />
            <meshStandardMaterial color="#efe8dc" roughness={0.95} />
          </mesh>
          <group position={[0, T, 0]}>
            {/* 楼梯间 + 门 */}
            <Blk p={[-w / 2 + 2.2, 0.95, -d / 2 + 2.0]} s={[3.6, 1.9, 2.8]} c={PAL.concrete} r={0.08} shadow />
            <Blk p={[-w / 2 + 2.2, 1.96, -d / 2 + 2.0]} s={[3.9, 0.14, 3.1]} c={PAL.trim} r={0.05} />
            <Blk p={[-w / 2 + 3.3, 0.75, -d / 2 + 3.42]} s={[0.9, 1.5, 0.08]} c={accent} r={0.03} />
            {/* 空调外机 */}
            <ACUnit x={w / 2 - 2.0} z={-d / 2 + 1.5} />
            <ACUnit x={w / 2 - 3.8} z={-d / 2 + 1.5} />
            <ACUnit x={w / 2 - 2.0} z={-d / 2 + 3.0} />
            {/* 水箱 */}
            <mesh position={[-w / 2 + 6.2, 0.8, -d / 2 + 1.6]} castShadow>
              <cylinderGeometry args={[0.75, 0.75, 1.6, 20]} />
              <meshStandardMaterial color="#d8dde1" roughness={0.6} metalness={0.2} />
            </mesh>
            {/* 太阳能板阵列（两排） */}
            <SolarRow x={0.6} z={-1.4} />
            <SolarRow x={0.6} z={-3.2} />
            {/* 屋顶花园 */}
            <Bed x={-w / 2 + 3.6} z={d / 2 - 3.4} w={6.2} d={3.2} flowers />
            <Tree x={-w / 2 + 2.0} z={d / 2 - 3.4} s={0.55} y={0.4} />
            <Tree x={-w / 2 + 5.0} z={d / 2 - 3.9} s={0.42} y={0.4} />
            <Bed x={w / 2 - 3.0} z={d / 2 - 3.4} w={4.2} d={1.6} />
            <Plant x={w / 2 - 4.0} z={d / 2 - 3.4} s={0.8} />
            <Plant x={w / 2 - 2.2} z={d / 2 - 3.4} s={0.8} c="#3f9d5d" />
            {/* 长椅 */}
            <Blk p={[-0.8, 0.28, d / 2 - 2.0]} s={[2.4, 0.12, 0.6]} c={accent} r={0.05} shadow />
            <Blk p={[-0.8, 0.12, d / 2 - 2.0]} s={[2.2, 0.24, 0.5]} c="#c9bba5" r={0.04} />
            {/* 天线 + 航空灯 */}
            <mesh position={[w / 2 - 1.0, 1.7, -d / 2 + 3.8]} castShadow>
              <cylinderGeometry args={[0.05, 0.08, 3.4, 8]} />
              <meshStandardMaterial color={PAL.metal} metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[w / 2 - 1.0, 3.5, -d / 2 + 3.8]}>
              <sphereGeometry args={[0.16, 12, 10]} />
              <meshStandardMaterial ref={beacon} color="#ff6b5e" emissive="#ff4a3d" emissiveIntensity={1.5} />
            </mesh>
            {/* 招牌：立在屋顶后沿，朝向镜头 */}
            <group position={[w / 2 - 6.4, 2.7, -d / 2 + 0.2]} rotation={[0, Math.PI / 4, 0]} scale={1.2}>
              <Sign />
            </group>
          </group>
        </>
      )}
    </group>
  )
}

/** 一棵圆润的低多边形树 */
export function Tree({ x, z, s = 1, y = 0 }: { x: number; z: number; s?: number; y?: number }) {
  return (
    <group position={[x, y, z]} scale={s}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.2, 1.1, 8]} />
        <meshStandardMaterial color="#a77d58" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.95, 1]} />
        <meshStandardMaterial color="#7fb877" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.45, 2.2, 0.2]} castShadow>
        <icosahedronGeometry args={[0.6, 1]} />
        <meshStandardMaterial color="#93c98a" roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 2.4, 8]} />
        <meshStandardMaterial color="#4a4458" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 2.5, 0]}>
        <sphereGeometry args={[0.2, 14, 12]} />
        <meshStandardMaterial color="#fff2d6" emissive="#ffd9a0" emissiveIntensity={1.4 + NIGHT * 2.6} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** 地面：基座台阶 + 广场铺装 + 草坪 + 树 + 路灯 + 入口雨棚 + 门前人行道。随最底层一起移动。 */
export function Ground({ w, d, accent, hideFront = false }: { w: number; d: number; accent: string; hideFront?: boolean }) {
  const front = useRef<THREE.Group>(null!)
  const door = useRef<THREE.Group>(null!)
  const fk = useRef(1)
  useFrame((_, dt) => {
    // 进入楼层视图时，门前的树 / 路灯 / 雨棚缩下去（会挡住前景）；回到整栋楼再长出来
    fk.current += ((hideFront ? 0 : 1) - fk.current) * (1 - Math.exp(-Math.min(dt, 0.05) * 5))
    for (const r of [front, door]) {
      if (r.current) {
        r.current.scale.setScalar(Math.max(0.001, fk.current))
        r.current.visible = fk.current > 0.02
      }
    }
  })
  const W = w + 9
  const D = d + 9
  const shadowTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128)
    gr.addColorStop(0, 'rgba(60,45,40,0.42)')
    gr.addColorStop(0.55, 'rgba(60,45,40,0.2)')
    gr.addColorStop(1, 'rgba(60,45,40,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 256, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => shadowTex.dispose(), [shadowTex])
  const ex = w / 2 - 4.6 // 入口位置（前立面）
  return (
    <group>
      {/* 广场 */}
      <RoundedBox args={[W, 0.7, D]} radius={0.35} smoothness={3} position={[0, -1.0, 0]} receiveShadow>
        <meshStandardMaterial color={PAL.plaza} roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[W - 0.8, 0.12, D - 0.8]} radius={0.1} smoothness={2} position={[0, -0.62, 0]} receiveShadow>
        <meshStandardMaterial color={PAL.plazaLine} roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[W - 1.2, 0.1, D - 1.2]} radius={0.1} smoothness={2} position={[0, -0.58, 0]} receiveShadow>
        <meshStandardMaterial color={PAL.plaza} roughness={0.95} />
      </RoundedBox>
      {/* 烘焙感的大楼落影 */}
      <mesh position={[-3.2, -0.5, -2.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w + 14, d + 14]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} />
      </mesh>
      {/* 基座台阶 */}
      <Blk p={[0, -0.28, 0]} s={[w + 1.8, 0.56, d + 1.8]} c={PAL.concreteDark} r={0.08} />
      <Blk p={[0, -0.12, 0]} s={[w + 1.2, 0.24, d + 1.2]} c={PAL.trim} r={0.06} />
      {/* 草坪 */}
      <RoundedBox args={[W * 0.34, 0.16, 3.2]} radius={0.08} smoothness={2} position={[-W / 2 + W * 0.2, -0.56, D / 2 - 2.2]} receiveShadow>
        <meshStandardMaterial color={PAL.grass} roughness={1} />
      </RoundedBox>
      <RoundedBox args={[3.2, 0.16, D * 0.6]} radius={0.08} smoothness={2} position={[W / 2 - 2.0, -0.56, -D / 2 + D * 0.32]} receiveShadow>
        <meshStandardMaterial color={PAL.grass} roughness={1} />
      </RoundedBox>
      <RoundedBox args={[W * 0.4, 0.16, 3.0]} radius={0.08} smoothness={2} position={[-W / 2 + W * 0.22, -0.56, -D / 2 + 1.8]} receiveShadow>
        <meshStandardMaterial color={PAL.grassDark} roughness={1} />
      </RoundedBox>
      <group ref={front}>
      <Tree x={-W / 2 + 2.2} z={D / 2 - 2.2} s={1.15} y={-0.5} />
      <Tree x={-W / 2 + 5.6} z={D / 2 - 2.0} s={0.85} y={-0.5} />
      <Tree x={W / 2 - 2.0} z={-D / 2 + 3.0} s={1.1} y={-0.5} />
      <Tree x={W / 2 - 2.0} z={-D / 2 + 7.0} s={0.9} y={-0.5} />
      <Tree x={-W / 2 + 3.0} z={-D / 2 + 1.8} s={1.0} y={-0.5} />
      <group position={[0, -0.5, 0]}>
        <Lamp x={ex - 3.2} z={d / 2 + 3.4} />
        <Lamp x={ex + 3.4} z={d / 2 + 3.4} />
        <Lamp x={w / 2 + 3.2} z={-1} />
      </group>
      </group>
      {/* 门前人行道 */}
      <mesh position={[ex, -0.545, d / 2 + 2.9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.8, 4.8]} />
        <meshStandardMaterial color="#f3ebdc" roughness={0.95} />
      </mesh>
      <mesh position={[w / 2 + 2.6, -0.545, d / 2 - 3.0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.2, 2.2]} />
        <meshStandardMaterial color="#f3ebdc" roughness={0.95} />
      </mesh>
      {/* 入口：门洞 + 雨棚 */}
      <group ref={door} position={[ex, 0, d / 2]}>
        <Blk p={[0, 2.78, 0.12]} s={[2.4, 0.16, 0.18]} c="#6d6a7e" r={0.04} />
        <mesh position={[0, 1.35, 0.23]}>
          <planeGeometry args={[2.0, 2.4]} />
          <meshStandardMaterial color="#cfe6f2" transparent opacity={0.55} roughness={0.05} emissive="#ffe0b0" emissiveIntensity={0.3 + NIGHT * 0.9} />
        </mesh>
        <Blk p={[0, 3.35, 1.1]} s={[4.6, 0.2, 2.4]} c={accent} r={0.08} shadow />
        <Blk p={[0, 3.55, 1.1]} s={[4.8, 0.12, 2.6]} c={PAL.trim} r={0.05} />
        {[-2.0, 2.0].map((x) => (
          <mesh key={x} position={[x, 1.65, 2.05]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 3.3, 10]} />
            <meshStandardMaterial color={PAL.metal} metalness={0.4} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

export function Dummy({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
