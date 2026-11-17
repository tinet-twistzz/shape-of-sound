# 声之形 · Shape of Sound

一座关于「克拉尼图形」（Chladni patterns）的线上夜间博物馆：声音让金属板振动，沙粒沿节线聚集，画出看得见的声音形状。本站包含四个展厅——声形画廊（试听预设声音）、寻声猜形（听音辨形小测验）、声绘工坊（滑杆/麦克风驱动沙盘创作）、声形之理（原理手册抽屉）。

当前阶段为**纯前端骨架**：所有物理模拟、音频、麦克风、导出能力均以接口 + mock 占位（详见下方「待注入点清单」），视觉上用 CSS 渐变示意沙盘图案。设计基线见 [sepc.md](./sepc.md)。

## 技术栈

- Vite 5 + React 18 + TypeScript（strict，零 `any`）
- CSS Modules + 全局设计令牌（`src/theme/tokens.css`），无 UI / 动画库
- Context + useReducer 管理应用状态；服务经 `ServiceProvider` 依赖注入
- ESLint 9（typescript-eslint / react-hooks / react-refresh）+ Prettier

## 运行方式

```bash
npm install        # 安装依赖
npm run dev        # 开发服务器（默认 http://localhost:5173）
npm run build      # 类型检查（tsc -b）+ 生产构建，产物在 dist/
npm run preview    # 预览生产构建
npm run lint       # ESLint 检查
npm run format     # Prettier 格式化
npm run format:check
```

> 注意：根 `tsconfig.json` 使用 project references，单独跑 `tsc --noEmit` 不会检查任何文件；完整类型检查请用 `npx tsc -b --force`（`npm run build` 已包含）。

## 目录结构

```
src/
├── app/                  # App 壳与 Providers 组装（AppProviders 接受 services 注入）
├── components/
│   ├── layout/           # TopNav（含移动端菜单）、Section、Footer
│   ├── sand/             # SandCanvas（沙盘占位渲染）、PatternThumbnail（缩略图）
│   └── ui/               # Button / IconButton / Card / Drawer / Slider / Toast 等基础件
├── content/copy.ts       # 全站文案唯一来源（组件不得硬编码文案）
├── data/mock/            # 静态数据：声音预设、测验题、原理章节
├── features/             # 按展厅组织的业务组件
│   ├── hero/             # 首屏
│   ├── gallery/          # HALL 01 声形画廊
│   ├── quiz/             # HALL 02 寻声猜形
│   ├── studio/           # HALL 03 声绘工坊
│   └── principle/        # 声形之理手册抽屉
├── hooks/                # useAsyncData / useScrollSpy / useScrollTo / useReducedMotion
├── services/
│   ├── ServiceProvider.tsx   # 注入入口：mock 兜底 + Partial<Services> 覆盖
│   ├── serviceContext.ts     # ServiceContext 与 useServices()
│   └── mock/                 # 六个服务的 mock 实现（待替换）
├── store/                # AppStateProvider（useReducer）与 useAppState / useAppActions
├── theme/                # tokens.css（设计令牌）、global.css（全局样式 / 焦点 / 动效偏好）
└── types/                # domain.ts（领域模型）、services.ts（服务接口契约）
```

约定：

- 组件一律通过 `useServices()` 取服务，禁止直接 import `src/data/mock` 或 mock 实现。
- 组件文案一律来自 `src/content/copy.ts`。
- 响应式断点：≥1200 双栏、768–1199 平板、<768 单栏；尊重 `prefers-reduced-motion`。

## 待注入点清单

所有服务接口定义在 [src/types/services.ts](./src/types/services.ts)。替换方式统一为：实现接口 → 通过 `AppProviders` / `ServiceProvider` 的 `services` prop 注入（`Partial<Services>`，未注入的键自动回落 mock）：

```tsx
// src/main.tsx
<AppProviders services={{ audioEngine: realAudioEngine, dataSource: realDataSource }}>
  <App />
</AppProviders>
```

### 1. AudioEngine（音频播放）

- **接口**：`play(sound: SoundPreset): void` · `playTone(frequencyHz: number): void` · `stop(): void` · `setMuted(muted: boolean): void`
- **当前 mock**：`src/services/mock/mockAudioEngine.ts` — 仅 `console.log`，不发声。
- **替换位置**：新建 Web Audio 实现（OscillatorNode / 采样播放 + GainNode 静音），经 `services.audioEngine` 注入。调用方：画廊卡片试听、测验播放、工坊滑杆音调、顶部静音开关。

