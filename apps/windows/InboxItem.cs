using System;
using System.IO;
using System.Text;
using System.Windows.Media.Imaging;

namespace SnapSlot;

internal sealed class InboxItem
{
    public Guid Id { get; } = Guid.NewGuid();
    public string Title { get; }
    public string Display { get; set; } = "";
    public string? Preview { get; set; }
    public string? Text { get; }
    public BitmapSource? Image {
        get {
            if (Text is not null) return null;
            var image = new BitmapImage();image.BeginInit();image.CacheOption=BitmapCacheOption.OnLoad;
            image.UriSource=new Uri(ExportPath);image.EndInit();image.Freeze();return image;
        }
    }
    public string ExportPath { get; }
    public bool IsRemoving { get; set; }
    public InboxItem(string title, string text)
    {
        if (Encoding.UTF8.GetByteCount(text) > 65536) throw new ArgumentOutOfRangeException(nameof(text));
        Title = title; Text = text;
        ExportPath = Path.Combine(App.SessionDirectory, $"{Id:N}.txt");
        File.WriteAllText(ExportPath, text, new UTF8Encoding(false));
    }
    public InboxItem(string title, BitmapSource image)
    {
        Title = title;
        if (image.CanFreeze) image.Freeze();
        ExportPath = Path.Combine(App.SessionDirectory, $"{Id:N}.png");
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(image));
        using var stream = File.Create(ExportPath);
        encoder.Save(stream);
    }
}
