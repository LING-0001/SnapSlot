import type { Locale } from "./locales";

export type HomeCopy = {
  name: string;
  nav: { features: string; download: string; language: string };
  headline: string;
  sub: string;
  get: { win: string; mac: string; meta: string };
  stage: {
    desktop: string; docTitle: string; docHeading: string; docEmpty: string; clear: string;
    files: [string, string]; fileLabels: [string, string]; sampleText: string; pasted: string;
    list: string; empty: string; copied: string; remove: string; copyImage: string; copyText: string; copyFile: string;
  };
  coach: { edge: string; edgeTouch: string; file: string; drag: string; dragTouch: string; trayWin: string; trayMac: string; trayTouch: string; done: string; skip: string };
  notice: { notPinned: string; intakeOn: string; intakeOff: string };
  menu: { settings: string; intake: string; pin: string; quit: string; trayWin: string; trayMac: string };
  settings: { title: string; language: string; intakeHint: string; pinHint: string; look: string; pinText: string; openNotes: string; count: string; clear: string; close: string };
  skins: [string, string, string];
  island: string;
  chip: string;
  bento: {
    selectTitle: [string, string]; selectLine: string; selectFoot: string;
    capacityFoot: string; capacityLabel: string; skinTitle: string; skinFoot: string;
    privacyTitle: [string, string]; privacyFoot: string;
  };
  footer: { tagline: string; contact: string; license: string };
};

