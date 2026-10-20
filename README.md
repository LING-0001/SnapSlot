# SnapSlot / 快照贴

把截图和文字临时贴在屏幕上沿。点击复制，长按后拖出 PNG/TXT 副本，用完移除。

本仓库包含官网和两个可编译的桌面测试客户端。界面以已确认的蓝白便签版为准：
独立纸卡和钉子、连续横向滚动、0.5 秒顶边停留触发、450 ms 离开缓冲、
柔和进出场、即时删除归位，以及 JSON 自定义尺寸、配色、图片和样式。

## 目录与技术分工

| 目录 | 职责 |
| --- | --- |
| `apps/website` | Next.js 官网、已确认的界面与皮肤解析器 |
| `apps/native-ui` | 两端共用的离线便签和外观面板，React/CSS，小型静态包 |
| `apps/macos` | Swift/AppKit + 系统 WKWebView，原生截图、剪贴板、拖拽、菜单栏与边缘监听 |
| `apps/windows` | C#/WPF + WebView2 Composition，原生截图选区、剪贴板、OLE 拖拽、托盘与边缘监听 |
| `scripts` | 按平台命名的构建与源码打包命令 |

不需要启动官网服务器，也不附带 Node.js 或 Electron 运行时。
系统接口分平台实现；皮肤格式、视觉和交互界面共用。旧的像素轨道、8 张分页、
`+N` 折叠、旧高度及旧触发时长已由便签版取代，见 `docs/adr/0024-native-notes-parity.md`。

## 先在 Mac 上测试

需要 Apple Command Line Tools（或 Xcode）、Node.js 22+，不要求完整 Xcode。

```bash
./scripts/build-macos.sh
open artifacts/macos/SnapSlot.app
```

构建产物：`artifacts/macos/SnapSlot.app` 和 `SnapSlot-macOS.zip`。
默认按当前 Mac 的 CPU 架构构建；当前本机产物为 Apple Silicon。最低部署目标 macOS 13。

启动后在 Dock 和菜单栏显示 SnapSlot 图标，便签为空并完全隐藏。点击 Dock 图标可以展开：

- 菜单栏的“截一张图”或 `Control + Option + S` 打开系统区域截图工具。Esc 取消。
- 首次主动截图时，macOS 可能请求屏幕录制权限；启动和普通换肤不会主动请求截图。
- 继续使用系统的 `Command + Shift + 3/4/5` 截图：新保存的系统截图会自动进入便签，原文件保留。
- 直接复制到剪贴板的截图、新复制的图片也会自动进入；启动时已有内容和纯文字不会自动收取。
- 菜单中的“自动收取截图和剪贴板图片”可随时关闭。复制便签自身不会再次生成便签。
- 右键菜单栏图标 →“设置”，可修改接收开关、截图快捷键和收取选中文字快捷键；保存后立即生效，重启保留。
- 默认 `Control + Option + T` 收取当前软件中选中的文字（也可以先全选），同时复制到剪贴板。
  Mac 首次使用需要在“系统设置 → 隐私与安全性 → 辅助功能”中允许 SnapSlot。没有选中文字时不会读取旧剪贴板文字。
- “贴上文字”创建文本；“粘贴一次”只在点击时读取当前剪贴板；“添加图片”导入本地图片。
- 鼠标抵达屏幕顶边停留 0.5 秒展开，移开约 450 ms 后开始淡出。
- `Control + Option + Space` 为键盘展开/收起；方向键选卡，Enter 复制，Delete 移除，Esc 收起。
- 鼠标悬停就高亮并显示复制按钮，第一次点击即可复制图片或完整文字。按住至少 160 ms 并移动即可向 Finder、聊天软件等拖出文件副本。
- “自定义外观”与官网使用同一个面板，图片上传、两种预设、宽高圆角、颜色及 JSON 导入导出均可用。
- 从菜单栏选择退出。退出清理本次暂存文件；重启不恢复便签，外观和语言设置会保留。

原生层在菜单栏下方显示便签，不遮住 macOS 系统菜单。
本地包使用 ad-hoc 签名，用于测试，尚未做 Developer ID 签名和公证。

