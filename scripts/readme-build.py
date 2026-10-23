"""Writes README.md (简体中文) and docs/readme/README.<locale>.md from one template.

    python scripts/readme-build.py

Every language shares the same layout and images; only the words differ.
Edit the strings here, never the generated files.
"""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
REPO = "https://github.com/LING-0001/SnapSlot"
EMAIL = "e1347605313@gmail.com"
ORDER = ["zh-Hans", "en", "zh-Hant", "ja", "ko", "es"]
NAMES = {"zh-Hans": "简体中文", "en": "English", "zh-Hant": "繁體中文", "ja": "日本語", "ko": "한국어", "es": "Español"}

T = {
    "zh-Hans": dict(
        name="SnapSlot 快照贴", tagline="复制过的，都钉在屏幕顶上。",
        sub="复制的图片、选中的文字，变成屏幕上沿的便签。点一下，就回到剪贴板。",
        badges="Windows 10 / 11 · macOS 13+ · 免费开源 · 不需要账号 · 不上传",
        site="在线体验", download="下载", contrib="参与贡献",
        demo_alt="SnapSlot 演示：鼠标移到上沿，便签落下；复制图片后自动钉上；拖进文档",
        h_use="怎么用",
        s_edge=("移到上沿，停一下", "鼠标在屏幕最上沿停 0.5 秒，便签以扇形落下；往下移开就收起。滚轮转动扇形。"),
        s_copy=("复制图片，自动钉上", "在任何应用里复制一张图片，它会飞到上沿。单击便签，原图回到剪贴板。"),
        s_drag=("拖出去就能用", "按住便签拖进任何应用或文件夹，作为 PNG / TXT 放下。"),
        s_select=("选中文字，按快捷键", "选中一段文字按 `Ctrl + Alt + T`（Mac：`⌃ ⌥ T`），钉成文字便签，原文同时进剪贴板。"),
        h_tray="托盘菜单与设置",
        tray_text="Windows 右键托盘图标，Mac 单击菜单栏图标：**设置…**、**自动收取剪贴板图片**、**固定便签**（后两项可勾选，勾上「固定」后鼠标离开也不收起）。设置里还能换外观、切换语言、看快捷键、清空全部。",
        h_platforms="Windows 与 macOS", platforms_text="两端界面和交互一致，系统能力各自原生实现。手机上也能体验官网演示。",
        alt_tray="托盘右键菜单", alt_settings="设置窗口", alt_mac="macOS 菜单栏与 Dock", alt_phone="手机上的演示",
        h_keys="快捷键", k_head=("操作", "Windows", "macOS"),
        keys=[("展开 / 收起便签", "Ctrl Alt Space", "⌃ ⌥ Space"), ("收取选中文字", "Ctrl Alt T", "⌃ ⌥ T"), ("截图", "Ctrl Shift S", "⌃ ⌥ S"), ("挑选 / 复制 / 移除 / 收起", "← → / Enter / Delete / Esc", "← → / Enter / Delete / Esc")],
        keys_note="快捷键都可在设置里重新录制。",
        h_privacy="隐私", privacy="不截屏、不读文件、不联网。只收其他应用写进剪贴板的图片，和你按快捷键时选中的文字。最多 30 张，退出就清空。",
        h_build="从源码构建",
        b_site="官网", b_win="Windows（需要 .NET 10 SDK、Node.js 22+）", b_mac="macOS（需要 Command Line Tools、Node.js 22+）",
        b_note="Windows 请携带整个 `artifacts/windows/win-x64/` 目录或 ZIP，不要只拷贝 exe。Mac 本地包为 ad-hoc 签名，仅用于测试。",
        h_layout="仓库结构",
        layout=[("apps/website", "官网（六种语言）、皮肤解析器"), ("apps/native-ui", "两端共用的便签与外观面板"), ("apps/windows", "Windows 客户端（C# / WPF + WebView2）"), ("apps/macos", "macOS 客户端（Swift / AppKit + WKWebView）"), ("docs", "设计记录、测试清单、README 图片")],
        h_test="测试", test_note="官网与共用界面 24 / 24 通过。Windows / macOS 检查命令和实机验收清单见 [CONTRIBUTING.md](CONTRIBUTING.md) 与 `docs/native-testing.md`。",
        h_contrib="参与贡献", contrib_text="欢迎 Issue 和 PR。一个提交只做一件事、一次只改一个平台，写清楚为什么改、改了什么、测试结果。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。",
        contact="问题与建议", h_license="许可", license="代码以 MIT 许可开源。名称与图标不在 MIT 授权范围内，见 [BRANDING.md](BRANDING.md)。",
    ),
    "en": dict(
        name="SnapSlot", tagline="Everything you copy, pinned to the top of your screen.",
        sub="Copied images and selected text become notes along the top edge. Click one and it’s back on your clipboard.",
        badges="Windows 10 / 11 · macOS 13+ · Free and open source · No account · No uploads",
        site="Try it online", download="Download", contrib="Contribute",
        demo_alt="SnapSlot demo: rest at the top edge and notes drop down; copied images pin themselves; drag one into a document",
        h_use="How it works",
        s_edge=("Rest at the top edge", "Pause the pointer at the very top for half a second and the notes fan down. Move away and they leave. Scroll to turn the fan."),
        s_copy=("Copy an image, it pins itself", "Copy an image in any app and it flies up to the top edge. Click a note and the original is back on your clipboard."),
        s_drag=("Drag it where you need it", "Hold a note and drop it into any app or folder as a PNG or TXT file."),
        s_select=("Select text, press the shortcut", "Select some text and press `Ctrl + Alt + T` (Mac: `⌃ ⌥ T`). It becomes a note, and the full text is copied too."),
        h_tray="Tray menu and settings",
        tray_text="Right-click the tray icon on Windows, or click the menu-bar icon on Mac: **Settings…**, **Collect clipboard images**, **Pin notes** (both checkable; with Pin on, notes stay open when the pointer leaves). Settings also change the look and language, show shortcuts, and clear everything.",
        h_platforms="Windows and macOS", platforms_text="Same notes and gestures on both; each uses its own system features natively. The website demo works on phones too.",
        alt_tray="Tray menu", alt_settings="Settings window", alt_mac="macOS menu bar and Dock", alt_phone="The demo on a phone",
        h_keys="Shortcuts", k_head=("Action", "Windows", "macOS"),
        keys=[("Show / hide notes", "Ctrl Alt Space", "⌃ ⌥ Space"), ("Pin selected text", "Ctrl Alt T", "⌃ ⌥ T"), ("Screenshot", "Ctrl Shift S", "⌃ ⌥ S"), ("Choose / copy / remove / hide", "← → / Enter / Delete / Esc", "← → / Enter / Delete / Esc")],
        keys_note="All shortcuts can be re-recorded in Settings.",
        h_privacy="Privacy", privacy="No screenshots taken for you, no file access, no network. SnapSlot only takes images other apps put on the clipboard, and text you select when you press the shortcut. Up to 30 notes; quit and they’re gone.",
        h_build="Build from source",
        b_site="Website", b_win="Windows (.NET 10 SDK, Node.js 22+)", b_mac="macOS (Command Line Tools, Node.js 22+)",
        b_note="On Windows, keep the whole `artifacts/windows/win-x64/` folder or ZIP together; the exe alone won’t run. The local Mac build is ad-hoc signed, for testing only.",
        h_layout="Repository layout",
        layout=[("apps/website", "Website (six languages), skin parser"), ("apps/native-ui", "Note and appearance panels shared by both clients"), ("apps/windows", "Windows client (C# / WPF + WebView2)"), ("apps/macos", "macOS client (Swift / AppKit + WKWebView)"), ("docs", "Design records, test checklists, README images")],
        h_test="Tests", test_note="Website and shared UI: 24 / 24 passing. Windows / macOS checks and the hardware checklist are in [CONTRIBUTING.md](CONTRIBUTING.md) and `docs/native-testing.md`.",
        h_contrib="Contributing", contrib_text="Issues and PRs welcome. One change per commit, one platform per commit, and say why, what changed, and what the tests showed. See [CONTRIBUTING.md](CONTRIBUTING.md) (Chinese).",
        contact="Questions and ideas", h_license="License", license="Code is MIT licensed. The name and icon are not covered by the MIT license; see [BRANDING.md](BRANDING.md).",
    ),
    "zh-Hant": dict(
        name="SnapSlot 快照貼", tagline="複製過的，都釘在螢幕頂端。",
        sub="複製的圖片、選取的文字，會變成螢幕上緣的便箋。點一下，就回到剪貼簿。",
        badges="Windows 10 / 11 · macOS 13+ · 免費開源 · 不需要帳號 · 不上傳",
        site="線上體驗", download="下載", contrib="參與貢獻",
        demo_alt="SnapSlot 示範：滑鼠移到上緣，便箋落下；複製圖片後自動釘上；拖進文件",
        h_use="怎麼用",
        s_edge=("移到上緣，停一下", "滑鼠在螢幕最上緣停 0.5 秒，便箋會呈扇形落下；往下移開就收起。滾輪可以轉動扇形。"),
        s_copy=("複製圖片，自動釘上", "在任何應用程式裡複製一張圖片，它會飛到上緣。點一下便箋，原圖就回到剪貼簿。"),
        s_drag=("拖出去就能用", "按住便箋拖進任何應用程式或資料夾，會以 PNG / TXT 放下。"),
        s_select=("選取文字，按快速鍵", "選取一段文字按 `Ctrl + Alt + T`（Mac：`⌃ ⌥ T`），釘成文字便箋，原文同時複製到剪貼簿。"),
        h_tray="工作列選單與設定",
        tray_text="Windows 在工作列圖示上按右鍵，Mac 點選單列圖示：**設定…**、**自動收取剪貼簿圖片**、**固定便箋**（後兩項可勾選，勾選「固定」後滑鼠離開也不收起）。設定裡還能換外觀、切換語言、查看快速鍵、全部清空。",
        h_platforms="Windows 與 macOS", platforms_text="兩端的便箋和操作一致，系統功能各自以原生方式實作。手機上也能體驗官網示範。",
        alt_tray="工作列右鍵選單", alt_settings="設定視窗", alt_mac="macOS 選單列與 Dock", alt_phone="手機上的示範",
        h_keys="快速鍵", k_head=("操作", "Windows", "macOS"),
        keys=[("展開 / 收起便箋", "Ctrl Alt Space", "⌃ ⌥ Space"), ("收取選取的文字", "Ctrl Alt T", "⌃ ⌥ T"), ("截圖", "Ctrl Shift S", "⌃ ⌥ S"), ("挑選 / 複製 / 移除 / 收起", "← → / Enter / Delete / Esc", "← → / Enter / Delete / Esc")],
        keys_note="所有快速鍵都可以在設定裡重新錄製。",
        h_privacy="隱私", privacy="不截圖、不讀取檔案、不連網。只收其他應用程式寫進剪貼簿的圖片，以及你按快速鍵時選取的文字。最多 30 張，結束就清空。",
        h_build="從原始碼建置",
        b_site="官網", b_win="Windows（需要 .NET 10 SDK、Node.js 22+）", b_mac="macOS（需要 Command Line Tools、Node.js 22+）",
        b_note="Windows 請攜帶整個 `artifacts/windows/win-x64/` 資料夾或 ZIP，不要只複製 exe。Mac 本機套件為 ad-hoc 簽署，僅供測試。",
        h_layout="儲存庫結構",
        layout=[("apps/website", "官網（六種語言）、外觀解析器"), ("apps/native-ui", "兩端共用的便箋與外觀面板"), ("apps/windows", "Windows 用戶端（C# / WPF + WebView2）"), ("apps/macos", "macOS 用戶端（Swift / AppKit + WKWebView）"), ("docs", "設計紀錄、測試清單、README 圖片")],
        h_test="測試", test_note="官網與共用介面 24 / 24 通過。Windows / macOS 檢查指令與實機驗收清單見 [CONTRIBUTING.md](CONTRIBUTING.md) 與 `docs/native-testing.md`。",
        h_contrib="參與貢獻", contrib_text="歡迎 Issue 和 PR。一個提交只做一件事、一次只改一個平台，寫清楚為什麼改、改了什麼、測試結果。詳見 [CONTRIBUTING.md](CONTRIBUTING.md)（簡體中文）。",
        contact="問題與建議", h_license="授權", license="程式碼以 MIT 授權開源。名稱與圖示不在 MIT 授權範圍內，見 [BRANDING.md](BRANDING.md)。",
    ),
    "ja": dict(
        name="SnapSlot", tagline="コピーしたものは、画面の上にピン留め。",
        sub="コピーした画像や選択したテキストが、画面の上端にメモとして並びます。クリックすれば、クリップボードに戻ります。",
        badges="Windows 10 / 11 · macOS 13+ · 無料・オープンソース · アカウント不要 · アップロードなし",
        site="オンラインで試す", download="ダウンロード", contrib="コントリビュート",
        demo_alt="SnapSlot のデモ：上端で止まるとメモが下りてくる、コピーした画像が自動でピン留め、書類へドラッグ",
        h_use="使いかた",
        s_edge=("上端で、少し止まる", "画面のいちばん上で 0.5 秒止まると、メモが扇形に下りてきます。マウスを下ろすと閉じます。ホイールで扇を回せます。"),
        s_copy=("画像をコピーすると、自動でピン留め", "どのアプリでも画像をコピーすると上端へ飛んでいきます。メモをクリックすれば、元の画像がクリップボードに戻ります。"),
        s_drag=("ドラッグして使う", "メモを押さえたまま、アプリやフォルダへ PNG / TXT としてドロップできます。"),
        s_select=("テキストを選んでショートカット", "テキストを選択して `Ctrl + Alt + T`（Mac は `⌃ ⌥ T`）。テキストのメモになり、全文もコピーされます。"),
        h_tray="トレイメニューと設定",
        tray_text="Windows はトレイアイコンを右クリック、Mac はメニューバーのアイコンをクリック：**設定…**、**クリップボードの画像を自動取り込み**、**メモを固定**（後の 2 つはオン／オフ。固定するとマウスが離れても閉じません）。設定では見た目・言語の変更、ショートカットの確認、すべて消去もできます。",
        h_platforms="Windows と macOS", platforms_text="メモと操作は共通、システム機能はそれぞれネイティブで実装しています。サイトのデモはスマホでも動きます。",
        alt_tray="トレイメニュー", alt_settings="設定ウインドウ", alt_mac="macOS のメニューバーと Dock", alt_phone="スマホでのデモ",
        h_keys="ショートカット", k_head=("操作", "Windows", "macOS"),
        keys=[("メモを表示 / 隠す", "Ctrl Alt Space", "⌃ ⌥ Space"), ("選択テキストをピン留め", "Ctrl Alt T", "⌃ ⌥ T"), ("スクリーンショット", "Ctrl Shift S", "⌃ ⌥ S"), ("選ぶ / コピー / 削除 / 閉じる", "← → / Enter / Delete / Esc", "← → / Enter / Delete / Esc")],
        keys_note="ショートカットはすべて設定で変更できます。",
        h_privacy="プライバシー", privacy="勝手に撮らない、ファイルを読まない、通信しない。取り込むのは、ほかのアプリがクリップボードに入れた画像と、ショートカットを押したときに選択していたテキストだけ。最大 30 枚、終了すればすべて消えます。",
        h_build="ソースからビルド",
        b_site="Web サイト", b_win="Windows（.NET 10 SDK、Node.js 22+）", b_mac="macOS（Command Line Tools、Node.js 22+）",
        b_note="Windows では `artifacts/windows/win-x64/` フォルダか ZIP ごと持ち運んでください。exe 単体では動きません。Mac のローカルビルドは ad-hoc 署名で、テスト用です。",
        h_layout="リポジトリ構成",
        layout=[("apps/website", "Web サイト（6 言語）、スキン解析"), ("apps/native-ui", "両クライアント共通のメモと外観パネル"), ("apps/windows", "Windows クライアント（C# / WPF + WebView2）"), ("apps/macos", "macOS クライアント（Swift / AppKit + WKWebView）"), ("docs", "設計記録、テスト項目、README 画像")],
        h_test="テスト", test_note="Web サイトと共通 UI：24 / 24 合格。Windows / macOS のチェックと実機確認項目は [CONTRIBUTING.md](CONTRIBUTING.md) と `docs/native-testing.md` を参照。",
        h_contrib="コントリビュート", contrib_text="Issue と PR を歓迎します。1 コミット 1 つの変更、1 コミット 1 プラットフォーム。理由・変更内容・テスト結果を書いてください。詳細は [CONTRIBUTING.md](CONTRIBUTING.md)（中国語）。",
        contact="質問・提案", h_license="ライセンス", license="コードは MIT ライセンスです。名前とアイコンは MIT の対象外です。[BRANDING.md](BRANDING.md) を参照。",
    ),
    "ko": dict(
        name="SnapSlot", tagline="복사한 모든 것을, 화면 위에 고정하세요.",
        sub="복사한 이미지와 선택한 텍스트가 화면 위쪽 가장자리에 메모로 놓입니다. 클릭하면 다시 클립보드로 돌아와요.",
        badges="Windows 10 / 11 · macOS 13+ · 무료 오픈 소스 · 계정 불필요 · 업로드 없음",
        site="온라인으로 체험", download="다운로드", contrib="기여하기",
        demo_alt="SnapSlot 데모: 위쪽 가장자리에 머물면 메모가 내려오고, 복사한 이미지가 자동으로 고정되고, 문서로 끌어다 놓기",
        h_use="사용 방법",
        s_edge=("맨 위에서 잠시 멈추기", "마우스를 화면 맨 위에 0.5초 두면 메모가 부채꼴로 내려와요. 아래로 옮기면 닫혀요. 휠로 부채를 돌릴 수 있어요."),
        s_copy=("이미지를 복사하면 자동 고정", "어떤 앱에서든 이미지를 복사하면 위로 날아가요. 메모를 클릭하면 원본이 클립보드로 돌아와요."),
        s_drag=("끌어다 놓아 쓰기", "메모를 누른 채 앱이나 폴더로 끌어다 놓으면 PNG / TXT 파일이 돼요."),
        s_select=("텍스트 선택 후 단축키", "텍스트를 선택하고 `Ctrl + Alt + T`(Mac: `⌃ ⌥ T`)를 누르면 텍스트 메모가 되고, 전체 텍스트도 복사돼요."),
        h_tray="트레이 메뉴와 설정",
        tray_text="Windows는 트레이 아이콘을 오른쪽 클릭, Mac은 메뉴 막대 아이콘을 클릭: **설정…**, **클립보드 이미지 자동 수집**, **메모 고정**(뒤의 두 개는 켜고 끌 수 있어요. 고정하면 마우스가 벗어나도 닫히지 않아요). 설정에서 모양과 언어 변경, 단축키 확인, 모두 지우기도 할 수 있어요.",
        h_platforms="Windows와 macOS", platforms_text="메모와 조작은 같고, 시스템 기능은 각자 네이티브로 구현했어요. 웹사이트 데모는 휴대폰에서도 동작해요.",
        alt_tray="트레이 메뉴", alt_settings="설정 창", alt_mac="macOS 메뉴 막대와 Dock", alt_phone="휴대폰에서의 데모",
        h_keys="단축키", k_head=("동작", "Windows", "macOS"),
        keys=[("메모 보이기 / 숨기기", "Ctrl Alt Space", "⌃ ⌥ Space"), ("선택한 텍스트 고정", "Ctrl Alt T", "⌃ ⌥ T"), ("스크린샷", "Ctrl Shift S", "⌃ ⌥ S"), ("선택 / 복사 / 삭제 / 숨기기", "← → / Enter / Delete / Esc", "← → / Enter / Delete / Esc")],
        keys_note="모든 단축키는 설정에서 다시 지정할 수 있어요.",
        h_privacy="개인정보", privacy="임의로 캡처하지 않고, 파일을 읽지 않고, 네트워크를 쓰지 않아요. 다른 앱이 클립보드에 넣은 이미지와, 단축키를 누를 때 선택한 텍스트만 받아요. 최대 30개, 종료하면 모두 사라져요.",
        h_build="소스에서 빌드",
        b_site="웹사이트", b_win="Windows(.NET 10 SDK, Node.js 22+)", b_mac="macOS(Command Line Tools, Node.js 22+)",
        b_note="Windows에서는 `artifacts/windows/win-x64/` 폴더나 ZIP을 통째로 옮기세요. exe만으로는 실행되지 않아요. Mac 로컬 빌드는 ad-hoc 서명이며 테스트용이에요.",
        h_layout="저장소 구조",
        layout=[("apps/website", "웹사이트(6개 언어), 스킨 파서"), ("apps/native-ui", "두 클라이언트가 함께 쓰는 메모·모양 패널"), ("apps/windows", "Windows 클라이언트(C# / WPF + WebView2)"), ("apps/macos", "macOS 클라이언트(Swift / AppKit + WKWebView)"), ("docs", "설계 기록, 테스트 항목, README 이미지")],
        h_test="테스트", test_note="웹사이트와 공용 UI: 24 / 24 통과. Windows / macOS 검사와 실기기 확인 항목은 [CONTRIBUTING.md](CONTRIBUTING.md)와 `docs/native-testing.md`를 보세요.",
        h_contrib="기여하기", contrib_text="Issue와 PR을 환영해요. 커밋 하나에 변경 하나, 플랫폼 하나. 이유·변경 내용·테스트 결과를 적어 주세요. 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)(중국어).",
        contact="문의와 제안", h_license="라이선스", license="코드는 MIT 라이선스예요. 이름과 아이콘은 MIT 적용 대상이 아니에요. [BRANDING.md](BRANDING.md)를 보세요.",
    ),
    "es": dict(
        name="SnapSlot", tagline="Todo lo que copias, fijado arriba en tu pantalla.",
        sub="Las imágenes que copias y el texto que seleccionas se vuelven notas en el borde superior. Haz clic en una y vuelve a tu portapapeles.",
        badges="Windows 10 / 11 · macOS 13+ · Gratis y de código abierto · Sin cuenta · Sin subidas",
        site="Pruébalo en línea", download="Descargar", contrib="Contribuir",
        demo_alt="Demostración de SnapSlot: al detenerte en el borde superior bajan las notas, las imágenes copiadas se fijan solas, arrastra una a un documento",
        h_use="Cómo funciona",
        s_edge=("Detente en el borde superior", "Deja el cursor arriba del todo medio segundo y las notas bajan en abanico. Al apartarlo, se van. La rueda gira el abanico."),
        s_copy=("Copia una imagen y se fija sola", "Copia una imagen en cualquier app y sube volando al borde. Haz clic en una nota y el original vuelve al portapapeles."),
        s_drag=("Arrástrala donde la necesites", "Mantén pulsada una nota y suéltala en cualquier app o carpeta como archivo PNG o TXT."),
        s_select=("Selecciona texto y pulsa el atajo", "Selecciona un texto y pulsa `Ctrl + Alt + T` (Mac: `⌃ ⌥ T`). Se vuelve una nota y el texto completo también se copia."),
        h_tray="Menú de la bandeja y ajustes",
        tray_text="Clic derecho en el icono de la bandeja en Windows, o clic en el icono de la barra de menús en Mac: **Ajustes…**, **Recoger imágenes del portapapeles**, **Fijar notas** (las dos últimas se activan y desactivan; con «Fijar», las notas no se ocultan al apartar el cursor). En Ajustes también cambias el aspecto y el idioma, ves los atajos y borras todo.",
        h_platforms="Windows y macOS", platforms_text="Las mismas notas y gestos en ambos; cada uno usa las funciones de su sistema de forma nativa. La demostración web también funciona en el móvil.",
        alt_tray="Menú de la bandeja", alt_settings="Ventana de ajustes", alt_mac="Barra de menús y Dock de macOS", alt_phone="La demostración en un móvil",
        h_keys="Atajos", k_head=("Acción", "Windows", "macOS"),
        keys=[("Mostrar / ocultar notas", "Ctrl Alt Space", "⌃ ⌥ Space"), ("Fijar texto seleccionado", "Ctrl Alt T", "⌃ ⌥ T"), ("Captura de pantalla", "Ctrl Shift S", "⌃ ⌥ S"), ("Elegir / copiar / quitar / ocultar", "← → / Enter / Delete / Esc", "← → / Enter / Delete / Esc")],
        keys_note="Todos los atajos se pueden volver a grabar en Ajustes.",
        h_privacy="Privacidad", privacy="No hace capturas por su cuenta, no lee archivos, no usa la red. Solo recoge las imágenes que otras apps ponen en el portapapeles y el texto que seleccionas al pulsar el atajo. Hasta 30 notas; al salir, todo se borra.",
        h_build="Compilar desde el código",
        b_site="Sitio web", b_win="Windows (.NET 10 SDK, Node.js 22+)", b_mac="macOS (Command Line Tools, Node.js 22+)",
        b_note="En Windows, lleva la carpeta `artifacts/windows/win-x64/` o el ZIP completos; el exe solo no funciona. La compilación local de Mac tiene firma ad-hoc, solo para pruebas.",
        h_layout="Estructura del repositorio",
        layout=[("apps/website", "Sitio web (seis idiomas), analizador de temas"), ("apps/native-ui", "Paneles de notas y apariencia compartidos"), ("apps/windows", "Cliente de Windows (C# / WPF + WebView2)"), ("apps/macos", "Cliente de macOS (Swift / AppKit + WKWebView)"), ("docs", "Registros de diseño, listas de pruebas, imágenes del README")],
        h_test="Pruebas", test_note="Sitio web e interfaz compartida: 24 / 24 superadas. Las comprobaciones de Windows / macOS y la lista para equipos reales están en [CONTRIBUTING.md](CONTRIBUTING.md) y `docs/native-testing.md`.",
        h_contrib="Contribuir", contrib_text="Se agradecen Issues y PR. Un cambio por commit y una plataforma por commit; explica el porqué, qué cambió y qué mostraron las pruebas. Consulta [CONTRIBUTING.md](CONTRIBUTING.md) (en chino).",
        contact="Preguntas e ideas", h_license="Licencia", license="El código tiene licencia MIT. El nombre y el icono no están cubiertos por la MIT; consulta [BRANDING.md](BRANDING.md).",
    ),
}


