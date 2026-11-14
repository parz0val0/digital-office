import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { STATUS_META } from '../meta'
import type { Agent } from '../types'
import { poseRegistry, type Layout } from './layout'

const ACCESSORY: Record<string, string> = {
  office: 'hardhat',
  'class-arrangement': 'bow',
  teacher: 'mortarboard',
  'signal-trader': 'antenna',
  'codex-cli': 'headphones',
  botmail: 'cap',
  director: 'beret',
  'market-compare': 'glasses',
  last30days: 'sprout',
  'grokbot-market': 'tophat',
  grokbot: 'crown',
}
const FALLBACK_ACC = ['hardhat', 'bow', 'antenna', 'headphones', 'cap', 'beret', 'glasses', 'sprout', 'tophat', 'crown']

const lerpColor = (hex: string, to: string, k: number) => '#' + new THREE.Color(hex).lerp(new THREE.Color(to), k).getHexString()

function Mat({ c, e = 0, rough = 0.7 }: { c: string; e?: number; rough?: number }) {
  return <meshStandardMaterial color={c} roughness={rough} emissive={e ? c : '#000'} emissiveIntensity={e} />
}

// 反向外壳描边
function Outlined({ geo, pos, scale, color, outline = '#2b2438', width = 0.035, children }: any) {
  return (
    <group position={pos} scale={scale}>
      <mesh castShadow receiveShadow>
        {geo}
        {children}
      </mesh>
      <mesh scale={1 + width}>
        {geo}
        <meshBasicMaterial color={outline} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

function Accessory({ kind, color, accent }: { kind: string; color: string; accent: string }) {
  const dark = lerpColor(color, '#000000', 0.25)
  switch (kind) {
    case 'hardhat':
      return (
        <group position={[0, 0.3, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.43, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat c="#ffd43b" />
          </mesh>
          <mesh position={[0, 0.02, 0.2]} scale={[1, 0.25, 1]} castShadow>
            <cylinderGeometry args={[0.46, 0.46, 0.1, 24]} />
            <Mat c="#fcc419" />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.1, 0.22, 0.8]} />
            <Mat c="#fab005" />
          </mesh>
        </group>
      )
    case 'bow':
      return (
        <group position={[0.3, 0.33, 0.18]} rotation={[0.2, 0, -0.4]}>
          <mesh position={[-0.12, 0, 0]} scale={[1, 0.8, 0.6]} castShadow>
            <sphereGeometry args={[0.13, 12, 10]} />
            <Mat c="#ff4d6d" />
          </mesh>
          <mesh position={[0.12, 0, 0]} scale={[1, 0.8, 0.6]} castShadow>
            <sphereGeometry args={[0.13, 12, 10]} />
            <Mat c="#ff4d6d" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.07, 10, 8]} />
            <Mat c="#c9184a" />
          </mesh>
        </group>
      )
    case 'mortarboard':
      return (
        <group position={[0, 0.42, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.28, 0.3, 0.14, 16]} />
            <Mat c="#2b2f36" />
          </mesh>
          <mesh position={[0, 0.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <boxGeometry args={[0.8, 0.05, 0.8]} />
            <Mat c="#343a40" />
          </mesh>
          <mesh position={[0.3, 0.0, 0.3]}>
            <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
            <Mat c="#ffd43b" />
          </mesh>
        </group>
      )
    case 'antenna':
      return (
        <group position={[0, 0.4, 0]}>
          <mesh position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
            <Mat c="#555b66" />
          </mesh>
          <mesh position={[0, 0.34, 0]}>
            <sphereGeometry args={[0.08, 12, 10]} />
            <Mat c="#ff6b6b" e={0.8} />
          </mesh>
        </group>
      )
    case 'headphones':
      return (
        <group position={[0, 0.05, 0]}>
          <mesh rotation={[0, 0, 0]} castShadow>
            <torusGeometry args={[0.44, 0.035, 8, 24, Math.PI]} />
            <Mat c="#343a40" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.44, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.13, 0.13, 0.12, 14]} />
              <Mat c="#ff6b6b" />
            </mesh>
          ))}
        </group>
      )
    case 'cap':
      return (
        <group position={[0, 0.28, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.43, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
            <Mat c="#228be6" />
          </mesh>
          <mesh position={[0, 0.0, 0.42]} scale={[1, 0.2, 1]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.1, 16]} />
            <Mat c="#1971c2" />
          </mesh>
        </group>
      )
    case 'beret':
      return (
        <group position={[0.06, 0.38, 0]} rotation={[0, 0, -0.2]}>
          <mesh scale={[1, 0.4, 1]} castShadow>
            <sphereGeometry args={[0.4, 20, 12]} />
            <Mat c="#212529" />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.08, 6]} />
            <Mat c="#212529" />
          </mesh>
        </group>
      )
    case 'glasses':
      return (
        <group position={[0, 0.0, 0.38]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.17, 0, 0.0]}>
              <torusGeometry args={[0.11, 0.022, 8, 20]} />
              <Mat c="#2b2f36" />
            </mesh>
          ))}
          <mesh position={[0, 0.0, 0]}>
            <boxGeometry args={[0.1, 0.02, 0.02]} />
            <Mat c="#2b2f36" />
          </mesh>
        </group>
      )
    case 'sprout':
      return (
        <group position={[0, 0.4, 0]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.18, 6]} />
            <Mat c="#2f9e44" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.1, 0.2, 0]} scale={[1, 0.5, 0.6]} rotation={[0, 0, s * 0.5]} castShadow>
              <sphereGeometry args={[0.12, 10, 8]} />
              <Mat c="#51cf66" />
            </mesh>
          ))}
        </group>
      )
    case 'tophat':
      return (
        <group position={[0, 0.5, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.24, 0.26, 0.4, 18]} />
            <Mat c="#343a40" />
          </mesh>
          <mesh position={[0, -0.2, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.04, 20]} />
            <Mat c="#343a40" />
          </mesh>
          <mesh position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.265, 0.265, 0.1, 18]} />
            <Mat c={accent} />
          </mesh>
        </group>
      )
    case 'crown':
      return (
        <group position={[0, 0.44, 0]}>
          <mesh>
            <cylinderGeometry args={[0.2, 0.17, 0.14, 5]} />
            <Mat c="#ffd43b" rough={0.3} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.sin((i / 5) * Math.PI * 2) * 0.19, 0.14, Math.cos((i / 5) * Math.PI * 2) * 0.19]}>
              <coneGeometry args={[0.06, 0.12, 6]} />
              <Mat c="#ffd43b" rough={0.3} />
            </mesh>
          ))}
        </group>
      )
    default:
      return <mesh visible={false} userData={{ dark }} />
  }
}

