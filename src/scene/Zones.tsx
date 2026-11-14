import { useMemo } from 'react'
import * as THREE from 'three'
import { Ball, Box, Cyl, Mug, Plant, Sofa } from './Furniture'
import { lerpColor } from './Character'
import type { Layout } from './layout'
import type { Theme } from './themes'

/** 落地灯：细杆 + 发光灯罩 */
function FloorLamp({ x, z, c = '#fff0cf' }: { x: number; z: number; c?: string }) {
  return (
    <group position={[x, 0, z]}>
      <Cyl p={[0, 0.04, 0]} r={0.3} h={0.08} c="#4a4458" />
      <Cyl p={[0, 0.9, 0]} r={0.035} h={1.8} c="#5a5468" />
      <mesh position={[0, 1.95, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.34, 0.5, 18, 1, true]} />
        <meshStandardMaterial color={c} emissive="#ffd9a0" emissiveIntensity={0.9} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.12, 12, 10]} />
        <meshBasicMaterial color="#fff2d0" toneMapped={false} />
      </mesh>
    </group>
  )
}

function Stool({ x, z, c }: { x: number; z: number; c: string }) {
  return (
    <group position={[x, 0, z]}>
      <Cyl p={[0, 0.3, 0]} r={0.05} h={0.6} c="#6b6475" />
      <Cyl p={[0, 0.62, 0]} r={0.26} h={0.1} c={c} />
      <Cyl p={[0, 0.04, 0]} r={0.24} h={0.06} c="#5a5468" />
    </group>
  )
}

/** 长条花箱：矮箱体 + 一排圆润的灌木 */
function PlanterBox({ x, z, len = 3, rotY = 0, flowers }: { x: number; z: number; len?: number; rotY?: number; flowers?: boolean }) {
  const n = Math.max(2, Math.round(len / 0.8))
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]}>
      <Box p={[0, 0.3, 0]} s={[len, 0.6, 0.7]} c="#e7ddcc" r={0.1} />
      <Box p={[0, 0.58, 0]} s={[len - 0.12, 0.06, 0.58]} c="#6b4a35" r={0.02} shadow={false} />
      {Array.from({ length: n }).map((_, i) => {
        const px = -len / 2 + (len / n) * (i + 0.5)
        const c = ['#5fc17f', '#4caf6a', '#7fcf8e', '#3f9d5d'][i % 4]
        return (
          <group key={i}>
            <Ball p={[px, 0.85 + (i % 2) * 0.08, 0]} r={0.34 + (i % 3) * 0.04} c={c} />
            {flowers && <Ball p={[px + 0.12, 1.15, 0.08]} r={0.09} c={['#ff9eb5', '#ffd166', '#ffffff'][i % 3]} />}
          </group>
        )
      })}
    </group>
  )
}

/** 室内小树：粗一点的盆 + 树干 + 蓬松树冠 */
function IndoorTree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <Cyl p={[0, 0.35, 0]} r={0.45} rt={0.52} h={0.7} c="#f1e6d3" />
      <Cyl p={[0, 0.7, 0]} r={0.46} h={0.04} c="#6b4a35" />
      <Cyl p={[0, 1.5, 0]} r={0.07} rt={0.05} h={1.6} c="#a77d58" />
      <Ball p={[0, 2.35, 0]} r={0.8} c="#6fbf7a" sc={[1, 0.9, 1]} />
      <Ball p={[0.45, 2.0, 0.2]} r={0.5} c="#8fd08a" />
      <Ball p={[-0.42, 2.1, -0.15]} r={0.52} c="#58b36e" />
      <Ball p={[0.1, 2.75, -0.2]} r={0.42} c="#9bd994" />
    </group>
  )
}

function CoffeeTable({ x, z, top = '#f0d3a2' }: { x: number; z: number; top?: string }) {
  return (
    <group position={[x, 0, z]}>
      <Cyl p={[0, 0.2, 0]} r={0.12} h={0.4} c="#c99562" />
      <Cyl p={[0, 0.43, 0]} r={0.85} h={0.08} c={top} />
      <Mug x={0.3} z={0.1} c="#ffffff" />
      <Mug x={-0.35} z={-0.2} c="#74c0fc" />
      <Box p={[0.0, 0.5, 0.35]} s={[0.55, 0.05, 0.4]} c="#ef7a7a" r={0.02} rot={[0, 0.4, 0]} shadow={false} />
    </group>
  )
}

/** 茶水岛台：长台面 + 咖啡机 + 水果碗 + 两侧高脚凳 */
function PantryIsland({ x, z, accent }: { x: number; z: number; accent: string }) {
  return (
    <group position={[x, 0, z]}>
      <Box p={[0, 0.5, 0]} s={[3.8, 1.0, 1.0]} c="#f1d9b5" />
      <Box p={[0, 1.04, 0]} s={[4.0, 0.08, 1.15]} c="#c99562" r={0.03} />
      <Box p={[0, 0.5, 0.52]} s={[3.6, 0.7, 0.04]} c={accent} r={0.01} shadow={false} />
      <Box p={[-1.2, 1.4, -0.1]} s={[0.55, 0.62, 0.45]} c="#e5484d" r={0.07} />
      <Box p={[-1.2, 1.62, 0.13]} s={[0.4, 0.14, 0.02]} c="#2b2f36" r={0.01} shadow={false} />
      <Mug x={-0.5} z={0.1} c="#ffffff" />
      <Mug x={-0.2} z={-0.05} c="#ffb454" />
      <Cyl p={[0.9, 1.15, 0]} r={0.3} rt={0.38} h={0.18} c="#f3b25a" />
      <Ball p={[0.82, 1.3, 0.04]} r={0.13} c="#ff6b6b" />
      <Ball p={[0.98, 1.3, -0.06]} r={0.12} c="#a9d86e" />
      <Ball p={[0.92, 1.33, 0.1]} r={0.12} c="#ffd166" />
      {[-1.3, 0, 1.3].map((sx) => (
        <Stool key={sx} x={sx} z={1.05} c={lerpColor(accent, '#ffffff', 0.2)} />
      ))}
    </group>
  )
}

