# AGENTS.md — 声之形 (Shape of Sound)

本文件为跨 Session 协作上下文基准，供 AI Coding Agent 快速掌握仓库架构、运行方式、数据协议、编码铁律与已知风险。

---

## 1. 项目定位与当前状态

**《声之形 · Shape of Sound》** 是一座关于「克拉尼图形（Chladni Patterns）」的线上夜间科学艺术馆（单页应用 SPA）。声音驱动共振板振动，细沙沿波节线聚集形成几何声纹。

页面按展厅顺序由上至下编排（另配右侧科普抽屉）：
- `hero`：**序厅**（全屏背景沙盘 + 展签式导览入口）
- `gallery`：**HALL 01 · 声形画廊**（8 件真实声学/乐器采样试听 + 实时沙盘 + 展签）
- `quiz`：**HALL 02 · 寻声猜形**（6 道盲听辨形题 + 图鉴收集，独立 7 首采样池）
- `studio`：**HALL 03 · 声绘工坊**（滑杆调频 / 麦克风实时随动 / 2.5s 一句话声纹画像 / 3–20s 长声音年轮与多重曝光压缩 / 四种共振盘形状 / 四种沙粒色泽 / 拍立得典藏卡导出 / 展厅发布）
- `exhibition`：**HALL 04 · 艺术展厅**（云端「公共展厅」分页浏览 + 本机 IndexedDB「我的展厅」+ `ReplayModal` 粒子原貌复活重放）
- `PrincipleDrawer`：**声形之理**（5 章科普手册抽屉，含「学霸模式」折叠注释）

### 重要上下文纠偏（必读）
1. **切勿按 `sepc.md` 回退功能**：根目录下的 `sepc.md`（原文件名如此）是项目骨架期的早期文档，其中「禁止实现粒子物理、Canvas、Web Audio、麦克风、FFT、图片导出」的限制**早已过期**；上述能力均已在生产代码中完整实现。
2. **当前分支与未提交现场（`feat/store`）**：当前工作区正在开发/完善 **HALL 04 艺术展厅、作品发布弹窗、典藏卡导出与后端云函数**（涉及 `src/features/exhibition/`、`src/features/studio/PublishDialog/`、`src/services/real/{galleryService,localGallery,canvasArtworkExporter}.ts`、`functions/`、`dev/gallery-preview/` 等）。接手新任务前先跑 `git status` 确认未提交改动，勿随意回滚或格式化无关文件。

---

## 2. 常用命令与本地联调

### 前端开发与质量门禁
```bash
npm run dev            # 启动 Vite 开发服务器（默认 5173）
npm run build          # tsc -b && vite build（严格类型检查 + 生产构建）
npm run lint           # ESLint 检查（覆盖 **/*.{ts,tsx}）
npm run format:check   # Prettier 格式检查
npm run format         # Prettier 自动格式化（注意：当前仓库存量文件有格式漂移，谨慎全量执行）
```

无副作用纯类型检查（不产出 build 文件）：
```bash
npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.node.json
```

### 公共展厅后端本地联调（无测试框架，使用内置脚本）
Vite 开发服务器已配置代理（`vite.config.ts`）：将 `/functions/v1/app` 与 `/__storage` 转发至 `http://127.0.0.1:8787`。

```bash
# 终端 1：启动本地内存 DB + 对象落盘假件服务器（复用真实 functions/routes.mjs）
node dev/gallery-preview/server.mjs

# 终端 2：启动前端
npm run dev

# 可选：对运行中的 8787 假件服务执行端到端路由与异常边界冒烟测试（21 项断言）
node dev/gallery-preview/smoke.mjs
```
> 注意：`server.mjs` 处理 `PUT /__storage/*` 时会将上传的 `.webp` 和 `.state` 写入 `dev/gallery-preview/objects/`，运行 `smoke.mjs` 会产生新的 UUID 测试文件。

---

## 3. 架构与目录地图

