#!/usr/bin/env node
/**
 * 让 bot 更新自己在 status.json 里的条目（原子写入）。
 *
 * 用法示例：
 *   node scripts/update-status.mjs --floor lobby --id botmail --status working \
 *        --task "整理收件箱" --progress 40 --log "开始处理 23 封未读邮件"
 *   node scripts/update-status.mjs --id teacher --status collaborating --with class-arrangement --topic "周三课程调整"
 *   node scripts/update-status.mjs --id botmail --status done --progress 100 --plan-item p10:100:done
 *   node scripts/update-status.mjs --id newbot --name "新 bot" --role "测试" --color "#ff8a3d" --status working   # 自动创建
 *   node scripts/update-status.mjs --id botmail --json '{"currentTask":"…","progress":50}'                       # 直接合并字段
 *
 * 选项：
 *   --floor <floorId>    楼层 id（见 public/floors.json）。省略时：在所有楼层里按 agent id 查找；
 *                        新 bot 且未指定 --floor → 放进标记 default 的楼层（默认大厅）
 *   --floors <path>      floors.json 路径（默认 public/floors.json，或环境变量 FLOORS_FILE）
 *   --file <path>        直接指定某个 status.json（覆盖楼层解析；环境变量 STATUS_FILE）
 *   --sync-building      只重建 building.json 汇总（不需要 --id）；每次更新楼层后也会自动同步
 *   --building <path>    building.json 路径（默认与 floors.json 同目录）
 *   --roamer             新建漫游 bot（不属于固定楼层，可去任何一层；见 public/roaming.json）
 *   --id <agentId>       必填（除非 --sync-building）。如果 id 是漫游 bot（如 office），
 *                        则 --floor 的含义是“把它移动到该楼层”（写 roaming.json 的 currentFloor）
 *   --status <s>         working|thinking|collaborating|waiting|done|error|offline
 *   --task <text>        currentTask
 *   --progress <0-100>   当前任务进度
 *   --log <text>         追加一条日志（可重复；最新在前，最多保留 50 条）
 *   --with a,b           协作对象 id（会同步写入 collaborations）
 *   --topic <text>       协作主题
 *   --clear-collab       清除该 bot 的所有协作
 *   --plan-item id:progress[:status]   更新今日计划项（可重复）
 *   --add-plan id:title[:progress]     为该 bot 新增计划项
 *   --plan-date YYYY-MM-DD             设置计划日期（换日时会清空旧计划项，需配合 --reset-plan）
 *   --reset-plan                        清空计划项
 *   --name/--role/--color/--desk       创建或修改基础资料
 *   --json '<obj>'       合并到 agent 对象
 *   --dry-run            只打印，不写文件
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const STATUSES = ['working', 'thinking', 'collaborating', 'waiting', 'done', 'error', 'offline']
const PLAN_STATUSES = ['todo', 'doing', 'done', 'blocked']

function parseArgs(argv) {
  const o = { log: [], planItem: [], addPlan: [] }
  const bool = new Set(['clear-collab', 'dry-run', 'reset-plan', 'help', 'sync-building', 'roamer'])
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const k = a.slice(2)
    if (bool.has(k)) {
      o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = true
      continue
    }
    const v = argv[++i]
    if (v === undefined) fail(`参数 --${k} 缺少值`)
    if (k === 'log') o.log.push(v)
    else if (k === 'plan-item') o.planItem.push(v)
    else if (k === 'add-plan') o.addPlan.push(v)
    else o[k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v
  }
  return o
}

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

const o = parseArgs(process.argv.slice(2))
if (o.help || (!o.id && !o.syncBuilding)) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace('#!/usr/bin/env node\n', ''))
  process.exit(o.help ? 0 : 1)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(here, '..', 'public')
const floorsFile = path.resolve(o.floors || process.env.FLOORS_FILE || path.join(publicDir, 'floors.json'))
const buildingFile = path.resolve(o.building || path.join(path.dirname(floorsFile), 'building.json'))
const roamingRel = readJsonSafe(floorsFile)?.roaming || './roaming.json'
const roamingFile = path.resolve(path.dirname(floorsFile), roamingRel)
const now = new Date()
const iso = (d) => {
  // 带本地时区偏移的 ISO 8601
  const pad = (n) => String(n).padStart(2, '0')
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? '+' : '-'
  const oh = pad(Math.floor(Math.abs(off) / 60))
  const om = pad(Math.abs(off) % 60)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${oh}:${om}`
}
const today = iso(now).slice(0, 10)

function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(tmp, text)
  fs.renameSync(tmp, file)
}
function readJsonSafe(file) {
  return readJson(file)
}
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

// ---- 楼层配置 ----
const floorsCfg = fs.existsSync(floorsFile) ? readJson(floorsFile) : null
const floorList = (floorsCfg?.floors ?? []).slice().sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
const feedPath = (f) => path.resolve(path.dirname(floorsFile), f.feed)
const isUrl = (x) => /^https?:\/\//.test(x)

function summarizeAll() {
  const out = { updatedAt: iso(now), floors: [] }
  for (const f of floorList) {
    if (isUrl(f.feed)) continue
    const d = fs.existsSync(feedPath(f)) ? readJson(feedPath(f)) : null
    const items = d?.plan?.items ?? []
    const completion = items.length ? Math.round(items.reduce((a, i) => a + (i.status === 'done' ? 100 : Math.max(0, Math.min(100, Number(i.progress) || 0))), 0) / items.length) : 0
    const counts = {}
    for (const a of d?.agents ?? []) counts[a.status] = (counts[a.status] ?? 0) + 1
    out.floors.push({ id: f.id, completion, agents: (d?.agents ?? []).length, counts, updatedAt: d?.updatedAt ?? null })
  }
  const roam = fs.existsSync(roamingFile) ? readJson(roamingFile) : null
  out.roamers = (roam?.roamers ?? []).map((r) => ({ id: r.id, floor: r.currentFloor }))
  return out
}
function syncBuilding() {
  if (!floorList.length) return
  if (o.dryRun) return
  writeAtomic(buildingFile, JSON.stringify(summarizeAll(), null, 2) + '\n')
  console.log(`✓ building.json 已同步 ${buildingFile}`)
}

if (o.syncBuilding && !o.id) {
  if (!floorList.length) fail(`找不到楼层配置 ${floorsFile}`)
  syncBuilding()
  process.exit(0)
}

// ---- 漫游 bot（roaming.json）----
const roamData = fs.existsSync(roamingFile) ? readJson(roamingFile) : null
const isRoamer = !!o.roamer || !!roamData?.roamers?.some((r) => r.id === o.id)

// ---- 解析目标 feed 文件 ----
let file
let floorDef = null
if (isRoamer) {
  if (!floorList.length) fail(`漫游 bot 需要楼层配置 ${floorsFile}`)
  file = roamingFile
  if (o.floor && !floorList.some((f) => f.id === o.floor)) fail(`没有这个楼层: ${o.floor}（可用：${floorList.map((f) => f.id).join(', ')}）`)
  if (floorList.some((f) => !isUrl(f.feed) && fs.existsSync(feedPath(f)) && (readJson(feedPath(f))?.agents ?? []).some((a) => a.id === o.id))) fail(`${o.id} 已是某个楼层的固定成员，不能同时作为漫游 bot`)
} else if (o.file || process.env.STATUS_FILE) {
  file = path.resolve(o.file || process.env.STATUS_FILE)
  floorDef = o.floor ? floorList.find((f) => f.id === o.floor) ?? null : null
} else if (floorList.length) {
  if (o.floor) {
    floorDef = floorList.find((f) => f.id === o.floor)
    if (!floorDef) fail(`没有这个楼层: ${o.floor}（可用：${floorList.map((f) => f.id).join(', ')}）`)
  } else {
    // 在所有楼层里找这个 bot
    for (const f of floorList) {
      if (isUrl(f.feed) || !fs.existsSync(feedPath(f))) continue
      if ((readJson(feedPath(f))?.agents ?? []).some((a) => a.id === o.id)) {
        floorDef = f
        break
      }
    }
    if (!floorDef) {
      floorDef = floorList.find((f) => f.default) ?? floorList[floorList.length - 1]
      console.log(`ℹ 未指定 --floor 且 ${o.id} 尚不存在，放入默认楼层 ${floorDef.id}`)
    }
  }
  if (isUrl(floorDef.feed)) fail(`楼层 ${floorDef.id} 的 feed 是远程地址，脚本只能写本地文件`)
  file = feedPath(floorDef)
  // 同一个 id 不允许出现在两层
  for (const f of floorList) {
    if (f.id === floorDef.id || isUrl(f.feed) || !fs.existsSync(feedPath(f))) continue
    if ((readJson(feedPath(f))?.agents ?? []).some((a) => a.id === o.id)) fail(`${o.id} 已经在楼层 ${f.id} 中，请用 --floor ${f.id}（或先从那里移除）`)
  }
} else {
  file = path.join(publicDir, 'status.json') // 兼容旧的单层模式
}

let data
if (isRoamer) {
  data = roamData ?? { updatedAt: iso(now), roamers: [], collaborations: [] }
  data.roamers ??= []
  data.agents = data.roamers // 别名：复用下面通用的更新逻辑
} else if (fs.existsSync(file)) {
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    fail(`无法解析 ${file}: ${e.message}`)
  }
} else {
  data = { updatedAt: iso(now), plan: { date: today, items: [] }, agents: [], collaborations: [] }
}
if (floorDef && !isRoamer) data.floor = floorDef.id
data.plan ??= { date: today, items: [] }
data.plan.items ??= []
data.agents ??= []
data.collaborations ??= []

if (o.planDate) data.plan.date = o.planDate
if (o.resetPlan) data.plan.items = []

let agent = data.agents.find((a) => a.id === o.id)
if (!agent) {
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(o.id)) fail('新建 agent 时 id 只能包含小写字母/数字/-/_')
  const used = new Set(data.agents.map((a) => a.desk))
  let desk = 0
  while (used.has(desk)) desk++
  agent = {
    id: o.id,
    name: o.name || o.id,
    role: o.role || '',
    color: o.color || '#4dabf7',
    desk: o.desk !== undefined ? Number(o.desk) : desk,
    status: 'offline',
    currentTask: '',
    progress: 0,
    collaboratingWith: [],
    log: [],
  }
  if (isRoamer) {
    delete agent.desk
    agent.currentFloor = o.floor || (floorList.find((f) => f.default) ?? floorList[floorList.length - 1]).id
    agent.plan = []
  }
  data.agents.push(agent)
  console.log(isRoamer ? `+ 新建漫游 agent: ${o.id}（所在楼层 ${agent.currentFloor}）` : `+ 新建 agent: ${o.id}（工位 ${agent.desk}）`)
}
if (isRoamer) {
  agent.plan ??= []
  data.plan = { date: today, items: agent.plan } // 漫游 bot 的计划项存在它自己条目里
  if (o.floor && agent.currentFloor !== o.floor) {
    console.log(`→ ${agent.id} 从 ${agent.currentFloor ?? '?'} 移动到 ${o.floor}`)
    agent.currentFloor = o.floor
  }
}

if (o.json) {
  try {
    Object.assign(agent, JSON.parse(o.json))
  } catch (e) {
    fail(`--json 不是合法 JSON: ${e.message}`)
  }
}
for (const k of ['name', 'role', 'color']) if (o[k] !== undefined) agent[k] = o[k]
if (o.desk !== undefined) agent.desk = Number(o.desk)
if (o.status !== undefined) {
  if (!STATUSES.includes(o.status)) fail(`status 必须是 ${STATUSES.join('|')}`)
  agent.status = o.status
}
if (o.task !== undefined) agent.currentTask = o.task
if (o.progress !== undefined) {
  const p = Number(o.progress)
  if (!Number.isFinite(p)) fail('--progress 必须是数字')
  agent.progress = Math.max(0, Math.min(100, p))
}
// 日志（先传入的在前面显示，最终整体最新在前）
agent.log ??= []
for (const text of [...o.log].reverse()) agent.log.unshift({ time: iso(now), text })
agent.log = agent.log.slice(0, 50)

// 协作
const dropCollabs = () => {
  data.collaborations = data.collaborations.filter((c) => c.from !== agent.id && c.to !== agent.id)
  for (const a of data.agents) a.collaboratingWith = (a.collaboratingWith ?? []).filter((x) => x !== agent.id)
  agent.collaboratingWith = []
}
if (o.clearCollab) dropCollabs()
if (o.with) {
  const ids = o.with.split(',').map((s) => s.trim()).filter(Boolean)
  const known = new Set(data.agents.map((a) => a.id))
  if (isRoamer) for (const f of floorList) if (!isUrl(f.feed) && fs.existsSync(feedPath(f))) for (const a of readJson(feedPath(f))?.agents ?? []) known.add(a.id)
  for (const id of ids) if (!known.has(id)) fail(`协作对象不存在: ${id}`)
  dropCollabs()
  agent.collaboratingWith = ids
  for (const id of ids) data.collaborations.push({ from: agent.id, to: id, topic: o.topic || agent.currentTask || '', since: iso(now) })
  if (o.status === undefined) agent.status = 'collaborating'
}
if (o.status !== undefined && o.status !== 'collaborating' && !o.with) {
  // 不再处于协作状态：清理连线
  if ((agent.collaboratingWith ?? []).length || data.collaborations.some((c) => c.from === agent.id || c.to === agent.id)) dropCollabs()
}

// 计划项
for (const spec of o.addPlan) {
  const [id, title, progress = '0'] = spec.split(':')
  if (!id || !title) fail(`--add-plan 格式应为 id:title[:progress]，收到 ${spec}`)
  if (data.plan.items.some((i) => i.id === id)) fail(`计划项已存在: ${id}`)
  data.plan.items.push({ id, title, owner: agent.id, status: Number(progress) >= 100 ? 'done' : 'todo', progress: Number(progress) })
}
for (const spec of o.planItem) {
  const [id, progress, status] = spec.split(':')
  const it = data.plan.items.find((i) => i.id === id)
  if (!it) fail(`计划项不存在: ${id}`)
  if (progress !== undefined && progress !== '') it.progress = Math.max(0, Math.min(100, Number(progress)))
  if (status) {
    if (!PLAN_STATUSES.includes(status)) fail(`计划项状态必须是 ${PLAN_STATUSES.join('|')}`)
    it.status = status
  } else if (it.progress >= 100) it.status = 'done'
  else if (it.progress > 0 && (it.status === 'todo' || it.status === 'done')) it.status = 'doing'
}

if (data.meta?.mock) delete data.meta.mock // 一旦有真实写入，就不再是示例数据
if (data.meta && Object.keys(data.meta).length === 0) delete data.meta
data.updatedAt = iso(now)

let outObj = data
if (isRoamer) {
  const { agents: _a, plan: _p, ...rest } = data
  outObj = rest
}
const out = JSON.stringify(outObj, null, 2) + '\n'
if (o.dryRun) {
  console.log(out)
  process.exit(0)
}
writeAtomic(file, out)
console.log(`✓ ${agent.id}${isRoamer ? `@${agent.currentFloor}(roaming)` : floorDef ? `@${floorDef.id}` : ''} → ${agent.status}${agent.currentTask ? `「${agent.currentTask}」` : ''} 已写入 ${file}`)
if (floorDef || isRoamer) syncBuilding()
