import * as THREE from 'three'

/**
 * 昼夜氛围：0 = 白天，1 = 深夜（我们封顶在 NIGHT_MAX，保持“傍晚”的可读性）。
 * 默认按浏览器本地时间；`?tod=day|dusk|night` 或 `?tod=0.3` 可强制。
 */
const NIGHT_MAX = 0.32
const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function nightFactor(date = new Date()): number {
  const q = new URLSearchParams(location.search).get('tod')
  if (q === 'day') return 0
  if (q === 'dusk') return 0.55
  if (q === 'night') return NIGHT_MAX
  if (q != null && q !== '' && Number.isFinite(Number(q))) return Math.min(1, Math.max(0, Number(q)))
  const h = date.getHours() + date.getMinutes() / 60
  const evening = ss(16.5, 19.5, h)
  const morning = 1 - ss(5.5, 7.5, h)
  return Math.max(evening, morning) * NIGHT_MAX
}

const c = (hex: string) => new THREE.Color(hex)
export const mix = (a: string, b: string, k: number) => '#' + c(a).lerp(c(b), k).getHexString()

export const NIGHT = nightFactor()
