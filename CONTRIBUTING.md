# 参与共创

谢谢你愿意一起做 SnapSlot。这份文档只讲一件事：**怎样提交，才能让别人一眼看懂、放心合并、出了问题能快速回退。**

SnapSlot 有三个平台：官网（`website`）、Windows 客户端（`windows`）、macOS 客户端（`macos`），外加两端共用的便签界面（`native-ui`）。它们经常要改「同一个功能」，最容易出的问题是：一个提交里同时改了三端，其中一端出错，结果整个提交都得回退。下面的规则就是为了避免这种情况。

## 五条规则

1. **一个提交只做一件事。**
   修一个 bug、加一个功能、改一处文案，各自一个提交。「顺手」改的格式、重命名、无关的小修，单独再提一个提交。

2. **一个提交只改一个平台。**
   同一个功能要在 Windows 和 macOS 都实现，就拆成两个提交，先后提交，各自都能通过测试。
   只有以下情况允许跨平台出现在同一个提交里，并且必须在正文里说明原因：
   - 改的是三端共用的东西（`native-ui`、官网样式与多语言文案、品牌图标），且不改会导致构建失败；
   - 纯文档提交（只改 `.md`）。

3. **写清楚四件事：为什么改、改了哪个平台、改了什么、测试结果。** 格式见下方「提交信息格式」。

4. **每个提交都能单独通过它所在平台的测试。**
   不要提交「先坏掉、下一个提交再修好」的中间状态。没法在本机跑的测试（例如在 Windows 上跑不了 Swift），在测试结果里写「未运行」并说明原因，不要写「通过」。

5. **不夸大验证结果。**
   编译通过 ≠ 浏览器测试通过 ≠ 实机验收。只写你真正跑过、真正看到的结果。

## 提交信息格式

```
<类型>(<平台>): <一句话说明改了什么>

为什么：<遇到了什么问题 / 用户要什么。一到三句。>

平台：<website | windows | macos | native-ui | docs | ci>

改动：
- <具体改了什么，按文件或行为列出>
- <……>

测试：
- <命令>：<结果，带数字>
- <手动验证：在什么系统、什么尺寸、做了什么、看到了什么>
- <没跑的测试：写明原因>

关联：#<Issue 编号>（可选）
```

### 类型

| 类型 | 用于 |
| --- | --- |
| `feat` | 新功能、新交互 |
| `fix` | 修 bug |
| `style` | 只改视觉（颜色、间距、动画），不改行为 |
| `refactor` | 不改行为的代码整理 |
| `test` | 只加或改测试 |
| `docs` | 只改文档 |
| `chore` | 构建脚本、依赖、CI |

### 平台

| 平台 | 对应目录 | 至少要跑的测试 |
| --- | --- | --- |
| `website` | `apps/website`（除 `tests/native-ui.spec.ts` 相关） | `npm run build` + `npx playwright test` |
| `native-ui` | `apps/native-ui` | `npm run build:native` + `npx playwright test tests/native-ui.spec.ts` |
| `windows` | `apps/windows` | `.\scripts\build-windows.ps1` + Windows 逻辑检查 |
| `macos` | `apps/macos`、`scripts/make-icon.swift` | `./scripts/build-macos.sh` + `SnapSlotCoreChecks` |
| `docs` | `*.md`、`docs/` | 无 |
| `ci` | `.github/`、`scripts/`（除 `make-icon.swift`） | 对应 CI 任务 |

各命令的完整写法见 README「测试」一节。

## 示例

> 下面示例里的测试数字只用来示范格式，写你自己的提交时请填真实跑出来的结果。

### 好的提交：一个平台、一件事、四项写全

