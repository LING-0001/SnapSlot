"""Writes README.md (简体中文) and docs/readme/README.<locale>.md from one template.

    python scripts/readme-build.py

Every language shares the same layout and images; only the words differ.
Edit the strings here, never the generated files.
"""
from pathlib import Path
import json
import hashlib
import subprocess
from functools import lru_cache

root = Path(__file__).resolve().parent.parent
REPO = "https://github.com/LING-0001/SnapSlot"
EMAIL = "e1347605313@gmail.com"
VERSION = json.loads((root / "release.json").read_text())["version"]
DOWNLOADS = f"{REPO}/releases/download/v{VERSION}"
ORDER = ["zh-Hans", "en", "zh-Hant", "ja", "ko", "es"]
NAMES = {"zh-Hans": "简体中文", "en": "English", "zh-Hant": "繁體中文", "ja": "日本語", "ko": "한국어", "es": "Español"}


@lru_cache(maxsize=None)
def committed_asset(relative: str):
    """Pin committed images; GitHub's relative-image redirect drops query keys."""
    data = (root / relative).read_bytes()
    blob = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
    try:
        tracked = subprocess.check_output(
            ["git", "rev-parse", f"HEAD:{relative}"], cwd=root, stderr=subprocess.DEVNULL, text=True
        ).strip()
        if tracked == blob:
            commit = subprocess.check_output(
                ["git", "log", "-1", "--format=%H", "--", relative], cwd=root, text=True
            ).strip()
            if len(commit) == 40:
                return f"https://raw.githubusercontent.com/LING-0001/SnapSlot/{commit}/{relative}"
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    # Uncommitted captures and source ZIPs still preview their own local files.
    return None

