# 数据契约 · `status.json`

数字办公室是**纯展示**的前端：它只读一个 JSON 文件（默认 `./status.json`，与 `index.html` 同目录），
每 10 秒轮询一次。任何 bot 只要能写这个文件（或让某个 HTTP 地址返回同样结构的 JSON），就能出现在办公室里。

- 机器可读的 JSON Schema：[`status.schema.json`](./status.schema.json)
- 示例：[`../public/status.json`](../public/status.json)
- 更新脚本：[`../scripts/update-status.mjs`](../scripts/update-status.mjs)

## URL 参数

| 参数 | 说明 |
| --- | --- |
| `?feed=<url>` | 指定数据地址（相对/绝对 URL，需允许 CORS），默认 `./status.json` |
| `?interval=<ms>` | 轮询间隔，默认 10000，最小 2000 |
| `?demo=1` | 演示模式：忽略 feed，用本地模拟器在示例数据上随机切换状态 |
| `?select=<agentId>` | 打开页面时自动选中某个 bot（打开侧边详情） |

读取失败时：保留上一次成功的数据；如果从未成功过，则显示内置示例数据并提示“未连接 status.json”。

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
| `desk` | integer | 工位编号 0–11（0–4 后排，5–10 前排，11 后排最右）；冲突时自动排到空位 |
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

```bash
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

- 默认写 `public/status.json`；用 `--file` 或环境变量 `STATUS_FILE` 指向部署目录里的文件（例如 `dist/status.json`）。
- 写入是原子的（临时文件 + rename），前端不会读到半个文件。
- 一旦有真实写入，会自动移除 `meta.mock`。
- 多个 bot 同时写同一文件有极小概率互相覆盖；上线真实 bot 后建议改为“每 bot 一个 HTTP 上报接口 → 服务端合并”，契约保持不变。

## 版本与兼容

当前为 v1（无显式版本字段）。新增字段时前端会忽略未知字段；缺失的可选字段会使用默认值，不会崩溃。