export interface CharacterProps {
  layout: Layout
  agent: Agent
  index: number
  deskSlot: number
  seat: number
  selected: boolean
  partnerNames: string[]
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

const SIT_LIFT = 0.26
const CHAR_SCALE = 1.18

export function Character({ layout, agent, index, deskSlot, seat, selected, partnerNames, onSelect, onHover }: CharacterProps) {
  const st = agent.status
  const offline = st === 'offline'
  const base = offline ? lerpColor(agent.color, '#9aa0a6', 0.8) : agent.color
  const bodyC = base
  const headC = lerpColor(base, '#ffffff', 0.18)
  const limbC = lerpColor(base, '#000000', 0.18)
  const accent = lerpColor(base, '#ffffff', 0.4)
  const acc = ACCESSORY[agent.id] ?? FALLBACK_ACC[index % FALLBACK_ACC.length]

  const { route, seatYaw, deskYaw } = useMemo(() => layout.buildRoute(deskSlot, seat), [layout, deskSlot, seat])
  const root = useRef<THREE.Group>(null!)
  const bodyG = useRef<THREE.Group>(null!)
  const headG = useRef<THREE.Group>(null!)
  const armL = useRef<THREE.Group>(null!)
  const armR = useRef<THREE.Group>(null!)
  const legL = useRef<THREE.Group>(null!)
  const legR = useRef<THREE.Group>(null!)
  const eyes = useRef<THREE.Group>(null!)
  const ring = useRef<THREE.Mesh>(null!)

  const sim = useRef({
    t: 0, // 沿路径的进度
    yaw: 0,
    sit: 1,
    phase: index * 1.7,
    pos: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    tmp: new THREE.Vector3(),
    walkSign: 1,
    init: false,
  })

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const s = sim.current
    const time = state.clock.elapsedTime + s.phase
    const atTable = st === 'collaborating'
    const target = atTable ? route.length : 0
    if (!s.init) {
      s.t = target
      s.init = true
    }
    const diff = target - s.t
    const moving = Math.abs(diff) > 0.02
    if (moving) {
      s.walkSign = Math.sign(diff)
      s.t += s.walkSign * Math.min(Math.abs(diff), dt * 3.2)
    } else s.t = target
    route.at(s.t, s.pos, s.dir)

    // 朝向
    let wantYaw: number
    if (moving) wantYaw = Math.atan2(s.dir.x * s.walkSign, s.dir.z * s.walkSign)
    else wantYaw = atTable ? seatYaw : deskYaw
    let dy = wantYaw - s.yaw
    dy = Math.atan2(Math.sin(dy), Math.cos(dy))
    s.yaw += dy * Math.min(1, dt * 9)

    const sitTarget = moving ? 0 : 1
    s.sit += (sitTarget - s.sit) * Math.min(1, dt * 6)

    const g = root.current
    g.position.set(s.pos.x, 0, s.pos.z) // root 缩放不影响位置
    g.rotation.y = s.yaw
    // 公共坐标
    let pv = poseRegistry.get(agent.id)
    if (!pv) poseRegistry.set(agent.id, (pv = new THREE.Vector3()))
    pv.set(s.pos.x, (1.95 + s.sit * SIT_LIFT) * CHAR_SCALE, s.pos.z)

    const b = bodyG.current
    const h = headG.current
    let bobY = 0
    let shakeX = 0
    let headRx = 0
    let headRz = 0
    let aLx = 0, aRx = 0, aLz = 0, aRz = 0
    let lLx = 0, lRx = 0
    const sw = Math.sin(time * 10)

    if (moving) {
      bobY = Math.abs(sw) * 0.07
      lLx = sw * 0.7
      lRx = -sw * 0.7
      aLx = -sw * 0.6
      aRx = sw * 0.6
      headRz = Math.sin(time * 5) * 0.04
    } else {
      const sitK = s.sit
      // 坐姿腿
      lLx = -1.45 * sitK
      lRx = -1.45 * sitK
      const breathe = Math.sin(time * 2) * 0.015
      bobY = breathe
      switch (st) {
        case 'working': {
          aLx = -1.15 + Math.sin(time * 15) * 0.22
          aRx = -1.15 + Math.sin(time * 15 + 2.2) * 0.22
          headRx = 0.12 + Math.sin(time * 3) * 0.03
          bobY += Math.abs(Math.sin(time * 7.5)) * 0.012
          break
        }
        case 'thinking': {
          aRx = -2.3 + Math.sin(time * 2) * 0.05
          aRz = -0.3
          aLx = -0.5
          headRz = Math.sin(time * 1.2) * 0.14
          headRx = -0.08
          break
        }
        case 'collaborating': {
          aLx = -0.7 + Math.sin(time * 3.1) * 0.5
          aRx = -0.7 + Math.sin(time * 3.1 + 2.5) * 0.5
          headRx = Math.sin(time * 4) * 0.08
          headRz = Math.sin(time * 1.5) * 0.08
          break
        }
        case 'waiting': {
          aRz = 2.7 + Math.sin(time * 9) * 0.25
          aLx = -0.2
          bobY += Math.abs(Math.sin(time * 4)) * 0.05
          headRz = Math.sin(time * 3) * 0.1
          break
        }
        case 'done': {
          aLz = -2.7 + Math.sin(time * 6) * 0.15
          aRz = 2.7 - Math.sin(time * 6) * 0.15
          bobY += Math.abs(Math.sin(time * 3.5)) * 0.12
          break
        }
        case 'error': {
          aLx = -2.5
          aRx = -2.5
          aLz = 0.5
          aRz = -0.5
          shakeX = Math.sin(time * 38) * 0.025
          headRx = 0.3
          break
        }
        case 'offline': {
          bobY = 0
          headRx = 0.65
          aLx = 0.1
          aRx = 0.1
          break
        }
      }
    }
    b.position.set(shakeX, s.sit * SIT_LIFT + bobY, 0)
    h.rotation.set(headRx, 0, headRz)
    armL.current.rotation.set(aLx, 0, aLz)
    armR.current.rotation.set(aRx, 0, aRz)
    legL.current.rotation.x = lLx
    legR.current.rotation.x = lRx
    // 眨眼 / 闭眼
    const blink = offline ? 0.12 : Math.sin(time * 0.9 + 1) > 0.985 ? 0.1 : 1
    eyes.current.scale.y += (blink - eyes.current.scale.y) * 0.5
    if (ring.current) {
      ring.current.rotation.z += dt * 0.8
      const k = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.04
      ring.current.scale.set(k, k, 1)
    }
  })

  const meta = STATUS_META[st]
  const dim = offline ? 0.55 : 1

  return (
    <group
      ref={root}
      scale={CHAR_SCALE}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(agent.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
        onHover(agent.id)
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
        onHover(null)
      }}
    >
      {/* 选中光圈 */}
      {selected && (
        <mesh ref={ring} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.62, 0.78, 40, 1]} />
          <meshBasicMaterial color={meta.color} transparent opacity={0.95} />
        </mesh>
      )}
      {/* 脚下阴影圈（为让角色在地板上更突出） */}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#5b3a1e" transparent opacity={0.16} />
      </mesh>

      <group ref={bodyG}>
        {/* 腿 */}
        <group ref={legL} position={[-0.17, 0.32, 0]}>
          <mesh position={[0, -0.12, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.2, 4, 10]} />
            <Mat c={limbC} />
          </mesh>
          <mesh position={[0, -0.26, 0.06]} scale={[1, 0.6, 1.4]} castShadow>
            <sphereGeometry args={[0.12, 10, 8]} />
            <Mat c="#2b2438" />
          </mesh>
        </group>
        <group ref={legR} position={[0.17, 0.32, 0]}>
          <mesh position={[0, -0.12, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.2, 4, 10]} />
            <Mat c={limbC} />
          </mesh>
          <mesh position={[0, -0.26, 0.06]} scale={[1, 0.6, 1.4]} castShadow>
            <sphereGeometry args={[0.12, 10, 8]} />
            <Mat c="#2b2438" />
          </mesh>
        </group>

        {/* 身体 */}
        <Outlined geo={<capsuleGeometry args={[0.34, 0.34, 6, 16]} />} pos={[0, 0.72, 0]}>
          <Mat c={bodyC} />
        </Outlined>
        {/* 白色肚皮 */}
        <mesh position={[0, 0.66, 0.285]} scale={[1, 1.15, 0.35]}>
          <sphereGeometry args={[0.2, 16, 12]} />
          <Mat c={lerpColor(base, '#ffffff', 0.72)} />
        </mesh>

        {/* 手臂 */}
        <group ref={armL} position={[0.42, 1.0, 0]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.09, 0.3, 4, 10]} />
            <Mat c={limbC} />
          </mesh>
          <mesh position={[0, -0.5, 0]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <Mat c={headC} />
          </mesh>
        </group>
        <group ref={armR} position={[-0.42, 1.0, 0]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.09, 0.3, 4, 10]} />
            <Mat c={limbC} />
          </mesh>
          <mesh position={[0, -0.5, 0]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <Mat c={headC} />
          </mesh>
        </group>

        {/* 头 */}
        <group ref={headG} position={[0, 1.38, 0]}>
          <Outlined geo={<sphereGeometry args={[0.46, 28, 22]} />} pos={[0, 0.0, 0]}>
            <Mat c={headC} />
          </Outlined>
          <group ref={eyes} position={[0, 0.02, 0.4]}>
            {[-1, 1].map((sx) => (
              <group key={sx} position={[sx * 0.17, 0, 0]}>
                <mesh scale={[1, 1.25, 0.5]}>
                  <sphereGeometry args={[0.075, 12, 10]} />
                  <meshBasicMaterial color="#2b2438" />
                </mesh>
                <mesh position={[0.02, 0.04, 0.04]}>
                  <sphereGeometry args={[0.022, 8, 6]} />
                  <meshBasicMaterial color="#fff" />
                </mesh>
              </group>
            ))}
          </group>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.29, -0.1, 0.34]} scale={[1, 0.6, 0.3]}>
              <sphereGeometry args={[0.07, 10, 8]} />
              <meshBasicMaterial color="#ff8fa3" transparent opacity={0.75 * dim} />
            </mesh>
          ))}
          {/* 嘴 */}
          <mesh
            position={[0, -0.12, 0.43]}
            rotation={[0, 0, st === 'error' ? 0 : Math.PI]}
            scale={st === 'error' ? [1, 1, 1] : [1, 1, 1]}
          >
            <torusGeometry args={[0.05, 0.014, 6, 12, Math.PI]} />
            <meshBasicMaterial color="#2b2438" />
          </mesh>
          <Accessory kind={acc} color={base} accent={accent} />
        </group>
      </group>

      {/* 悬浮名牌 */}
      <Html position={[0, 2.55 + (st === 'collaborating' ? (seat % 2) * 1.0 : 0), 0]} center zIndexRange={[50, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`tag ${selected ? 'sel' : ''} st-${st}`} onClick={() => onSelect(agent.id)}>
          <Bubble status={st} partners={partnerNames} />
          <div className="plate" style={{ ['--c' as any]: agent.color }}>
            <span className="dot" style={{ background: meta.color }} />
            <b>{agent.name}</b>
                        {!offline && typeof agent.progress === 'number' && agent.status !== 'done' && (
              <span className="bar">
                <span style={{ width: `${Math.max(0, Math.min(100, agent.progress))}%`, background: agent.color }} />
              </span>
            )}
          </div>
        </div>
      </Html>
    </group>
  )
}

function Bubble({ status, partners }: { status: Agent['status']; partners: string[] }) {
  switch (status) {
    case 'thinking':
      return (
        <div className="bubble think">
          <span className="dots">
            <span />
            <span />
            <span />
          </span>
        </div>
      )
    case 'waiting':
      return <div className="bubble wait">!</div>
    case 'done':
      return <div className="bubble ok">✓</div>
    case 'error':
      return <div className="bubble err">✕</div>
    case 'collaborating':
      return <div className="bubble collab">{'⇄'}</div>
    case 'offline':
      return <div className="bubble off">z<small>z</small><small>z</small></div>
    default:
      return null
  }
}