T = {
    "zh-Hans": dict(
        name="SnapSlot 快照贴", tagline="把重要的内容，留在眼前。",
        sub="把截图和文字贴在屏幕上，让参考资料和临时想法随时可见。",
        site="在线体验", download="下载", contrib="参与贡献",
        download_mac="下载 macOS 版",
        download_win="下载 Windows 版",
        animated="查看动图",
        watch="观看演示",
        developer="开发与贡献",
        key_preview="放大查看便签",
        install="安装说明",
        demo_alt="快照贴交互演示：展开便签、收取文字、拖入文档",
        h_use="怎么用",
        s_edge=("移到上沿，停一下", "鼠标在屏幕最上沿停 0.5 秒，便签以扇形落下；往下移开就收起。滚轮转动扇形。"),
        s_drag=('拖出去就能用', '按住便签拖到支持接收图片或文字的应用，也可以拖到文件夹，作为 PNG / TXT 放下。'),
        s_select=('选中文字，按快捷键', '选中允许复制的文字，按 `⌃ ⌥ T`（Windows：`Ctrl + Alt + T`），收为文字便签，原文同时复制到剪贴板。'),
        h_tray="菜单与设置",
        tray_text="点按 macOS 菜单栏图标，或右键 Dock 图标，即可打开设置、切换自动收取和固定便签。Windows 使用托盘右键菜单。设置中可以更换外观、语言与快捷键，也可以清空当前便签。",
        alt_settings="设置窗口",
        h_keys="快捷键", k_head=("操作", "Windows", "macOS"),
        keys=[('展开 / 收起便签', 'Ctrl Alt Space', '⌃ ⌥ Space'), ('收取选中文字', 'Ctrl Alt T', '⌃ ⌥ T'), ('挑选 / 复制 / 移除 / 收起', '← → / Enter / Delete / Esc', '← → / Enter / Delete / Esc')],
        keys_note='表中为默认快捷键。Mac 和 Windows 均可在设置中点击组合键，再按下新组合。启动和打开设置时会同时检查两组快捷键，提前显示检测到的冲突及可用替代组合。录入不屏蔽其他应用；Mac 录入无需辅助功能权限，收取选中文字时才需要。部分共享注册的快捷键可能无法检测。',
        h_privacy="隐私", privacy="自动收取新复制的图片；文字只在你选中并按下快捷键时收取。内容在本机处理，不上传便签。最多 30 张，满额移除最早一张，正常退出后清空当前便签会话。",
        h_build="从源码构建",
        b_site="官网", b_win="Windows（需要 .NET 10 SDK、Node.js 22+）", b_mac="macOS（需要 Command Line Tools、Node.js 22+）",
        b_note="用户可直接下载上方 DMG / Setup 安装包。源码构建产物供开发调试。Mac 包为 ad-hoc 签名，未做 Apple 公证，系统可能阻止首次启动。发布与服务器部署见 [发布指南](docs/releases/hosting.md)。",
        h_layout="仓库结构",
        layout=[('apps/website', '官网与六语言交互演示'), ('apps/native-ui', '两端共用的扇形便签、菜单与设置'), ('apps/windows', 'Windows 客户端（C# / WPF + WebView2）'), ('apps/macos', 'macOS 客户端（Swift / AppKit + WKWebView）'), ('docs', '当前规范、测试清单、README 图片')],
        h_test="测试", test_note='构建、自动化测试和实机验收命令见 [CONTRIBUTING.md](CONTRIBUTING.md) 与 `docs/native-testing.md`。',
        contrib_text="欢迎 Issue 和 PR。围绕一个需求组织提交，写清涉及平台、行为变化与实际验证。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。",
        contact="问题与建议", h_license="许可", license="代码以 MIT 许可开源。名称与图标不在 MIT 授权范围内，见 [BRANDING.md](BRANDING.md)。",
    ),
    "en": dict(
        name="SnapSlot", tagline="Keep what matters, right in sight.",
        sub="Pin screenshots and text above your work. Keep references and passing thoughts within reach.",
        site="Try it online", download="Download", contrib="Contribute",
        download_mac="Download for macOS",
        download_win="Download for Windows",
        animated="View GIF",
        watch="Watch the demo",
        developer="Development & contributing",
        key_preview="Read a full note",
        install="Installation guide",
        demo_alt="Snapshot Pin interactive demo: reveal notes, collect text, and drag into a document",
        h_use="How it works",
        s_edge=("Rest at the top edge", "Pause the pointer at the very top for half a second and the notes fan down. Move away and they leave. Scroll to turn the fan."),
        s_drag=('Drag it where you need it', 'Drop a note into a compatible app or folder as a PNG or TXT file.'),
        s_select=('Select text, press the shortcut', 'Select text that the app allows you to copy, then press `⌃ ⌥ T` (Windows: `Ctrl + Alt + T`). It becomes a note, and the full text is copied too.'),
        h_tray="Menu and settings",
        tray_text="Click the macOS menu-bar icon or right-click the Dock icon to open Settings, toggle image collection, or pin notes. On Windows, use the tray menu. Settings also controls appearance, language, shortcuts, and clearing the current notes.",
        alt_settings="Settings window",
        h_keys="Shortcuts", k_head=("Action", "Windows", "macOS"),
        keys=[('Show / hide notes', 'Ctrl Alt Space', '⌃ ⌥ Space'), ('Pin selected text', 'Ctrl Alt T', '⌃ ⌥ T'), ('Choose / copy / remove / hide', '← → / Enter / Delete / Esc', '← → / Enter / Delete / Esc')],
        keys_note='These are the defaults. Click a shortcut in Settings and press a new combination. Both bindings are checked at startup and when Settings opens, showing detected conflicts and available replacements before editing. Recording leaves other apps active and needs no Accessibility permission on Mac; collecting selected text does. Some shared shortcut registrations may not be detectable.',
        h_privacy="Privacy", privacy="Newly copied images are collected automatically. Text is collected only after you select it and press the shortcut. Notes are processed locally and are not uploaded. Keep up to 30 notes; the oldest is removed when full, and a normal exit clears the current note session.",
        h_build="Build from source",
        b_site="Website", b_win="Windows (.NET 10 SDK, Node.js 22+)", b_mac="macOS (Command Line Tools, Node.js 22+)",
        b_note="Download the DMG / Setup installer above to install the app. Source-build outputs are intended for development. The Mac package is ad-hoc signed and not notarized; the system may block its first launch. See the [release and hosting guide](docs/releases/hosting.md).",
        h_layout="Repository layout",
        layout=[('apps/website', 'Website and interactive demo in six languages'), ('apps/native-ui', 'Fan notes, menu and settings shared by both clients'), ('apps/windows', 'Windows client (C# / WPF + WebView2)'), ('apps/macos', 'macOS client (Swift / AppKit + WKWebView)'), ('docs', 'Current specifications, test checklists, README images')],
        h_test="Tests", test_note='Build, automated test and physical-machine acceptance commands are in [CONTRIBUTING.md](CONTRIBUTING.md) and `docs/native-testing.md`.',
        contrib_text="Issues and PRs welcome. Keep commits focused on one need and describe the affected platforms, behavior changes, and actual verification. See [CONTRIBUTING.md](CONTRIBUTING.md) (Chinese).",
        contact="Questions and ideas", h_license="License", license="Code is MIT licensed. The name and icon are not covered by the MIT license; see [BRANDING.md](BRANDING.md).",
    ),
    "zh-Hant": dict(
        name="SnapSlot 快照貼", tagline="把重要的內容，留在眼前。",
        sub="把截圖和文字貼在螢幕上方，讓參考資料和臨時想法隨時可見。",
        site="線上體驗", download="下載", contrib="參與貢獻",
        download_mac="下載 macOS 版",
        download_win="下載 Windows 版",
        animated="查看動圖",
        watch="觀看示範",
        developer="開發與貢獻",
        key_preview="放大閱讀便箋",
        install="安裝說明",
        demo_alt="快照貼互動示範：展開便箋、收取文字、拖入文件",
        h_use="怎麼用",
        s_edge=("移到上緣，停一下", "滑鼠在螢幕最上緣停 0.5 秒，便箋會呈扇形落下；往下移開就收起。滾輪可以轉動扇形。"),
        s_drag=('拖出去就能用', '按住便箋拖到支援接收圖片或文字的應用程式，也可以拖到資料夾，以 PNG / TXT 放下。'),
        s_select=('選取文字，按快速鍵', '選取允許複製的文字，按 `⌃ ⌥ T`（Windows：`Ctrl + Alt + T`），收為文字便箋，原文同時複製到剪貼簿。'),
        h_tray="選單與設定",
        tray_text="點選 macOS 選單列圖示，或在 Dock 圖示上按右鍵，即可開啟設定、切換自動收取與固定便箋。Windows 使用系統匣右鍵選單。設定中可更換外觀、語言與快速鍵，也可以清空目前便箋。",
        alt_settings="設定視窗",
        h_keys="快速鍵", k_head=("操作", "Windows", "macOS"),
        keys=[('展開 / 收起便箋', 'Ctrl Alt Space', '⌃ ⌥ Space'), ('收取選取的文字', 'Ctrl Alt T', '⌃ ⌥ T'), ('挑選 / 複製 / 移除 / 收起', '← → / Enter / Delete / Esc', '← → / Enter / Delete / Esc')],
        keys_note='表中為預設快速鍵。在設定中點選組合鍵，再按下新組合即可修改。啟動及開啟設定時會同時檢查兩組快速鍵，提前顯示偵測到的衝突與可用替代組合。錄入不攔截其他應用程式；Mac 僅在收取選取文字時需要輔助使用權限。部分共用註冊的快速鍵可能無法偵測。',
        h_privacy="隱私", privacy="自動收取新複製的圖片；文字只在你選取並按下快速鍵時收取。內容在本機處理，不上傳便箋。最多 30 張，額滿移除最早一張，正常結束後清空目前便箋工作階段。",
        h_build="從原始碼建置",
        b_site="官網", b_win="Windows（需要 .NET 10 SDK、Node.js 22+）", b_mac="macOS（需要 Command Line Tools、Node.js 22+）",
        b_note="使用者可直接下載上方 DMG / Setup 安裝套件。原始碼建置產物供開發測試。Mac 套件為 ad-hoc 簽署，尚未經 Apple 公證，系統可能阻止首次啟動。請參閱[發布與部署指南](docs/releases/hosting.md)。",
        h_layout="儲存庫結構",
        layout=[('apps/website', '官網與六語言互動示範'), ('apps/native-ui', '兩端共用的扇形便箋、選單與設定'), ('apps/windows', 'Windows 用戶端（C# / WPF + WebView2）'), ('apps/macos', 'macOS 用戶端（Swift / AppKit + WKWebView）'), ('docs', '目前規範、測試清單、README 圖片')],
        h_test="測試", test_note='建置、自動化測試及實機驗收指令見 [CONTRIBUTING.md](CONTRIBUTING.md) 與 `docs/native-testing.md`。',
        contrib_text="歡迎 Issue 和 PR。圍繞一項需求組織提交，說明涉及平台、行為變更與實際驗證。詳見 [CONTRIBUTING.md](CONTRIBUTING.md)（簡體中文）。",
        contact="問題與建議", h_license="授權", license="程式碼以 MIT 授權開源。名稱與圖示不在 MIT 授權範圍內，見 [BRANDING.md](BRANDING.md)。",
    ),
    "ja": dict(
        name="SnapSlot", tagline="大切なものを、いつでも目の前に。",
        sub="画像や文字を画面の手前に。参考資料や思いついたアイデアを、いつでも見える場所へ。",
        site="オンラインで試す", download="ダウンロード", contrib="コントリビュート",
        download_mac="macOS 版をダウンロード",
        download_win="Windows 版をダウンロード",
        animated="GIF を見る",
        watch="デモを見る",
        developer="開発と貢献",
        key_preview="メモを拡大して読む",
        install="インストール方法",
        demo_alt="SnapSlot の操作デモ：メモを表示し、文字を取り込み、文書にドラッグ",
        h_use="使いかた",
        s_edge=("上端で、少し止まる", "画面のいちばん上で 0.5 秒止まると、メモが扇形に下りてきます。マウスを下ろすと閉じます。ホイールで扇を回せます。"),
        s_drag=('ドラッグして使う', '対応するアプリやフォルダーに、PNG または TXT としてドラッグできます。'),
        s_select=('テキストを選んでショートカット', 'コピー可能なテキストを選び、`⌃ ⌥ T`（Windows：`Ctrl + Alt + T`）を押すとメモになります。全文もクリップボードにコピーされます。'),
        h_tray="メニューと設定",
        tray_text="macOS ではメニューバーのアイコンをクリックするか、Dock アイコンを右クリックして、設定・画像の自動取り込み・メモの固定を操作できます。Windows ではトレイメニューを使います。設定から外観、言語、ショートカットの変更やメモの消去もできます。",
        alt_settings="設定ウインドウ",
        h_keys="ショートカット", k_head=("操作", "Windows", "macOS"),
        keys=[('メモを表示 / 隠す', 'Ctrl Alt Space', '⌃ ⌥ Space'), ('選択テキストをピン留め', 'Ctrl Alt T', '⌃ ⌥ T'), ('選ぶ / コピー / 削除 / 閉じる', '← → / Enter / Delete / Esc', '← → / Enter / Delete / Esc')],
        keys_note='表は初期設定です。設定でショートカットをクリックし、新しいキーの組み合わせを押すと変更できます。起動時と設定を開いたときに両方の競合を確認し、検出した競合と代替キーを先に表示します。記録中も他のアプリは動作します。Mac でアクセシビリティ権限が必要なのは選択テキストの収集時だけです。一部の共有登録は検出できない場合があります。',
        h_privacy="プライバシー", privacy="新しくコピーした画像を自動で取り込みます。テキストは選択してショートカットを押したときだけ取り込みます。メモは端末内で処理し、アップロードしません。最大30件で、上限時は最も古いメモを削除し、通常の終了時に現在のセッションを消去します。",
        h_build="ソースからビルド",
        b_site="Web サイト", b_win="Windows（.NET 10 SDK、Node.js 22+）", b_mac="macOS（Command Line Tools、Node.js 22+）",
        b_note="上の DMG / Setup インストーラーからインストールできます。ソースのビルド出力は開発用です。Mac 版は ad-hoc 署名で Apple の公証を受けていないため、初回起動がブロックされる場合があります。[公開・配信ガイド](docs/releases/hosting.md)も参照してください。",
        h_layout="リポジトリ構成",
        layout=[('apps/website', '6 言語のサイトとインタラクティブデモ'), ('apps/native-ui', '両クライアント共通の扇形メモ・メニュー・設定'), ('apps/windows', 'Windows クライアント（C# / WPF + WebView2）'), ('apps/macos', 'macOS クライアント（Swift / AppKit + WKWebView）'), ('docs', '現在の仕様、テスト項目、README 画像')],
        h_test="テスト", test_note='ビルド、自動テスト、実機確認のコマンドは [CONTRIBUTING.md](CONTRIBUTING.md) と `docs/native-testing.md` を参照してください。',
        contrib_text="Issue と PR を歓迎します。一つの要件に沿ってコミットをまとめ、対象プラットフォーム、動作の変更、実際の検証を記載してください。詳細は [CONTRIBUTING.md](CONTRIBUTING.md)（中国語）。",
        contact="質問・提案", h_license="ライセンス", license="コードは MIT ライセンスです。名前とアイコンは MIT の対象外です。[BRANDING.md](BRANDING.md) を参照。",
    ),
    "ko": dict(
        name="SnapSlot", tagline="중요한 내용을, 바로 눈앞에.",
        sub="스크린샷과 텍스트를 화면 위에 붙여 참고 자료와 아이디어를 가까이 두세요.",
        site="온라인으로 체험", download="다운로드", contrib="기여하기",
        download_mac="macOS 버전 다운로드",
        download_win="Windows 버전 다운로드",
        animated="GIF 보기",
        watch="데모 보기",
        developer="개발 및 기여",
        key_preview="메모 크게 보기",
        install="설치 안내",
        demo_alt="SnapSlot 사용 데모: 메모 펼치기, 텍스트 수집, 문서로 드래그",
        h_use="사용 방법",
        s_edge=("맨 위에서 잠시 멈추기", "마우스를 화면 맨 위에 0.5초 두면 메모가 부채꼴로 내려와요. 아래로 옮기면 닫혀요. 휠로 부채를 돌릴 수 있어요."),
        s_drag=('끌어다 놓아 쓰기', '메모를 지원하는 앱이나 폴더에 PNG 또는 TXT로 끌어다 놓을 수 있습니다.'),
        s_select=('텍스트 선택 후 단축키', '복사가 허용된 텍스트를 선택하고 `⌃ ⌥ T`(Windows: `Ctrl + Alt + T`)를 누르면 메모가 됩니다. 원문도 클립보드에 복사됩니다.'),
        h_tray="메뉴와 설정",
        tray_text="macOS 메뉴 막대 아이콘을 클릭하거나 Dock 아이콘을 우클릭하면 설정, 이미지 자동 수집, 메모 고정을 사용할 수 있습니다. Windows에서는 트레이 메뉴를 사용합니다. 설정에서 모양, 언어, 단축키를 변경하거나 현재 메모를 비울 수 있습니다.",
        alt_settings="설정 창",
        h_keys="단축키", k_head=("동작", "Windows", "macOS"),
        keys=[('메모 보이기 / 숨기기', 'Ctrl Alt Space', '⌃ ⌥ Space'), ('선택한 텍스트 고정', 'Ctrl Alt T', '⌃ ⌥ T'), ('선택 / 복사 / 삭제 / 숨기기', '← → / Enter / Delete / Esc', '← → / Enter / Delete / Esc')],
        keys_note='표는 기본 단축키입니다. 설정에서 단축키를 클릭한 후 새 조합을 누르세요. 시작하거나 설정을 열 때 두 단축키를 함께 확인해 감지된 충돌과 사용 가능한 대체 조합을 먼저 표시합니다. 입력 중에도 다른 앱은 동작하며, Mac 손쉬운 사용 권한은 선택한 텍스트를 수집할 때만 필요합니다. 일부 공유 등록은 감지하지 못할 수 있습니다.',
        h_privacy="개인정보", privacy="새로 복사한 이미지를 자동으로 수집합니다. 텍스트는 선택한 뒤 단축키를 눌렀을 때만 수집합니다. 메모는 기기 안에서 처리하며 업로드하지 않습니다. 최대 30개이며, 가득 차면 가장 오래된 메모를 삭제하고 정상 종료 시 현재 메모 세션을 비웁니다.",
        h_build="소스에서 빌드",
        b_site="웹사이트", b_win="Windows(.NET 10 SDK, Node.js 22+)", b_mac="macOS(Command Line Tools, Node.js 22+)",
        b_note="위의 DMG / Setup 설치 파일을 다운로드해 설치하세요. 소스 빌드 결과물은 개발용입니다. Mac 패키지는 ad-hoc 서명이며 Apple 공증을 받지 않아 첫 실행이 차단될 수 있어요. [릴리스 및 배포 안내](docs/releases/hosting.md)를 참고하세요.",
        h_layout="저장소 구조",
        layout=[('apps/website', '6개 언어 웹사이트와 대화형 데모'), ('apps/native-ui', '두 클라이언트 공용 부채꼴 메모·메뉴·설정'), ('apps/windows', 'Windows 클라이언트(C# / WPF + WebView2)'), ('apps/macos', 'macOS 클라이언트(Swift / AppKit + WKWebView)'), ('docs', '현재 사양, 테스트 항목, README 이미지')],
        h_test="테스트", test_note='빌드, 자동 테스트, 실기기 확인 명령은 [CONTRIBUTING.md](CONTRIBUTING.md)와 `docs/native-testing.md`를 보세요.',
        contrib_text="Issue와 PR을 환영해요. 하나의 요구사항에 맞춰 커밋을 정리하고, 관련 플랫폼과 동작 변경, 실제 검증 결과를 적어 주세요. 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)(중국어).",
        contact="문의와 제안", h_license="라이선스", license="코드는 MIT 라이선스예요. 이름과 아이콘은 MIT 적용 대상이 아니에요. [BRANDING.md](BRANDING.md)를 보세요.",
    ),
    "es": dict(
        name="SnapSlot", tagline="Capturas y texto, siempre a la vista.",
        sub="Fija capturas y notas sobre tu trabajo. Referencias e ideas, siempre cerca.",
        site="Pruébalo en línea", download="Descargar", contrib="Contribuir",
        download_mac="Descargar para macOS",
        download_win="Descargar para Windows",
        animated="Ver GIF",
        watch="Ver la demostración",
        developer="Desarrollo y contribuciones",
        key_preview="Ampliar una nota",
        install="Guía de instalación",
        demo_alt="Demostración de Snapshot Pin: mostrar notas, recoger texto y arrastrarlo a un documento",
        h_use="Cómo funciona",
        s_edge=("Detente en el borde superior", "Deja el cursor arriba del todo medio segundo y las notas bajan en abanico. Al apartarlo, se van. La rueda gira el abanico."),
        s_drag=('Arrástrala donde la necesites', 'Suelta una nota en una aplicación compatible o una carpeta como archivo PNG o TXT.'),
        s_select=('Selecciona texto y pulsa el atajo', 'Selecciona texto que la aplicación permita copiar y pulsa `⌃ ⌥ T` (Windows: `Ctrl + Alt + T`). Se crea una nota y el texto completo se copia al portapapeles.'),
        h_tray="Menú y ajustes",
        tray_text="Haz clic en el icono de la barra de menús de macOS o clic derecho en el icono del Dock para abrir Ajustes, activar la captura de imágenes o fijar notas. En Windows, usa el menú de la bandeja. Ajustes permite cambiar el aspecto, el idioma, los atajos y borrar las notas actuales.",
        alt_settings="Ventana de ajustes",
        h_keys="Atajos", k_head=("Acción", "Windows", "macOS"),
        keys=[('Mostrar / ocultar notas', 'Ctrl Alt Space', '⌃ ⌥ Space'), ('Fijar texto seleccionado', 'Ctrl Alt T', '⌃ ⌥ T'), ('Elegir / copiar / quitar / ocultar', '← → / Enter / Delete / Esc', '← → / Enter / Delete / Esc')],
        keys_note='Estos son los atajos predeterminados. Haz clic en uno en Ajustes y pulsa una nueva combinación. Ambos se comprueban al iniciar y al abrir Ajustes, mostrando los conflictos detectados y las alternativas antes de editar. La grabación permite que otras apps sigan respondiendo. En Mac, Accesibilidad solo se necesita para recoger texto seleccionado. Algunos registros compartidos pueden no detectarse.',
        h_privacy="Privacidad", privacy="Recoge automáticamente las imágenes recién copiadas. El texto solo se recoge cuando lo seleccionas y pulsas el atajo. Las notas se procesan localmente y no se suben. Conserva hasta 30 notas; al llenarse se elimina la más antigua y, al cerrar normalmente, se borra la sesión actual.",
        h_build="Compilar desde el código",
        b_site="Sitio web", b_win="Windows (.NET 10 SDK, Node.js 22+)", b_mac="macOS (Command Line Tools, Node.js 22+)",
        b_note="Descarga el instalador DMG / Setup de arriba para instalar la aplicación. Los resultados de compilar el código son para desarrollo. El paquete de Mac tiene firma ad-hoc y no está notarizado por Apple; el sistema puede bloquear el primer inicio. Consulta la [guía de publicación y alojamiento](docs/releases/hosting.md).",
        h_layout="Estructura del repositorio",
        layout=[('apps/website', 'Sitio y demostración interactiva en seis idiomas'), ('apps/native-ui', 'Notas en abanico, menú y ajustes compartidos'), ('apps/windows', 'Cliente de Windows (C# / WPF + WebView2)'), ('apps/macos', 'Cliente de macOS (Swift / AppKit + WKWebView)'), ('docs', 'Especificaciones actuales, listas de pruebas, imágenes del README')],
        h_test="Pruebas", test_note='Los comandos de compilación, pruebas automáticas y aceptación en equipos reales están en [CONTRIBUTING.md](CONTRIBUTING.md) y `docs/native-testing.md`.',
        contrib_text="Se agradecen Issues y PR. Agrupa los commits por una necesidad e indica las plataformas afectadas, los cambios de comportamiento y la verificación realizada. Consulta [CONTRIBUTING.md](CONTRIBUTING.md) (en chino).",
        contact="Preguntas e ideas", h_license="Licencia", license="El código tiene licencia MIT. El nombre y el icono no están cubiertos por la MIT; consulta [BRANDING.md](BRANDING.md).",
    ),
}


