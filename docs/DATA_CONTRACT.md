# 数据契约 · `status.json`

数字办公室是一栋**大楼**：一个分组 = 一层楼 = 一个**独立**的 `status.json`。前端是**纯展示**的：
只读「当前正在看的那一层」的 feed（每 10 秒轮询一次），其他楼层**完全不加载、不轮询**（见下文“按需加载”）。
任何 bot 只要能写自己所在楼层的 feed 文件（或让某个 HTTP 地址返回同样结构的 JSON），就能出现在那一层。

- 机器可读的 JSON Schema：[`status.schema.json`](./status.schema.json)（每层 feed）、[`floors.schema.json`](./floors.schema.json)（楼层配置）、[`building.schema.json`](./building.schema.json)（总览汇总）
- 示例：[`../public/floors.json`](../public/floors.json)、[`../public/floors/lobby/status.json`](../public/floors/lobby/status.json)、[`../public/building.json`](../public/building.json)
- 更新脚本：[`../scripts/update-status.mjs`](../scripts/update-status.mjs)

## 楼层配置 `floors.json`

文件位置 `public/floors.json`（部署后与 `index.html` 同目录），**随时可改**：增删楼层、改名、换层、把 bot 挪到别的楼层都只需要编辑配置/feed，无需改代码。

```jsonc
{
  "roaming": "./roaming.json",        // 可选：漫游 bot 文件（见下）
  "floors": [
    { "id": "competition", "name": "Competition", "order": 3, "feed": "./floors/competition/status.json", "theme": "sunset" },
    { "id": "class",       "name": "Class",       "order": 2, "feed": "./floors/class/status.json",       "theme": "mint"   },
    { "id": "lobby",       "name": "Lobby",       "order": 1, "feed": "./floors/lobby/status.json",       "theme": "warm", "default": true, "note": "Unassigned bots" }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `id` | 楼层 id（小写字母/数字/`-`/`_`），用于 `?floor=<id>` 与 `--floor <id>` |
| `name` | 楼层名称（界面是英文，建议用英文，如 `Competition`），显示在电梯面板、墙上招牌、顶栏 |
| `order` | 楼层号，数字越大越靠上；电梯面板从高到低排列，招牌默认显示 `${order}F` |
| `feed` | 该层独立的 status.json；相对路径按 floors.json 所在目录解析，也可以是绝对 URL（需 CORS） |
| `label` | 可选，覆盖楼层牌（默认 `4F`） |
| `theme` | 可选：`warm` 暖木 · `mint` 薄荷 · `night` 夜蓝石板 · `sunset` 暖红；省略时按顺序轮换 |
| `default` | 可选：默认进入的楼层，也是新 bot（未指定 `--floor`）的默认归属；都没标记时用最低的一层 |

**初始分组是估计值（请按需修改）**：3F Competition（competition、比赛）· 2F Class（排课、老师）· 1F Lobby / 未分组（Grok Bot、botmail、Director、last30days、debug、chat、window，以及原交易组的 Signal Trader、codex cli、grokbot market、market·比价助手）。暂时没有交易楼层；需要时在 floors.json 加一项并把对应 bot 挪过去即可。`office` 是漫游 bot，不属于任何固定楼层。

每层 feed 的结构与下文完全一致（可选地多一个 `"floor": "<id>"` 字段）。**一个 bot id 只应出现在一层**（id 在整栋楼内唯一）。
楼层大小随固定成员数自动变化：成员少 → 房间小、工位少（如 2 人的竞赛层是单排小房间，11 人的大厅是两排大房间）。漫游 bot 不占工位。
没有 `floors.json` 时退化为单层模式，读取 `./status.json`。

### 按需加载（不看就不耗）

- 启动时只读一次 `floors.json`（静态配置，不含 bot 数据），然后只请求**当前楼层**的 feed。
- 切换楼层：立即 `abort` 旧楼层在途请求并停止旧轮询，再开始新楼层的轮询；**不预取**其他楼层。
- 标签页隐藏（`visibilitychange`）时暂停轮询并中止在途请求，恢复可见时立即补拉一次。
- `?demo=1`：只拉取当前楼层一次作为种子，之后只在本地模拟当前楼层，不再发请求。
- 默认视图是**整栋楼**（3D 等距，每层一块悬浮托盘）。此视图**只读 `building.json`**（见下），不读任何楼层 feed、也不读 `roaming.json`；每 `?interval` 毫秒刷新，标签页隐藏时暂停。
- 点击某一层（或用右侧楼层条）→ 镜头缓动拉近（约 1.7 秒），上方楼层升起、下方楼层下沉，此时才开始只请求该层 feed + `roaming.json`，`building.json` 停止轮询。
- 点 `Exit floor` / 按 `Esc` → 镜头缓动拉远回到整栋楼（约 1.5 秒），楼层 feed 停止、`building.json` 恢复轮询。
- `building.json` 是静态汇总文件，读取它不会触发任何 bot 活动。

## 漫游 bot `roaming.json`

有些 bot（目前是 `office`，数字办公室的维护者）不属于某一层，而是**可以出现在任何一层**。它们记录在 `public/roaming.json`（路径由 `floors.json` 的 `roaming` 字段指定，省略则完全不读取）：

```jsonc
{
  "updatedAt": "2026-11-14T21:35:00+08:00",
  "roamers": [
    { "id": "office", "name": "office", "role": "Digital Engineer", "color": "#ff8a3d",
      "currentFloor": "lobby",                        // 现在在哪一层（floors.json 里的 id）
      "status": "working", "currentTask": "…", "progress": 72, "collaboratingWith": [], "log": [ … ],
      "plan": [ { "id": "o1", "title": "…", "owner": "office", "status": "doing", "progress": 72 } ] }
  ],
  "collaborations": []                                // 可选：漫游 bot 与楼层成员的协作
}
```

- 字段与普通 agent 相同，另有 `currentFloor`（必填）和 `plan`（该 bot 自己的今日计划项，只在详情面板显示，**不计入任何楼层的完成度**），没有 `desk`。
- 前端**只在读取当前楼层 feed 的同时**顺带读一次这个很小的文件（同一个轮询周期，同样受“楼层切换即中止 / 标签页隐藏即暂停”的约束），所以不会为未查看的楼层产生任何额外请求。
- 只有 `currentFloor` 等于当前楼层的漫游 bot 才会出现在场景里：在白板前书写、沿过道巡视；协作时走到会议桌旁；其余状态停在白板旁。头顶名牌带 `Roaming` 标记。
- 整栋楼视图里，漫游 bot 当前所在楼层的标牌/列表会显示它的小标签（如 `office`），数据来自 `building.json` 的 `roamers`；进入楼层后以 `roaming.json` 为准。
- 移动它：`node scripts/update-status.mjs --id office --floor class`（`--floor` 对漫游 bot 的含义是“移动到那一层”）。新建漫游 bot：加 `--roamer`。

### 整栋楼视图 `building.json`

极小的汇总文件，每层一条，足够画出整栋楼（每层的完成度、人数，以及每个 bot 的状态色圆点），而不必加载各层 feed：

```jsonc
{ "updatedAt": "2026-11-14T21:19:47+08:00",
  "meta": { "mock": true },                              // 可选：示例数据标记
  "roamers": [ { "id": "office", "floor": "lobby", "name": "office", "color": "#ff8a3d", "status": "working" } ],
  "floors": [ { "id": "class", "completion": 61, "agents": 2,
                "items": { "done": 2, "total": 5 },
                "counts": { "thinking": 1, "collaborating": 1 },
                "members": [ { "id": "class-arrangement", "name": "class arrangement", "color": "#…", "status": "thinking", "desk": 0 } ],
                "updatedAt": "…" } ] }
