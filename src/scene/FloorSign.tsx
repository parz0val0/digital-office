import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Box } from './Furniture'
import type { Theme } from './themes'

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif'

/** 左墙上的楼层招牌：「4F 竞赛」 */
export function FloorSign({ label, name, theme, room }: { label: string; name: string; theme: Theme; room: { w: number; d: number; wallH: number } }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1000
    c.height = 300
    const g = c.getContext('2d')!
    const r = 46
    g.fillStyle = theme.accent
    g.beginPath()
    g.roundRect(0, 0, 1000, 300, r)
    g.fill()
    g.fillStyle = 'rgba(255,255,255,0.96)'
    g.beginPath()
    g.roundRect(22, 22, 956, 256, r - 14)
    g.fill()
    g.fillStyle = theme.accent
    g.beginPath()
    g.roundRect(22, 22, 250, 256, r - 14)
    g.fill()
    g.fillStyle = '#fff'
    g.font = `900 130px ${FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(label, 147, 160)
    g.fillStyle = '#2b2438'
    let size = 112
    g.font = `900 ${size}px ${FONT}`
    while (g.measureText(name).width > 640 && size > 48) {
      size -= 6
      g.font = `900 ${size}px ${FONT}`
    }
    g.textAlign = 'left'
    g.fillText(name, 305, 162)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [label, name, theme.accent])
  useEffect(() => () => tex.dispose(), [tex])
  const w = 3.3
  const h = 1.0
  return (
    <group position={[-room.w / 2 + 0.04, room.wallH - 0.75, -room.d / 2 + 3.0]} rotation={[0, Math.PI / 2, 0]}>
      <Box p={[0, 0, 0]} s={[w + 0.14, h + 0.14, 0.06]} c="#ffffff" r={0.04} />
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} transparent />
      </mesh>
    </group>
  )
}
