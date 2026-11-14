import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { poseRegistry } from './layout'

const N = 28

function Link({ a, b, color, topic }: { a: string; b: string; color: string; topic: string }) {
  const line = useRef<any>(null)
  const dots = useRef<THREE.Group>(null!)
  const label = useRef<THREE.Group>(null!)
  const initPts = useMemo(() => Array.from({ length: N + 1 }, (_, i) => new THREE.Vector3(i * 0.01, 0, 0)), [])
  const pts = useMemo(() => new Float32Array((N + 1) * 3), [])
  const va = useMemo(() => new THREE.Vector3(), [])
  const vb = useMemo(() => new THREE.Vector3(), [])
  const ctrl = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  const curve = (t: number, out: THREE.Vector3) => {
    const u = 1 - t
    out.set(
      u * u * va.x + 2 * u * t * ctrl.x + t * t * vb.x,
      u * u * va.y + 2 * u * t * ctrl.y + t * t * vb.y,
      u * u * va.z + 2 * u * t * ctrl.z + t * t * vb.z,
    )
  }

  useFrame((state) => {
    const pa = poseRegistry.get(a)
    const pb = poseRegistry.get(b)
    if (!pa || !pb) return
    va.copy(pa)
    vb.copy(pb)
    const dist = va.distanceTo(vb)
    ctrl.addVectors(va, vb).multiplyScalar(0.5)
    ctrl.y += 0.6 + dist * 0.18
    for (let i = 0; i <= N; i++) {
      curve(i / N, tmp)
      pts[i * 3] = tmp.x
      pts[i * 3 + 1] = tmp.y
      pts[i * 3 + 2] = tmp.z
    }
    const l = line.current
    if (l?.geometry) {
      l.geometry.setPositions(pts)
      if (l.material) l.material.dashOffset = -state.clock.elapsedTime * 0.8
      l.computeLineDistances?.()
    }
    const t0 = state.clock.elapsedTime * 0.35
    dots.current.children.forEach((d, i) => {
      const t = (t0 + i / 3) % 1
      curve(t, d.position)
    })
    curve(0.5, label.current.position)
  })

  return (
    <group>
      <Line ref={line} points={initPts} color={color} lineWidth={3} dashed dashSize={0.25} gapSize={0.14} transparent opacity={0.95} />
      <group ref={dots}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
      <group ref={label}>
        <Html center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <div className="linkchip" style={{ borderColor: color, color }}>
            {topic ? topic : 'Collab'}
          </div>
        </Html>
      </group>
    </group>
  )
}

export function CollabLinks({ links, colors }: { links: { a: string; b: string; topic: string }[]; colors: Record<string, string> }) {
  return (
    <group>
      {links.map((l) => (
        <Link key={l.a + l.b} a={l.a} b={l.b} topic={l.topic.length > 12 ? l.topic.slice(0, 12) + '…' : l.topic} color={colors[l.a] ?? '#14b8a6'} />
      ))}
    </group>
  )
}
