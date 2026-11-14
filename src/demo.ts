// 演示模式：在种子数据上随机推进状态，让办公室“活”起来（?demo=1）
import type { Agent, AgentStatus, Snapshot } from './types'

const TASKS: Record<string, string[]> = {
  office: ['调试等距相机', '优化角色动画', '检查 status.json 契约', '维护办公室灯光'],
  'class-arrangement': ['排布下周课表', '处理教室冲突', '同步老师可用时间'],
  teacher: ['准备课堂讲义', '批改作业', '整理学生反馈'],
  'signal-trader': ['生成明日信号', '回测策略', '盘后复盘'],
  'codex-cli': ['重构数据层', '修复单元测试', '代码评审'],
  botmail: ['整理收件箱', '起草回复', '归档邮件'],
  director: ['渲染分镜', '剪辑片段', '配乐与字幕'],
  'market-compare': ['抓取平台价格', '对比同款商品', '生成比价报告'],
  last30days: ['汇总近 30 天热点', '整理调研来源', '生成调研摘要'],
  'grokbot-market': ['编写市场周报', '采集行情', '更新看板'],
  grokbot: ['汇总各 bot 进度', '生成日报', '分派今日任务'],
}
const TOPICS = ['同步进度', '交叉验证数据', '讨论方案', '联合评审', '对齐今日计划']
const ERRORS = ['接口超时', '显存不足', '权限被拒绝', '解析失败']

const rnd = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(a: T[]) => a[rnd(a.length)]

export function startDemo(seed: Snapshot, onUpdate: (s: Snapshot) => void, tickMs = 3000): () => void {
  const s: Snapshot = structuredClone(seed)
  s.meta = { mock: true, note: '演示模式：数据由前端随机生成' }
  // 记录“到期自动切换”的时间
  const until = new Map<string, { at: number; next: AgentStatus }>()
  const now = () => Date.now()
  const iso = () => new Date().toISOString()
  const byId = (id: string) => s.agents.find((a) => a.id === id)!

  const log = (a: Agent, text: string) => {
    a.log = [{ time: iso(), text }, ...(a.log ?? [])].slice(0, 30)
  }
  const setStatus = (a: Agent, st: AgentStatus, task?: string) => {
    a.status = st
    if (task !== undefined) a.currentTask = task
    if (st !== 'collaborating') a.collaboratingWith = []
  }
  const endCollab = (a: Agent) => {
    s.collaborations = s.collaborations.filter((c) => c.from !== a.id && c.to !== a.id)
    for (const o of s.agents) o.collaboratingWith = (o.collaboratingWith ?? []).filter((x) => x !== a.id)
  }
  const planOf = (id: string) => s.plan.items.filter((i) => i.owner === id)

  const tick = () => {
    const t = now()
    // 1. 到期的状态切换
    for (const [id, u] of [...until]) {
      if (u.at <= t) {
        until.delete(id)
        const a = byId(id)
        if (a.status === 'collaborating') endCollab(a)
        const task = pick(TASKS[id] ?? ['处理任务'])
        setStatus(a, u.next, task)
        if (u.next === 'working') a.progress = Math.min(a.progress ?? 0, 60)
        log(a, a.status === 'error' ? '已恢复' : `开始：${task}`)
      }
    }
    // 2. 工作中的 bot 推进进度
    for (const a of s.agents) {
      if (a.status === 'working' || a.status === 'collaborating') {
        a.progress = Math.min(100, (a.progress ?? 0) + 2 + rnd(7))
        const items = planOf(a.id).filter((i) => i.status !== 'done')
        if (items.length) {
          const it = items[0]
          it.progress = Math.min(100, it.progress + 2 + rnd(6))
          it.status = it.progress >= 100 ? 'done' : 'doing'
        }
        if (a.progress >= 100 && a.status === 'working') {
          setStatus(a, 'done')
          log(a, `完成：${a.currentTask}`)
          until.set(a.id, { at: t + 9000 + rnd(6000), next: 'thinking' })
        }
      }
    }
    // 3. 随机事件
    const r = Math.random()
    const free = s.agents.filter((a) => !until.has(a.id) && a.status !== 'offline')
    if (r < 0.2 && free.length >= 2 && s.collaborations.length < 2) {
      // 两两协作
      const a = pick(free)
      const b = pick(free.filter((x) => x.id !== a.id))
      const topic = pick(TOPICS)
      for (const [x, y] of [[a, b], [b, a]] as const) {
        setStatus(x, 'collaborating', `和 ${y.name} ${topic}`)
        x.collaboratingWith = [y.id]
        log(x, `开始与 ${y.name} 协作：${topic}`)
        until.set(x.id, { at: t + 14000 + rnd(10000), next: 'working' })
      }
      s.collaborations.push({ from: a.id, to: b.id, topic, since: iso() })
    } else if (r < 0.34 && free.length) {
      const a = pick(free)
      setStatus(a, 'waiting', '等待确认：' + pick(['是否继续执行', '是否发布', '是否合并']))
      log(a, a.currentTask ?? '等待确认')
      until.set(a.id, { at: t + 8000 + rnd(5000), next: 'working' })
    } else if (r < 0.52 && free.length) {
      const a = pick(free)
      setStatus(a, 'thinking', '思考：' + pick(TASKS[a.id] ?? ['方案']))
      log(a, a.currentTask ?? '')
      until.set(a.id, { at: t + 6000 + rnd(5000), next: 'working' })
    } else if (r < 0.57 && free.length) {
      const a = pick(free)
      const e = pick(ERRORS)
      setStatus(a, 'error', `出错：${e}`)
      log(a, `错误：${e}`)
      until.set(a.id, { at: t + 8000 + rnd(4000), next: 'working' })
    } else if (r < 0.62) {
      // 离线 / 上线切换
      const a = pick(s.agents)
      if (a.status === 'offline') {
        setStatus(a, 'working', pick(TASKS[a.id] ?? ['处理任务']))
        a.progress = 5
        log(a, '已上线')
      } else if (!until.has(a.id) && a.id !== 'office') {
        if (a.status === 'collaborating') endCollab(a)
        setStatus(a, 'offline', '')
        log(a, '已离线')
      }
    }
    s.updatedAt = iso()
    onUpdate(structuredClone(s))
  }
  const h = setInterval(tick, tickMs)
  return () => clearInterval(h)
}