/**
 * 楼层的“生活区”：根据 layout 剩余的空地自动布置。
 * - full（工位占满）：保持原来的小休息角（沙发 + 小圆毯 + 绿植）
 * - 否则：工位群底下铺一块地毯；前方空地布置 休息区（L 形沙发 + 扶手椅 + 茶几 + 落地灯 + 地毯）+ 茶水岛台 + 花箱 + 室内小树，再点缀几盆不同的绿植。
 */
export function Zones({ layout, theme }: { layout: Layout; theme: Theme }) {
  const { w, d } = layout.room
  const sofaMain = theme.chair
  const sofaDark = useMemo(() => lerpColor(theme.chair, '#000000', 0.14), [theme.chair])
  const sofaLight = useMemo(() => lerpColor(theme.chair, '#ffffff', 0.35), [theme.chair])
  if (layout.full) {
    return (
      <group>
        <Plant x={-w / 2 + 0.9} z={-d / 2 + 0.8} s={1.0} />
        <Plant x={w / 2 - 0.8} z={layout.aisleZ + 0.9} s={1.05} c="#3f9d5d" />
        <Sofa x={-w / 2 + 1.0} z={d / 2 - 1.3} rotY={Math.PI / 2} />
        <Cyl p={[-w / 2 + 2.5, 0.3, d / 2 - 1.3]} r={0.5} h={0.12} c="#fff1d6" />
        <Cyl p={[-w / 2 + 2.5, 0.15, d / 2 - 1.3]} r={0.08} h={0.3} c="#c99562" />
        <Mug x={-w / 2 + 2.5} z={d / 2 - 1.4} c="#ff7a7a" />
        <Box p={[-w / 2 + 2.5, 0.04, d / 2 - 1.3]} s={[2.2, 0.04, 2.2]} c="#ffd7a8" r={0.02} shadow={false} />
      </group>
    )
  }
  const zF = layout.freeFront
  const fd = d / 2 - zF // 前方空地进深
  const zc = zF + fd / 2
  const wide = fd >= 3.3
  const cx = layout.clusterX
  const rugW = layout.perRow * 3 + 1.6
  const rugD = layout.rows * 3.7 + 0.2
  const rowMid = -d / 2 + 2.4 + ((layout.rows - 1) * 3.7) / 2
  return (
    <group>
      {/* 工位群地毯 */}
      <mesh position={[cx, 0.012, rowMid + 0.1]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[rugW, rugD]} />
        <meshStandardMaterial color={lerpColor(theme.rug, '#ffffff', 0.55)} roughness={1} />
      </mesh>
      {/* 后墙角绿植 */}
      <Plant x={-w / 2 + 0.9} z={-d / 2 + 0.8} s={1.0} />
      <Plant x={cx - (layout.perRow * 3) / 2 - 1.3} z={-d / 2 + 0.9} s={0.8} c="#3f9d5d" />
      <Plant x={w / 2 - 0.8} z={layout.aisleZ + 0.9} s={0.95} c="#3f9d5d" />

      {wide ? (
        <>
          {/* 休息区 */}
          <mesh position={[-w / 2 + 5.0, 0.012, zc]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[7.4, Math.min(fd - 0.3, 4.6)]} />
            <meshStandardMaterial color="#f3cfa0" roughness={1} />
          </mesh>
          <mesh position={[-w / 2 + 5.0, 0.016, zc]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[6.8, Math.min(fd - 0.9, 4.0)]} />
            <meshStandardMaterial color="#ffe3bf" roughness={1} />
          </mesh>
          <Sofa x={-w / 2 + 1.0} z={zc + 0.1} rotY={Math.PI / 2} />
          <Sofa x={-w / 2 + 5.0} z={zc - fd / 2 + 1.0} rotY={0} c1={sofaMain} c2={sofaDark} c3={sofaLight} pillow="#fff0b3" />
          <Sofa x={-w / 2 + 8.6} z={zc + 0.2} rotY={-Math.PI / 2} scale={0.62} c1={sofaMain} c2={sofaDark} c3={sofaLight} pillow="#ffe066" />
          <CoffeeTable x={-w / 2 + 4.7} z={zc + 0.5} />
          <FloorLamp x={-w / 2 + 0.8} z={zc - fd / 2 + 0.6} />
          <Plant x={-w / 2 + 9.3} z={zc + 1.5} s={0.85} c="#5fc17f" />
          {/* 茶水岛台 */}
          <PantryIsland x={w / 2 - 3.6} z={zc - 0.4} accent={theme.accent} />
          {/* 花箱 + 室内小树 */}
          <IndoorTree x={w / 2 - 1.0} z={d / 2 - 0.9} s={0.9} />
          <PlanterBox x={1.8} z={d / 2 - 0.55} len={3.6} />
        </>
      ) : (
        <>
          <Sofa x={-w / 2 + 1.0} z={d / 2 - 1.3} rotY={Math.PI / 2} />
          <CoffeeTable x={-w / 2 + 3.2} z={d / 2 - 1.3} />
          <FloorLamp x={-w / 2 + 0.8} z={d / 2 - 3.4} />
          <PlanterBox x={w / 2 - 0.55} z={d / 2 - 2.8} len={3} rotY={Math.PI / 2} flowers />
          <IndoorTree x={w / 2 - 1.0} z={d / 2 - 0.9} s={0.85} />
        </>
      )}
    </group>
  )
}
