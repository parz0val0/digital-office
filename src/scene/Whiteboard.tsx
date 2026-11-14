import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { fmtLongDate, itemProgress, overallProgress } from '../meta'
import type { Snapshot } from '../types'
import { Box } from './Furniture'

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif'
const W = 1800
const H = 860

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function fit(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

function draw(c: HTMLCanvasElement, s: Snapshot) {
  const g = c.getContext('2d')!
  g.clearRect(0, 0, W, H)
  g.fillStyle = '#fffdf7'
  g.fillRect(0, 0, W, H)
  // 标题
  g.fillStyle = '#2b2438'
  g.font = `800 64px ${FONT}`
  g.textBaseline = 'alphabetic'
  g.fillText("Today's Plan", 60, 100)
  const titleW = g.measureText("Today's Plan").width
  g.font = `600 38px ${FONT}`
  g.fillStyle = '#8a7f99'
  g.fillText(fmtLongDate(s.plan.date), 60 + titleW + 30, 98)
  // 总进度
  const total = overallProgress(s)
  g.fillStyle = '#2b2438'
  g.font = `900 120px ${FONT}`
  g.textAlign = 'right'
  g.fillText(`${total}%`, W - 60, 110)
  g.textAlign = 'left'
  rr(g, 60, 135, W - 120, 36, 18)
  g.fillStyle = '#efe6d6'
  g.fill()
  rr(g, 60, 135, Math.max(36, ((W - 120) * total) / 100), 36, 18)
  const grad = g.createLinearGradient(60, 0, W - 60, 0)
  grad.addColorStop(0, '#ffb454')
  grad.addColorStop(1, '#40c057')
  g.fillStyle = grad
  g.fill()

  // 事项：两列
  const agentColor = new Map(s.agents.map((a) => [a.id, a.color]))
  const agentName = new Map(s.agents.map((a) => [a.id, a.name]))
  const items = s.plan.items.slice(0, 14)
  const colN = 7
  const colW = (W - 120 - 60) / 2
  items.forEach((it, i) => {
    const col = Math.floor(i / colN)
    const row = i % colN
    const x = 60 + col * (colW + 60)
    const y = 218 + row * 90
    const p = itemProgress(it)
    const done = it.status === 'done'
    const col2 = agentColor.get(it.owner) ?? '#888'
    // 勾选框
    rr(g, x, y + 6, 44, 44, 10)
    g.fillStyle = done ? '#40c057' : it.status === 'blocked' ? '#ff6b6b' : '#fff'
    g.fill()
    g.lineWidth = 4
    g.strokeStyle = done ? '#40c057' : it.status === 'blocked' ? '#ff6b6b' : '#c9bfae'
    g.stroke()
    g.fillStyle = '#fff'
    g.font = `900 30px ${FONT}`
    if (done) g.fillText('✓', x + 9, y + 40)
    else if (it.status === 'blocked') g.fillText('!', x + 16, y + 40)
    // 标题
    g.font = `800 40px ${FONT}`
    g.fillStyle = done ? '#9a8f80' : '#2b2438'
    g.fillText(fit(g, it.title, colW - 360), x + 60, y + 36)
    // 负责人
    g.font = `700 28px ${FONT}`
    g.fillStyle = col2
    g.beginPath()
    g.arc(x + 72, y + 66, 9, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#8a7f99'
    g.fillText(fit(g, agentName.get(it.owner) ?? it.owner, 220), x + 90, y + 76)
    // 进度条
    const bx = x + colW - 290
    rr(g, bx, y + 16, 210, 26, 13)
    g.fillStyle = '#efe6d6'
    g.fill()
    if (p > 0) {
      rr(g, bx, y + 16, Math.max(26, (210 * p) / 100), 26, 13)
      g.fillStyle = done ? '#40c057' : it.status === 'blocked' ? '#ff8787' : col2
      g.fill()
    }
    g.font = `800 32px ${FONT}`
    g.fillStyle = '#5b5368'
    g.textAlign = 'right'
    g.fillText(`${Math.round(p)}%`, x + colW, y + 42)
    g.textAlign = 'left'
  })
  if (!items.length) {
    g.fillStyle = '#b9b0a2'
    g.font = `600 44px ${FONT}`
    g.fillText('No plan items today', 60, 300)
  }
}

export function Whiteboard({ snapshot, room }: { snapshot: Snapshot; room: { w: number; d: number; wallH: number } }) {
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    draw(canvas, snapshot) // 首帧就有内容，避免切楼层时闪黑
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return { canvas, tex }
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  useEffect(() => {
    draw(canvas, snapshot)
    tex.needsUpdate = true
    // 字体加载完成后重绘
    ;(document as any).fonts?.ready?.then(() => {
      draw(canvas, snapshot)
      tex.needsUpdate = true
    })
  }, [snapshot.plan, snapshot.agents.length, canvas, tex]) // eslint-disable-line react-hooks/exhaustive-deps
  const w = Math.min(8.4, room.w - 5)
  const h = (w * H) / W
  const z = -room.d / 2
  return (
    <group position={[0, Math.max(h / 2 + 0.55, 2.2), z]}>
      <Box p={[0, 0, 0.04]} s={[w + 0.3, h + 0.3, 0.1]} c="#f4d6a8" r={0.05} />
      <mesh position={[0, 0, 0.1]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* 托盘 + 笔 */}
      <Box p={[0, -h / 2 - 0.2, 0.2]} s={[w * 0.6, 0.06, 0.16]} c="#e8c28f" r={0.02} />
      <Box p={[-1, -h / 2 - 0.14, 0.2]} s={[0.35, 0.06, 0.06]} c="#ff6b6b" r={0.02} />
      <Box p={[-0.5, -h / 2 - 0.14, 0.2]} s={[0.35, 0.06, 0.06]} c="#4dabf7" r={0.02} />
    </group>
  )
}
