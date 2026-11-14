import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STATUS_META } from '../meta'
import type { AgentStatus, BuildingFloorSummary, BuildingMember, BuildingRoamer } from '../types'
import { Accessory, ACCESSORY, FALLBACK_ACC, lerpColor, Mat } from './Character'
import { Box, Chair, Desk, Laptop, MeetingTable, Plant, Room, Sofa } from './Furniture'
import { assignDesks, DESK_YAW, makeLayout } from './layout'
import type { Theme } from './themes'

const MINI_WALL = 1.5

/** 总览里的小 bot：胖胖的圆角小人 + 头顶状态色圆点（颜色 = 状态） */
function MiniBot({ id, color, status, index, x, z, yaw, lift = 0 }: { id: string; color: string; status: AgentStatus; index: number; x: number; z: number; yaw: number; lift?: number }) {
  const off = status === 'offline'
  const base = off ? lerpColor(color, '#9aa0a6', 0.8) : color
  const head = lerpColor(base, '#ffffff', 0.18)
  const limb = lerpColor(base, '#000000', 0.18)
  const accent = lerpColor(base, '#ffffff', 0.4)
  const acc = ACCESSORY[id] ?? FALLBACK_ACC[index % FALLBACK_ACC.length]
  const root = useRef<THREE.Group>(null!)
  const pin = useRef<THREE.Group>(null!)
  const target = useMemo(() => new THREE.Vector3(x, lift, z), [x, z, lift])
  const first = useRef(true)
  const meta = STATUS_META[status]
  useFrame(({ clock }, dt) => {
    const g = root.current
    if (!g) return
    if (first.current) {
      g.position.copy(target)
      first.current = false
    } else g.position.lerp(target, 1 - Math.exp(-dt * 4))
    const t = clock.elapsedTime + index * 1.3
    const p = pin.current
    if (p) {
      const pulse = status === 'waiting' || status === 'error' ? 1 + Math.sin(t * 5) * 0.22 : 1
      p.scale.setScalar(pulse)
      p.position.y = 2.95 + (off ? 0 : Math.sin(t * 2) * 0.05)
    }
    if (!off) g.children[0].position.y = Math.max(0, Math.sin(t * (status === 'working' ? 6 : 2.2))) * 0.03
  })
  return (
    <group ref={root} rotation={[0, yaw, 0]}>
      <group scale={1.18}>
        {[-0.17, 0.17].map((sx) => (
          <mesh key={sx} position={[sx, 0.2, 0.02]} castShadow>
            <capsuleGeometry args={[0.1, 0.18, 4, 8]} />
            <Mat c={limb} />
          </mesh>
        ))}
        <mesh position={[0, 0.72, 0]} castShadow>
          <capsuleGeometry args={[0.34, 0.34, 6, 14]} />
          <Mat c={base} />
        </mesh>
        <mesh position={[0, 0.72, 0]} scale={1.04}>
          <capsuleGeometry args={[0.34, 0.34, 6, 14]} />
          <meshBasicMaterial color="#2b2438" side={THREE.BackSide} />
        </mesh>
        <mesh position={[0, 0.66, 0.285]} scale={[1, 1.15, 0.35]}>
          <sphereGeometry args={[0.2, 12, 10]} />
          <Mat c={lerpColor(base, '#ffffff', 0.72)} />
        </mesh>
        <group position={[0, 1.38, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.46, 22, 16]} />
            <Mat c={head} />
          </mesh>
          <mesh scale={1.04}>
            <sphereGeometry args={[0.46, 22, 16]} />
            <meshBasicMaterial color="#2b2438" side={THREE.BackSide} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.17, 0.02, 0.4]} scale={[1, 1.25, 0.5]}>
              <sphereGeometry args={[0.075, 10, 8]} />
              <meshBasicMaterial color="#2b2438" />
            </mesh>
          ))}
          <Accessory kind={acc} color={base} accent={accent} />
        </group>
      </group>
      {/* 状态圆点：发光小球 + 白色描边 */}
      <group ref={pin} position={[0, 2.95, 0]}>
        <mesh>
          <sphereGeometry args={[0.27, 16, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.2, 16, 12]} />
          <meshBasicMaterial color={meta.color} />
        </mesh>
      </group>
    </group>
  )
}

export interface MiniFloorProps {
  label: string
  name: string
  theme: Theme
  members: BuildingMember[]
  roamers: BuildingRoamer[]
  info?: BuildingFloorSummary
  showLabel: boolean
  hover: boolean
  onOver?: () => void
  onOut?: () => void
  onClick?: () => void
}

