# 发布分支、GitHub 打包与官网部署

日常在 `main` 开发和推送。`Verify SnapSlot` 运行源码版本、网站、原生界面及两端编译检查，不生成正式安装包，不创建 Release。

## 明确要求发布时

用户说“推送到 release 分支”或“releasev1.2.0”后：

1. 在 main 准备版本号、发布说明及 README，提交并推送。明确版本号优先；未指定时使用当前未发布版本，已经发布则默认递增 patch。
2. 将该 main 提交正常推送到 `release`、`releasev1.2.0` 或 `release/v1.2.0`。例如 `git push origin main:releasev1.2.0`。日常 main push 和手工 tag push 均不触发正式发布。
3. `Publish release` 校验发布者是 `LING-0001`，重跑者也是该账号；源码提交须在远端 main 历史中，版本须与版本分支、两端项目和网站一致。已经公开的版本会被拒绝，不覆盖安装包或标签。
4. GitHub 的 macOS runner 导入 Developer ID 证书到独立临时钥匙串，从这个提交编译 Mac 双架构应用及 Windows x64 自包含应用。Mac 应用启用 Hardened Runtime 和安全时间戳，完成签名、公证、附加票据和 Gatekeeper 检查后执行原生冒烟检查；生成 DMG 后再签名、公证、附加票据和验证，最后生成清单与 SHA-256。Windows runner 实际安装、运行界面冒烟检查并卸载，确认用户文件保留。
5. Ubuntu runner 刷新六语言截图、引导、GIF / MP4 和 README，并构建包含完整安装包的静态网站。
6. 全部检查通过后，以最初触发的提交 SHA 创建 `v1.2.0` 标签，先上传并验证草稿附件，再公开 GitHub Release。

失败后可由同一个 owner 重跑；草稿可为同一提交续传，也可由 owner 用后续 main 提交更新；已有标签不得改指向。发布前还会检查分支是否已前进，过期构建不会公开。失败不公开半成品。并发发布串行执行，新的 main 开发不会取消发布。未更改版本不得再次发布已经公开的版本。

正式发布不需要本地 Swift 双架构编译、.NET 自包含发布、NSIS、dmgbuild 或演示录屏。仅本地开发测试时按需使用这些工具。

## 只有 owner 可以修改 release 分支

仓库服务端启用 Ruleset **Release branches — owner only**，配置源文件是 `.github/release-branches.ruleset.json`，匹配：

- `release`
- `releasev*`
- `release/v*`

规则限制创建、更新、删除和非快进推送，只允许管理员绕过。目前这是个人仓库，唯一管理员为 `LING-0001`；普通写权限协作者和 GitHub Actions 未获绕过权限。规则不影响 main。

新增管理员、迁移仓库到组织或修改绕过列表时，必须重新审查“仅 owner”是否仍然成立。workflow 内的 actor 校验是额外防线，不能代替服务端分支保护。

## Release 附件

- `SnapSlot-X.Y.Z-macOS-universal.dmg`：macOS 13+，Apple Silicon / Intel，拖入“应用程序”安装。
- `SnapSlot-X.Y.Z-windows-x64-setup.exe`：Windows 10 / 11 x64，包含 .NET；缺少 WebView2 时从微软官方地址联网安装。
- `manifest.json`、`SHA256SUMS.txt`：安装包路径、版本、大小和校验值。
- `SnapSlot-X.Y.Z-website.zip`：可直接部署的完整静态网站，包含本站下载文件。
- `SnapSlot-X.Y.Z-media.zip`：本次生成的 README、六语言截图、引导素材和 GIF / MP4。发布后可将此 ZIP 中的 README 与 docs 素材同步回 main，无需重新生成；不要回写 release 分支。

历史 Release 保留。安装包不再跟踪在 Git 中；已有历史提交和 v1.1.0 Release 不改写。

## 官网部署

