import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { readParams, useBuilding, useFeed, useFloors } from './feed'
import { BuildingPanel, BuildingTopBar, DetailPanel, FeedPanel, FloorList, FloorStrip, Legend, MemberList, TopBar } from './hud/Hud'
import { BuildingScene } from './scene/Building'

const params = readParams()

export default function App() {
  const { floors, ready, roamingUrl } = useFloors(params.floorsUrl)
  // null = 整栋楼视图（默认）；否则 = 正在查看的楼层
  const [floorId, setFloorId] = useState<string | null>(null)
  const [initDone, setInitDone] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(params.select || null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [hoverFloor, setHoverFloor] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const mounted = useRef(false)

  // 初始：只有 ?floor=<id> 才直接进入某层，否则显示整栋楼
  useEffect(() => {
    if (!ready || initDone) return
    const byParam = floors.find((f) => f.id === params.floor)
    setFloorId(byParam ? byParam.id : null)
    setInitDone(true)
  }, [ready, floors, initDone])

  const floor = useMemo(() => floors.find((f) => f.id === floorId) ?? null, [floors, floorId])
  const inBuilding = initDone && floorId == null
  // 楼层 feed 只在「进入某层」时拉取；整栋楼视图只读 building.json
  const { data, source, fetchedAt } = useFeed(floor, params.feed, roamingUrl, params.demo, params.interval)
  const { summary, error: summaryError, fetchedAt: summaryAt } = useBuilding(inBuilding, params.interval)

  const loaded = !!floor && data?.floorId === floor.id
  const loading = !!floor && !loaded
  const snapshot = loaded ? data!.snapshot : null
  const floorLabel = floor ? floor.label ?? `${floor.order}F` : ''

  const setUrl = (id: string | null) => {
    const q = new URLSearchParams(location.search)
    if (id) q.set('floor', id)
    else q.delete('floor')
    const qs = q.toString()
    history.replaceState(null, '', `${location.pathname}${qs ? '?' + qs : ''}${location.hash}`)
  }
  const goFloor = useCallback(
    (id: string) => {
      if (id === floorId) return
      setFloorId(id)
      setSelectedId(null)
      setHoverId(null)
      setHoverFloor(null)
      setUrl(id)
    },
    [floorId],
  )
  const goBuilding = useCallback(() => {
    if (floorId == null) return
    setFloorId(null)
    setSelectedId(null)
    setHoverId(null)
    setHoverFloor(null)
    setUrl(null)
  }, [floorId])

  const onSelect = useCallback((id: string | null) => setSelectedId((cur) => (id === cur ? null : id)), [])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedId) setSelectedId(null)
        else goBuilding()
      }
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && floorId && floors.length > 1 && !e.altKey && !e.metaKey && !e.ctrlKey) {
        const i = floors.findIndex((f) => f.id === floorId)
        const j = e.key === 'ArrowUp' ? i - 1 : i + 1 // floors 按楼层号从高到低排列
        if (j >= 0 && j < floors.length) goFloor(floors[j].id)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [floors, floorId, goFloor, goBuilding, selectedId])

  // 悬停楼层时鼠标变手形
  useEffect(() => {
    document.body.style.cursor = inBuilding && hoverFloor ? 'pointer' : ''
  }, [inBuilding, hoverFloor])

  const everyone = snapshot ? [...snapshot.agents, ...(snapshot.roamers ?? [])] : []
  const selected = everyone.find((a) => a.id === selectedId) ?? null

  const sceneReady = ready && initDone && (floorId != null || !!summary || summaryError || mounted.current)
  if (sceneReady) mounted.current = true

  return (
    <div className="app">
      {inBuilding ? (
        <BuildingTopBar b={summary} error={summaryError} fetchedAt={summaryAt} onReset={() => setResetKey((k) => k + 1)} />
      ) : snapshot ? (
        <TopBar s={snapshot} source={loading ? 'loading' : source} fetchedAt={fetchedAt} onReset={() => setResetKey((k) => k + 1)} onBack={goBuilding} floor={floor} floorLabel={floorLabel} />
      ) : (
        <header className="topbar">
          <div className="brand">
            <span className="logo">🏢</span>
            <div>
              <h1>Jason's Digital Office</h1>
              <div className="sub crumbs">
                <button className="crumb" onClick={goBuilding}>
                  ← Building
                </button>
                {floor && (
                  <>
                    <span className="sep">/</span>
                    <span className="crumb here">
                      {floorLabel} {floor.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>
      )}
      <main>
        {inBuilding ? (
          <FloorList floors={floors} b={summary} hoverId={hoverFloor} onHover={setHoverFloor} onGo={goFloor} />
        ) : snapshot ? (
          <MemberList s={snapshot} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} hoverId={hoverId} floorName={floor?.name} />
        ) : (
          <aside className="panel left" />
        )}
        <div className="stagewrap">
          <div className="stage">
            {sceneReady && (
              <BuildingScene
                floors={floors}
                summary={summary}
                focusId={floorId}
                hoverFloor={hoverFloor}
                onHoverFloor={setHoverFloor}
                onFloorClick={goFloor}
                detail={data ? { floorId: data.floorId, snapshot: data.snapshot } : null}
                selectedId={selectedId}
                onSelect={onSelect}
                onHoverAgent={setHoverId}
                resetKey={resetKey}
              />
            )}
            {(loading || !sceneReady) && (
              <div className="floor-loading">
                <span className="spin big" />
                {floor ? `Entering ${floorLabel} ${floor.name}…` : 'Loading building…'}
              </div>
            )}
            {floorId && (
              <button className="exitbtn" onClick={goBuilding} title="Leave this floor and pull back to the whole building (Esc)">
                <span>⬅</span> Exit floor <kbd>Esc</kbd>
              </button>
            )}
            <Legend building={inBuilding} />
          </div>
          {floors.length > 0 && <FloorStrip floors={floors} currentId={floorId} loading={loading} hoverId={hoverFloor} onHover={setHoverFloor} onGo={goFloor} onBuilding={goBuilding} />}
        </div>
        <div className="right">
          {inBuilding ? (
            <BuildingPanel floors={floors} b={summary} onGo={goFloor} />
          ) : (
            <>
              {selected && snapshot && <DetailPanel s={snapshot} agent={selected} roaming={(snapshot.roamers ?? []).some((r) => r.id === selected.id)} onClose={() => setSelectedId(null)} />}
              {snapshot && <FeedPanel s={snapshot} />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