/** 大楼视图里的一层：地板托盘 + 低矮墙/玻璃护栏 + 桌椅 + 小 bot。不含任何 feed 数据，只用 building.json 里的 members */
export function MiniFloor({ label, name, theme, members, roamers, info, showLabel, hover, onOver, onOut, onClick }: MiniFloorProps) {
  const n = Math.max(members.length, 2)
  const layout = useMemo(() => makeLayout(n), [n])
  const room = useMemo(() => ({ ...layout.room, wallH: MINI_WALL }), [layout])
  const desks = useMemo(() => assignDesks(members.map((m, i) => ({ id: m.id, desk: m.desk ?? i }))), [members.map((m) => m.id + m.desk).join()])
  const { w, d } = room
  const pct = Math.round(info?.completion ?? 0)
  const rim = useRef<THREE.Mesh>(null!)
  useFrame(({ clock }) => {
    if (rim.current) (rim.current.material as THREE.MeshBasicMaterial).opacity = hover ? 0.75 + Math.sin(clock.elapsedTime * 5) * 0.2 : 0
  })

  return (
    <group
      onPointerOver={onOver ? (e) => (e.stopPropagation(), onOver()) : undefined}
      onPointerOut={onOut ? (e) => (e.stopPropagation(), onOut()) : undefined}
      onClick={onClick ? (e) => (e.stopPropagation(), onClick()) : undefined}
    >
      {/* 悬停高亮光边 */}
      <mesh ref={rim} position={[0, -0.9, 0]}>
        <boxGeometry args={[w + 2.0, 0.5, d + 2.0]} />
        <meshBasicMaterial color={theme.accent} transparent opacity={0} depthWrite={false} />
      </mesh>
      <Room room={room} theme={theme} />
      {/* 前、右两侧：玻璃护栏 */}
      {[
        { p: [0, 0.3, d / 2 + 0.02] as [number, number, number], s: [w + 0.2, 0.6, 0.06] as [number, number, number] },
        { p: [w / 2 + 0.02, 0.3, 0] as [number, number, number], s: [0.06, 0.6, d] as [number, number, number] },
      ].map((g, i) => (
        <mesh key={i} position={g.p}>
          <boxGeometry args={g.s} />
          <meshStandardMaterial color="#d6efff" transparent opacity={0.28} roughness={0.1} depthWrite={false} />
        </mesh>
      ))}
      <Box p={[0, 0.62, d / 2 + 0.02]} s={[w + 0.2, 0.06, 0.1]} c={theme.accent} r={0.02} shadow={false} />
      <Box p={[w / 2 + 0.02, 0.62, 0]} s={[0.1, 0.06, d]} c={theme.accent} r={0.02} shadow={false} />

      <Plant x={-w / 2 + 0.9} z={-d / 2 + 0.8} s={0.9} />
      <Plant x={w / 2 - 0.8} z={layout.aisleZ + 0.9} s={0.95} c="#3f9d5d" />
      <Sofa x={-w / 2 + 1.0} z={d / 2 - 1.3} rotY={Math.PI / 2} />
      <MeetingTable table={layout.table} theme={theme} />
      {Array.from({ length: layout.sps * 2 }).map((_, i) => {
        const s = layout.seatPos(i)
        return <Chair key={i} x={s.x} z={s.z} yaw={s.yaw} c={theme.chair} />
      })}
      {members.map((m, i) => {
        const slot = desks[m.id]
        const p = layout.deskPos(slot)
        const on = m.status !== 'offline'
        const collab = m.status === 'collaborating'
        const seat = layout.seatPos(slot)
        return (
          <group key={m.id}>
            <Desk x={p.x} z={p.z} />
            <Chair x={p.x} z={p.z - 0.8} yaw={DESK_YAW} c={m.color} />
            <Laptop x={p.x - 0.1} z={p.z + 0.05} glow={STATUS_META[m.status].color} on={on} />
            <MiniBot id={m.id} color={m.color} status={m.status} index={i} x={collab ? seat.x : p.x} z={collab ? seat.z : p.z - 0.8} yaw={collab ? seat.yaw : DESK_YAW} lift={0.26} />
          </group>
        )
      })}
      {roamers.map((r, i) => (
        <MiniBot key={r.id} id={r.id} color={r.color} status={r.status} index={members.length + i} x={-1.4} z={-d / 2 + 1.0} yaw={Math.PI * 0.12} />
      ))}

    </group>
  )
}