### 2. MicInput（麦克风输入）

- **接口**：`start(): Promise<void>` · `stop(): void` · `subscribe(listener: (frame: MicFrame) => void): () => void`；`MicFrame = { pitchHz: number | null; volume: number; waveform: Float32Array }`
- **当前 mock**：`src/services/mock/mockMicInput.ts` — `start()` 后每 50ms 推送合成正弦帧（音高 220±60Hz、音量 0.35±0.25、128 点波形），不请求真实麦克风。
- **替换位置**：新建 `getUserMedia + AnalyserNode + 音高检测（FFT / 自相关）` 实现，经 `services.micInput` 注入；`start()` 失败（拒绝授权 / 不支持）应 reject，UI 已有降级文案。调用方：`src/features/studio/MicPanel`、`WaveIndicator`。

### 3. PatternMapper（频率 → 图案映射）

- **接口**：`frequencyToPattern(frequencyHz: number): PatternParams`（`{ n, m, a?, b? }`）
- **当前 mock**：`src/services/mock/mockPatternMapper.ts` — 在声音预设中找频率最近的一项，返回其 `pattern` 副本。
- **替换位置**：新建基于真实模态表（或克拉尼方程数值解）的映射实现，经 `services.patternMapper` 注入。调用方：工坊滑杆 / 麦克风驱动的沙盘图案。

### 4. ArtworkExporter（作品导出）

- **接口**：`export(artwork: Artwork, snapshot: Blob | null): Promise<Blob | null>`
- **当前 mock**：`src/services/mock/mockArtworkExporter.ts` — 打日志并 resolve `null`；UI 收到 null 时提示导出暂不可用。
- **替换位置**：新建 Canvas 截图 + 展签合成 + `toBlob` 导出实现，经 `services.artworkExporter` 注入。依赖 SandCanvas 的 `snapshot()` 先返回真实画面 Blob（见第 6 项）。调用方：`src/features/studio/StudioSection` 的导出按钮。

### 5. DataSource（数据源）

- **接口**：`getSoundPresets(): Promise<SoundPreset[]>` · `getQuizQuestions(): Promise<QuizQuestion[]>` · `getPrincipleChapters(): Promise<PrincipleChapter[]>`
- **当前 mock**：`src/services/mock/mockDataSource.ts` — 300ms 模拟延迟后返回 `src/data/mock/` 静态数据的浅拷贝。
- **替换位置**：新建静态 JSON / API 实现，经 `services.dataSource` 注入；数据模型见 `src/types/domain.ts`。调用方：画廊、测验、原理抽屉、首屏背景图案（均经 `useAsyncData`）。

### 6. SandCanvas（沙盘渲染，组件级替换）

- **契约**（替换时必须保持不变，调用方零改动）：
  - Props：`pattern: PatternParams` · `theme: ParticleTheme`（gold / glacier / neon）· `energy: number`（0–1）· `interactive?: boolean` · `className?: string`
  - Ref（`SandCanvasHandle`）：`scatter(): void`（轻撒沙粒）· `snapshot(): Promise<Blob | null>`（导出当前画面）
- **当前占位**：`src/components/sand/SandCanvas/index.tsx` — CSS 渐变示意：conic/radial 渐变拼出花瓣与圆环，pattern 变化双层淡入淡出，theme 经 CSS 变量换色，`scatter()` 播放抖动动画，`snapshot()` 恒返回 `null`。`src/components/sand/PatternThumbnail` 为同风格静态缩略图。
- **替换位置**：在该组件内部实现 Canvas 粒子渲染（克拉尼节线物理模拟），`scatter()` 改为给粒子施加随机冲量，`snapshot()` 改为 `canvas.toBlob()` 输出 PNG；文件头部与函数内已留 TODO 标记。

### 附：QuizService（测验判分）

- **接口**：`check(question: QuizQuestion, soundId: string): boolean`
- **当前 mock**：`src/services/mock/mockQuizService.ts` — 精确匹配 `answerSoundId`。如需容错 / 部分得分，实现后经 `services.quizService` 注入。

## 质量基线

- `npx tsc -b --force`、`npm run lint`、`npm run build`、`npm run format:check` 全部零报错零警告。
- 键盘可访问性：全站 `:focus-visible` 金色焦点环；抽屉 / 移动端菜单焦点圈闭 + ESC 关闭并归还焦点；滑杆方向键调值；主题选择 radiogroup 方向键漫游；图标按钮均有 `aria-label`。
- 已在 1440 / 1024 / 768 / 390 宽度下验证布局，无横向溢出。