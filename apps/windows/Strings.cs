using System.Collections.Generic;

namespace SnapSlot;

internal static class Strings
{
    public static readonly string[] Locales = ["en", "zh-Hans", "zh-Hant", "ja", "ko", "es"];
    public static string Locale = "zh-Hans";
    private static readonly Dictionary<string, string[]> Values = new()
    {
        ["text"] = ["A little idea", "一点小想法", "一點小想法", "小さなアイデア", "작은 아이디어", "Una pequeña idea"],
        ["sample"] = ["Leave some room.\nKeep the useful things close.", "给桌面留点空白。\n好用的东西，应该随手可得。", "給桌面留點空白。\n好用的東西，應該隨手可得。", "デスクトップに余白を。\n便利なものは手の届く場所に。", "바탕 화면에 여백을.\n유용한 것은 손닿는 곳에.", "Deja un poco de espacio.\nTen lo útil a mano."],
        ["tooLarge"] = ["Text limit: 64 KB.", "纯文本上限为 64 KB。", "純文字上限為 64 KB。", "テキスト上限: 64 KB。", "텍스트 한도: 64 KB.", "Límite de texto: 64 KB."],
        ["hotkey"] = ["Shortcut unavailable: another app may use it.", "快捷键不可用，可能已被其他应用占用。", "快速鍵無法使用，可能已被其他應用程式佔用。", "ショートカットを登録できませんでした。", "단축키를 등록할 수 없습니다.", "El atajo no está disponible."],
    };
    public static string Get(string key)
    {
        int index = System.Array.IndexOf(Locales, Locale);
        return Values[key][index < 0 ? 0 : index];
    }
}
