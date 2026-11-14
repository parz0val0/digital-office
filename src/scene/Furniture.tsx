import { RoundedBox } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { ROOM, TABLE } from './layout'

type V3 = [number, number, number]

export function Box({
  p,
  s,
  c,
  r = 0.04,
  rot,
  shadow = true,
  emissive,
}: {
  p: V3
  s: V3
  c: string
  r?: number
  rot?: V3
  shadow?: boolean
  emissive?: string
}) {
  return (
    <RoundedBox args={s} radius={Math.min(r, Math.min(...s) / 2 - 0.001)} smoothness={3} position={p} rotation={rot} castShadow={shadow} receiveShadow>
      <meshStandardMaterial color={c} roughness={0.8} emissive={emissive ?? '#000'} emissiveIntensity={emissive ? 0.6 : 0} />
    </RoundedBox>
  )
}

export function Cyl({ p, r, h, c, rt, seg = 24, shadow = true }: { p: V3; r: number; h: number; c: string; rt?: number; seg?: number; shadow?: boolean }) {
  return (
    <mesh position={p} castShadow={shadow} receiveShadow>
      <cylinderGeometry args={[rt ?? r, r, h, seg]} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  )
}

export function Ball({ p, r, c, e, sc }: { p: V3; r: number; c: string; e?: boolean; sc?: V3 }) {
  return (
    <mesh position={p} scale={sc} castShadow receiveShadow>
      <sphereGeometry args={[r, 20, 16]} />
      <meshStandardMaterial color={c} roughness={0.8} emissive={e ? c : '#000'} emissiveIntensity={e ? 0.7 : 0} />
    </mesh>
  )
}

function plankTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')!
  const cols = ['#e2b57c', '#d9a96d', '#e8c08a', '#d4a063']
  const pw = 512 / 4
  for (let row = 0; row < 8; row++) {
    const y = row * 64
    let x = -(row % 2) * 64
    let i = row
    while (x < 512) {
      g.fillStyle = cols[(i++ * 7 + row) % cols.length]
      g.fillRect(x, y, pw, 64)
      g.strokeStyle = 'rgba(120,70,30,0.35)'
      g.lineWidth = 2
      g.strokeRect(x, y, pw, 64)
      x += pw
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(ROOM.w / 5, ROOM.d / 5)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export function Room() {
  const tex = useMemo(plankTexture, [])
  const { w, d, wallH } = ROOM
  return (
    <group>
      {/* 底座 */}
      <mesh position={[0, -0.55, 0]} receiveShadow>
        <boxGeometry args={[w + 1.2, 0.6, d + 1.2]} />
        <meshStandardMaterial color="#8b6a4f" roughness={0.9} />
      </mesh>
      {/* 地板 */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={tex} roughness={0.85} />
      </mesh>
      {/* 后墙 / 左墙 */}
      <Box p={[0, wallH / 2, -d / 2 - 0.15]} s={[w + 0.6, wallH, 0.3]} c="#fbe3c6" r={0.02} />
      <Box p={[-w / 2 - 0.15, wallH / 2, 0]} s={[0.3, wallH, d + 0.0]} c="#d6ebe3" r={0.02} />
      {/* 踢脚线 */}
      <Box p={[0, 0.12, -d / 2 + 0.05]} s={[w, 0.24, 0.1]} c="#fff6e8" r={0.02} />
      <Box p={[-w / 2 + 0.05, 0.12, 0]} s={[0.1, 0.24, d]} c="#fff6e8" r={0.02} />
      {/* 墙顶装饰条 */}
      <Box p={[0, wallH + 0.04, -d / 2 - 0.15]} s={[w + 0.6, 0.12, 0.4]} c="#f2c48d" r={0.03} />
      <Box p={[-w / 2 - 0.15, wallH + 0.04, 0]} s={[0.4, 0.12, d + 0.0]} c="#a9d0c3" r={0.03} />
    </group>
  )
}

export function Desk({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box p={[0, 0.76, 0]} s={[2.2, 0.1, 1.05]} c="#f7e4c5" />
      <Box p={[0, 0.72, 0.52]} s={[2.2, 0.02, 0.04]} c="#e0b87e" r={0.01} shadow={false} />
      {/* 桌腿/抽屉柜 */}
      <Box p={[-0.95, 0.36, 0]} s={[0.12, 0.72, 0.9]} c="#e6c08a" />
      <Box p={[0.78, 0.36, 0.0]} s={[0.5, 0.72, 0.9]} c="#e6c08a" />
      <Box p={[0.78, 0.5, 0.46]} s={[0.4, 0.2, 0.02]} c="#d4a063" r={0.01} shadow={false} />
      <Box p={[0.78, 0.2, 0.46]} s={[0.4, 0.2, 0.02]} c="#d4a063" r={0.01} shadow={false} />
    </group>
  )
}

export function Laptop({ x, z, glow, on }: { x: number; z: number; glow: string; on: boolean }) {
  // 屏幕朝向 -z（朝向角色），镜头看到的是背面
  return (
    <group position={[x, 0.81, z]}>
      <Box p={[0, 0.015, 0.0]} s={[0.78, 0.03, 0.52]} c="#d0d4da" r={0.015} />
      <Box p={[0, 0.0, 0.0]} s={[0.4, 0.02, 0.2]} c="#b6bcc4" r={0.01} shadow={false} />
      <group position={[0, 0.03, 0.24]} rotation={[0.3, 0, 0]}>
        <Box p={[0, 0.27, 0]} s={[0.78, 0.54, 0.035]} c="#e3e6ea" r={0.02} />
        <mesh position={[0, 0.27, 0.02]}>
          <circleGeometry args={[0.07, 20]} />
          <meshStandardMaterial color={on ? glow : '#9aa0a8'} emissive={on ? glow : '#000'} emissiveIntensity={on ? 1.2 : 0} />
        </mesh>
      </group>
    </group>
  )
}

export function DeskLamp({ x, z, color, on }: { x: number; z: number; color: string; on: boolean }) {
  return (
    <group position={[x, 0.81, z]}>
      <Cyl p={[0, 0.02, 0]} r={0.12} h={0.04} c="#555b66" />
      <Cyl p={[0, 0.22, 0]} r={0.025} h={0.4} c="#6b7280" />
      <mesh position={[0, 0.48, 0]} castShadow>
        <sphereGeometry args={[0.13, 16, 12]} />
        <meshStandardMaterial color={on ? color : '#8d939c'} emissive={on ? color : '#000'} emissiveIntensity={on ? 1.4 : 0} roughness={0.5} />
      </mesh>
    </group>
  )
}

export function Mug({ x, z, c = '#ff7a7a' }: { x: number; z: number; c?: string }) {
  return (
    <group position={[x, 0.86, z]}>
      <Cyl p={[0, 0.05, 0]} r={0.07} h={0.12} c={c} seg={16} />
      <mesh position={[0.08, 0.05, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.04, 0.012, 8, 12]} />
        <meshStandardMaterial color={c} />
      </mesh>
    </group>
  )
}

export function Chair({ x, z, yaw = 0, c = '#6c7a89' }: { x: number; z: number; yaw?: number; c?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <Cyl p={[0, 0.06, 0]} r={0.3} h={0.04} c="#3d444d" seg={5} />
      <Cyl p={[0, 0.25, 0]} r={0.04} h={0.4} c="#4a525c" />
      <Box p={[0, 0.48, 0]} s={[0.62, 0.12, 0.6]} c={c} r={0.05} />
      <Box p={[0, 0.86, -0.28]} s={[0.58, 0.55, 0.1]} c={c} r={0.05} />
    </group>
  )
}

export function MeetingTable() {
  const { x, z, w, d } = TABLE
  return (
    <group position={[x, 0, z]}>
      {/* 地毯 */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w + 3, d + 3.0]} />
        <meshStandardMaterial color="#9ec9d9" roughness={1} />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w + 2.4, d + 2.4]} />
        <meshStandardMaterial color="#c8e3ec" roughness={1} />
      </mesh>
      {/* 桌面 */}
      <Box p={[0, 0.82, 0]} s={[w, 0.12, d]} c="#fff1d6" r={0.1} />
      <Box p={[0, 0.74, 0]} s={[w - 0.3, 0.06, d - 0.3]} c="#e9c48f" r={0.05} shadow={false} />
      <Box p={[-w / 2 + 1.0, 0.4, 0]} s={[0.4, 0.8, d - 0.6]} c="#e1b87e" />
      <Box p={[w / 2 - 1.0, 0.4, 0]} s={[0.4, 0.8, d - 0.6]} c="#e1b87e" />
      {/* 桌上小物 */}
      <Cyl p={[0, 0.95, 0]} r={0.16} h={0.14} c="#ffd166" />
      <Ball p={[0, 1.12, 0]} r={0.16} c="#ff8fab" />
      <Box p={[-1.6, 0.9, 0.2]} s={[0.5, 0.03, 0.36]} c="#ffffff" r={0.01} rot={[0, 0.3, 0]} />
      <Box p={[1.4, 0.9, -0.2]} s={[0.5, 0.03, 0.36]} c="#ffffff" r={0.01} rot={[0, -0.2, 0]} />
      <Mug x={2.0} z={0.3} c="#7bd389" />
      <Mug x={-2.4} z={-0.3} c="#ffb454" />
    </group>
  )
}

