import { useEffect, useRef, useState } from 'react'
import { startDemo } from './demo'
import { normalize, normalizeRoaming } from './meta'
import type { BuildingSummary, FeedSource, FloorDef, RoamerInfo, Snapshot } from './types'

export function readParams() {
  const q = new URLSearchParams(location.search)
  return {
    floor: q.get('floor') || '',
    feed: q.get('feed') || '', // 覆盖「当前楼层」的 feed 地址
    floorsUrl: q.get('floors') || './floors.json',
    demo: q.get('demo') === '1' || q.get('demo') === 'true',
    interval: Math.max(2000, Number(q.get('interval')) || 10000),
    select: q.get('select') || '',
  }
}

const noCache = (url: string) => `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`

/** 楼层 feed 相对 floors.json 所在目录解析（floors.json 与 index.html 同级时即相对页面） */
function resolveFeed(feed: string, floorsUrl: string) {
  try {
    return new URL(feed, new URL(floorsUrl, location.href)).href
  } catch {
    return feed
  }
}

// ---------- 楼层配置：只在启动时读取一次（静态配置，不含 bot 数据） ----------
export function useFloors(floorsUrl: string) {
  const [state, setState] = useState<{ floors: FloorDef[]; roamingUrl: string; ready: boolean; error: boolean }>({ floors: [], roamingUrl: '', ready: false, error: false })
  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      try {
        const res = await fetch(noCache(floorsUrl), { cache: 'no-store', signal: ac.signal })
        if (!res.ok) throw new Error(String(res.status))
        const raw = await res.json()
        const floors: FloorDef[] = (Array.isArray(raw?.floors) ? raw.floors : [])
          .filter((f: any) => f && f.id && f.feed)
          .map((f: any, i: number) => ({
            id: String(f.id),
            name: String(f.name ?? f.id),
            order: Number.isFinite(f.order) ? Number(f.order) : i + 1,
            feed: resolveFeed(String(f.feed), floorsUrl),
            label: f.label ? String(f.label) : undefined,
            theme: f.theme ? String(f.theme) : undefined,
            default: !!f.default,
            note: f.note,
          }))
          .sort((a: FloorDef, b: FloorDef) => b.order - a.order)
        if (!floors.length) throw new Error('empty')
        setState({ floors, roamingUrl: raw?.roaming ? resolveFeed(String(raw.roaming), floorsUrl) : '', ready: true, error: false })
      } catch {
        if (ac.signal.aborted) return
        // 向后兼容：没有 floors.json 时退化成单层（./status.json）
        setState({
          floors: [{ id: 'default', name: '办公室', order: 1, feed: resolveFeed('./status.json', floorsUrl), default: true }],
          roamingUrl: '',
          ready: true,
          error: true,
        })
      }
    })()
    return () => ac.abort()
  }, [floorsUrl])
  return state
}

export interface FeedState {
  floorId: string // snapshot 所属楼层
  snapshot: Snapshot
  roamers: RoamerInfo[] // 所有漫游成员当前所在楼层（来自 roaming.json，用于电梯面板标记）
}

/**
 * 只对「当前楼层」轮询 status.json：
 * - 楼层切换时立刻 abort 旧请求并停止旧轮询，不预取其他楼层
 * - 标签页隐藏时暂停（含 abort 在途请求），恢复可见时立即补拉一次
 * - demo=1：仅拉取当前楼层一次作为种子，之后在本地模拟
 */
