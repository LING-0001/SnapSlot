using System.Collections.Generic;

namespace SnapSlot;

internal static class Strings
{
    public static readonly string[] Locales = ["en", "zh-Hans", "zh-Hant", "ja", "ko", "es"];
    public static readonly string[] Names = ["English", "简体中文", "繁體中文", "日本語", "한국어", "Español"];
    public static string Locale = "zh-Hans";
    private static readonly Dictionary<string, string[]> Values = new()
    {
        ["add"] = ["Add image", "添加图片", "新增圖片", "画像を追加", "이미지 추가", "Añadir imagen"],
        ["paste"] = ["Paste once", "粘贴一次", "貼上一次", "一度だけ貼り付け", "한 번 붙여넣기", "Pegar una vez"],
        ["demo"] = ["Add sample", "添加示例", "新增範例", "サンプルを追加", "예시 추가", "Añadir ejemplo"],
        ["copy"] = ["Copy", "复制", "複製", "コピー", "복사", "Copiar"],
        ["remove"] = ["Remove from inbox", "从暂存槽移除", "從暫存槽移除", "一時保管から取り除く", "임시 보관함에서 제거", "Quitar de la bandeja"],
        ["copied"] = ["Copied", "已复制", "已複製", "コピーしました", "복사했습니다", "Copiado"],
        ["removed"] = ["Removed; original kept", "已移除，原文件保留", "已移除，原始檔保留", "元のファイルは残ります", "제거됨. 원본은 유지됩니다", "Quitado; original conservado"],
        ["empty"] = ["Add an image or paste a snippet.", "添加图片，或粘贴一段文字。", "新增圖片，或貼上一段文字。", "画像やテキストを追加してください。", "이미지나 텍스트를 추가하세요.", "Añade una imagen o pega texto."],
        ["preview"] = ["UI prototype · WPF preview renderer", "交互原型 · WPF 预览渲染", "互動原型 · WPF 預覽繪製", "UI プロトタイプ · WPF 描画", "UI 프로토타입 · WPF 렌더링", "Prototipo · Renderizado WPF"],
        ["show"] = ["Open rail", "展开滑轨", "展開滑軌", "レールを開く", "레일 펼치기", "Abrir riel"],
        ["hide"] = ["Collapse", "收起", "收起", "閉じる", "접기", "Contraer"],
        ["exit"] = ["Quit", "退出", "結束", "終了", "종료", "Salir"],
        ["text"] = ["A little idea", "一点小想法", "一點小想法", "小さなアイデア", "작은 아이디어", "Una pequeña idea"],
        ["sample"] = ["Leave some room.\nKeep the useful things close.", "给桌面留点空白。\n好用的东西，应该随手可得。", "給桌面留點空白。\n好用的東西，應該隨手可得。", "デスクトップに余白を。\n便利なものは手の届く場所に。", "바탕 화면에 여백을.\n유용한 것은 손닿는 곳에.", "Deja un poco de espacio.\nTen lo útil a mano."],
        ["clipboard"] = ["Clipboard has no supported image or plain text.", "剪贴板中没有可用图片或纯文本。", "剪貼簿中沒有可用圖片或純文字。", "画像またはテキストがありません。", "지원하는 이미지나 텍스트가 없습니다.", "No hay imagen ni texto compatible."],
        ["tooLarge"] = ["Text limit: 64 KB.", "纯文本上限为 64 KB。", "純文字上限為 64 KB。", "テキスト上限: 64 KB。", "텍스트 한도: 64 KB.", "Límite de texto: 64 KB."],
        ["error"] = ["Operation failed. Try again.", "操作未完成，请重试。", "操作未完成，請重試。", "操作できませんでした。再試行してください。", "작업에 실패했습니다. 다시 시도하세요.", "La operación falló. Inténtalo de nuevo."],
        ["hotkey"] = ["Shortcut unavailable: another app may use it.", "快捷键不可用，可能已被其他应用占用。", "快速鍵無法使用，可能已被其他應用程式佔用。", "ショートカットを登録できませんでした。", "단축키를 등록할 수 없습니다.", "El atajo no está disponible."],
        ["more"] = ["More", "更多", "更多", "もっと見る", "더 보기", "Más"],
        ["back"] = ["Back", "返回", "返回", "戻る", "돌아가기", "Volver"],
        ["language"] = ["Language", "语言", "語言", "言語", "언어", "Idioma"],
    };
    public static string Get(string key)
    {
        int index = System.Array.IndexOf(Locales, Locale);
        return Values[key][index < 0 ? 0 : index];
    }
}
