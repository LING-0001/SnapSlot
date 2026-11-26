using System;
using System.IO;
using System.Linq;

namespace SnapSlot;

internal static class SemVer
{
    public static int[]? Parse(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.Trim();
        if (s.StartsWith('v') || s.StartsWith('V')) s = s[1..];
        int dash = s.IndexOf('-');
        if (dash >= 0) s = s[..dash];
        var parts = s.Split('.');
        if (parts.Length != 3) return null;
        var numbers = new int[3];
        for (int i = 0; i < 3; i++)
            if (!int.TryParse(parts[i], out numbers[i]) || numbers[i] < 0) return null;
        return numbers;
    }

    public static bool IsNewer(string candidate, string current)
    {
        var next = Parse(candidate);
        var now = Parse(current);
        if (next is null || now is null) return false;
        for (int i = 0; i < 3; i++)
            if (next[i] != now[i]) return next[i] > now[i];
        return false;
    }
}

internal static class FileNameSanitizer
{
    private static readonly char[] ExtraInvalid = ['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\r', '\n', '\t'];

    public static string SanitizeStem(string? raw, string fallback, int limit = 24)
    {
        if (string.IsNullOrWhiteSpace(raw)) return fallback;
        var invalid = Path.GetInvalidFileNameChars().Concat(ExtraInvalid).ToHashSet();
        var chars = raw.Select(c => invalid.Contains(c) || char.IsControl(c) ? ' ' : c).ToArray();
        var collapsed = string.Join(" ", new string(chars).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        var trimmed = collapsed.Trim('.', ' ');
        if (trimmed.Length == 0) return fallback;
        if (trimmed.Length > limit) trimmed = trimmed[..limit].Trim('.', ' ');
        return trimmed.Length == 0 ? fallback : trimmed;
    }

    public static string UniquePath(string directory, string stem, string extension)
    {
        var baseName = string.IsNullOrWhiteSpace(stem) ? "SnapSlot" : stem;
        var candidate = Path.Combine(directory, $"{baseName}.{extension}");
        int suffix = 2;
        while (File.Exists(candidate))
        {
            candidate = Path.Combine(directory, $"{baseName}-{suffix}.{extension}");
            suffix++;
        }
        return candidate;
    }
}
