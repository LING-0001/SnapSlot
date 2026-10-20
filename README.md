# SnapSlot / 快照槽

屏幕顶端的像素滑轨，临时放置截图与纯文本。

本仓库当前交付的是 **可运行的 UI 原型**，包括独立官网和 Windows 原生交互预览。
产品约束见 `CONTEXT.md`，视觉实施方案见 `docs/design-direction.md`。

## 官网

```powershell
cd apps/website
npm ci
npm run dev -- --port 3000
```

打开 `http://127.0.0.1:3000/zh-Hans/`。六个路径为
`/en/`、`/zh-Hans/`、`/zh-Hant/`、`/ja/`、`/ko/`、`/es/`。

已实现：响应式首页、滑轨展开收起、图片和文字示例、原生 PNG / 纯文本复制、
像素粉碎、溢出收纳、空状态、键盘操作、减少动态效果、FAQ、隐私说明及真实发布状态。
示例由本地 SVG 绘制，页面不下载外部图片或字体，不读取剪贴板。
“截一张图”按钮在网页里添加的是示例，不会截取访客屏幕。

```powershell
npm run build
npm run typecheck
npx playwright test
npm start
```

生产静态文件位于 `apps/website/out`，可以作为 Cloudflare Pages 构建输出。
当前未绑定域名、未部署、没有正式安装包或虚构的校验和。
`npm start` 本地提供构建后的静态页面，与 `npm run dev` 二选一使用默认端口 3000。
Playwright 在 Windows 使用已安装的 Edge；其他平台先运行 `npx playwright install chromium`。

## Windows 交互预览

需要 .NET 10 SDK（编译）与 .NET 10 Desktop Runtime（运行）。本地已将 SDK 放在
`.tools/dotnet`，不依赖全局 SDK，也不改 PATH。

```powershell
.\.tools\dotnet\dotnet.exe build apps/desktop/SnapSlot.Desktop.csproj
.\apps\desktop\bin\Debug\net10.0-windows\SnapSlot.exe
```

启动后完全隐藏，在系统托盘提供展开、语言和退出。

- 鼠标向上抵达主屏顶边，停留约 220ms 后展开；移开约 450ms 后收回。
- `Ctrl + Alt + Space` 为键盘使用展开 / 收起。键盘操作时保持展开，Esc 收起。
- 展开层铺满主屏宽度，高度约 124 个逻辑像素；待机窗口隐藏，不遮挡底下的应用。
- 右侧 `+` 从本地选择图片；`···` 菜单中的“粘贴一次”只在点击时读取剪贴板。
- 点击卡片复制；拖出卡片提供 PNG / TXT 文件副本，原卡片保留。
- 方向键选卡、Enter 复制、Delete 移除、Esc 收起。
- 移除只清除本次暂存项。导出的临时文件保留到会话结束，以免中断其他应用的读取。
- 退出清理本应用生成的临时文件；意外退出遗留文件在下次启动清理。
- 六语切换覆盖操作界面，已收取的用户内容不翻译。

自动冒烟检查：

```powershell
.\apps\desktop\bin\Debug\net10.0-windows\SnapSlot.exe --smoke-test "$PWD/artifacts/qa"
```

测试退出码应为 0，报告与原生渲染截图在 `artifacts/qa`。

## 与正式产品之间的剩余工作

这轮优先验证视觉和交互，没有将原型声明为完整 MVP。

- 当前原生滑轨使用 WPF 预览渲染；ADR 0001 的 DirectComposition / Direct3D 渲染器待实现。
- 全局截图监听、独立区域截图快捷键、可选剪贴板持续监听和去重待实现。
- 显示器独立收件箱、多屏 DPI / 热插拔、全屏 / 演示 / 鼠标捕获抑制待验证。
- 高刷新率、CPU、内存和完整 UI Automation 验收尚未完成。
- 安装包、签名、正式更新记录、SHA-256 下载流程、官网部署待接入实际发布。
- 六语文案已接入，发布前仍需母语校对。

旧名称和旧视觉的 PNG 留在 `assets/brand`，作为历史探索材料，不是当前发布资产。
原型 SVG 图标是可缩放的界面占位标记，正式品牌图标仍需定稿。