def build(locale: str) -> str:
    t = T[locale]
    up = "" if locale == "zh-Hans" else "../../"  # generated non-Chinese files live in docs/readme/
    m = f"{up}docs/media/{locale}"
    link = lambda l: f"{up}README.md" if l == "zh-Hans" else (f"{up}docs/readme/README.{l}.md" if up == "" else f"README.{l}.md")
    langs = " · ".join(f"<b>{NAMES[l]}</b>" if l == locale else f'<a href="{link(l)}">{NAMES[l]}</a>' for l in ORDER)
    fix = lambda s: s.replace("](CONTRIBUTING.md)", f"]({up}CONTRIBUTING.md)").replace("](BRANDING.md)", f"]({up}BRANDING.md)")
    site = f"http://101.200.239.135/{locale}/"

    def step(img, alt, pair, flip=False):
        title, body = pair
        pic = f'<td width="56%"><img src="{m}/{img}" alt="{alt}"></td>'
        words = f'<td width="44%"><h3>{title}</h3><p>{md_inline(body)}</p></td>'
        return f"<tr>{words}{pic}</tr>" if flip else f"<tr>{pic}{words}</tr>"

    rows = "\n".join([
        step("hero.webp", t["s_edge"][0], t["s_edge"]),
        step("drag.webp", t["s_drag"][0], t["s_drag"], flip=True),
        step("select.webp", t["s_select"][0], t["s_select"]),
    ])
    keys = "\n".join(f"| {a} | {kbd(w)} | {kbd(m_)} |" for a, w, m_ in t["keys"])
    layout = "\n".join(f"| `{d}` | {x} |" for d, x in t["layout"])
    return f"""<!-- Generated by scripts/readme-build.py — edit that file, not this one. -->
<p align="center"><img src="{up}apps/website/public/icon.svg" width="96" height="96" alt=""></p>

<h1 align="center">{t["name"]}</h1>

<p align="center"><b>{t["tagline"]}</b><br>{t["sub"]}</p>

<p align="center">{t["badges"]}</p>

<p align="center">
  <a href="{site}"><b>{t["site"]}</b></a> ·
  <a href="{REPO}/releases">{t["download"]}</a> ·
  <a href="{up}CONTRIBUTING.md">{t["contrib"]}</a>
</p>

<p align="center">{langs}</p>

<p align="center"><img src="{m}/demo.gif" width="760" alt="{t["demo_alt"]}"></p>

## {t["h_use"]}

<table>
{rows}
</table>

## {t["h_tray"]}

<table>
<tr>
<td width="50%"><img src="{m}/tray-menu.webp" alt="{t["alt_tray"]}"></td>
<td width="50%"><img src="{m}/settings.webp" alt="{t["alt_settings"]}"></td>
</tr>
</table>

{md_inline(t["tray_text"], keep_md=True)}

## {t["h_platforms"]}

<table>
<tr>
<td width="72%"><img src="{m}/macos.webp" alt="{t["alt_mac"]}"></td>
<td width="28%"><img src="{m}/phone.webp" alt="{t["alt_phone"]}"></td>
</tr>
</table>

{t["platforms_text"]}

## {t["h_keys"]}

| {t["k_head"][0]} | {t["k_head"][1]} | {t["k_head"][2]} |
| --- | --- | --- |
{keys}

{t["keys_note"]}

## {t["h_privacy"]}

{t["privacy"]}

## {t["h_build"]}

```bash
# {t["b_site"]}
npm ci --prefix apps/website
npm run dev --prefix apps/website -- --port 3000
```

```powershell
# {t["b_win"]}
.\\scripts\\build-windows.ps1
.\\artifacts\\windows\\win-x64\\SnapSlot.exe
```

```bash
# {t["b_mac"]}
./scripts/build-macos.sh
open artifacts/macos/SnapSlot.app
```

{t["b_note"]}

## {t["h_layout"]}

| | |
| --- | --- |
{layout}

## {t["h_test"]}

{fix(t["test_note"])}

## {t["h_contrib"]}

{fix(t["contrib_text"])}

{t["contact"]}：[GitHub Issues]({REPO}/issues) · {EMAIL}

## {t["h_license"]}

{fix(t["license"])}
"""


def kbd(keys: str) -> str:
    groups = [g.strip() for g in keys.split("/")]
    return " / ".join(" ".join(f"<kbd>{k}</kbd>" for k in g.split()) for g in groups)


def md_inline(text: str, keep_md: bool = False) -> str:
    """Inside HTML table cells GitHub does not render Markdown, so convert `code` and **bold**."""
    if keep_md:
        return text
    import re

    def code(m):
        s = m.group(1)
        if " + " in s:  # `Ctrl + Alt + T` → key caps
            return " ".join(f"<kbd>{k}</kbd>" for k in s.split(" + "))
        if s.startswith("⌃"):  # `⌃ ⌥ T`
            return " ".join(f"<kbd>{k}</kbd>" for k in s.split())
        return f"<code>{s}</code>"

    text = re.sub(r"`([^`]+)`", code, text)
    return re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)


(root / "docs" / "readme").mkdir(parents=True, exist_ok=True)
for locale in ORDER:
    target = root / "README.md" if locale == "zh-Hans" else root / "docs" / "readme" / f"README.{locale}.md"
    target.write_text(build(locale), encoding="utf-8", newline="\n")
    print(target.relative_to(root))
