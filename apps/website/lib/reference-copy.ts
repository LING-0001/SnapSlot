import type {Locale} from './locales';
type ReferenceCopy={menu:string;badge:string;try:string;navDownload:string;scope:string;downloadTitle:string;appearance:string;docHint:string};
export const referenceCopy:Record<Locale,ReferenceCopy>={
 'zh-Hans':{menu:'演示菜单',badge:'macOS 与 Windows 桌面工具',try:'往下试试',navDownload:'下载',scope:'网页交互演示，仅在当前页面内体验。',downloadTitle:'让参考内容，留在你的桌面。',appearance:'外观',docHint:'把想法粘贴到这里'},
 'zh-Hant':{menu:'示範選單',badge:'macOS 與 Windows 桌面工具',try:'往下試試',navDownload:'下載',scope:'網頁互動示範，僅在目前頁面內體驗。',downloadTitle:'讓參考內容，留在你的桌面。',appearance:'外觀',docHint:'把想法貼到這裡'},
 en:{menu:'Demo menu',badge:'A desktop tool for macOS & Windows',try:'Try it below',navDownload:'Download',scope:'Interactive web demo. Try it within this page.',downloadTitle:'Keep your references on your desktop.',appearance:'Look',docHint:'Paste a thought here'},
 ja:{menu:'デモのメニュー',badge:'macOS・Windows のデスクトップツール',try:'下で試す',navDownload:'ダウンロード',scope:'このページ内で体験するウェブ操作デモです。',downloadTitle:'参考資料を、あなたのデスクトップに。',appearance:'外観',docHint:'アイデアをここにペースト'},
 ko:{menu:'데모 메뉴',badge:'macOS 및 Windows 데스크톱 도구',try:'아래에서 체험',navDownload:'다운로드',scope:'이 페이지 안에서 체험하는 웹 데모예요.',downloadTitle:'참고 자료를 내 데스크톱에.',appearance:'외관',docHint:'아이디어를 여기에 붙여넣으세요'},
 es:{menu:'Menú de la demo',badge:'Una herramienta para macOS y Windows',try:'Pruébalo abajo',navDownload:'Descargar',scope:'Demo web interactiva, dentro de esta página.',downloadTitle:'Tus referencias, en tu escritorio.',appearance:'Aspecto',docHint:'Pega aquí tus ideas'}
};