```

`scripts/update-status.mjs` 每次更新任一楼层后会自动重建它；也可以手动 `node scripts/update-status.mjs --sync-building`。

## 界面语言

界面（标题、标签、状态名、面板标题、楼层名、墙上招牌、图例、按钮、日期格式）全部为**英文**；**任务文本、计划项、当前任务、活动日志、协作主题保持中文**（由 bot 写入什么就显示什么）。bot 的 `name` 原样显示；`role` 字段会原样显示，示例数据用英文。

## URL 参数

| 参数 | 说明 |
| --- | --- |
| `?floor=<id>` | 打开时进入的楼层（默认：`default` 楼层）。切换楼层时地址栏会同步更新 |
| `?floors=<url>` | 指定楼层配置地址，默认 `./floors.json` |
| `?feed=<url>` | 覆盖**当前楼层**的 feed 地址（调试用） |
| `?interval=<ms>` | 轮询间隔，默认 10000，最小 2000 |
| `?demo=1` | 演示模式：只模拟当前楼层，用本地模拟器在示例数据上随机切换状态 |
| `?select=<agentId>` | 打开页面时自动选中某个 bot（打开侧边详情） |

读取失败时：保留上一次成功的数据；如果该楼层从未成功过，则显示空楼层并提示“未连接该楼层的 status.json”。
键盘：`↑` / `↓` 切换楼层，`Esc` 取消选中。

## 顶层结构

```jsonc
{
  "updatedAt": "2026-11-14T20:45:00+08:00",   // 必填，ISO 8601，建议带时区
  "meta": { "mock": true, "note": "…" },       // 可选；mock=true 时顶栏显示“示例数据”
  "plan": {
    "date": "2026-11-14",                      // 今日日期 YYYY-MM-DD
    "items": [ /* PlanItem */ ]
  },
  "agents": [ /* Agent */ ],
  "collaborations": [ /* Collaboration */ ]
}
```

### Agent

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一 id（小写字母/数字/`-`/`_`），被 plan 与 collaborations 引用 |
| `name` | string | 名牌上显示的名字 |
| `role` | string | 角色/职责（如“数字工程师”） |
| `color` | `#rrggbb` | 角色主色 |
| `desk` | integer | 工位顺序（该层内按数值排序后依次分配工位，冲突/空缺自动顺延；房间大小由该层成员数决定） |
| `status` | enum | `working` 工作中 · `thinking` 思考中 · `collaborating` 协作中 · `waiting` 等待确认 · `done` 已完成 · `error` 出错 · `offline` 离线 |
| `currentTask` | string? | 当前任务描述 |
| `progress` | 0–100? | 当前任务进度 |
| `collaboratingWith` | string[]? | 正在协作的 agent id |
| `log` | `{time,text}[]`? | 最近活动，**最新在前**，前端展示最近 12 条 |