```text
├── src/
│   ├── main.tsx                     # 挂载入口，引入 tokens.css 与 global.css
│   ├── app/
│   │   ├── providers.tsx            # Provider 嵌套：ServiceProvider -> AppStateProvider -> ToastProvider
│   │   └── App.tsx                  # 单页五展厅顺序编排 + useScrollSpy 同步导航高亮 + PrincipleDrawer
│   ├── types/
│   │   ├── domain.ts                # 核心领域类型（PatternParams, SoundPreset, Artwork, ReplayMeta 等）
│   │   └── services.ts              # 7 大服务接口契约（Services）与展厅 DTO
│   ├── store/
│   │   ├── appStateContext.ts       # State / Actions 双 Context 分离定义与 hooks
│   │   └── AppStateProvider.tsx     # useReducer 状态机，同步 muted 到 audioEngine
│   ├── services/
│   │   ├── ServiceProvider.tsx      # 依赖注入组装：createMockServices() 打底 + real 实现覆盖
│   │   ├── mock/                    # Mock 实现（目前仅 mockDataSource 与 mockQuizService 仍在生产生效）
│   │   └── real/
│   │       ├── webAudioEngine.ts        # Web Audio 采样缓存解码播放 + 基频/泛音合成器 + 平滑淡入淡出
│   │       ├── webMicInput.ts           # getUserMedia + AnalyserNode + 自相关基频检测（中值+EMA平滑）+ 明亮度计算
│   │       ├── chladniPatternMapper.ts  # 80–2600Hz 对数映射到 15 组 (n, m) 模态表
│   │       ├── canvasArtworkExporter.ts # 1080×1360 黑金拍立得典藏卡 Canvas 2D 合成与 PNG 触发下载
│   │       ├── galleryService.ts        # 公共展厅 HTTP 客户端（/functions/v1/app/api/artworks）
│   │       └── localGallery.ts          # 本机「我的展厅」IndexedDB 封装（DB: shape-of-sound, Store: artworks）
│   ├── components/
│   │   ├── sand/
│   │   │   ├── SandCanvas/          # 核心驻波粒子物理画布（最高 30k 粒子，暴露 imperative handle）
│   │   │   └── PatternThumbnail/    # 静态方盘缩略图（ImageData 确定性像素哈希噪点）
│   │   ├── layout/                  # TopNav, Section, Footer
│   │   └── ui/                      # 无第三方依赖自研组件库（Button, Card, Drawer, Toast, Slider 等 + icons.tsx）
│   ├── features/
│   │   ├── hero/                    # 序厅
│   │   ├── gallery/                 # HALL 01 声形画廊
│   │   ├── quiz/                    # HALL 02 寻声猜形
│   │   ├── studio/                  # HALL 03 声绘工坊（含 utteranceAnalysis.ts、longSoundCompression.ts）
│   │   ├── exhibition/              # HALL 04 艺术展厅（ExhibitionSection, ArtworkCard, ReplayModal）
│   │   └── principle/               # 声形之理科普抽屉
│   ├── data/mock/                   # 静态展品数据（指向 public/sounds/*.m4a）、题库、原理章节文本
│   ├── content/copy.ts              # 全站唯一中文文案、ARIA 标签与动态模板函数集中表
│   ├── hooks/                       # useAsyncData, useReducedMotion, useScrollSpy, useScrollTo
│   └── theme/                       # tokens.css（色彩/字体/间距/阴影令牌）+ global.css（全局重置与排版工具类）
├── public/sounds/                   # 15 个 Wikimedia Commons 真实乐器/声学采样 (.m4a) 及 CREDITS.md
├── functions/
│   ├── index.ts                     # Qoder 平台 Deno.serve 入口（引用平台注入的 ./_qoder/*）
│   └── routes.mjs                   # 零平台耦合的展厅 API 业务路由、参数清洗与二进制校验
└── dev/gallery-preview/             # 本地无凭证联调假件服务器 (server.mjs) 与冒烟测试 (smoke.mjs)
```

---

## 4. 核心机制与跨端协议（修改时务必对齐）