## Windows 构建与测试

需要 Windows 10/11、Node.js 22+ 和 .NET 10 SDK。运行依赖系统 WebView2 Evergreen Runtime；
Windows 测试包自带 .NET Desktop Runtime。尚未在本机执行 Windows GUI 验收。

在 PowerShell 中，从仓库根目录运行：

```powershell
.\scripts\build-windows.ps1
.\artifacts\windows\win-x64\SnapSlot.exe
```

ARM64 Windows 可使用 `-Runtime win-arm64`。产物为对应目录和
`artifacts/windows/SnapSlot-win-x64.zip`。**请携带整个目录或 ZIP，不能只拷贝 exe**：
离线界面、WebView2 Loader 和运行库必须在一起。

Windows 使用 `Ctrl + Alt + Space` 展开/收起，`Ctrl + Alt + S` 截图；托盘提供相同操作。
`Ctrl + Alt + T` 收取当前选中文字。右键托盘图标 →“设置”可录制两个快捷键和修改截图接收开关；
快捷键占用或重复时会提示并保留之前的设置。编辑设置时暂停全局快捷键，离开设置后恢复。
区域截图由本地原生选区窗口完成。`Win + Shift + S`、Print Screen 等工具产生的新剪贴板图片会自动收取，
可在托盘菜单关闭；不会自动收取文字、启动时已有内容或复制便签自身产生的内容。
后续请在 Windows 实机重点检查透明层、DPI/多屏、截图选区和目标软件的拖拽兼容性，
详见 `docs/native-testing.md`。当前已在 Mac 交叉编译生成 PE x64 exe；交叉编译不等于运行验收。

## 皮肤热插拔

两端读取与官网相同的版本 1 JSON。导出的皮肤可以在三端互相导入。

- macOS：`~/Library/Application Support/SnapSlot/Skins/active.json`
- Windows：`%LOCALAPPDATA%\SnapSlot\Skins\active.json`

外观面板或系统菜单中可直接打开这个文件夹。修改 `active.json` 保存，约 250 ms 后自动应用；
支持原地保存和编辑器的原子替换。错误 JSON 不覆盖当前外观，`last-good.json` 保留最近有效版本。
附带 `notes.json` 和 `cards.json` 两个预设。不执行皮肤脚本，也不加载远程素材。
尺寸、字段限制和图片嵌入方式见 `apps/website/SKINS.md`。

原生应用设置独立保存为 `preferences.json`，位于各端 SnapSlot 应用数据目录；与皮肤 JSON 分开。
默认截图接收开启，截图和选中文字快捷键分别为 Ctrl+Option/Alt+S、Ctrl+Option/Alt+T。

## 验证命令

```bash
# 两端共用的界面与官网
cd apps/website
npm ci
npm run build
npm run build:native
npx playwright test
cd ../..

# 无需 XCTest / 完整 Xcode 的 Mac 业务检查
swift run --package-path apps/macos SnapSlotCoreChecks

# macOS 原生渲染、剪贴板和真实文件监听冒烟检查（使用隔离测试目录/测试剪贴板）
artifacts/macos/SnapSlot.app/Contents/MacOS/SnapSlot --smoke-test "$PWD/artifacts/qa/macos"

# Windows 皮肤校验及文件监听检查，也能在 Mac .NET SDK 上执行
dotnet run --project apps/windows/Checks/SnapSlot.Windows.Checks.csproj -- artifacts/native-ui
```

正式使用不附带示例卡。冒烟检查使用绘制的测试图片和独立剪贴板，不读取用户的截图或覆盖系统剪贴板。
高刷新率、CPU、内存、多屏和外部拖拽的完整性能验收仍需实机测量；目前不声称通过旧文档的 144 Hz 质量门槛。

## 官网与源码包

```bash
npm ci --prefix apps/website
npm run dev --prefix apps/website -- --port 3000
python3 scripts/package-source.py
```

官网入口 `http://127.0.0.1:3000/zh-Hans/`，六种语言和现有网站交互保留。
源码包为 `artifacts/SnapSlot-source.zip`，排除依赖、缓存、生成物和本机临时文件。
没有自动部署、发布或创建安装器。
