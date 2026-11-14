import * as THREE from 'three'

export const SEAT_YAW = 0.5 // 略微转向镜头，让脸更容易被看到
export const DESK_YAW = SEAT_YAW
export const DESK_SEAT_DZ = -0.8
const WALL_H = 4.8

export interface Layout {
  n: number
  perRow: number
  rows: number
  room: { w: number; d: number; wallH: number }
  table: { x: number; z: number; w: number; d: number }
  sps: number // 会议桌每侧座位数
  aisleZ: number
  deskPos(slot: number): { x: number; z: number }
  seatPos(seat: number): { x: number; z: number; yaw: number }
  buildRoute(deskSlot: number, seat: number): { route: Route; deskYaw: number; seatYaw: number }
}

/** 按成员数生成楼层布局：成员少 → 房间小、工位少 */
export function makeLayout(count: number): Layout {
  const n = Math.max(1, Math.min(count, 24))
  const perRow = n <= 5 ? n : Math.min(6, Math.ceil(n / 2))
  const rows = Math.ceil(n / perRow)
  const w = Math.max(12, perRow * 3 + 2.5)
  const d = 10.3 + (rows - 1) * 3.7
  const x0 = -((perRow - 1) * 3) / 2
  const row0Z = -d / 2 + 2.4
  const lastRowZ = row0Z + (rows - 1) * 3.7
  const sps = Math.max(2, Math.ceil(n / 2))
  const tableW = Math.max(5, (sps - 1) * 1.4 + 2)
  const table = { x: 0, z: lastRowZ + 5.1, w: tableW, d: 2.2 }
  const aisleZ = lastRowZ + 2.1

  const deskPos = (slot: number) => {
    const s = Math.max(0, Math.min(slot, n - 1))
    return { x: x0 + 3 * (s % perRow), z: row0Z + 3.7 * Math.floor(s / perRow) }
  }
  const seatPos = (seat: number) => {
    const s = Math.max(0, Math.min(seat, sps * 2 - 1))
    const sx = (i: number) => -((sps - 1) * 1.4) / 2 + 1.4 * i
    if (s < sps) return { x: sx(s), z: table.z - 1.8, yaw: SEAT_YAW }
    return { x: sx(s - sps), z: table.z + 1.8, yaw: Math.PI - 0.3 }
  }
  const buildRoute = (deskSlot: number, seat: number) => {
    const dp = deskPos(deskSlot)
    const sp = seatPos(seat)
    const gx = dp.x + 1.5
    const p: THREE.Vector3[] = [
      new THREE.Vector3(dp.x, 0, dp.z + DESK_SEAT_DZ),
      new THREE.Vector3(gx, 0, dp.z + DESK_SEAT_DZ),
      new THREE.Vector3(gx, 0, aisleZ),
    ]
    if (sp.z < table.z) {
      p.push(new THREE.Vector3(sp.x, 0, aisleZ))
      p.push(new THREE.Vector3(sp.x, 0, sp.z))
    } else {
      const side = sp.x >= 0 ? 1 : -1
      const sx = side * (table.w / 2 + 0.9)
      p.push(new THREE.Vector3(sx, 0, aisleZ))
      p.push(new THREE.Vector3(sx, 0, sp.z - 0.2))
      p.push(new THREE.Vector3(sp.x, 0, sp.z - 0.2))
      p.push(new THREE.Vector3(sp.x, 0, sp.z))
    }
    return { route: new Route(p), deskYaw: DESK_YAW, seatYaw: sp.yaw }
  }
  return { n, perRow, rows, room: { w, d, wallH: WALL_H }, table, sps, aisleZ, deskPos, seatPos, buildRoute }
}

/** 给每个 agent 分配紧凑的工位 0..n-1（按 desk 字段排序，冲突/越界自动顺延） */
export function assignDesks(agents: { id: string; desk: number }[]): Record<string, number> {
  const order = agents
    .map((a, i) => ({ id: a.id, desk: Number.isFinite(a.desk) ? a.desk : i, i }))
    .sort((a, b) => a.desk - b.desk || a.i - b.i)
  const out: Record<string, number> = {}
  order.forEach((o, k) => (out[o.id] = k))
  return out
}

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

// 公共位置注册表：角色每帧写入头顶世界坐标，协作连线读取（key = agent.id，需在大楼内唯一）
export const poseRegistry = new Map<string, THREE.Vector3>()
