# 成品包发布与官网直链

发布文件随普通 Git 提交保存到 `apps/website/public/downloads/v1.1.0/`，没有使用 Git LFS。官网两个按钮直接下载本站安装包，页脚保留 GitHub Releases，导航保留代码仓库入口。

服务器更新并完成静态构建后，下载地址为：

- [macOS 13+，Apple Silicon / Intel](http://101.200.239.135/downloads/v1.1.0/SnapSlot-1.1.0-macOS-universal.dmg)
- [Windows 10 / 11 x64](http://101.200.239.135/downloads/v1.1.0/SnapSlot-1.1.0-windows-x64-setup.exe)
- [SHA-256 校验文件](http://101.200.239.135/downloads/v1.1.0/SHA256SUMS.txt)

按钮使用相对地址，将来迁移域名无需改下载代码。

## 本地提交与 GitHub Release

先检查并提交本次代码、文档和整个 `apps/website/public/downloads/v1.1.0/` 目录，再推送分支。不要只提交下载链接或清单。

```bash
node scripts/verify-release.mjs
git push
git tag -a v1.1.0 -m "SnapSlot v1.1.0"
git push origin v1.1.0
```

标签应指向已包含这两个成品包的提交。推送标签会触发 `.github/workflows/release.yml`，先验证版本、SHA-256、Mac DMG 内的签名与双架构，以及 Windows 安装 / 卸载流程，全部通过后将同一份 DMG、EXE、校验文件、清单上传至 GitHub Release。无需本地登录 GitHub CLI；工作流使用仓库的 `GITHUB_TOKEN`。代码仓库需允许 Actions 运行。

## 服务器拉取与部署

在服务器现有项目目录执行：

```bash
git pull --ff-only
npm ci --prefix apps/website
npm run build --prefix apps/website
```

静态产物位于 `apps/website/out/`，包含所有语言页面及 `downloads/`。服务器只需 Node.js，不需要 Swift、.NET SDK 或 Windows。构建前自动检查下载包，缺失、版本不符或内容损坏会直接报错。

如果当前使用 Nginx，网站根目录应指向项目的 `apps/website/out/`；如果使用自己的发布目录，需要同步**整个 out 目录**，包括 `downloads/`，再 reload Nginx。Nginx 原生支持 Range 请求，可在现有 server 配置内补充：

```nginx
# 保留现有其他路由；将 root 替换为真实路径。
root /path/to/SnapSlot/apps/website/out;

location ~ ^/downloads/v[0-9]+\.[0-9]+\.[0-9]+/[^/]+\.(dmg|exe)$ {
    try_files $uri =404;
    types { application/x-apple-diskimage dmg; application/vnd.microsoft.portable-executable exe; }
    add_header Content-Disposition 'attachment';
    add_header Cache-Control 'public, max-age=31536000, immutable';
}
```

如果使用项目自带的 Node 静态服务器，构建后以现有进程管理方式重启它：

```bash
HOST=0.0.0.0 PORT=3000 npm start --prefix apps/website
```

它支持 DMG / EXE 附件下载、HEAD、ETag 和单段 Range 断点续传。公网反向代理应转发 Range / If-Range 等请求头。

部署后用任一下载链接验证响应应为 `200`、对应的 DMG / EXE MIME 类型，而不是跳转 GitHub。断点请求应为 `206`：

```bash
curl -I http://101.200.239.135/downloads/v1.1.0/SnapSlot-1.1.0-macOS-universal.dmg
curl -r 0-31 -D - -o /dev/null http://101.200.239.135/downloads/v1.1.0/SnapSlot-1.1.0-windows-x64-setup.exe
```

## 后续版本

在 Mac 上准备新版本：更新 `release.json`、两端项目版本及网站 package 版本，安装网站依赖、.NET 10 SDK 和 Python 3.10+，以及以下打包工具：

```bash
brew install makensis sevenzip ffmpeg
python3 -m venv .tools/dmgbuild
.tools/dmgbuild/bin/pip install dmgbuild==1.6.7
```

正式发布时，先刷新六语言截图、引导素材、GIF / MP4 录屏和 README。保持官网开发服务运行，再在另一个终端执行：

```bash
npm run build:native --prefix apps/website
node apps/website/scripts/readme-media.mjs
python3 scripts/readme-gif.py  # 需要 Pillow；MP4 编码使用 FFmpeg
python3 scripts/readme-build.py
```

截图脚本使用本机 Chrome，设置截图直接载入本次 NativeUI 构建。请检查引导位置、便签状态、设置与冲突说明后再发布。Mac 的 `CFBundleVersion` 应随正式版本递增，Windows 应用清单版本应与项目版本一起更新。

然后运行：

```bash
node scripts/prepare-release.mjs
node scripts/verify-release.mjs
```

脚本生成带拖拽安装引导的 Mac 通用 DMG、Windows x64 安装器、SHA-256 与清单，成功后移除旧版本下载目录。Windows 安装器包含 .NET、桌面与开始菜单快捷方式、卸载入口；缺少 WebView2 时会自动联网安装。打包时会从微软官方地址下载其引导程序，安装器会提示用户保持联网。

Mac DMG 通过 `hdiutil verify` 检查，Windows 安装器通过 7-Zip 检查并逐文件比对完整载荷。Windows CI 还会验证微软引导程序的 Authenticode 签名，并执行静默安装、快捷方式 / 注册信息和卸载保留用户文件的检查。安装体验：Mac 用户打开 DMG 后，把 SnapSlot 拖到“应用程序”；Windows 用户双击 `setup.exe` 按引导安装，无需处理 DLL 或项目源码。

已发布的版本文件名不可覆盖；修复后使用新的版本号，避免长期缓存取到旧包。GitHub 中历史 Release 保留，官网仓库只保留最新成品目录。每版还需添加 `docs/releases/v版本号.md` 后提交和推送标签。

当前 Mac 包为 ad-hoc 签名、未公证；Windows 包未签名。获得相应签名证书后应在生成最终安装包前签名并验证。

尚未发布且没有本地版本标签的候选包，可以用 `--replace-unpublished` 重新准备；正式发布后必须递增版本号。