export function Plant({ x, z, s = 1, c = '#4caf6a' }: { x: number; z: number; s?: number; c?: string }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <Cyl p={[0, 0.25, 0]} r={0.28} rt={0.34} h={0.5} c="#d98c5f" />
      <Cyl p={[0, 0.5, 0]} r={0.3} h={0.04} c="#6b4a35" />
      <Ball p={[0, 0.95, 0]} r={0.42} c={c} sc={[1, 1.15, 1]} />
      <Ball p={[0.28, 0.75, 0.1]} r={0.28} c="#5fc17f" />
      <Ball p={[-0.25, 0.8, -0.1]} r={0.3} c="#3f9d5d" />
    </group>
  )
}

export function Bookshelf({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  const books = useMemo(() => {
    const cols = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#b197fc', '#ffa94d', '#63e6be', '#f783ac']
    const out: { x: number; y: number; w: number; h: number; c: string }[] = []
    for (let r = 0; r < 4; r++) {
      let cx = -1.15
      let k = r * 3
      while (cx < 1.05) {
        const w = 0.12 + ((k * 37) % 7) * 0.02
        const h = 0.4 + ((k * 53) % 5) * 0.04
        out.push({ x: cx + w / 2, y: 0.28 + r * 0.72 + h / 2 - 0.1, w, h, c: cols[(k * 5 + r) % cols.length] })
        cx += w + 0.02
        k++
        if (((k * 11) % 9) === 0) cx += 0.25
      }
    }
    return out
  }, [])
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Box p={[0, 1.6, 0]} s={[2.6, 3.2, 0.1]} c="#b98655" />
      <Box p={[-1.3, 1.6, 0.25]} s={[0.1, 3.2, 0.6]} c="#c99562" />
      <Box p={[1.3, 1.6, 0.25]} s={[0.1, 3.2, 0.6]} c="#c99562" />
      {[0.05, 0.77, 1.49, 2.21, 3.15].map((y, i) => (
        <Box key={i} p={[0, y, 0.25]} s={[2.6, 0.1, 0.6]} c="#c99562" />
      ))}
      {books.map((b, i) => (
        <Box key={i} p={[b.x, b.y + 0.05, 0.3]} s={[b.w, b.h, 0.34]} c={b.c} r={0.015} shadow={false} />
      ))}
    </group>
  )
}