export const homeCopy: Record<Locale, HomeCopy> = {
  "zh-Hans": {
    name: "快照贴",
    nav: { features: "功能", download: "下载", language: "语言" },
    headline: "复制过的，都钉在屏幕顶上。",
    sub: "复制的图片、选中的文字，变成屏幕上沿的便签。点一下，就回到剪贴板。",
    get: { win: "下载 Windows 版", mac: "下载 macOS 版", meta: "免费开源 · Windows 10 / 11 · macOS 13 及以上" },
    stage: {
      desktop: "SnapSlot 演示桌面", docTitle: "周报草稿", docHeading: "本周进展", docEmpty: "把便签拖到这里", clear: "清空",
      files: ["湖边的山.png", "窗边的绿植.png"], fileLabels: ["湖边的山", "窗边的绿植"],
      sampleText: "周五前：\n· 定下图标\n· 更新截图\n· 发给设计组看", pasted: "你复制的图片",
      list: "屏幕顶部的便签", empty: "还没有便签", copied: "已复制", remove: "移除这张便签",
      copyImage: "复制图片：", copyText: "复制文字：", copyFile: "复制 ",
    },
    coach: {
      edge: "把鼠标移到最上沿，停一下", edgeTouch: "点一下最上沿", file: "点这张图片，它会钉到上面",
      drag: "把一张便签拖进文档", dragTouch: "点一下便签，就复制好了",
      trayWin: "右键任务栏里的这个图标", trayMac: "点菜单栏里的这个图标", trayTouch: "点一下这个图标",
      done: "都会了。", skip: "跳过",
    },
    notice: { notPinned: "已复制。自动收取已关闭，所以没有钉上", intakeOn: "已开启自动收取", intakeOff: "已关闭自动收取" },
    menu: { settings: "设置…", intake: "自动收取剪贴板图片", pin: "固定便签", quit: "退出快照贴", trayWin: "SnapSlot（右键打开菜单）", trayMac: "SnapSlot 菜单" },
    settings: { title: "SnapSlot 设置", language: "语言", intakeHint: "其他应用复制的图片会自动钉上", pinHint: "鼠标离开后也不收起", look: "外观", pinText: "选中文字钉成便签", openNotes: "展开便签", count: "便签 {n} / 30", clear: "清空全部", close: "关闭设置" },
    skins: ["磨砂", "纸白", "石墨"],
    island: "已钉上 · 第 {n} 张",
    chip: "钉到顶上",
    bento: {
      selectTitle: ["选中，", "就钉上。"], selectLine: "好的想法，往往只出现一次。", selectFoot: "选中上面这句，按",
      capacityFoot: "满了，最早那张让位。退出就清空。", capacityLabel: "已用 {n} 张，最多 30 张",
      skinTitle: "换个外观", skinFoot: "上面的便签会跟着变。",
      privacyTitle: ["不截屏。", "不上传。"], privacyFoot: "只收其他应用写进剪贴板的图片，和你按快捷键时选中的文字。全部留在本机。",
    },
    footer: { tagline: "给剪贴板一个看得见的地方。", contact: "联系我们", license: "代码以 MIT 许可开源" },
  },
  "zh-Hant": {
    name: "快照貼",
    nav: { features: "功能", download: "下載", language: "語言" },
    headline: "複製過的，都釘在螢幕頂端。",
    sub: "複製的圖片、選取的文字，會變成螢幕上緣的便箋。點一下，就回到剪貼簿。",
    get: { win: "下載 Windows 版", mac: "下載 macOS 版", meta: "免費開源 · Windows 10 / 11 · macOS 13 以上" },
    stage: {
      desktop: "SnapSlot 示範桌面", docTitle: "週報草稿", docHeading: "本週進度", docEmpty: "把便箋拖到這裡", clear: "清空",
      files: ["湖邊的山.png", "窗邊的綠植.png"], fileLabels: ["湖邊的山", "窗邊的綠植"],
      sampleText: "週五前：\n· 定下圖示\n· 更新截圖\n· 給設計組看看", pasted: "你複製的圖片",
      list: "螢幕頂端的便箋", empty: "還沒有便箋", copied: "已複製", remove: "移除這張便箋",
      copyImage: "複製圖片：", copyText: "複製文字：", copyFile: "複製 ",
    },
    coach: {
      edge: "把滑鼠移到最上緣，停一下", edgeTouch: "點一下最上緣", file: "點這張圖片，它會釘到上面",
      drag: "把一張便箋拖進文件", dragTouch: "點一下便箋，就複製好了",
      trayWin: "在工作列的這個圖示上按右鍵", trayMac: "點選單列裡的這個圖示", trayTouch: "點一下這個圖示",
      done: "都會了。", skip: "略過",
    },
    notice: { notPinned: "已複製。自動收取已關閉，所以沒有釘上", intakeOn: "已開啟自動收取", intakeOff: "已關閉自動收取" },
    menu: { settings: "設定…", intake: "自動收取剪貼簿圖片", pin: "固定便箋", quit: "結束快照貼", trayWin: "SnapSlot（按右鍵開啟選單）", trayMac: "SnapSlot 選單" },
    settings: { title: "SnapSlot 設定", language: "語言", intakeHint: "其他應用程式複製的圖片會自動釘上", pinHint: "滑鼠離開後也不收起", look: "外觀", pinText: "把選取的文字釘成便箋", openNotes: "展開便箋", count: "便箋 {n} / 30", clear: "全部清空", close: "關閉設定" },
    skins: ["磨砂", "紙白", "石墨"],
    island: "已釘上 · 第 {n} 張",
    chip: "釘到頂端",
    bento: {
      selectTitle: ["選取，", "就釘上。"], selectLine: "好的想法，往往只出現一次。", selectFoot: "選取上面這句，按",
      capacityFoot: "滿了，最早那張讓位。結束就清空。", capacityLabel: "已用 {n} 張，最多 30 張",
      skinTitle: "換個外觀", skinFoot: "上面的便箋會跟著變。",
      privacyTitle: ["不截圖。", "不上傳。"], privacyFoot: "只收其他應用程式寫進剪貼簿的圖片，以及你按快速鍵時選取的文字。全部留在本機。",
    },
    footer: { tagline: "給剪貼簿一個看得見的地方。", contact: "聯絡我們", license: "程式碼以 MIT 授權開源" },
  },
  en: {
    name: "",
    nav: { features: "Features", download: "Download", language: "Language" },
    headline: "Everything you copy, pinned to the top of your screen.",
    sub: "Copied images and selected text become notes along the top edge. Click one and it’s back on your clipboard.",
    get: { win: "Download for Windows", mac: "Download for Mac", meta: "Free and open source · Windows 10 / 11 · macOS 13 or later" },
    stage: {
      desktop: "SnapSlot demo desktop", docTitle: "Weekly update", docHeading: "This week", docEmpty: "Drag a note here", clear: "Clear",
      files: ["lake.png", "plant.png"], fileLabels: ["Mountain lake", "Plant by the window"],
      sampleText: "By Friday:\n· Pick the icon\n· Update screenshots\n· Share with design", pasted: "Your copied image",
      list: "Notes at the top of the screen", empty: "No notes yet", copied: "Copied", remove: "Remove this note",
      copyImage: "Copy image: ", copyText: "Copy text: ", copyFile: "Copy ",
    },
    coach: {
      edge: "Move to the very top and pause", edgeTouch: "Tap the top edge", file: "Click this image to pin it up top",
      drag: "Drag a note into the document", dragTouch: "Tap a note to copy it",
      trayWin: "Right-click this icon in the taskbar", trayMac: "Click this icon in the menu bar", trayTouch: "Tap this icon",
      done: "That’s all there is.", skip: "Skip",
    },
    notice: { notPinned: "Copied. Auto-collect is off, so it wasn’t pinned", intakeOn: "Auto-collect on", intakeOff: "Auto-collect off" },
    menu: { settings: "Settings…", intake: "Collect clipboard images", pin: "Pin notes", quit: "Quit SnapSlot", trayWin: "SnapSlot (right-click for menu)", trayMac: "SnapSlot menu" },
    settings: { title: "SnapSlot Settings", language: "Language", intakeHint: "Images copied in other apps get pinned automatically", pinHint: "Stay open when the pointer leaves", look: "Appearance", pinText: "Pin selected text", openNotes: "Show notes", count: "Notes {n} / 30", clear: "Clear all", close: "Close settings" },
    skins: ["Frosted", "Paper", "Graphite"],
    island: "Pinned · note {n}",
    chip: "Pin to top",
    bento: {
      selectTitle: ["Select it.", "Pin it."], selectLine: "Good ideas rarely show up twice.", selectFoot: "Select the line above, then press",
      capacityFoot: "When it’s full, the oldest note makes room. Quit and it’s all gone.", capacityLabel: "{n} of 30 notes used",
      skinTitle: "Change the look", skinFoot: "The notes above change with it.",
      privacyTitle: ["No screenshots.", "No uploads."], privacyFoot: "SnapSlot only takes images other apps put on the clipboard, and text you select when you press the shortcut. Everything stays on your computer.",
    },
    footer: { tagline: "A place you can see for your clipboard.", contact: "Contact", license: "Code released under the MIT License" },
  },
  ja: {
    name: "",
    nav: { features: "機能", download: "ダウンロード", language: "言語" },
    headline: "コピーしたものは、画面の上にピン留め。",
    sub: "コピーした画像や選択したテキストが、画面の上端にメモとして並びます。クリックすれば、クリップボードに戻ります。",
    get: { win: "Windows 版をダウンロード", mac: "Mac 版をダウンロード", meta: "無料・オープンソース · Windows 10 / 11 · macOS 13 以降" },
    stage: {
      desktop: "SnapSlot デモデスクトップ", docTitle: "週報の下書き", docHeading: "今週の進捗", docEmpty: "ここにメモをドラッグ", clear: "クリア",
      files: ["湖と山.png", "窓辺の植物.png"], fileLabels: ["湖と山", "窓辺の植物"],
      sampleText: "金曜までに：\n· アイコンを決める\n· スクショを更新\n· デザインチームに共有", pasted: "コピーした画像",
      list: "画面上端のメモ", empty: "メモはまだありません", copied: "コピーしました", remove: "このメモを削除",
      copyImage: "画像をコピー：", copyText: "テキストをコピー：", copyFile: "コピー：",
    },
    coach: {
      edge: "いちばん上までマウスを動かして、少し待つ", edgeTouch: "上端をタップ", file: "この画像をクリックすると、上にピン留め",
      drag: "メモを書類へドラッグ", dragTouch: "メモをタップするとコピー",
      trayWin: "タスクバーのこのアイコンを右クリック", trayMac: "メニューバーのこのアイコンをクリック", trayTouch: "このアイコンをタップ",
      done: "これで全部です。", skip: "スキップ",
    },
    notice: { notPinned: "コピーしました。自動取り込みがオフなのでピン留めされません", intakeOn: "自動取り込み：オン", intakeOff: "自動取り込み：オフ" },
    menu: { settings: "設定…", intake: "クリップボードの画像を自動取り込み", pin: "メモを固定", quit: "SnapSlot を終了", trayWin: "SnapSlot（右クリックでメニュー）", trayMac: "SnapSlot メニュー" },
    settings: { title: "SnapSlot 設定", language: "言語", intakeHint: "ほかのアプリでコピーした画像を自動でピン留め", pinHint: "マウスが離れても閉じない", look: "外観", pinText: "選択したテキストをピン留め", openNotes: "メモを表示", count: "メモ {n} / 30", clear: "すべて消去", close: "設定を閉じる" },
    skins: ["すりガラス", "ペーパー", "グラファイト"],
    island: "ピン留めしました · {n} 枚目",
    chip: "上にピン留め",
    bento: {
      selectTitle: ["選んで、", "ピン留め。"], selectLine: "いいアイデアは、二度は来ない。", selectFoot: "上の一文を選択して",
      capacityFoot: "いっぱいになると、いちばん古いメモから消えます。終了すれば、すべて消えます。", capacityLabel: "30 枚中 {n} 枚使用",
      skinTitle: "見た目を変える", skinFoot: "上のメモもいっしょに変わります。",
      privacyTitle: ["撮らない。", "送らない。"], privacyFoot: "取り込むのは、ほかのアプリがクリップボードに入れた画像と、ショートカットを押したときに選択していたテキストだけ。すべてこのパソコンの中で完結します。",
    },
    footer: { tagline: "クリップボードに、目に見える置き場所を。", contact: "お問い合わせ", license: "コードは MIT ライセンスで公開" },
  },
  ko: {
    name: "",
    nav: { features: "기능", download: "다운로드", language: "언어" },
    headline: "복사한 모든 것을, 화면 위에 고정하세요.",
    sub: "복사한 이미지와 선택한 텍스트가 화면 위쪽 가장자리에 메모로 놓입니다. 클릭하면 다시 클립보드로 돌아와요.",
    get: { win: "Windows용 다운로드", mac: "Mac용 다운로드", meta: "무료 오픈 소스 · Windows 10 / 11 · macOS 13 이상" },
    stage: {
      desktop: "SnapSlot 데모 바탕 화면", docTitle: "주간 보고 초안", docHeading: "이번 주 진행", docEmpty: "여기로 메모를 끌어오세요", clear: "비우기",
      files: ["호수와 산.png", "창가 식물.png"], fileLabels: ["호수와 산", "창가 식물"],
      sampleText: "금요일까지:\n· 아이콘 정하기\n· 스크린샷 업데이트\n· 디자인팀에 공유", pasted: "복사한 이미지",
      list: "화면 위쪽의 메모", empty: "아직 메모가 없어요", copied: "복사됨", remove: "이 메모 삭제",
      copyImage: "이미지 복사: ", copyText: "텍스트 복사: ", copyFile: "복사: ",
    },
    coach: {
      edge: "마우스를 맨 위로 옮기고 잠시 기다리세요", edgeTouch: "맨 위를 탭하세요", file: "이 이미지를 클릭하면 위에 고정돼요",
      drag: "메모를 문서로 끌어다 놓으세요", dragTouch: "메모를 탭하면 복사돼요",
      trayWin: "작업 표시줄의 이 아이콘을 오른쪽 클릭", trayMac: "메뉴 막대의 이 아이콘을 클릭", trayTouch: "이 아이콘을 탭하세요",
      done: "이게 전부예요.", skip: "건너뛰기",
    },
    notice: { notPinned: "복사됨. 자동 수집이 꺼져 있어 고정되지 않았어요", intakeOn: "자동 수집 켜짐", intakeOff: "자동 수집 꺼짐" },
    menu: { settings: "설정…", intake: "클립보드 이미지 자동 수집", pin: "메모 고정", quit: "SnapSlot 종료", trayWin: "SnapSlot (오른쪽 클릭하면 메뉴)", trayMac: "SnapSlot 메뉴" },
    settings: { title: "SnapSlot 설정", language: "언어", intakeHint: "다른 앱에서 복사한 이미지를 자동으로 고정", pinHint: "마우스가 벗어나도 닫히지 않아요", look: "모양", pinText: "선택한 텍스트 고정", openNotes: "메모 보기", count: "메모 {n} / 30", clear: "모두 지우기", close: "설정 닫기" },
    skins: ["반투명", "종이", "그래파이트"],
    island: "고정됨 · {n}번째 메모",
    chip: "위에 고정",
    bento: {
      selectTitle: ["선택하고,", "고정하세요."], selectLine: "좋은 생각은 두 번 오지 않아요.", selectFoot: "위 문장을 선택하고 누르세요",
      capacityFoot: "가득 차면 가장 오래된 메모가 자리를 내줘요. 종료하면 모두 사라져요.", capacityLabel: "30개 중 {n}개 사용",
      skinTitle: "모양 바꾸기", skinFoot: "위의 메모도 함께 바뀌어요.",
      privacyTitle: ["캡처하지 않아요.", "업로드하지 않아요."], privacyFoot: "다른 앱이 클립보드에 넣은 이미지와, 단축키를 누를 때 선택한 텍스트만 받아요. 모든 것이 내 컴퓨터에만 남아요.",
    },
    footer: { tagline: "클립보드에 눈에 보이는 자리를.", contact: "문의", license: "코드는 MIT 라이선스로 공개" },
  },
  es: {
    name: "",
    nav: { features: "Funciones", download: "Descargar", language: "Idioma" },
    headline: "Todo lo que copias, fijado arriba en tu pantalla.",
    sub: "Las imágenes que copias y el texto que seleccionas se vuelven notas en el borde superior. Haz clic en una y vuelve a tu portapapeles.",
    get: { win: "Descargar para Windows", mac: "Descargar para Mac", meta: "Gratis y de código abierto · Windows 10 / 11 · macOS 13 o posterior" },
    stage: {
      desktop: "Escritorio de demostración de SnapSlot", docTitle: "Informe semanal", docHeading: "Esta semana", docEmpty: "Arrastra una nota aquí", clear: "Vaciar",
      files: ["lago.png", "planta.png"], fileLabels: ["Lago y montañas", "Planta junto a la ventana"],
      sampleText: "Antes del viernes:\n· Elegir el icono\n· Actualizar capturas\n· Compartir con diseño", pasted: "Tu imagen copiada",
      list: "Notas en la parte superior de la pantalla", empty: "Aún no hay notas", copied: "Copiada", remove: "Quitar esta nota",
      copyImage: "Copiar imagen: ", copyText: "Copiar texto: ", copyFile: "Copiar ",
    },
    coach: {
      edge: "Lleva el cursor arriba del todo y espera", edgeTouch: "Toca el borde superior", file: "Haz clic en esta imagen para fijarla arriba",
      drag: "Arrastra una nota al documento", dragTouch: "Toca una nota para copiarla",
      trayWin: "Haz clic derecho en este icono de la barra de tareas", trayMac: "Haz clic en este icono de la barra de menús", trayTouch: "Toca este icono",
      done: "Eso es todo.", skip: "Omitir",
    },
    notice: { notPinned: "Copiada. La recogida automática está desactivada, así que no se fijó", intakeOn: "Recogida automática activada", intakeOff: "Recogida automática desactivada" },
    menu: { settings: "Ajustes…", intake: "Recoger imágenes del portapapeles", pin: "Fijar notas", quit: "Salir de SnapSlot", trayWin: "SnapSlot (clic derecho para el menú)", trayMac: "Menú de SnapSlot" },
    settings: { title: "Ajustes de SnapSlot", language: "Idioma", intakeHint: "Las imágenes que copias en otras apps se fijan solas", pinHint: "No se oculta al apartar el cursor", look: "Apariencia", pinText: "Fijar texto seleccionado", openNotes: "Mostrar notas", count: "Notas {n} / 30", clear: "Borrar todo", close: "Cerrar ajustes" },
    skins: ["Esmerilado", "Papel", "Grafito"],
    island: "Fijada · nota {n}",
    chip: "Fijar arriba",
    bento: {
      selectTitle: ["Selecciona.", "Fija."], selectLine: "Las buenas ideas no avisan dos veces.", selectFoot: "Selecciona la frase de arriba y pulsa",
      capacityFoot: "Cuando se llena, la nota más antigua deja sitio. Al salir, todo se borra.", capacityLabel: "{n} de 30 notas usadas",
      skinTitle: "Cambia el aspecto", skinFoot: "Las notas de arriba cambian también.",
      privacyTitle: ["Sin capturas.", "Sin subidas."], privacyFoot: "Solo recoge las imágenes que otras apps ponen en el portapapeles y el texto que seleccionas al pulsar el atajo. Todo se queda en tu ordenador.",
    },
    footer: { tagline: "Un lugar visible para tu portapapeles.", contact: "Contacto", license: "Código publicado con licencia MIT" },
  },
};

export const fill = (template: string, n: number) => template.replace("{n}", String(n));
