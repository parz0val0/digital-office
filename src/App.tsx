import { useCallback, useEffect, useMemo, useState } from 'react'
import { readParams, useBuilding, useFeed, useFloors } from './feed'
import { DetailPanel, Elevator, FeedPanel, Legend, MemberList, TopBar } from './hud/Hud'
import { overallProgress } from './meta'
import { Scene } from './scene/Scene'
import { themeFor } from './scene/themes'

const params = readParams()

export default function App() {
  const { floors, ready } = useFloors(params.floorsUrl)
  const [floorId, setFloorId] = useState<string>('')
  const [selectedId, setSelectedId] = useState<string | null>(params.select || null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [overview, setOverview] = useState(false)

  // 初始楼层：?floor= → default 标记 → 最低楼层
  useEffect(() => {
    if (!ready || floorId) return
    const byParam = floors.find((f) => f.id === params.floor)
    const def = floors.find((f) => f.default) ?? floors[floors.length - 1]
    setFloorId((byParam ?? def).id)
  }, [ready, floors, floorId])

  const floor = useMemo(() => floors.find((f) => f.id === floorId) ?? null, [floors, floorId])
  const { data, source, fetchedAt } = useFeed(floor, params.feed, params.demo, params.interval)
  const { summary, error: summaryError } = useBuilding(overview)

  const shownFloor = useMemo(() => floors.find((f) => f.id === data?.floorId) ?? null, [floors, data?.floorId])
  const loading = !!floor && data?.floorId !== floor.id
  const snapshot = data?.snapshot ?? null

  const goFloor = useCallback(
    (id: string) => {
      if (id === floorId) return
      setFloorId(id)
      setSelectedId(null)
      setHoverId(null)
      const q = new URLSearchParams(location.search)
      q.set('floor', id)
      history.replaceState(null, '', `${location.pathname}?${q.toString()}${location.hash}`)
    },
    [floorId],
  )

  const onSelect = useCallback((id: string | null) => setSelectedId((cur) => (id === cur ? null : id)), [])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null)
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && floors.length > 1 && !e.altKey && !e.metaKey && !e.ctrlKey) {
        const i = floors.findIndex((f) => f.id === floorId)
        const j = e.key === 'ArrowUp' ? i - 1 : i + 1 // floors 按楼层号从高到低排列
        if (j >= 0 && j < floors.length) goFloor(floors[j].id)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [floors, floorId, goFloor])

  const selected = snapshot?.agents.find((a) => a.id === selectedId) ?? null
  const themeIdx = shownFloor ? floors.length - 1 - floors.findIndex((f) => f.id === shownFloor.id) : 0
  const view = snapshot && shownFloor ? { floor: shownFloor, snapshot, theme: themeFor(shownFloor.theme, themeIdx) } : null
  const label = shownFloor ? shownFloor.label ?? `${shownFloor.order}F` : ''

  return (
    <div className="app">
      {snapshot && (
        <TopBar s={snapshot} source={loading ? 'loading' : source} fetchedAt={fetchedAt} onReset={() => setResetKey((k) => k + 1)} floor={shownFloor} floorLabel={label} />
      )}
      <main>
        {snapshot && <MemberList s={snapshot} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} hoverId={hoverId} floorName={shownFloor?.name} />}
        <div className="stage">
          {view && <Scene view={view} selectedId={selectedId} onSelect={onSelect} onHover={setHoverId} resetKey={resetKey} />}
          {floors.length > 0 && (
            <Elevator
              floors={floors}
              currentId={floorId}
              loading={loading}
              liveCount={shownFloor?.id === floorId && snapshot ? snapshot.agents.length : null}
              expanded={overview}
              onToggle={() => setOverview((v) => !v)}
              onGo={goFloor}
              summary={summary}
              summaryError={summaryError}
            />
          )}
          {(loading || !ready) && (
            <div className="floor-loading">
              <span className="spin big" />
              {floor ? `正在进入 ${floor.label ?? floor.order + 'F'} ${floor.name}…` : '加载大楼…'}
            </div>
          )}
          <Legend />
        </div>
        <div className="right">
          {selected && snapshot && <DetailPanel s={snapshot} agent={selected} onClose={() => setSelectedId(null)} />}
          {snapshot && <FeedPanel s={snapshot} />}
        </div>
      </main>
    </div>
  )
}
