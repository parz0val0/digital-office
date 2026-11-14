import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STATUS_META } from '../meta'
import type { AgentStatus, BuildingMember, BuildingRoamer } from '../types'
import { Accessory, ACCESSORY, FALLBACK_ACC, lerpColor, Mat } from './Character'
import { Chair, Desk, Laptop, MeetingTable, Plant, Room, Sofa } from './Furniture'
import { Facade, FLOOR_H } from './Exterior'
import { assignDesks, DESK_YAW, makeLayout } from './layout'
import type { Theme } from './themes'
import { NIGHT } from './tod'


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
      p.position.y = 3.98 + (off ? 0 : Math.sin(t * 2) * 0.05)
    }
    if (!off) g.children[0].position.y = Math.max(0, Math.sin(t * (status === 'working' ? 6 : 2.2))) * 0.03
  })
  return (
    <group ref={root} rotation={[0, yaw, 0]}>
      <group scale={1.7}>
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
      <group ref={pin} position={[0, 3.98, 0]}>
        <mesh>
          <sphereGeometry args={[0.42, 16, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.33, 16, 12]} />
          <meshBasicMaterial color={meta.color} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** 空工位：桌 + 空椅 + 熄屏笔记本 */
export function EmptyDesk({ x, z }: { x: number; z: number }) {
  return (
    <group>
      <Desk x={x} z={z} />
      <Chair x={x + 0.1} z={z - 0.95} yaw={DESK_YAW + 0.5} c="#d8cdbb" />
      <Laptop x={x - 0.1} z={z + 0.05} glow="#9aa0a8" on={false} />
    </group>
  )
}

export interface MiniFloorProps {
  plateN?: number // 统一楼板：所有楼层按同一人数规格生成同样大的平面

  theme: Theme
  members: BuildingMember[]
  roamers: BuildingRoamer[]
  facade: boolean // 外壳（玻璃幕墙）是否显示；进入该层时淡出
  hover: boolean
  onOver?: () => void
  onOut?: () => void
  onClick?: () => void
}

/** 大楼视图里的一层：地板托盘 + 低矮墙/玻璃护栏 + 桌椅 + 小 bot。不含任何 feed 数据，只用 building.json 里的 members */
export function MiniFloor({ plateN = 0, theme, members, roamers, facade, hover, onOver, onOut, onClick }: MiniFloorProps) {
  const n = Math.max(members.length, 2, plateN)
  const layout = useMemo(() => makeLayout(n), [n])
  const room = useMemo(() => ({ ...layout.room, wallH: FLOOR_H - 0.4 }), [layout])
  const desks = useMemo(() => assignDesks(members.map((m, i) => ({ id: m.id, desk: m.desk ?? i }))), [members.map((m) => m.id + m.desk).join()])
  const { w, d } = room
  return (
    <group
      onPointerOver={onOver ? (e) => (e.stopPropagation(), onOver()) : undefined}
      onPointerOut={onOut ? (e) => (e.stopPropagation(), onOut()) : undefined}
      onClick={onClick ? (e) => (e.stopPropagation(), onClick()) : undefined}
    >
      <Room room={room} theme={theme} noBase />
      <Facade w={w} d={d} accent={theme.accent} show={facade} hover={hover} lit={members.length > 0} seed={members.length} />

      <Plant x={-w / 2 + 0.9} z={-d / 2 + 0.8} s={0.9} />
      <Plant x={w / 2 - 0.8} z={layout.aisleZ + 0.9} s={0.95} c="#3f9d5d" />
      <Sofa x={-w / 2 + 1.0} z={d / 2 - 1.3} rotY={Math.PI / 2} />
      <MeetingTable table={layout.table} theme={theme} />
      {Array.from({ length: layout.sps * 2 }).map((_, i) => {
        const s = layout.seatPos(i)
        return <Chair key={i} x={s.x} z={s.z} yaw={s.yaw} c={theme.chair} />
      })}
      {Array.from({ length: Math.max(0, layout.n - members.length) }).map((_, k) => {
        const p = layout.deskPos(members.length + k)
        return <EmptyDesk key={`e${k}`} x={p.x} z={p.z} />
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