def build(locale: str) -> str:
    t = T[locale]
    up = "" if locale == "zh-Hans" else "../../"

    def asset(relative: str) -> str:
        pinned = committed_asset(relative)
        if pinned:
            return pinned
        digest = hashlib.sha256((root / relative).read_bytes()).hexdigest()[:12]
        return f"{up}{relative}?v={digest}"

    media = lambda name: asset(f"docs/media/{locale}/{name}")
    link = lambda l: f"{up}README.md" if l == "zh-Hans" else (f"{up}docs/readme/README.{l}.md" if up == "" else f"README.{l}.md")
    langs = " · ".join(f"<b>{NAMES[l]}</b>" if l == locale else f'<a href="{link(l)}">{NAMES[l]}</a>' for l in ORDER)
    fix = lambda text: text.replace("](CONTRIBUTING.md)", f"]({up}CONTRIBUTING.md)").replace("](BRANDING.md)", f"]({up}BRANDING.md)").replace("](docs/releases/hosting.md)", f"]({up}docs/releases/hosting.md)")
    site = f"https://snapslot.linglinglab.top/{locale}/"
    steps = "\n".join(f"{i}. **{title}**<br>\n   {text}" for i, (title, text) in enumerate([t["s_edge"], t["s_select"], t["s_drag"]], 1))
    bindings = t["keys"][:2] + [(t["key_preview"], "Space", "Space")] + t["keys"][2:]
    keys = "\n".join(f"| {action} | {kbd(mac)} | {kbd(win)} |" for action, win, mac in bindings)
    layout = "\n".join(f"| `{directory}` | {description} |" for directory, description in t["layout"])
    return f"""<!-- Generated by scripts/readme-build.py — edit that file, not this one. -->
<p align="center"><img src="{asset("apps/website/public/brand/current/snapslot.png")}" width="80" height="80" alt=""></p>

<h1 align="center">{t["name"]}</h1>

<p align="center"><b>{t["tagline"]}</b><br>{t["sub"]}</p>

<p align="center">
  <a href="{DOWNLOADS}/SnapSlot-{VERSION}-macOS-universal.dmg"><b>{t["download_mac"]}</b></a> ·
  <a href="{DOWNLOADS}/SnapSlot-{VERSION}-windows-x64-setup.exe"><b>{t["download_win"]}</b></a> ·
  <a href="{site}">{t["site"]}</a>
</p>

<p align="center">{langs}</p>

<p align="center"><a href="{media("demo.mp4")}"><img src="{media("drag.webp")}" width="840" alt="{t["demo_alt"]}"></a></p>
<p align="center"><sub><a href="{media("demo.mp4")}">{t["watch"]}</a> · <a href="{media("demo.gif")}">{t["animated"]}</a> · <a href="{REPO}/releases/tag/v{VERSION}">v{VERSION}</a> · <a href="{up}docs/releases/hosting.md">{t["install"]}</a></sub></p>

## {t["h_use"]}

{steps}

## {t["h_tray"]}

{t["tray_text"]}

<p align="center"><img src="{media("settings.webp")}" width="400" alt="{t["alt_settings"]}"></p>

## {t["h_keys"]}

| {t["k_head"][0]} | {t["k_head"][2]} | {t["k_head"][1]} |
| --- | --- | --- |
{keys}

{t["keys_note"]}

## {t["h_privacy"]}

{t["privacy"]}

## {t["developer"]}

<details>
<summary>{t["h_build"]} · {t["h_layout"]} · {t["h_test"]}</summary>

### {t["h_build"]}

```bash
# {t["b_site"]}
npm ci --prefix apps/website
npm run dev --prefix apps/website
```

```bash
# {t["b_mac"]}
./scripts/build-macos.sh
open artifacts/macos/SnapSlot.app
```

```powershell
# {t["b_win"]}
.\\scripts\\build-windows.ps1
.\\artifacts\\windows\\win-x64\\SnapSlot.exe
```

{fix(t["b_note"])}

### {t["h_layout"]}

| | |
| --- | --- |
{layout}

### {t["h_test"]}

{fix(t["test_note"])}

{fix(t["contrib_text"])}

</details>

## {t["h_license"]}

{fix(t["license"])}

[GitHub Issues]({REPO}/issues) · [{t["contrib"]}]({up}CONTRIBUTING.md) · [{EMAIL}](mailto:{EMAIL})
"""


def kbd(keys: str) -> str:
    groups = [g.strip() for g in keys.split("/")]
    return " / ".join(" ".join(f"<kbd>{k}</kbd>" for k in g.split()) for g in groups)



(root / "docs" / "readme").mkdir(parents=True, exist_ok=True)
for locale in ORDER:
    target = root / "README.md" if locale == "zh-Hans" else root / "docs" / "readme" / f"README.{locale}.md"
    content = build(locale)
    with target.open("w", encoding="utf-8", newline="\n") as output:
        output.write(content)
    print(target.relative_to(root))