### 4.1 `SandCanvas` 物理与渲染架构 (`src/components/sand/SandCanvas/index.tsx`)
- **驻波场查找表**：模态变化时在 `128×128` 网格上预计算振幅 `amp` 与归一化负梯度 `(dirX, dirY)`，每帧粒子循环只做双线性插值与乘加，**严禁在 `stepSim` / `drawParticles` 热路径内调用三角函数或分配临时对象**。
- **盘形与模式**：支持 `square`、`circle`、`hexagon`、`triangle`（统一由有向距离场 `plateSignedDist` 处理边界反弹）；当 `compressionMode === 'rings'`（声音年轮）时，`effectiveShape` 强制按 `circle` 处理。
- **彩沙记忆（`theme === 'voice'`）**：粒子落盘时锁定当前 `activeColorBand`（`0..3`），后续随声音增强通过提升 `density`（`0.3 -> 1.0`）唤醒更多新色沙粒，不覆盖已有沙粒颜色。
- **性能自保**：桌面端初始 `30,000` 粒、移动端 `7,000` 粒；FPS EMA 连续 1.5s 低于 45 时阶梯削减 25%（下限 `3,000`）；依赖 `IntersectionObserver`、`document.hidden` 与 `prefers-reduced-motion` 自动启停或直接静态 `settle()`。

### 4.2 `SND1` 粒子状态二进制协议（前后端强耦合）
`SandCanvas.exportState()` / `loadState()` 与后端 `functions/routes.mjs`（`POST /api/artworks/:id/complete`）共享严格字节布局：
- **总长度**：`8 + count * 5` 字节（服务端上限 `150,008` 字节，即最多 `30,000` 粒）。
- **Header (8 bytes)**：
  - `0..3`：ASCII 魔数 `0x53 0x4E 0x44 0x31`（`"SND1"`）
  - `4..7`：`Uint32`（Little-Endian）粒子数 `count`（服务端要求 `500 <= count <= 30000` 且必须等于 `replay_meta.count`）
- **Body (`count * 5` bytes)**：每粒 5 字节
  - `+0..1`：`Uint16` LE `qx`，由 `(x + 1) / 2 * 65535` 量化
  - `+2..3`：`Uint16` LE `qy`，由 `(y + 1) / 2 * 65535` 量化
  - `+4`：`Uint8` `band`（色桶索引 `0..3`）

### 4.3 公共展厅三阶段发布流
1. `POST /functions/v1/app/api/artworks`：校验元数据，顺带清理超 24h 的 `pending` 记录，检查总记录 `< 500`，插入 `status: 'pending'` 并签发 `imageUpload` / `stateUpload` URL（`upsert: false`，同一路径不可覆盖重传）。
2. `PUT <signedUrl>`：上传 `600×600` WebP 快照（`<= 300KB`，`Content-Type: image/webp`）与 `.state` 二进制（`Content-Type: application/octet-stream`）。
3. `POST /functions/v1/app/api/artworks/:id/complete`：服务端流式有界读取两个对象，校验 MIME、字节上限与 `SND1` 结构后将状态更新为 `'ready'`。

---

## 5. 编码规范与红线约束

1. **零运行时重依赖**：生产依赖仅限 `react` 与 `react-dom`。**禁止**引入外部 UI 组件库、状态管理库或动画库。
2. **TypeScript 与 ESLint 铁律**：
   - 开启 `strict`、`noUnusedLocals`、`noUnusedParameters`。
   - **禁止 `any`**（`@typescript-eslint/no-explicit-any: error`）。
   - **强制 `import type`**（`@typescript-eslint/consistent-type-imports: error`）。
   - 跨模块导入统一使用 `@/*` 别名（映射到 `src/*`）。
3. **组件与样式组织**：
   - 每个组件独占目录：`ComponentName/index.tsx` + `ComponentName.module.css`。
   - 优先使用 `src/theme/tokens.css` 中的设计令牌与 `global.css` 中的排版类（`.hall-index`、`.display`、`.caption`、`.mono`），保持「深色夜间美术馆 + 精密科学仪器」视觉调性。
   - **所有用户可见文案与 ARIA 描述集中写入 `src/content/copy.ts`**，不在组件中硬编码中文文案。