```
fix(windows): 托盘图标改为读取随程序附带的 SnapSlot.ico

为什么：托盘图标原来是代码里画的旧图案，换了新图标后任务栏和托盘
显示的不一样，用户看到两个不同的 SnapSlot。

平台：windows

改动：
- SnapSlot.Windows.csproj：把 assets/brand/SnapSlot.ico 复制到输出目录
- RailWindow.cs：托盘优先加载 SnapSlot.ico，按系统小图标尺寸取帧；
  文件缺失时退回 exe 自带图标
- 删除不再使用的 RoundedRectangle 和 DestroyIcon

测试：
- .\scripts\build-windows.ps1：构建成功，0 警告
- Windows 逻辑检查：12 / 12 通过
- 手动：Windows 11 23H2，100% 和 150% 缩放下托盘图标与任务栏图标一致；
  删掉 SnapSlot.ico 后启动，托盘显示 exe 图标，没有崩溃
```

### 同一个功能，跨两端：拆成两个提交

需求：「设置里加语言选项」。

```
feat(windows): 设置窗口新增语言选项

为什么：Windows 目前只能改 locale.txt 或跟随系统语言，界面上没有入口。
平台：windows
改动：……（只动 apps/windows）
测试：……
```

```
feat(macos): 设置窗口新增语言选项

为什么：macOS 的语言只能在菜单栏子菜单里切换，和 Windows 不一致。
平台：macos
改动：……（只动 apps/macos）
测试：……
```

如果两端都要用到共用界面里的新控件，就再加一个**最先提交**的 `feat(native-ui)`，让后面两个平台提交都建立在它之上。

### 不好的提交

```
update
```
看不出改了什么、为什么改、能不能回退。

```
feat: 加语言选项，顺便修了托盘图标和官网页脚
```
三件事、三个平台混在一起。官网页脚有问题时，没法只回退页脚。

```
fix(macos): 修复图标

测试：通过
```
没说为什么、没说改了什么；「通过」没有说跑了什么、多少项。

## Pull Request

- 一个 PR 可以包含多个提交，但最好只围绕一个需求；跨平台的需求按平台拆提交即可，不必拆 PR。
- PR 描述按模板填写（`.github/pull_request_template.md`），并附上截图或录屏——改界面的 PR 必须附图，桌面和手机各一张。
- CI 三个任务（website / windows / macos）全部通过再请求合并。

## README 与截图

README 有六种语言：`README.md`（简体中文）和 `docs/readme/README.<语言>.md`。它们都由脚本生成，**不要直接改这几个文件**。

- 改 README 文字：编辑 `scripts/readme-build.py` 里对应语言的字符串，然后运行 `python scripts/readme-build.py`。
- 改了界面，README 里的图也要更新。截图和动图都由脚本从官网自动截取，六种语言一次生成：

  ```bash
  npm run dev --prefix apps/website -- --port 3000     # 另开一个终端
  npm run readme:media --prefix apps/website           # 截图 + 录制演示动图（约 5 分钟）
  python scripts/readme-gif.py                         # 合成 demo.gif、转成 WebP
  python scripts/readme-build.py                       # 重新生成六份 README
  ```

  只想更新某一种语言：`node apps/website/scripts/readme-media.mjs en` 和 `python scripts/readme-gif.py en`。
- 更新图片单独作为一个 `docs` 提交，测试一栏写清楚截取时官网对应的提交。图片放在 `docs/media/<语言>/`，每种语言约 1 MB。

## 其他约定

- 界面文案六种语言一起改：`apps/website/lib/home-copy.ts`（官网）、`apps/native-ui`（客户端）。只会一两种语言时，在 PR 里说明，其他语言可以先用英文占位，由维护者补齐。
- 产品术语以 `CONTEXT.md` 为准（例如「便签」「固定」「自动收取」），不要自造新词。
- 改动影响设计决策时，同步更新 `CONTEXT.md` 和 `apps/website/DESIGN.md`，只保留当前官网方案。
- 名称和图标的使用规则见 `BRANDING.md`。

有疑问可以开 Issue，或发邮件到 e1347605313@gmail.com。