各状态在 3D 办公室里的表现：

| status | 角色表现 |
| --- | --- |
| working | 坐在工位敲键盘，笔记本亮屏 |
| thinking | 托腮、头顶“…”气泡 |
| collaborating | 起身走到会议桌入座，与协作对象之间出现流动虚线 |
| waiting | 举手挥动，头顶橙色“!” |
| done | 举双手欢呼，头顶绿色“✓” |
| error | 抱头抖动，头顶红色“✕” |
| offline | 角色变灰、趴下，台灯与屏幕熄灭，头顶“zzz” |

### PlanItem（今日计划项）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一 id |
| `title` | string | 事项标题 |
| `owner` | string | 负责的 `agent.id` |
| `status` | enum | `todo` · `doing` · `done` · `blocked` |
| `progress` | 0–100 | 进度（`status=done` 时一律按 100 计算） |

**总完成度** = 所有计划项进度（done 记 100）的算术平均，由前端计算，顶栏与墙上白板共用。

### Collaboration

| 字段 | 说明 |
| --- | --- |
| `from` / `to` | 两个 `agent.id` |
| `topic` | 协作主题，显示在连线标签与“协作动态”里 |
| `since` | 开始时间（ISO 8601） |

前端会把 `collaborations[]` 与各 agent 的 `collaboratingWith[]` 合并去重后画线；任一方 `offline` 时不画。
只有 `status = collaborating` 的 bot 会走到会议桌。

## 让 bot 自己更新

`--floor <id>` 指定写哪一层；不写时脚本会在所有楼层里按 bot id 查找，找不到（新 bot）就放进 `default` 楼层。新 bot 会在其所在楼层内自动分配工位。

```bash
# 指定楼层（新 bot 首次上线时自动在该层创建并分配工位）
node scripts/update-status.mjs --floor lobby --id new-bot --name "新 bot" --role "Trading" --color "#12b886" --status working

# 开始工作
node scripts/update-status.mjs --id botmail --status working --task "整理收件箱" --progress 10 --log "开始处理"
# 进度推进 + 更新计划项
node scripts/update-status.mjs --id botmail --progress 60 --plan-item p10:60
# 与同事协作（自动写入 collaborations）
node scripts/update-status.mjs --id teacher --with class-arrangement --topic "周三课程调整"
# 等待 Jason 确认
node scripts/update-status.mjs --id codex-cli --status waiting --task "是否合并分支？"
# 完成
node scripts/update-status.mjs --id botmail --status done --progress 100 --plan-item p10:100:done --log "全部处理完毕"
# 新 bot 首次上线（自动创建并分配工位）
node scripts/update-status.mjs --id newbot --name "新 bot" --role "测试" --color "#ff8a3d" --status working
```

- 默认读写 `public/floors.json` 指向的各层 feed；部署后用 `--floors dist/floors.json`（或环境变量 `FLOORS_FILE`）指向部署目录里的配置。`--file` 可直接指定某个 feed 文件。
- 同一个 bot id 出现在另一层时会报错（避免重复），请显式 `--floor`。
- 每次写入后自动同步 `building.json`（可用 `--building` 指定路径）。
- 写入是原子的（临时文件 + rename），前端不会读到半个文件。
- 一旦有真实写入，会自动移除 `meta.mock`。
- 多个 bot 同时写同一文件有极小概率互相覆盖；上线真实 bot 后建议改为“每 bot 一个 HTTP 上报接口 → 服务端合并”，契约保持不变。

## 版本与兼容

当前为 v1（无显式版本字段）。新增字段时前端会忽略未知字段；缺失的可选字段会使用默认值，不会崩溃。
