# 发布分支、GitHub 打包与官网部署

日常在 `main` 开发和推送。`Verify SnapSlot` 运行源码版本、网站、原生界面及两端编译检查，不生成正式安装包，不创建 Release。

## 明确要求发布时

用户说“推送到 release 分支”或“releasev1.2.0”后：

1. 在 main 准备版本号、发布说明及 README，提交并推送。明确版本号优先；未指定时使用当前未发布版本，已经发布则默认递增 patch。
2. 将该 main 提交正常推送到 `release`、`releasev1.2.0` 或 `release/v1.2.0`。例如 `git push origin main:releasev1.2.0`。日常 main push 和手工 tag push 均不触发正式发布。
3. `Publish release` 校验发布者是 `LING-0001`，重跑者也是该账号；源码提交须在远端 main 历史中，版本须与版本分支、两端项目和网站一致。已经公开的版本会被拒绝，不覆盖安装包或标签。
4. GitHub 的 macOS runner 使用现有打包脚本，从这个提交编译 Mac 双架构应用及 Windows x64 自包含应用，生成 DMG、NSIS 安装器、清单与 SHA-256。Windows runner 实际安装、运行界面冒烟检查并卸载，确认用户文件保留。
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

构建前自动检查源码版本，从对应 GitHub Release 下载两个安装包、清单和 SHA-256。已有完整且校验通过的缓存会直接复用；下载不完整或校验失败会阻止构建，禁止部署失效下载按钮。构建产物为 `apps/website/out/`，须同步整个目录，包括 downloads。

服务器只需要 Node.js，不需要 Swift、.NET 或安装包工具。如果要单独准备缓存：

```bash
node scripts/fetch-release.mjs
node scripts/verify-release.mjs
```

只有 CI 源码预览可设置 `SNAPSLOT_SOURCE_CHECK_ONLY=1`。这个模式只验证版本并构建页面，不下载、不包含安装包，不属于可部署产物。

Nginx 的 root 指向静态产物目录，保持已有附件下载与 Range 配置。项目自带静态服务器同样支持 HEAD、附件 MIME、ETag 和单段 Range。部署后检查 DMG / EXE 为 200，断点请求为 206。

Mac 包仍为 ad-hoc 签名、未公证；Windows 包仍未签名。获得相应证书后应在生成最终安装包前签名并验证。
