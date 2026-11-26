using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace SnapSlot;

internal sealed class InboxItem
{
    public Guid Id { get; } = Guid.NewGuid();
    public string Title { get; private set; }
    public string Display { get; set; } = "";
    public string? Preview { get; set; }
    public string? Text { get; private set; }
    public string ContentHash { get; private set; }
    public int? Width { get; }
    public int? Height { get; }
    public string Kind => Text is null ? "image" : "text";
    public BitmapSource? Image {
        get {
            if (Text is not null) return null;
            var image = new BitmapImage(); image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad;
            image.UriSource = new Uri(ExportPath); image.EndInit(); image.Freeze(); return image;
        }
    }
    public string ExportPath { get; }
    public bool IsRemoving { get; set; }

    public InboxItem(string title, string text)
    {
        if (string.IsNullOrWhiteSpace(text) || Encoding.UTF8.GetByteCount(text) > 65536) throw new ArgumentOutOfRangeException(nameof(text), "err.invalidText");
        Title = title;
        Text = text;
        var bytes = new UTF8Encoding(false).GetBytes(text);
        ContentHash = Convert.ToHexString(SHA256.HashData(bytes));
        var stem = $"{FileNameSanitizer.SanitizeStem(title, "SnapSlot-note")}-{DateTime.Now:HHmmss}";
        ExportPath = FileNameSanitizer.UniquePath(App.SessionDirectory, stem, "txt");
        File.WriteAllBytes(ExportPath, bytes);
    }

    public InboxItem(string title, BitmapSource image, string? fileStem = null)
    {
        Title = title;
        if (image.CanFreeze) image.Freeze();
        Width = image.PixelWidth;
        Height = image.PixelHeight;
        var stem = fileStem is not null
            ? FileNameSanitizer.SanitizeStem(fileStem, $"SnapSlot-{DateTime.Now:yyyyMMdd-HHmmss}", 36)
            : $"SnapSlot-{DateTime.Now:yyyyMMdd-HHmmss}";
        ExportPath = FileNameSanitizer.UniquePath(App.SessionDirectory, stem, "png");
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(image));
        using var buffer = new MemoryStream();
        encoder.Save(buffer);
        var bytes = buffer.ToArray();
        ContentHash = Convert.ToHexString(SHA256.HashData(bytes));
        File.WriteAllBytes(ExportPath, bytes);
    }

    public void UpdateText(string text)
    {
        if (Text is null) throw new InvalidOperationException("err.unknownItem");
        if (string.IsNullOrWhiteSpace(text) || Encoding.UTF8.GetByteCount(text) > 65536) throw new ArgumentException("err.invalidText");
        var bytes = new UTF8Encoding(false).GetBytes(text);
        File.WriteAllBytes(ExportPath, bytes);
        Text = text;
        var first = text.Split('\n').FirstOrDefault(line => !string.IsNullOrWhiteSpace(line))?.Trim() ?? "Note";
        Title = first[..Math.Min(first.Length, 30)];
        ContentHash = Convert.ToHexString(SHA256.HashData(bytes));
    }

    public static string FormatImageTitle(string? appName, int width, int height)
    {
        string clock = DateTime.Now.ToString("HH:mm");
        if (!string.IsNullOrWhiteSpace(appName) && !string.Equals(appName.Trim(), "SnapSlot", StringComparison.OrdinalIgnoreCase))
            return $"{appName.Trim()} · {clock}";
        if (width > 0 && height > 0) return $"{width}×{height} · {clock}";
        return $"PNG · {clock}";
    }

    public static string EncodeImageDataUri(string filePath, int maxEdge)
    {
        if (maxEdge >= 2560)
        {
            var raw = File.ReadAllBytes(filePath);
            if (raw.Length <= 6 * 1024 * 1024)
            {
                using var ms = new MemoryStream(raw);
                var probe = new BitmapImage(); probe.BeginInit(); probe.CacheOption = BitmapCacheOption.OnLoad;
                probe.StreamSource = ms; probe.EndInit(); probe.Freeze();
                if (Math.Max(probe.PixelWidth, probe.PixelHeight) <= 2560)
                    return "data:image/png;base64," + Convert.ToBase64String(raw);
            }
        }
        var image = new BitmapImage(); image.BeginInit(); image.CacheOption = BitmapCacheOption.OnLoad;
        image.UriSource = new Uri(filePath); image.EndInit(); image.Freeze();
        double ratio = Math.Min(1.0, (double)maxEdge / Math.Max(1, Math.Max(image.PixelWidth, image.PixelHeight)));
        BitmapSource output = ratio < 1.0 ? new TransformedBitmap(image, new ScaleTransform(ratio, ratio)) : image;
        if (output.CanFreeze) output.Freeze();
        var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(output));
        using var stream = new MemoryStream(); encoder.Save(stream);
        return "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
    }
}
