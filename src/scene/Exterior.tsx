import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { Plant } from './Furniture'

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
  plaza: '#d8cfc0',
  plazaLine: '#c9bfae',
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

/**
 * 外立面：只画镜头看得到的两面（前 +z / 右 +x）。玻璃幕墙 + 竖向窗框 + 窗下实体裙板 + 顶梁。
 * show=false 时整体淡出（进入该层时外壳褪去，露出详情房间）；hover 时窗户和顶梁亮起该层的强调色。
 */
export function Facade({ w, d, accent, show, hover, lit }: { w: number; d: number; accent: string; show: boolean; hover: boolean; lit: boolean }) {
  const g = useRef<THREE.Group>(null!)
  const mats = useRef<Map<string, { m: THREE.MeshStandardMaterial; base: number }>>(new Map())
  const o = useRef(1)
  const glow = useRef(0)
  const reg = (base: number) => (m: THREE.MeshStandardMaterial | null) => {
    if (m) mats.current.set(m.uuid, { m, base })
  }
  const glassMats = useRef<THREE.MeshStandardMaterial[]>([])
  const beamMats = useRef<THREE.MeshStandardMaterial[]>([])
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 5)
    o.current += ((show ? 1 : 0) - o.current) * k
    glow.current += ((hover ? 1 : 0) - glow.current) * (1 - Math.exp(-Math.min(dt, 0.05) * 8))
    mats.current.forEach(({ m, base }) => {
      m.transparent = true
      m.opacity = base * o.current
    })
    glassMats.current.forEach((m) => m && (m.emissiveIntensity = glow.current * 0.55 + (lit ? 0.04 : 0)))
    beamMats.current.forEach((m) => m && (m.emissiveIntensity = glow.current * 1.1))
    if (g.current) g.current.visible = o.current > 0.01
  })
  const H = FLOOR_H
  const SP = 0.7 // 裙板高
  const TOP = 0.5 // 顶梁高
  const gh = H - SP - TOP
  const faces: { len: number; along: 'x' | 'z'; at: number }[] = [
    { len: w, along: 'x', at: d / 2 },
    { len: d, along: 'z', at: w / 2 },
  ]
  const accentSoft = lerpCol(accent, '#ffffff', 0.5)
  const band = (len: number, y: number, h: number, c: string, i: number, track?: 'beam') => (
    <mesh key={`b${i}-${y}`} position={[0, y, 0]} castShadow={false} receiveShadow>
      <boxGeometry args={[len + 0.5, h, 0.28]} />
      <meshStandardMaterial ref={(m) => { reg(1)(m); if (track && m) beamMats.current[i] = m }} color={c} roughness={0.85} emissive={accent} emissiveIntensity={0} />
    </mesh>
  )
  return (
    <group ref={g}>
      {faces.map((f, i) => {
        const n = Math.max(2, Math.round(f.len / 1.9))
        const step = f.len / n
        return (
          <group key={i} position={f.along === 'x' ? [0, 0, f.at] : [f.at, 0, 0]} rotation={[0, f.along === 'x' ? 0 : -Math.PI / 2, 0]}>
            {/* 窗下裙板 + 顶梁 */}
            {band(f.len, SP / 2, SP, PAL.concrete, i)}
            {band(f.len, H - TOP / 2, TOP, lerpCol(PAL.trim, accent, 0.12), i, 'beam')}
            {/* 玻璃 */}
            <mesh position={[0, SP + gh / 2, 0]}>
              <boxGeometry args={[f.len, gh, 0.05]} />
              <meshStandardMaterial
                ref={(m) => {
                  reg(0.16)(m)
                  if (m) glassMats.current[i] = m
                }}
                color={PAL.glass}
                roughness={0.06}
                metalness={0.15}
                transparent
                opacity={0.16}
                depthWrite={false}
                emissive={accentSoft}
                emissiveIntensity={0}
                envMapIntensity={0.5}
              />
            </mesh>
            {/* 竖向窗框 + 一道横档 */}
            {Array.from({ length: n + 1 }).map((_, k) => (
              <mesh key={k} position={[-f.len / 2 + k * step, SP + gh / 2, 0]} receiveShadow>
                <boxGeometry args={[0.1, gh, 0.2]} />
                <meshStandardMaterial ref={reg(1)} color={PAL.mullion} roughness={0.6} metalness={0.2} />
              </mesh>
            ))}
            <mesh position={[0, SP + gh * 0.62, 0]}>
              <boxGeometry args={[f.len, 0.07, 0.16]} />
              <meshStandardMaterial ref={reg(1)} color={PAL.mullion} roughness={0.6} metalness={0.2} />
            </mesh>
          </group>
        )
      })}
      {/* 转角立柱 */}
      <mesh position={[w / 2, H / 2, d / 2]} receiveShadow>
        <boxGeometry args={[0.36, H, 0.36]} />
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
    g.font = '700 118px "Helvetica Neue", Arial, sans-serif'
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

/** 屋顶层：楼板 + 檐口 + 女儿墙；顶层有招牌、设备间、空调外机、天线；中间层是露台（花池/长椅/树）。 */
export function RoofDeck({ w, d, accent, top, next }: { w: number; d: number; accent: string; top: boolean; next?: { w: number; d: number } }) {
  const T = ROOF_T
  const dw = w + 1.1
  const dd = d + 1.1
  const beacon = useRef<THREE.MeshStandardMaterial>(null!)
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 3) * 0.9
  })
  // 露台（下一层是更小的楼层时，右侧和前侧会露出一块屋面）
  const nx = next ? -w / 2 + next.w : w / 2
  const nz = next ? -d / 2 + next.d : d / 2
  const rightFree = next ? w / 2 - nx : 0
  const frontFree = next ? d / 2 - nz : 0
  const BW = 1.0
  const bk = top ? 4.0 : BW
  const innerD = dd - BW - bk
  const skyZ = (dd / 2 - BW) - innerD / 2 + 0
  const bands = [
    { x: 0, z: dd / 2 - BW / 2, w: dw, d: BW },
    { x: 0, z: -dd / 2 + bk / 2, w: dw, d: bk },
    { x: -dw / 2 + BW / 2, z: (dd / 2 - BW - innerD / 2) , w: BW, d: innerD },
    { x: dw / 2 - BW / 2, z: (dd / 2 - BW - innerD / 2), w: BW, d: innerD },
  ]
  return (
    <group>
      {/* 楼板：只做一圈边框（+ 屋顶设备带），中间是天窗，让镜头从上方看进室内（剖切 / 娃娃屋） */}
      {bands.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]}>
          <Blk p={[0, T / 2 - 0.05, 0]} s={[b.w, T - 0.1, b.d]} c={PAL.concrete} r={0.04} />
          <Blk p={[0, 0.0, 0]} s={[b.w - 0.1, 0.1, b.d - 0.1]} c={PAL.concreteDark} r={0.02} />
          <mesh position={[0, T + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[b.w - 0.02, b.d - 0.02]} />
            <meshStandardMaterial color={top ? '#d9d2c6' : '#e2dccf'} roughness={0.95} />
          </mesh>
        </group>
      ))}
      {/* 檐口：整圈细线，用楼层强调色点一下 */}
      <Blk p={[0, T - 0.07, dd / 2 + 0.04]} s={[dw + 0.18, 0.14, 0.2]} c={lerpCol(PAL.trim, accent, 0.5)} r={0.05} />
      <Blk p={[dw / 2 + 0.04, T - 0.07, 0]} s={[0.2, 0.14, dd + 0.18]} c={lerpCol(PAL.trim, accent, 0.5)} r={0.05} />
      <Blk p={[0, T - 0.07, -dd / 2 - 0.04]} s={[dw + 0.18, 0.14, 0.2]} c={lerpCol(PAL.trim, accent, 0.5)} r={0.05} />
      <Blk p={[-dw / 2 - 0.04, T - 0.07, 0]} s={[0.2, 0.14, dd + 0.18]} c={lerpCol(PAL.trim, accent, 0.5)} r={0.05} />
      {/* 天窗玻璃 */}
      <mesh position={[0, T * 0.6, skyZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[dw - 2 * BW, dd - BW - bk]} />
        <meshStandardMaterial color="#cfe3ee" transparent opacity={0.1} roughness={0.1} depthWrite={false} side={THREE.DoubleSide} envMapIntensity={0.3} />
      </mesh>
      {/* 女儿墙：整圈 */}
      {[
        { p: [0, T + 0.2, dd / 2 - 0.08] as [number, number, number], s: [dw, 0.4, 0.16] as [number, number, number] },
        { p: [dw / 2 - 0.08, T + 0.2, 0] as [number, number, number], s: [0.16, 0.4, dd] as [number, number, number] },
        { p: [0, T + 0.2, -dd / 2 + 0.08] as [number, number, number], s: [dw, 0.4, 0.16] as [number, number, number] },
        { p: [-dw / 2 + 0.08, T + 0.2, 0] as [number, number, number], s: [0.16, 0.4, dd] as [number, number, number] },
      ].map((b, i) => (
        <Blk key={i} p={b.p} s={b.s} c={PAL.trim} r={0.04} />
      ))}
      {top ? (
        <group position={[0, T, 0]}>
          {/* 设备间（楼梯间） */}
          <Blk p={[-w / 2 + 2.2, 0.9, -d / 2 + 1.9]} s={[3.6, 1.8, 2.6]} c={PAL.concrete} r={0.08} shadow />
          <Blk p={[-w / 2 + 2.2, 1.86, -d / 2 + 1.9]} s={[3.9, 0.14, 2.9]} c={PAL.trim} r={0.05} />
          <Blk p={[-w / 2 + 3.2, 0.75, -d / 2 + 3.22]} s={[0.9, 1.5, 0.08]} c={accent} r={0.03} />
          {/* 空调外机 */}
          <ACUnit x={w / 2 - 2.0} z={-d / 2 + 1.5} />
          <ACUnit x={w / 2 - 3.8} z={-d / 2 + 1.5} />
          <ACUnit x={w / 2 - 2.0} z={-d / 2 + 3.0} />
          {/* 水箱 */}
          <mesh position={[-w / 2 + 6.4, 0.8, -d / 2 + 1.5]} castShadow>
            <cylinderGeometry args={[0.7, 0.7, 1.6, 20]} />
            <meshStandardMaterial color="#d8dde1" roughness={0.6} metalness={0.2} />
          </mesh>
          {/* 天线 + 航空灯 */}
          <mesh position={[w / 2 - 1.0, 1.7, -d / 2 + 3.0]} castShadow>
            <cylinderGeometry args={[0.05, 0.08, 3.4, 8]} />
            <meshStandardMaterial color={PAL.metal} metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[w / 2 - 1.0, 3.5, -d / 2 + 3.0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial ref={beacon} color="#ff6b5e" emissive="#ff4a3d" emissiveIntensity={1.5} />
          </mesh>
          {/* 招牌：立在屋顶后沿，朝向镜头 */}
          <group position={[w / 2 - 6.0, 2.4, -d / 2 + 0.2]} rotation={[0, Math.PI / 4, 0]} scale={1.0}>
            <Sign />
          </group>
        </group>
      ) : (
        <group position={[0, T, 0]}>
          {rightFree > 3 && (
            <>
              {[-d / 2 + 2.2, -d / 2 + 6.0, d / 2 - 1.8].map((z, i) => (
                <group key={i} position={[w / 2 + 0.05, 0, z]}>
                  <Blk p={[0, 0.25, 0]} s={[1.0, 0.5, 2.0]} c="#e7ddcc" r={0.1} shadow />
                  <group position={[0, 0.5, 0]}>
                    <Plant x={0} z={-0.5} s={0.65} c={i % 2 ? '#3f9d5d' : '#5aab6e'} />
                    <Plant x={0} z={0.5} s={0.55} />
                  </group>
                </group>
              ))}
            </>
          )}
        </group>
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
        <meshStandardMaterial color="#fff2d6" emissive="#ffd9a0" emissiveIntensity={1.6} />
      </mesh>
    </group>
  )
}

/** 地面：基座台阶 + 广场铺装 + 草坪 + 树 + 路灯 + 入口雨棚 + 门前人行道。随最底层一起移动。 */
export function Ground({ w, d, accent }: { w: number; d: number; accent: string }) {
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
      <group position={[ex, 0, d / 2]}>
        <Blk p={[0, 1.35, 0.12]} s={[2.4, 2.7, 0.18]} c="#6d6a7e" r={0.05} />
        <mesh position={[0, 1.35, 0.23]}>
          <planeGeometry args={[2.0, 2.4]} />
          <meshStandardMaterial color="#cfe6f2" transparent opacity={0.55} roughness={0.05} emissive="#ffe9c6" emissiveIntensity={0.25} />
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
