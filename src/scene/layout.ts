import * as THREE from 'three'

export const ROOM = { w: 20, d: 14, wallH: 4.2 } // x ∈ [-10,10], z ∈ [-7,7]
export const ROW1_Z = -4.6
export const ROW2_Z = -0.9
export const TABLE = { x: 0, z: 4.2, w: 9, d: 2.2 }
export const SEAT_YAW = 0.5 // 略微转向镜头，让脸更容易被看到
export const DESK_YAW = SEAT_YAW
export const MAX_DESKS = 12

export function deskPos(slot: number): { x: number; z: number } {
  const s = ((slot % MAX_DESKS) + MAX_DESKS) % MAX_DESKS
  if (s < 5) return { x: -7.5 + 3 * s, z: ROW1_Z }
  if (s < 11) return { x: -7.5 + 3 * (s - 5), z: ROW2_Z }
  return { x: 7.5, z: ROW1_Z }
}

/** 给每个 agent 分配不冲突的工位 */
export function assignDesks(agents: { id: string; desk: number }[]): Record<string, number> {
  const used = new Set<number>()
  const out: Record<string, number> = {}
  const rest: string[] = []
  for (const a of agents) {
    const s = ((a.desk % MAX_DESKS) + MAX_DESKS) % MAX_DESKS
    if (!used.has(s)) {
      used.add(s)
      out[a.id] = s
    } else rest.push(a.id)
  }
  for (const id of rest) {
    let s = 0
    while (used.has(s) && s < MAX_DESKS) s++
    used.add(s)
    out[id] = s % MAX_DESKS
  }
  return out
}

export function seatPos(seat: number): { x: number; z: number; yaw: number } {
  const s = ((seat % 12) + 12) % 12
  if (s < 6) return { x: -3.5 + 1.4 * s, z: TABLE.z - 1.8, yaw: SEAT_YAW }
  return { x: -3.5 + 1.4 * (s - 6), z: TABLE.z + 1.8, yaw: Math.PI - 0.3 }
}

export const DESK_SEAT_DZ = -0.8

export class Route {
  pts: THREE.Vector3[]
  cum: number[]
  length: number
  constructor(pts: THREE.Vector3[]) {
    this.pts = pts
    this.cum = [0]
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
    this.length = this.cum[this.cum.length - 1]
  }
  at(t: number, out: THREE.Vector3, dir: THREE.Vector3) {
    t = Math.max(0, Math.min(this.length, t))
    let i = 1
    while (i < this.pts.length - 1 && this.cum[i] < t) i++
    const a = this.pts[i - 1]
    const b = this.pts[i]
    const seg = this.cum[i] - this.cum[i - 1] || 1
    const k = (t - this.cum[i - 1]) / seg
    out.lerpVectors(a, b, k)
    dir.subVectors(b, a).normalize()
  }
}

/** 从工位走到会议桌座位的折线路径（穿过工位之间的过道） */
export function buildRoute(deskSlot: number, seat: number): { route: Route; deskYaw: number; seatYaw: number } {
  const d = deskPos(deskSlot)
  const s = seatPos(seat)
  const gx = d.x + 1.5
  const p: THREE.Vector3[] = [
    new THREE.Vector3(d.x, 0, d.z + DESK_SEAT_DZ),
    new THREE.Vector3(gx, 0, d.z + DESK_SEAT_DZ),
    new THREE.Vector3(gx, 0, 1.2),
  ]
  if (s.z < TABLE.z) {
    p.push(new THREE.Vector3(s.x, 0, 1.2))
    p.push(new THREE.Vector3(s.x, 0, s.z))
  } else {
    const side = s.x >= 0 ? 1 : -1
    const sx = side * 5.4
    p.push(new THREE.Vector3(sx, 0, 1.2))
    p.push(new THREE.Vector3(sx, 0, s.z - 0.2))
    p.push(new THREE.Vector3(s.x, 0, s.z - 0.2))
    p.push(new THREE.Vector3(s.x, 0, s.z))
  }
  return { route: new Route(p), deskYaw: DESK_YAW, seatYaw: s.yaw }
}

// 公共位置注册表：角色每帧写入头顶世界坐标，协作连线读取
export const poseRegistry = new Map<string, THREE.Vector3>()