4. **切勿将 `functions/` 加入 `tsconfig.*.json`**：
   - `functions/index.ts` 运行在云端 Deno 环境，依赖平台构建期注入的 `./_qoder/backend.mjs` 与 `./_qoder/storage.mjs`（本地仓库不存在）。将其加入 `tsconfig` 会导致 `npm run build` (`tsc -b`) 编译失败。
   - 后端业务逻辑一律写在纯 ESM 的 `functions/routes.mjs` 中并通过依赖注入传入 `db` / `storage` / `BackendError`，确保 `dev/gallery-preview/server.mjs` 可直接在 Node.js 下运行验证。
5. **浏览器兼容与无障碍**：
   - Web Audio API 需保留 `webkitAudioContext` 与回调式 `decodeAudioData` 兼容写法（面向旧版 iOS Safari / 微信内置浏览器）。
   - 交互组件需维护键盘导航、`aria-*` 状态与 `prefers-reduced-motion` 降级分支。

---

## 6. 代码审查已知问题与技术债（供后续 Session 跟进）

1. **工坊发布/下载后展厅列表不自动刷新**：
   `StudioSection` 与 `ExhibitionSection` 同屏挂载于 `App.tsx`。用户在工坊完成「发布到展厅」或「下载典藏卡（写入 `localGallery`）」后向下滚动至 `ExhibitionSection`，因 `tab` 未切换，公共展厅与我的展厅不会重新拉取最新数据。建议在 `AppState` 或轻量事件总线上增加展厅刷新版本号。
2. **不支持 WebP 编码环境的发布兼容隐患**：
   `SandCanvas.snapshotScaled()` 调用 `off.toBlob(..., 'image/webp', 0.85)`；若旧版 WebKit 回退产出 `image/png`，`galleryService.publish()` 仍按 `'image/webp'` 上传，且 PNG 粒子图易超出服务端 `300KB` 限制而在 `/complete` 阶段返回 `422 invalid_upload`。
3. **非正方形容器下 `SandCanvas` 盘框与粒子坐标比例失配**：
   `drawParticles` 按画布半宽 `w/2`、半高 `h/2` 独立映射坐标，而 `buildPlatePath` 按 `Math.min(w, h) / 2` 等比绘制盘框；在 `HeroSection` 等长方形视口中粒子会溢出暗金盘框。
4. **`PatternThumbnail` 仅支持基础方盘方程**：
   `PatternThumbnail` 未实现 `plateShape`（圆/六角/三角）、`secondary` 与 `timelineSlices` 渲染；目前仅用于画廊预设与猜形题库（均为基础方盘），若复用于异形盘作品缩略图将失真。
5. **移动端重放桌面端作品时的粒子数突增**：
   `SandCanvas.loadState()` 会将桌面端导出的 `30,000` 粒直接赋给 `sim.count / activeCount`，绕过移动端初始 `7,000` 粒上限（需等待 1.5s 低帧率检测才逐步削减）。
6. **弹层焦点管理不一致**：
   `Drawer` 具备完整的正反向 `Tab` 焦点陷阱与滚动锁定，但 `TopNav` 移动端菜单未拦截 `Shift+Tab`，`PublishDialog` 与 `ReplayModal` 尚未补充 `Tab` 焦点圈定（`PublishDialog` 亦未锁定 `body` 滚动）。
7. **杂项清理与文案同步**：
   - `src/content/copy.ts` 页脚 `footer.note` 仍写「粒子为占位实现」，`README.md` 仍写「四个展厅」，需与现状同步。
   - `.gitignore` 建议补充 `dev/gallery-preview/objects/`（或区分种子数据与临时测试产物），并确认 `.Shape of Sound.qoder.site` 是否纳入版本控制。
   - 当前存量代码有 35 个文件存在 Prettier 格式差异（`npm run format:check`），可在独立整理提交中统一格式化。
