# 数字办公室 · Digital Office

等距 3D 卡通风格的“AI 员工办公室大楼”：**一个分组一层楼**，每层各自的 feed、各自的今日计划与完成度；
每个 bot 一个工位和一个小角色，能看到谁在工作 / 思考 / 协作 / 等待确认 / 出错 / 离线，
以及今日计划完成度。**第一版只做可视化**（不能在里面下指令）。

## 运行

```bash
npm install
npm run dev                 # 开发：http://localhost:5173
npm run build               # 产物在 dist/（相对路径，可放任意子目录/GitHub Pages）
npx serve dist              # 或：cd dist && python3 -m http.server 4173
```

打开后：
- `/`                       读取 `floors.json`，进入默认楼层，只轮询当前楼层的 feed（每 10 秒）
- `/?floor=trading`         直接进入某一层；侧边“电梯”可切换（↑/↓ 键也行），“总览”查看全楼汇总
- 没看的楼层：不请求、不轮询；标签页隐藏时也暂停
- `/?demo=1`                演示模式，随机切换状态
- `/?feed=https://…/status.json`   覆盖当前楼层的数据源
- `/?select=teacher`        自动选中某个 bot

> 直接双击 `index.html`（file://）时浏览器禁止 fetch，读不到数据；请用任意静态服务器打开。

## 数据契约 & 让 bot 上报

见 [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md)，以及 [status](docs/status.schema.json) / [floors](docs/floors.schema.json) / [building](docs/building.schema.json) 三份 JSON Schema。
bot 端更新自己的状态：`node scripts/update-status.mjs --floor lobby --id botmail --status working --task "…" --progress 30`。

## 技术栈

Vite + React 19 + TypeScript + three.js + @react-three/fiber + @react-three/drei（均为 MIT）。

## 素材与许可

- **没有任何外部 3D 模型 / 贴图 / 字体文件**：家具、角色、地板木纹、白板文字全部在代码里用基础几何体和 Canvas 生成。
- 中文使用系统字体（PingFang SC / 微软雅黑 / Noto Sans CJK）。
- 本项目代码 MIT（见 LICENSE）。如以后引入 Kenney / Quaternius 等 CC0 模型，请在此处登记来源。
- 依赖许可：react / react-dom (MIT)、three (MIT)、@react-three/fiber (MIT)、@react-three/drei (MIT)、vite (MIT)。

## 目录

```
public/floors.json        楼层配置（可编辑）
public/floors/<id>/status.json  每层独立的 feed（示例数据，也是部署后 bot 要写的文件）
public/building.json      大楼总览汇总（脚本自动同步）
docs/                     数据契约文档 + JSON Schema
scripts/update-status.mjs bot 自更新脚本
src/scene/                3D 场景：Room/Furniture/Character/Whiteboard/FloorSign/CollabLinks/layout/themes（楼层切换动画在 Scene.tsx）
src/hud/                  顶栏 / 成员列表 / 协作动态 / 详情面板
src/demo.ts               演示模拟器
src/feed.ts               轮询 + 回退
```
