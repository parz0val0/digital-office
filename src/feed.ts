import { useEffect, useRef, useState } from 'react'
import seedRaw from '../public/status.json'
import { startDemo } from './demo'
import { normalize } from './meta'
import type { FeedSource, Snapshot } from './types'

export const seed: Snapshot = normalize(seedRaw)

export function readParams() {
  const q = new URLSearchParams(location.search)
  return {
    feed: q.get('feed') || './status.json',
    demo: q.get('demo') === '1' || q.get('demo') === 'true',
    interval: Math.max(2000, Number(q.get('interval')) || 10000),
    select: q.get('select') || '',
    shot: q.get('shot') === '1', // 截图模式：隐藏动画随机性
  }
}

/** 轮询 status.json；demo=1 时使用本地模拟器；读取失败时保留上一次数据并回退到内置示例 */
export function useFeed(feedUrl: string, demo: boolean, intervalMs: number) {
  const [snapshot, setSnapshot] = useState<Snapshot>(seed)
  const [source, setSource] = useState<FeedSource>(demo ? 'demo' : 'loading')
  const [fetchedAt, setFetchedAt] = useState<number>(Date.now())
  const gotLive = useRef(false)

  useEffect(() => {
    if (demo) {
      setSource('demo')
      return startDemo(seed, (s) => {
        setSnapshot(s)
        setFetchedAt(Date.now())
      })
    }
    let stop = false
    const load = async () => {
      try {
        const sep = feedUrl.includes('?') ? '&' : '?'
        const res = await fetch(`${feedUrl}${sep}_=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const data = normalize(await res.json())
        if (stop) return
        gotLive.current = true
        setSnapshot(data)
        setSource('live')
        setFetchedAt(Date.now())
      } catch {
        if (stop) return
        if (!gotLive.current) {
          setSnapshot(seed)
          setSource('fallback')
        }
      }
    }
    load()
    const h = setInterval(load, intervalMs)
    return () => {
      stop = true
      clearInterval(h)
    }
  }, [feedUrl, demo, intervalMs])

  return { snapshot, source, fetchedAt }
}
