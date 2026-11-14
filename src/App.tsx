import { useCallback, useEffect, useState } from 'react'
import { readParams, useFeed } from './feed'
import { DetailPanel, FeedPanel, Legend, MemberList, TopBar } from './hud/Hud'
import { Scene } from './scene/Scene'

const params = readParams()

export default function App() {
  const { snapshot, source, fetchedAt } = useFeed(params.feed, params.demo, params.interval)
  const [selectedId, setSelectedId] = useState<string | null>(params.select || null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)

  const onSelect = useCallback((id: string | null) => setSelectedId((cur) => (id === cur ? null : id)), [])
  const selected = snapshot.agents.find((a) => a.id === selectedId) ?? null

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setSelectedId(null)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <div className="app">
      <TopBar s={snapshot} source={source} fetchedAt={fetchedAt} onReset={() => setResetKey((k) => k + 1)} />
      <main>
        <MemberList s={snapshot} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} hoverId={hoverId} />
        <div className="stage">
          <Scene snapshot={snapshot} selectedId={selectedId} onSelect={onSelect} onHover={setHoverId} resetKey={resetKey} />
          <Legend />
        </div>
        <div className="right">
          {selected && <DetailPanel s={snapshot} agent={selected} onClose={() => setSelectedId(null)} />}
          <FeedPanel s={snapshot} />
        </div>
      </main>
    </div>
  )
}
