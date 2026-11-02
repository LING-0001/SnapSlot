# 参与贡献

产品与交互规则见 [AGENTS.md](AGENTS.md)，术语见 [CONTEXT.md](CONTEXT.md)，品牌许可见 [BRANDING.md](BRANDING.md)。

## 修改与提交

围绕一个需求组织提交，写清原因、涉及平台、行为变化和实际验证。跨平台或共享界面改动应便于独立审查，不将无关修复混入同一提交。编译、浏览器检查、原生冒烟和实机验收分别记录；未运行的检查不写为通过。

| 范围 | 验证入口 |
| --- | --- |
| 官网 | typecheck、源码预览构建、相关 Playwright 用例 |
| NativeUI | build:native、native-ui 类型检查与桥接用例 |
| macOS | build-macos.sh、核心/快捷键检查、隔离原生冒烟 |
| Windows | build-windows.ps1、逻辑检查与 Windows 实机流程 |
| 文档 | 路径、命令、引用与实现一致性 |

完整命令和验证边界见 [native-testing.md](docs/native-testing.md)。仅源码构建可使用 SNAPSLOT_SOURCE_CHECK_ONLY=1；该产物不含安装包，不用于官网部署。

共享控件通过 apps/website/vendor/npm 的固定公开包提供，校验清单在 vendor/libraries.json。更新依赖后同步锁文件并运行 `node scripts/check-public-boundary.mjs`，不加入私有接口或内部包。

## README 与媒体

六语言 README 由 `scripts/readme-build.py` 生成，编辑模板后再生成，保留各语言一致的产品含义。界面文字在官网 lib/home-copy.ts 与 NativeUI 来源中维护，不能用英文占位代替已经支持的语言。

普通修复不自动更新版本或重做截图、GIF、MP4。用户明确要求媒体更新或正式发布时，按 [发布流程](docs/releases/hosting.md) 集中处理。可单独执行 readme:media、readme-gif.py 与 readme-build.py；媒体检查须记录来源版本和范围，不将新文案配上不相符的旧截图。

## Pull Request 与发布

PR 使用仓库模板，说明问题、最终行为和验证。涉及界面时提供对应视口/平台的实际截图；无法在本机验证的平台如实注明，由 CI 或实机验收补足。

main push 运行源码验证。正式版本号、发布分支、owner 权限、安装包与媒体生成遵守 [AGENTS.md](AGENTS.md) 和 [发布指南](docs/releases/hosting.md)，不以普通修改代替发行授权。