export function useFeed(floor: FloorDef | null, feedOverride: string, roamingUrl: string, demo: boolean, intervalMs: number) {
  const [data, setData] = useState<FeedState | null>(null)
  const [source, setSource] = useState<FeedSource>('loading')
  const [error, setError] = useState<string>('')
  const [fetchedAt, setFetchedAt] = useState<number>(Date.now())
  const dataRef = useRef<FeedState | null>(null)
  dataRef.current = data

  const floorId = floor?.id ?? ''
  const url = floor ? feedOverride || floor.feed : ''

  useEffect(() => {
    if (!floor || !url) return
    setSource(demo ? 'demo' : 'loading')
    setError('')
    let ac: AbortController | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let stopDemo: (() => void) | null = null
    let dead = false

    const fetchOnce = async (): Promise<{ snap: Snapshot; roamers: RoamerInfo[] } | null> => {
      ac?.abort()
      const mine = (ac = new AbortController())
      try {
        // 楼层 feed + roaming.json（很小）一起取；roaming 失败不影响楼层显示
        const roamReq = roamingUrl
          ? fetch(noCache(roamingUrl), { cache: 'no-store', signal: mine.signal })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null)
        const res = await fetch(noCache(url), { cache: 'no-store', signal: mine.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const snap = normalize(await res.json())
        const roamRaw = await roamReq
        const roam = roamRaw ? normalizeRoaming(roamRaw) : { roamers: [], collaborations: [] }
        const here = roam.roamers.filter((r) => r.currentFloor === floor.id)
        const ids = new Set(here.map((r) => r.id))
        snap.roamers = here.map(({ currentFloor: _c, plan: _p, ...a }) => a)
        snap.roamPlan = here.flatMap((r) => r.plan)
        snap.collaborations = [...snap.collaborations, ...roam.collaborations.filter((c) => ids.has(c.from) || ids.has(c.to))]
        return { snap, roamers: roam.roamers.map((r) => ({ id: r.id, name: r.name, color: r.color, currentFloor: r.currentFloor })) }
      } catch (e: any) {
        if (mine.signal.aborted || dead) return null
        setError(String(e?.message ?? e))
        setSource('fallback')
        // 首次失败：显示一个空楼层，避免界面卡住
        if (!dataRef.current || dataRef.current.floorId !== floor.id) {
          setData({ floorId: floor.id, roamers: [], snapshot: normalize({ plan: { date: new Date().toISOString().slice(0, 10), items: [] }, agents: [], collaborations: [] }) })
        }
        return null
      }
    }

    const load = async () => {
      const r = await fetchOnce()
      if (!r || dead) return
      setData({ floorId: floor.id, snapshot: r.snap, roamers: r.roamers })
      setSource('live')
      setError('')
      setFetchedAt(Date.now())
    }

    if (demo) {
      ;(async () => {
        const seed = await fetchOnce()
        if (!seed || dead) return
        setData({ floorId: floor.id, snapshot: seed.snap, roamers: seed.roamers })
        setFetchedAt(Date.now())
        setSource('demo')
        stopDemo = startDemo(seed.snap, (s) => {
          if (dead) return
          setData({ floorId: floor.id, snapshot: s, roamers: seed.roamers })
          setFetchedAt(Date.now())
        })
      })()
      return () => {
        dead = true
        ac?.abort()
        stopDemo?.()
      }
    }

    const start = () => {
      if (timer || dead) return
      load()
      timer = setInterval(load, intervalMs)
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
      ac?.abort()
    }
    const onVis = () => (document.hidden ? stop() : start())
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      dead = true
      document.removeEventListener('visibilitychange', onVis)
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorId, url, roamingUrl, demo, intervalMs])

  return { data, source, error, fetchedAt }
}

/** 大楼总览：只在面板打开时读取 building.json（极小的汇总文件），打开期间每 15 秒刷新一次，隐藏时暂停 */
export function useBuilding(open: boolean, url = './building.json') {
  const [summary, setSummary] = useState<BuildingSummary | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!open) return
    let ac: AbortController | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    const load = async () => {
      ac?.abort()
      const mine = (ac = new AbortController())
      try {
        const res = await fetch(noCache(url), { cache: 'no-store', signal: mine.signal })
        if (!res.ok) throw new Error()
        const raw = await res.json()
        setSummary({
          updatedAt: String(raw.updatedAt ?? ''),
          roamers: Array.isArray(raw.roamers) ? raw.roamers.map((r: any) => ({ id: String(r.id), floor: String(r.floor) })) : [],
          floors: (Array.isArray(raw.floors) ? raw.floors : []).map((f: any) => ({
            id: String(f.id),
            completion: Number(f.completion) || 0,
            agents: Number(f.agents) || 0,
            counts: f.counts ?? {},
            updatedAt: f.updatedAt,
          })),
        })
        setError(false)
      } catch {
        if (!mine.signal.aborted) setError(true)
      }
    }
    const start = () => {
      if (timer) return
      load()
      timer = setInterval(load, 15000)
    }
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = null
      ac?.abort()
    }
    const onVis = () => (document.hidden ? stop() : start())
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      stop()
    }
  }, [open, url])
  return { summary, error }
}
