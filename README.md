# 数字办公室 · Digital Office

等距 3D 卡通风格的“AI 员工办公室”：每个 bot 一个工位和一个小角色，能看到谁在工作 / 思考 / 协作 / 等待确认 / 出错 / 离线，
以及今日计划完成度。**第一版只做可视化**（不能在里面下指令）。

## 运行

```bash
npm install
npm run dev                 # 开发：http://localhost:5173
npm run build               # 产物在 dist/（相对路径，可放任意子目录/GitHub Pages）
npx serve dist              # 或：cd dist && python3 -m http.server 4173
```

打开后：
- `/`                       读取同目录 `status.json`（每 10 秒轮询）
- `/?demo=1`                演示模式，随机切换状态
- `/?feed=https://…/status.json`   指定数据源
- `/?select=teacher`        自动选中某个 bot

> 直接双击 `index.html`（file://）时浏览器禁止 fetch，会显示内置示例数据；请用任意静态服务器打开。

## 数据契约 & 让 bot 上报

见 [docs/DATA_CONTRACT.md](docs/DATA_CONTRACT.md) 与 [docs/status.schema.json](docs/status.schema.json)。
bot 端更新自己的状态：`node scripts/update-status.mjs --id botmail --status working --task "…" --progress 30`。

## 技术栈

Vite + React 19 + TypeScript + three.js + @react-three/fiber + @react-three/drei（均为 MIT）。

## 素材与许可

- **没有任何外部 3D 模型 / 贴图 / 字体文件**：家具、角色、地板木纹、白板文字全部在代码里用基础几何体和 Canvas 生成。
- 中文使用系统字体（PingFang SC / 微软雅黑 / Noto Sans CJK）。
- 本项目代码 MIT（见 LICENSE）。如以后引入 Kenney / Quaternius 等 CC0 模型，请在此处登记来源。
- 依赖许可：react / react-dom (MIT)、three (MIT)、@react-three/fiber (MIT)、@react-three/drei (MIT)、vite (MIT)。

## 目录

```
public/status.json        示例数据（也是部署后 bot 要写的文件）
docs/                     数据契约文档 + JSON Schema
scripts/update-status.mjs bot 自更新脚本
src/scene/                3D 场景：Room/Furniture/Character/Whiteboard/CollabLinks/layout
src/hud/                  顶栏 / 成员列表 / 协作动态 / 详情面板
src/demo.ts               演示模拟器
src/feed.ts               轮询 + 回退
```
