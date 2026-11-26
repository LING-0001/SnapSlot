using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage;

namespace SnapSlot;

internal static class TextRecognition
{
    public static async Task<string> RecognizeAsync(string filePath)
    {
        if (!File.Exists(filePath)) throw new FileNotFoundException("err.invalidImage", filePath);
        var engine = OcrEngine.TryCreateFromUserProfileLanguages();
        if (engine is null && OcrEngine.AvailableRecognizerLanguages.Count > 0)
            engine = OcrEngine.TryCreateFromLanguage(OcrEngine.AvailableRecognizerLanguages[0]);
        if (engine is null) throw new InvalidOperationException("err.ocrFailed");

        var file = await StorageFile.GetFileFromPathAsync(Path.GetFullPath(filePath));
        using var stream = await file.OpenAsync(FileAccessMode.Read);
        var decoder = await BitmapDecoder.CreateAsync(stream);
        using var rawBitmap = await decoder.GetSoftwareBitmapAsync();
        SoftwareBitmap? converted = null;
        try
        {
            var target = rawBitmap;
            if (rawBitmap.BitmapPixelFormat != BitmapPixelFormat.Bgra8 || rawBitmap.BitmapAlphaMode != BitmapAlphaMode.Premultiplied)
            {
                converted = SoftwareBitmap.Convert(rawBitmap, BitmapPixelFormat.Bgra8, BitmapAlphaMode.Premultiplied);
                target = converted;
            }
            var result = await engine.RecognizeAsync(target);
            if (result is null || result.Lines.Count == 0) return "";
            return string.Join("\n", result.Lines.Select(line => line.Text)).Trim();
        }
        finally
        {
            converted?.Dispose();
        }
    }
}