保留相对下载 URL `/downloads/vX.Y.Z/...`，浏览器直接下载本站安装包。可以直接解压本版 `website.zip` 到站点目录；也可以在服务器拉取 main 后构建：

```bash
git pull --ff-only
npm ci --prefix apps/website
npm run build --prefix apps/website
```

构建默认从源码版本对应的 GitHub Release 下载两个安装包、清单和 SHA-256。只更新官网、继续使用已发布客户端时，可显式指定下载版本：

```bash
NEXT_PUBLIC_SNAPSLOT_RELEASE_VERSION=1.1.1 npm run build --prefix apps/website
```

指定版本必须已经公开，页面链接和附件校验使用同一版本；正式标签构建必须使用自身版本。已有完整且校验通过的缓存会直接复用；下载不完整或校验失败会阻止构建。构建产物为 `apps/website/out/`，须同步整个目录，包括 downloads。

服务器只需要 Node.js，不需要 Swift、.NET 或安装包工具。如果要单独准备缓存：

```bash
node scripts/fetch-release.mjs
node scripts/verify-release.mjs
```

只有 CI 源码预览可设置 `SNAPSLOT_SOURCE_CHECK_ONLY=1`。这个模式只验证版本并构建页面，不下载、不包含安装包，不属于可部署产物。

Nginx 的 root 指向静态产物目录，保持已有附件下载与 Range 配置。项目自带静态服务器同样支持 HEAD、附件 MIME、ETag 和单段 Range。部署后检查 DMG / EXE 为 200，断点请求为 206。

## Mac Developer ID 与公证配置

已公开的 v1.1.2 Mac 包仍为 ad-hoc 签名、未公证；新流程需要以下配置和实际公证通过后才能发行签名包，不覆盖已经公开的附件或校验值。Windows 签名状态不变。

在 `LING-0001/SnapSlot` 的 GitHub Actions Secrets 中配置：

| Secret | 用途 |
| --- | --- |
| `MACOS_CERTIFICATE_P12_BASE64` | 包含私钥的 Developer ID Application 证书 `.p12`，以 Base64 编码 |
| `MACOS_CERTIFICATE_PASSWORD` | 该 `.p12` 的导出密码 |
| `APPLE_ID` | 开发者 Apple 账号 |
| `APPLE_APP_SPECIFIC_PASSWORD` | 该账号为公证生成的 App 专用密码，不能使用登录密码 |
| `APPLE_TEAM_ID` | 证书所属的 10 位 Developer Team ID |

证书应为 **Developer ID Application**；Apple Development / Apple Distribution 不能代替官网分发证书。Xcode 的 Apple Accounts → Manage Certificates 可以创建证书。公证密码由账号持有人在 Apple 账号的安全设置中生成；不要写入源码、文档、日志或聊天，也不要提交 `.p12` 或私钥。创建证书及将凭据存入 GitHub Secrets 前由账号持有人授权。

`setup-macos-signing.sh` 在 runner 上验证证书团队和公证凭据；`cleanup-macos-signing.sh` 在成功或失败后删除独立钥匙串。打包脚本只在资源齐全后做最终签名，不授予额外的 Hardened Runtime 例外权限。应用与 DMG 均须由 Apple 返回 `Accepted`，并通过 `stapler validate` 与 `spctl`；凭据缺失、超时、拒绝或验证失败都会阻止发布，不回退到临时签名。

`manifest.json` 保存实际签名方式、团队和两次公证的 submission ID。校验值在最终 DMG 附加票据后计算。首次公证处理可能较慢；当前每次最多等待 20 分钟，超时仍须查询原 submission 状态及日志再重试，不把“已上传”当作“已通过”。macOS 仍可能出现正常的首次打开确认，签名与公证不等于取消所有系统提示。

要求来自 [Apple 的 macOS 公证说明](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)；本地 `scripts/build-macos.sh` 仍使用开发用 ad-hoc 签名，不能作为正式下载包。