export function Sofa({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Box p={[0, 0.3, 0]} s={[2.6, 0.5, 1.1]} c="#ff9d76" r={0.12} />
      <Box p={[0, 0.78, -0.45]} s={[2.6, 0.8, 0.25]} c="#ff8a5c" r={0.1} />
      <Box p={[-1.2, 0.6, 0]} s={[0.25, 0.6, 1.1]} c="#ff8a5c" r={0.1} />
      <Box p={[1.2, 0.6, 0]} s={[0.25, 0.6, 1.1]} c="#ff8a5c" r={0.1} />
      <Box p={[-0.5, 0.62, 0.05]} s={[0.7, 0.14, 0.8]} c="#ffb59a" r={0.06} />
      <Box p={[0.5, 0.62, 0.05]} s={[0.7, 0.14, 0.8]} c="#ffb59a" r={0.06} />
      <Box p={[-0.9, 0.85, -0.1]} s={[0.4, 0.4, 0.14]} c="#ffe066" r={0.06} rot={[-0.3, 0.3, 0.2]} />
    </group>
  )
}

export function CoffeeStation({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box p={[0, 0.45, 0]} s={[1.6, 0.9, 0.7]} c="#f1d9b5" />
      <Box p={[0, 0.93, 0]} s={[1.7, 0.06, 0.78]} c="#c99562" r={0.02} />
      <Box p={[-0.35, 1.28, 0]} s={[0.55, 0.64, 0.45]} c="#e5484d" r={0.07} />
      <Box p={[-0.35, 1.5, 0.23]} s={[0.4, 0.16, 0.02]} c="#2b2f36" r={0.01} shadow={false} />
      <Mug x={0.2} z={0.1} c="#ffffff" />
      <Mug x={0.5} z={-0.05} c="#74c0fc" />
    </group>
  )
}

export function WallClock({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.5, 0.1, 32]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.01]}>
        <torusGeometry args={[0.5, 0.05, 12, 32]} />
        <meshStandardMaterial color="#e8590c" />
      </mesh>
      <Box p={[0, 0.12, 0.06]} s={[0.04, 0.26, 0.02]} c="#333" shadow={false} />
      <Box p={[0.1, 0, 0.06]} s={[0.2, 0.04, 0.02]} c="#333" shadow={false} />
    </group>
  )
}

export function WindowFrame({ x, z, w = 2.4, h = 1.8, y = 2.3 }: { x: number; z: number; w?: number; h?: number; y?: number }) {
  // 开在左墙（朝 +x）
  return (
    <group position={[x, y, z]}>
      <Box p={[0.02, 0, 0]} s={[0.1, h + 0.2, w + 0.2]} c="#ffffff" r={0.03} />
      <mesh position={[0.09, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#bfe6ff" emissive="#9fd8ff" emissiveIntensity={0.9} />
      </mesh>
      <Box p={[0.1, 0, 0]} s={[0.05, h, 0.06]} c="#ffffff" r={0.01} shadow={false} />
      <Box p={[0.1, 0, 0]} s={[0.05, 0.06, w]} c="#ffffff" r={0.01} shadow={false} />
    </group>
  )
}

export function Poster({ x, y, z, c1, c2, rotY = 0 }: { x: number; y: number; z: number; c1: string; c2: string; rotY?: number }) {
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      <Box p={[0, 0, 0]} s={[1.1, 1.5, 0.06]} c="#ffffff" r={0.02} />
      <Box p={[0, 0.2, 0.04]} s={[0.85, 0.7, 0.02]} c={c1} r={0.01} shadow={false} />
      <Box p={[0, -0.45, 0.04]} s={[0.6, 0.15, 0.02]} c={c2} r={0.01} shadow={false} />
    </group>
  )
}
