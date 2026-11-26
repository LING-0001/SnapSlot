using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;
using WebView = Microsoft.Web.WebView2.Wpf.WebView2CompositionControl;
using Forms = System.Windows.Forms;
using Drawing = System.Drawing;

namespace SnapSlot;

public sealed class RailWindow : Window
{
    private sealed class FloatSession
    {
        public Guid Id;
        public Window Window = null!;
        public WebView View = null!;
        public double Opacity = 1.0;
    }

    private static readonly HashSet<string> DropImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".tif", ".tiff", ".webp" };
    private static readonly HashSet<string> DropTextExtensions = new(StringComparer.OrdinalIgnoreCase)
        { ".txt", ".md", ".markdown", ".json", ".csv", ".log", ".xml", ".yaml", ".yml", ".cs", ".ts", ".tsx", ".js", ".py", ".html", ".css" };

    private readonly List<InboxItem> items = new();
    private readonly Grid rootGrid = new();
    private readonly WebView web = new() { DefaultBackgroundColor = Drawing.Color.Transparent };
    private readonly Border dropOverlay = new() { Background = new SolidColorBrush(Color.FromArgb(1, 0, 0, 0)), Visibility = Visibility.Collapsed, AllowDrop = true };
    private WebView? settingsWeb;
    private Window? settings;
    private Action? closeSettings;
    private Window? trayMenu;
    private WebView? trayMenuWeb;
    private Task? trayMenuPreparation;
    private Window? preferencesWindow;
    private WebView? preferencesWeb;
    private Task? preferencesPreparation;
    private readonly Dictionary<Guid, FloatSession> floats = new();
    private string settingsMode = "";
    private PreferencesStore preferences = null!;
    private GlobalShortcuts shortcuts = null!;
    private readonly List<ShortcutChange> shortcutChanges = new();
    private bool recordingShortcut;
    private bool collectingText;
    private string? lastError, startupShortcutError;
    private readonly HashSet<WebView> ready = new();
    private readonly Dictionary<WebView, HashSet<Guid>> sentItems = new();
    private CoreWebView2Environment? environment;
    private readonly DispatcherTimer hover = new() { Interval = TimeSpan.FromMilliseconds(500) };
    private readonly DispatcherTimer edgeProbe = new() { Interval = TimeSpan.FromMilliseconds(50) };
    private readonly DispatcherTimer dismiss = new() { Interval = TimeSpan.FromMilliseconds(450) };
    private readonly DispatcherTimer hide = new() { Interval = TimeSpan.FromMilliseconds(240) };
    private EdgeWatcher? watcher;
    private readonly EdgeDwell edgeDwell = new();
    private Forms.NotifyIcon? tray;
    private Drawing.Icon? icon;
    private Drawing.Rectangle iconSource;
    private Drawing.Icon? stateIcon;
    private (bool Pinned, bool CollectImages, Drawing.Size Size)? iconState;
    private HwndSource? source;
    private bool expanded, pinned, arming, dragging, disposed, previewing, composing, dropArmed, dropHovering;
    private string appearance = "glass";
    private readonly List<(double X, double Y, double Width, double Height, double Angle)> hitAreas = new();
    private bool collectImages = true;
    private uint ignoredClipboard;
    private int clipboardRequest;
    private readonly bool testing;
    private Forms.Screen screen = Forms.Screen.PrimaryScreen!;
    private DateTime peekUntil = DateTime.MinValue;
    private readonly string uiRoot = Path.Combine(AppContext.BaseDirectory, "NativeUI");
    private readonly string appData;
    private readonly string currentVersion;
    private string locale = "en";
    private readonly Dictionary<string, Dictionary<string, string>> menuCopy;
    private string Label(string key) => menuCopy.TryGetValue(locale, out var values) && values.TryGetValue(key, out var translated) ? translated : key;

    public RailWindow(bool testing = false)
    {
        this.testing = testing;
        var asmVersion = Assembly.GetExecutingAssembly().GetName().Version;
        currentVersion = asmVersion is not null ? $"{asmVersion.Major}.{asmVersion.Minor}.{Math.Max(0, asmVersion.Build)}" : "1.1.3";
        menuCopy = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(File.ReadAllText(Path.Combine(uiRoot, "menus.json")))!;
        appData = testing ? Path.Combine(App.SessionDirectory, "Settings") : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SnapSlot");
        collectImages = !File.Exists(Path.Combine(appData, "image-intake-off"));
        preferences = new PreferencesStore(Path.Combine(appData, "preferences.json"), collectImages);
        collectImages = preferences.Value.CollectImages;
        var preferred = File.Exists(Path.Combine(appData, "locale.txt")) ? File.ReadAllText(Path.Combine(appData, "locale.txt")) : CultureInfo.CurrentUICulture.Name;
        locale = preferred.StartsWith("zh", StringComparison.OrdinalIgnoreCase)
            ? (preferred.Contains("TW") || preferred.Contains("HK") || preferred.Contains("Hant") ? "zh-Hant" : "zh-Hans")
            : Strings.Locales.FirstOrDefault(value => preferred.StartsWith(value, StringComparison.OrdinalIgnoreCase)) ?? "en";
        Strings.Locale = locale;
        var savedLook = Path.Combine(appData, "appearance.txt");
        if (File.Exists(savedLook) && new[] { "glass", "paper", "graphite" }.Contains(File.ReadAllText(savedLook))) appearance = File.ReadAllText(savedLook);
        Title = "SnapSlot";
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        ResizeMode = ResizeMode.NoResize;
        Topmost = true;
        ShowInTaskbar = false;
        ShowActivated = false;
        Width = SystemParameters.PrimaryScreenWidth;
        Height = 360;
        Left = 0;
        Top = 0;
        rootGrid.Children.Add(web);
        dropOverlay.DragEnter += OnDropDragEnter;
        dropOverlay.DragOver += OnDropDragOver;
        dropOverlay.DragLeave += OnDropDragLeave;
        dropOverlay.Drop += OnDropCompleted;
        rootGrid.Children.Add(dropOverlay);
        Content = rootGrid;
        hover.Tick += (_, _) => { hover.Stop(); edgeProbe.Stop(); if (EdgeWatcher.IsAtEdge() && EdgeWatcher.CanReveal(source?.Handle ?? IntPtr.Zero)) Reveal(false); };
        dismiss.Tick += (_, _) => { dismiss.Stop(); if (!KeepOpen() && !pinned && !dragging && !previewing && !composing && !dropHovering && settingsMode != "tray") Collapse(); };
        hide.Tick += (_, _) => { hide.Stop(); if (!expanded && !dropArmed) Hide(); };
        SourceInitialized += OnSource;
        DpiChanged += (_, _) => Dispatcher.BeginInvoke(new Action(() => { Position(); UpdateTrayIcon(); }));
        Loaded += async (_, _) =>
        {
            Hide();
            try
            {
                await InitializeWeb(web, "rail");
                if (!testing) { _ = PrepareTrayMenuAsync(); _ = PreparePreferencesAsync(); }
                if (testing) { Seed(); Reveal(false); }
                else if (startupShortcutError is not null || shortcutChanges.Count > 0) { OpenSettings("preferences"); }
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show(ex.Message + "\nInstall Microsoft Edge WebView2 Runtime to run SnapSlot.", "SnapSlot");
                Application.Current.Shutdown(1);
            }
        };
        Closed += (_, _) => Dispose();
        if (!testing) SetupTray();
    }

    private async Task InitializeWeb(WebView view, string mode)
    {
        environment ??= await CoreWebView2Environment.CreateAsync(null, Path.Combine(appData, "WebView2"));
        await view.EnsureCoreWebView2Async(environment);
        var core = view.CoreWebView2;
        core.SetVirtualHostNameToFolderMapping("snapslot.local", uiRoot, CoreWebView2HostResourceAccessKind.DenyCors);
        core.Settings.AreDefaultContextMenusEnabled = false;
        core.Settings.IsStatusBarEnabled = false;
        core.Settings.IsZoomControlEnabled = false;
        core.Settings.AreDevToolsEnabled = testing;
        core.NavigationStarting += (_, e) => { if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != "snapslot.local") e.Cancel = true; };
        core.ProcessFailed += (_, _) => { ready.Remove(view); sentItems.Remove(view); if (!disposed) view.Reload(); };
        core.NewWindowRequested += (_, e) => e.Handled = true;
        core.WebMessageReceived += (_, e) => { if (Uri.TryCreate(e.Source, UriKind.Absolute, out var origin) && origin.Scheme == "https" && origin.Host == "snapslot.local") Safe(() => Receive(view, e.WebMessageAsJson)); };
        core.Navigate("https://snapslot.local/index.html" + (mode == "rail" ? "" : "?mode=" + mode));
    }

    private void Safe(Action action)
    {
        try { action(); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or InvalidOperationException or ExternalException or JsonException or NotSupportedException)
        { Error(ex.Message); }
    }

    private void Error(string message)
    {
        var localized = Label(message);
        lastError = localized;
        foreach (var view in ready.ToArray()) Post(view, new { type = "error", message = localized });
    }

    private void Post(WebView view, object message)
    {
        if (ready.Contains(view) && !disposed) view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message));
    }

    private string Preview(InboxItem item)
    {
        if (item.Preview is not null) return item.Preview;
        return item.Preview = InboxItem.EncodeImageDataUri(item.ExportPath, 560);
    }

    private async void SendFullPreviewAsync(InboxItem item, WebView target)
    {
        if (item.Text is not null) return;
        try
        {
            var src = await Task.Run(() => InboxItem.EncodeImageDataUri(item.ExportPath, 2560));
            if (!disposed && ready.Contains(target) && !string.IsNullOrEmpty(src))
                Post(target, new { type = "previewImage", id = item.Id.ToString(), src });
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or NotSupportedException or InvalidOperationException) { }
    }

    private void State(bool focus = false)
    {
        UpdateTrayIcon();
        foreach (var view in ready.ToArray())
        {
            if (FindFloatByView(view) is not null) continue;
            var known = sentItems.GetValueOrDefault(view) ?? new HashSet<Guid>();
            var visible = view == web ? items.ToArray() : Array.Empty<InboxItem>();
            var captures = visible.Select(item => new
            {
                id = item.Id.ToString(),
                kind = item.Kind,
                title = item.Title,
                width = item.Width,
                height = item.Height,
                text = known.Contains(item.Id) ? null : item.Text,
                preview = !known.Contains(item.Id) && item.Text is null ? Preview(item) : null
            }).ToArray();
            Post(view, new
            {
                type = "state",
                items = captures,
                locale,
                expanded,
                reducedMotion = !SystemParameters.ClientAreaAnimation,
                focus,
                pinned,
                arming,
                appearance,
                count = items.Count,
                platform = "windows",
                version = currentVersion
            });
            sentItems[view] = visible.Select(item => item.Id).ToHashSet();
        }
        SyncFloats();
    }

    private FloatSession? FindFloatByView(WebView view) => floats.Values.FirstOrDefault(session => ReferenceEquals(session.View, view));

    private void SendFloatNote(Guid id)
    {
        if (!floats.TryGetValue(id, out var session) || !ready.Contains(session.View)) return;
        var item = items.FirstOrDefault(note => note.Id == id);
        if (item is null) { CloseFloat(id); return; }
        Post(session.View, new
        {
            type = "floatNote",
            item = new
            {
                id = item.Id.ToString(),
                kind = item.Kind,
                title = item.Title,
                width = item.Width,
                height = item.Height,
                text = item.Text,
                preview = item.Text is null ? Preview(item) : null
            },
            appearance,
            locale,
            reducedMotion = !SystemParameters.ClientAreaAnimation,
            platform = "windows",
            opacity = session.Opacity
        });
        if (item.Text is null) SendFullPreviewAsync(item, session.View);
    }

    private void SyncFloats()
    {
        foreach (var id in floats.Keys.ToArray()) SendFloatNote(id);
    }

    private async void OpenFloatAsync(InboxItem item)
    {
        if (floats.TryGetValue(item.Id, out var existing))
        {
            existing.Window.Activate();
            return;
        }
        if (floats.Count >= 8)
        {
            var oldest = floats.Keys.First();
            CloseFloat(oldest);
        }
        double width = item.Text is null ? 340 : 320;
        double height = item.Text is null ? 260 : 220;
        if (item.Text is null && item.Width is int w && item.Height is int h && w > 0 && h > 0)
        {
            double aspect = (double)w / h;
            width = Math.Clamp(w / 2.0, 240, 420);
            height = Math.Clamp(width / aspect, 160, 380) + 32;
        }
        var area = screen.WorkingArea;
        var scale = source?.CompositionTarget?.TransformToDevice.M22 ?? 1;
        double areaLeft = area.Left / scale, areaTop = area.Top / scale, areaWidth = area.Width / scale, areaHeight = area.Height / scale;
        double offset = (floats.Count % 5) * 26;
        double left = Math.Clamp(areaLeft + (areaWidth - width) / 2 + offset, areaLeft + 16, Math.Max(areaLeft + 16, areaLeft + areaWidth - width - 16));
        double top = Math.Clamp(areaTop + 180 + offset, areaTop + 24, Math.Max(areaTop + 24, areaTop + areaHeight - height - 24));

        var win = new Window
        {
            Title = item.Title,
            Width = width,
            Height = height,
            Left = left,
            Top = top,
            WindowStartupLocation = WindowStartupLocation.Manual,
            Background = Brushes.Transparent,
            WindowStyle = WindowStyle.None,
            AllowsTransparency = true,
            ResizeMode = ResizeMode.NoResize,
            ShowInTaskbar = false,
            ShowActivated = false,
            Topmost = true
        };
        var view = new WebView { DefaultBackgroundColor = Drawing.Color.Transparent };
        view.SizeChanged += (_, _) => view.Clip = new RectangleGeometry(new Rect(0, 0, view.ActualWidth, view.ActualHeight), 14, 14);
        win.Content = view;
        var session = new FloatSession { Id = item.Id, Window = win, View = view, Opacity = 1.0 };
        floats[item.Id] = session;
        win.Closed += (_, _) =>
        {
            floats.Remove(item.Id);
            ready.Remove(view);
            sentItems.Remove(view);
            view.Dispose();
        };
        win.Show();
        try { await InitializeWeb(view, "float"); }
        catch (Exception ex) { Error(ex.Message); CloseFloat(item.Id); }
    }

    private void CloseFloat(Guid id)
    {
        if (!floats.Remove(id, out var session)) return;
        ready.Remove(session.View);
        sentItems.Remove(session.View);
        session.Window.Close();
    }

    private void CloseAllFloats()
    {
        foreach (var id in floats.Keys.ToArray()) CloseFloat(id);
    }

    private void ResizeFloat(Guid id, double delta)
    {
        if (!floats.TryGetValue(id, out var session)) return;
        double factor = delta > 0 ? 1.08 : (1.0 / 1.08);
        var win = session.Window;
        double cx = win.Left + win.Width / 2, cy = win.Top + win.Height / 2;
        double newW = Math.Clamp(win.Width * factor, 180, 960);
        double newH = Math.Clamp(win.Height * factor, 120, 720);
        win.Width = newW;
        win.Height = newH;
        win.Left = cx - newW / 2;
        win.Top = cy - newH / 2;
    }

    private void SetFloatOpacity(Guid id, double opacity)
    {
        if (!floats.TryGetValue(id, out var session)) return;
        session.Opacity = Math.Clamp(opacity, 0.5, 1.0);
        session.Window.Opacity = session.Opacity;
    }

    private async void RunOcrAsync(InboxItem item, WebView target)
    {
        if (item.Text is not null) return;
        try
        {
            var text = await TextRecognition.RecognizeAsync(item.ExportPath);
            if (disposed || !ready.Contains(target)) return;
            if (string.IsNullOrWhiteSpace(text))
                Post(target, new { type = "ocrResult", id = item.Id.ToString(), text = "", error = Label("err.ocrEmpty") });
            else
                Post(target, new { type = "ocrResult", id = item.Id.ToString(), text });
        }
        catch (Exception)
        {
            if (!disposed && ready.Contains(target))
                Post(target, new { type = "ocrResult", id = item.Id.ToString(), text = "", error = Label("err.ocrFailed") });
        }
    }

    private async void CheckUpdatesAsync(WebView target)
    {
        if (testing)
        {
            Post(target, new { type = "updateStatus", value = new { status = "upToDate", currentVersion, latestVersion = "v" + currentVersion } });
            return;
        }
        var outcome = await UpdateChecker.CheckAsync(currentVersion);
        if (disposed || !ready.Contains(target)) return;
        Post(target, new
        {
            type = "updateStatus",
            value = new
            {
                status = outcome.Status,
                currentVersion = outcome.CurrentVersion,
                latestVersion = outcome.LatestVersion,
                releaseUrl = outcome.ReleaseUrl,
                message = outcome.Status == "error" ? Label("err.updateFailed") : outcome.Message
            }
        });
    }

    private void ApplyLaunchAtLogin(bool enabled)
    {
        if (testing) return;
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", writable: true);
            if (key is null) return;
            if (enabled)
            {
                var exe = Environment.ProcessPath;
                if (!string.IsNullOrWhiteSpace(exe)) key.SetValue("SnapSlot", $"\"{exe}\"");
            }
            else
            {
                key.DeleteValue("SnapSlot", throwOnMissingValue: false);
            }
        }
        catch (Exception ex) when (ex is UnauthorizedAccessException or IOException or System.Security.SecurityException)
        {
            Error("err.launchAtLogin");
        }
    }

    private void Receive(WebView view, string json)
    {
        if (Encoding.UTF8.GetByteCount(json) > 131072) return;
        using var message = JsonDocument.Parse(json);
        var value = message.RootElement;
        string? Get(string key) => value.TryGetProperty(key, out var field) && field.ValueKind == JsonValueKind.String ? field.GetString() : null;
        switch (Get("type"))
        {
            case "ready":
                ready.Add(view);
                sentItems[view] = new();
                if (FindFloatByView(view) is FloatSession readyFloat)
                {
                    SendFloatNote(readyFloat.Id);
                    break;
                }
                State();
                if (view == web || (view == settingsWeb && (settingsMode == "preferences" || settingsMode == "tray"))) SendPreferences(view);
                if (lastError is not null) Post(view, new { type = "error", message = lastError });
                break;
            case "collapse": Collapse(); break;
            case "closePreview": previewing = false; Position(); State(); ScheduleDismiss(); break;
            case "beginCompose":
                if (view == web) { composing = true; previewing = false; Reveal(true); }
                break;
            case "endCompose":
                if (view == web) { composing = false; Position(); State(); ScheduleDismiss(); }
                break;
            case "createText":
                if (view == web && Get("text") is string created && !string.IsNullOrWhiteSpace(created) && Encoding.UTF8.GetByteCount(created) <= 65536)
                {
                    composing = false;
                    if (!expanded) screen = Forms.Screen.FromPoint(Forms.Cursor.Position);
                    var first = created.Split('\n').FirstOrDefault(line => !string.IsNullOrWhiteSpace(line))?.Trim() ?? "Note";
                    Add(new InboxItem(first[..Math.Min(first.Length, 30)], created));
                    Arrived();
                }
                break;
            case "updateText":
                if (view == web && Guid.TryParse(Get("id"), out var editId) && Get("text") is string edited)
                {
                    var editItem = items.FirstOrDefault(item => item.Id == editId);
                    if (editItem is null) return;
                    editItem.UpdateText(edited);
                    items.RemoveAll(other => other.Id != editItem.Id && other.Kind == "text" && other.ContentHash == editItem.ContentHash);
                    foreach (var known in sentItems.Values) known.Remove(editItem.Id);
                    State();
                }
                break;
            case "copyText":
                if (Get("text") is string plain && !string.IsNullOrWhiteSpace(plain) && Encoding.UTF8.GetByteCount(plain) <= 65536)
                {
                    Clipboard.SetText(plain);
                    ignoredClipboard = GetClipboardSequenceNumber();
                    clipboardRequest++;
                }
                break;
            case "collectText":
                if (view == web && Get("text") is string selected && !string.IsNullOrWhiteSpace(selected) && Encoding.UTF8.GetByteCount(selected) <= 65536)
                {
                    previewing = false;
                    CollectText(selected);
                }
                break;
            case "dragText":
                if (view == web && Get("text") is string dragText && !string.IsNullOrWhiteSpace(dragText) && Encoding.UTF8.GetByteCount(dragText) <= 65536) DragText(dragText);
                break;
            case "preview":
                if (view == web && Guid.TryParse(Get("id"), out var previewId))
                {
                    var previewItem = items.FirstOrDefault(item => item.Id == previewId);
                    if (previewItem is null) return;
                    previewing = true;
                    composing = false;
                    Reveal(true);
                    SendFullPreviewAsync(previewItem, web);
                }
                break;
            case "ocr":
                if (Guid.TryParse(Get("id"), out var ocrId))
                {
                    var ocrItem = items.FirstOrDefault(item => item.Id == ocrId);
                    if (ocrItem is not null && ocrItem.Text is null) RunOcrAsync(ocrItem, view);
                }
                break;
            case "float":
                if (Guid.TryParse(Get("id"), out var floatId))
                {
                    var floatTarget = items.FirstOrDefault(item => item.Id == floatId);
                    if (floatTarget is null) return;
                    previewing = false;
                    Position();
                    OpenFloatAsync(floatTarget);
                    State();
                    ScheduleDismiss();
                }
                break;
            case "closeFloat":
                if (Guid.TryParse(Get("id"), out var closeFloatId)) CloseFloat(closeFloatId);
                break;
            case "moveFloat":
                if (Guid.TryParse(Get("id"), out var moveFloatId) && floats.TryGetValue(moveFloatId, out var moveSession) && System.Windows.Input.Mouse.LeftButton == System.Windows.Input.MouseButtonState.Pressed)
                    moveSession.Window.DragMove();
                break;
            case "resizeFloat":
                if (Guid.TryParse(Get("id"), out var resizeFloatId) && value.TryGetProperty("delta", out var deltaProp) && deltaProp.TryGetDouble(out var delta) && double.IsFinite(delta))
                    ResizeFloat(resizeFloatId, delta);
                break;
            case "setFloatOpacity":
                if (Guid.TryParse(Get("id"), out var opacityFloatId) && value.TryGetProperty("opacity", out var opacityProp) && opacityProp.TryGetDouble(out var opacity) && double.IsFinite(opacity))
                    SetFloatOpacity(opacityFloatId, opacity);
                break;
            case "checkUpdates":
                if (view == settingsWeb && settingsMode == "preferences") CheckUpdatesAsync(view);
                break;
            case "openUrl":
                if (!testing && Get("url") is string rawUrl && UpdateChecker.IsAllowedExternalUrl(rawUrl))
                    Process.Start(new ProcessStartInfo(rawUrl) { UseShellExecute = true });
                break;
            case "toggleRail":
                if (settingsMode == "tray") CloseSettings();
                ToggleRailFromShortcut();
                break;
            case "pin": Pin(); break;
            case "unpin": Unpin(); break;
            case "openPreferences": OpenSettings("preferences"); break;
            case "quit": if (view == settingsWeb && settingsMode == "tray") Application.Current.Shutdown(); break;
            case "close": CloseSettings(); break;
            case "savePreferences":
                if (view == settingsWeb && value.TryGetProperty("value", out var next))
                {
                    var preference = JsonSerializer.Deserialize<AppPreferences>(next.GetRawText(), PreferencesStore.Json) ?? throw new ArgumentException("err.shortcutInvalid");
                    SavePreferences(preference, Get("editingShortcut"));
                }
                break;
            case "beginShortcutRecording":
                if (view == settingsWeb && settingsMode == "preferences")
                {
                    try { RefreshShortcutAvailability(); shortcuts.Suspend(); recordingShortcut = true; Post(view, new { type = "recordingReady" }); }
                    catch { Post(view, new { type = "recordingCancelled" }); throw; }
                }
                break;
            case "endShortcutRecording": if (view == settingsWeb) FinishShortcutRecording(false); break;
            case "minimizePreferences": if (view == settingsWeb && settingsMode == "preferences") { FinishShortcutRecording(); settings!.WindowState = WindowState.Minimized; } break;
            case "resizePreferences":
                if (view == settingsWeb && settingsMode == "preferences" && value.TryGetProperty("height", out var height) && height.TryGetDouble(out var h) && double.IsFinite(h))
                    settings!.Height = Math.Clamp(h, 350, Math.Max(350, SystemParameters.WorkArea.Height - 40));
                break;
            case "setAppearance":
                if (Get("value") is string look && new[] { "glass", "paper", "graphite" }.Contains(look))
                {
                    appearance = look;
                    Directory.CreateDirectory(appData);
                    File.WriteAllText(Path.Combine(appData, "appearance.txt"), look);
                    State();
                }
                break;
            case "setLocale":
                if (Get("value") is string language && Strings.Locales.Contains(language))
                {
                    locale = language;
                    Strings.Locale = language;
                    Directory.CreateDirectory(appData);
                    File.WriteAllText(Path.Combine(appData, "locale.txt"), language);
                    State();
                }
                break;
            case "clearNotes": items.Clear(); CloseAllFloats(); State(); break;
            case "moveWindow":
                if (view == settingsWeb && settingsMode == "preferences" && System.Windows.Input.Mouse.LeftButton == System.Windows.Input.MouseButtonState.Pressed) settings?.DragMove();
                break;
            case "surfaces": if (view == web && value.TryGetProperty("surfaces", out var surfaces)) UpdateHitAreas(surfaces); break;
            case "copy":
            case "remove":
            case "drag":
                if (!Guid.TryParse(Get("id"), out var id)) return;
                var item = items.FirstOrDefault(note => note.Id == id);
                if (item is null) return;
                if (Get("type") == "remove") { previewing = false; Position(); CloseFloat(id); items.Remove(item); State(); }
                else if (Get("type") == "copy") { Copy(item); Post(view, new { type = "copied", id = item.Id.ToString() }); }
                else Drag(item);
                break;
        }
    }

    private void Add(InboxItem item)
    {
        item.Display = screen.DeviceName;
        items.RemoveAll(existing => existing.Kind == item.Kind && existing.ContentHash == item.ContentHash);
        items.Add(item);
        if (items.Count > 30) items.RemoveAt(0);
    }

    private void UpdateHitAreas(JsonElement surfaces)
    {
        hitAreas.Clear();
        if (surfaces.ValueKind != JsonValueKind.Array) return;
        foreach (var shape in surfaces.EnumerateArray().Take(12))
        {
            var name = shape.GetProperty("id").GetString();
            bool control = (name == "__preview" && previewing)
                || (name == "__composer" && composing)
                || ((name == "__selection" || name == "__compose-trigger" || name == "__empty-wrap") && expanded);
            if (!control && (!Guid.TryParse(name, out var id) || !items.Any(item => item.Id == id))) continue;
            double x = shape.GetProperty("x").GetDouble(), y = shape.GetProperty("y").GetDouble(), width = shape.GetProperty("width").GetDouble(), height = shape.GetProperty("height").GetDouble(), angle = shape.GetProperty("angle").GetDouble();
            if (new[] { x, y, width, height, angle }.All(double.IsFinite) && width > 0 && width <= Math.Min(800, ActualWidth) && height > 0 && height <= ActualHeight)
                hitAreas.Add((x, y, width, height, angle * Math.PI / 180));
        }
        UpdatePointers();
    }

    private void UpdatePointers()
    {
        var screenPoint = Forms.Cursor.Position;
        void Pointer(WebView view)
        {
            if (!ready.Contains(view)) return;
            var p = view.PointFromScreen(new Point(screenPoint.X, screenPoint.Y));
            bool inside = p.X >= 0 && p.Y >= 0 && p.X < view.ActualWidth && p.Y < view.ActualHeight;
            Post(view, new { type = "pointer", x = inside ? (double?)p.X : null, y = inside ? (double?)p.Y : null });
        }
        if (expanded && !dropArmed)
        {
            Pointer(web);
            var p = web.PointFromScreen(new Point(screenPoint.X, screenPoint.Y));
            bool hit = hitAreas.Any(area =>
            {
                var dx = p.X - area.X;
                var dy = p.Y - area.Y;
                return Math.Abs(dx * Math.Cos(area.Angle) + dy * Math.Sin(area.Angle)) <= area.Width / 2 + 12
                    && Math.Abs(-dx * Math.Sin(area.Angle) + dy * Math.Cos(area.Angle)) <= area.Height / 2 + 12;
            });
            if (!dragging) SetInteractive(hit);
        }
        if (settingsMode == "tray" && settingsWeb is not null) Pointer(settingsWeb);
    }

    private void Position()
    {
        if (source is null) return;
        var bounds = screen.Bounds;
        var area = screen.WorkingArea;
        // Use physical coordinates for monitor placement, including negative origins.
        var scale = source.CompositionTarget?.TransformToDevice.M22 ?? 1;
        Height = previewing ? Math.Min(720, area.Height / scale) : 360;
        SetWindowPos(source.Handle, new IntPtr(-1), bounds.Left, area.Top, bounds.Width, (int)Math.Ceiling(Height * scale), 0x0010 | (expanded || dropArmed ? 0x0040u : 0u));
    }

    private void ToggleRailFromShortcut()
    {
        var target = Forms.Screen.FromPoint(Forms.Cursor.Position);
        if (expanded && target.DeviceName == screen.DeviceName) Collapse();
        else { screen = target; Reveal(true); }
    }

    private void Reveal(bool focus, bool peek = false)
    {
        hover.Stop(); edgeProbe.Stop(); edgeDwell.Reset(); dismiss.Stop(); hide.Stop();
        if (!expanded && !peek) screen = Forms.Screen.FromPoint(Forms.Cursor.Position);
        expanded = true; arming = false;
        if (peek) peekUntil = DateTime.UtcNow.AddMilliseconds(4000);
        Position(); Show(); SetInteractive(true); State(focus);
        if (focus) { Activate(); web.Focus(); }
        if (peek) ScheduleDismiss();
    }

    private void Collapse()
    {
        hover.Stop(); edgeProbe.Stop(); edgeDwell.Reset(); dismiss.Stop(); hide.Stop();
        expanded = false; pinned = false; arming = false; previewing = false; composing = false;
        DisarmDropTarget();
        SetInteractive(false); Position(); State();
        if (SystemParameters.ClientAreaAnimation) hide.Start(); else Hide();
    }

    private void ArmDropTarget()
    {
        if (dropArmed || dragging || expanded || settingsMode == "tray") return;
        dropArmed = true;
        screen = EdgeWatcher.TargetScreen;
        hide.Stop();
        Position();
        Show();
        SetInteractive(true);
        dropOverlay.Visibility = Visibility.Visible;
        Post(web, new { type = "dropTarget", active = true });
    }

    private void DisarmDropTarget()
    {
        bool wasArmed = dropArmed;
        dropArmed = false;
        dropHovering = false;
        dropOverlay.Visibility = Visibility.Collapsed;
        if (wasArmed)
        {
            Post(web, new { type = "dropTarget", active = false });
            if (!expanded && !arming) { SetInteractive(false); Hide(); }
            else UpdatePointers();
        }
    }

    private void OnDropDragEnter(object sender, DragEventArgs e)
    {
        if (!CanAcceptDrop(e.Data)) { e.Effects = DragDropEffects.None; e.Handled = true; return; }
        dropHovering = true;
        e.Effects = DragDropEffects.Copy;
        e.Handled = true;
        Post(web, new { type = "dropTarget", active = true });
        if (!expanded) Reveal(false);
    }

    private void OnDropDragOver(object sender, DragEventArgs e)
    {
        e.Effects = CanAcceptDrop(e.Data) ? DragDropEffects.Copy : DragDropEffects.None;
        e.Handled = true;
    }

    private void OnDropDragLeave(object sender, DragEventArgs e)
    {
        dropHovering = false;
        if (!EdgeWatcher.IsLeftButtonHeld()) { DisarmDropTarget(); ScheduleDismiss(); }
    }

    private static bool CanAcceptDrop(IDataObject data)
        => data.GetDataPresent(DataFormats.FileDrop) || data.GetDataPresent(DataFormats.Bitmap) || data.GetDataPresent(DataFormats.UnicodeText);

    private void OnDropCompleted(object sender, DragEventArgs e)
    {
        e.Handled = true;
        bool added = false;
        Safe(() =>
        {
            if (e.Data.GetDataPresent(DataFormats.FileDrop) && e.Data.GetData(DataFormats.FileDrop) is string[] files)
            {
                foreach (var file in files.Take(8))
                {
                    if (!File.Exists(file)) continue;
                    var info = new FileInfo(file);
                    var ext = info.Extension;
                    if (DropImageExtensions.Contains(ext) && info.Length > 0 && info.Length <= 100 * 1024 * 1024)
                    {
                        var bmp = new BitmapImage(); bmp.BeginInit(); bmp.CacheOption = BitmapCacheOption.OnLoad;
                        bmp.UriSource = new Uri(file); bmp.EndInit(); bmp.Freeze();
                        var item = new InboxItem(info.Name, bmp, Path.GetFileNameWithoutExtension(file));
                        item.Preview = InboxItem.EncodeImageDataUri(item.ExportPath, 560);
                        Add(item);
                        added = true;
                    }
                    else if (DropTextExtensions.Contains(ext) && info.Length > 0 && info.Length <= 65536)
                    {
                        var fileText = File.ReadAllText(file, Encoding.UTF8);
                        if (!string.IsNullOrWhiteSpace(fileText))
                        {
                            var first = fileText.Split('\n').FirstOrDefault(line => !string.IsNullOrWhiteSpace(line))?.Trim() ?? info.Name;
                            Add(new InboxItem(first[..Math.Min(first.Length, 30)], fileText));
                            added = true;
                        }
                    }
                }
            }
            if (!added && e.Data.GetDataPresent(DataFormats.Bitmap))
            {
                BitmapSource? bmp = e.Data.GetData(DataFormats.Bitmap) as BitmapSource;
                if (bmp is null && e.Data.GetData(DataFormats.Bitmap) is Drawing.Bitmap gdi)
                {
                    var hBitmap = gdi.GetHbitmap();
                    try { bmp = Imaging.CreateBitmapSourceFromHBitmap(hBitmap, IntPtr.Zero, Int32Rect.Empty, BitmapSizeOptions.FromEmptyOptions()); }
                    finally { DeleteObject(hBitmap); }
                }
                if (bmp is not null)
                {
                    var title = InboxItem.FormatImageTitle(null, bmp.PixelWidth, bmp.PixelHeight);
                    var item = new InboxItem(title, bmp);
                    item.Preview = InboxItem.EncodeImageDataUri(item.ExportPath, 560);
                    Add(item);
                    added = true;
                }
            }
            if (!added && e.Data.GetDataPresent(DataFormats.UnicodeText) && e.Data.GetData(DataFormats.UnicodeText) is string droppedText && !string.IsNullOrWhiteSpace(droppedText) && Encoding.UTF8.GetByteCount(droppedText) <= 65536)
            {
                var first = droppedText.Split('\n').FirstOrDefault(line => !string.IsNullOrWhiteSpace(line))?.Trim() ?? "Note";
                Add(new InboxItem(first[..Math.Min(first.Length, 30)], droppedText));
                added = true;
            }
        });
        DisarmDropTarget();
        if (added) Arrived();
    }

    private void Pin()
    {
        if (!expanded) Reveal(false);
        pinned = true; dismiss.Stop(); State();
    }
    private void Unpin() => Collapse();
    private void SetInteractive(bool interactive)
    {
        if (source is null) return;
        var style = GetWindowLong(source.Handle, -20);
        SetWindowLong(source.Handle, -20, interactive ? style & ~0x20 : style | 0x20);
    }

    private Func<Drawing.Point> dismissalPointer = () => Forms.Cursor.Position;
    private bool KeepOpen()
    {
        if (previewing || composing || dropHovering || Forms.Control.MouseButtons.HasFlag(Forms.MouseButtons.Left)) return true;
        if (!expanded) return false;
        var point = dismissalPointer();
        var scale = source?.CompositionTarget?.TransformToDevice.M22 ?? 1;
        var local = web.PointFromScreen(new Point(point.X, point.Y));
        if (hitAreas.Any(area =>
        {
            var dx = local.X - area.X;
            var dy = local.Y - area.Y;
            return Math.Abs(dx * Math.Cos(area.Angle) + dy * Math.Sin(area.Angle)) <= area.Width / 2 + 12
                && Math.Abs(-dx * Math.Sin(area.Angle) + dy * Math.Cos(area.Angle)) <= area.Height / 2 + 12;
        })) return true;
        return NotesGeometry.IsPointerWithinRail(point.X, point.Y, screen.Bounds.Left, screen.WorkingArea.Top, screen.Bounds.Width, (int)Math.Ceiling(230 * scale));
    }

    private void ScheduleDismiss()
    {
        if (disposed || !expanded || pinned || dragging || previewing || composing || dropHovering || settingsMode == "tray") return;
        dismiss.Stop();
        dismiss.Interval = TimeSpan.FromMilliseconds(Math.Max(450, (peekUntil - DateTime.UtcNow).TotalMilliseconds));
        dismiss.Start();
    }

    private void Arrived() => Reveal(false, true);

    private void CollectText(string text)
    {
        if (!expanded) screen = Forms.Screen.FromPoint(Forms.Cursor.Position);
        var first = text.Split('\n').FirstOrDefault(line => !string.IsNullOrWhiteSpace(line))?.Trim() ?? "Note";
        Add(new InboxItem(first[..Math.Min(first.Length, 30)], text));
        Clipboard.SetText(text);
        ignoredClipboard = GetClipboardSequenceNumber();
        Arrived();
    }

    private void Copy(InboxItem item)
    {
        try
        {
            if (item.Text is not null) { Clipboard.SetText(item.Text); return; }
            var data = new DataObject();
            data.SetImage(item.Image!);
            // Publish both native bitmap and original PNG for applications with different clipboard support.
            data.SetData("PNG", new MemoryStream(File.ReadAllBytes(item.ExportPath)));
            Clipboard.SetDataObject(data, true);
        }
        finally { ignoredClipboard = GetClipboardSequenceNumber(); clipboardRequest++; }
    }

    private static string? GetForegroundProcessName()
    {
        try
        {
            var hwnd = GetForegroundWindow();
            if (hwnd == IntPtr.Zero) return null;
            GetWindowThreadProcessId(hwnd, out uint pid);
            if (pid == 0 || pid == Environment.ProcessId) return null;
            using var proc = Process.GetProcessById((int)pid);
            return proc.ProcessName;
        }
        catch { return null; }
    }

    private async void ReceiveClipboardImage()
    {
        if (testing || !collectImages || disposed) return;
        int request = ++clipboardRequest;
        for (int attempt = 0; attempt < 7; attempt++)
        {
            await Task.Delay(attempt == 0 ? 120 : 150);
            if (request != clipboardRequest || !collectImages || disposed) return;
            uint sequence = GetClipboardSequenceNumber();
            if (sequence == 0 || sequence == ignoredClipboard) return;
            try
            {
                // Text and the clipboard already present at launch are never collected automatically.
                var image = Clipboard.ContainsImage() ? Clipboard.GetImage() : null;
                ignoredClipboard = GetClipboardSequenceNumber();
                if (image is not null)
                {
                    if (image.CanFreeze) image.Freeze();
                    var appName = GetForegroundProcessName();
                    var title = InboxItem.FormatImageTitle(appName, image.PixelWidth, image.PixelHeight);
                    var created = await Task.Run(() =>
                    {
                        var note = new InboxItem(title, image);
                        note.Preview = InboxItem.EncodeImageDataUri(note.ExportPath, 560);
                        return note;
                    });
                    if (disposed) return;
                    if (!expanded) screen = Forms.Screen.FromPoint(Forms.Cursor.Position);
                    Add(created);
                    Arrived();
                }
                return;
            }
            catch (ExternalException) { /* Screenshot tools can hold the clipboard while publishing pixels. */ }
            catch (Exception ex) when (ex is IOException or NotSupportedException or InvalidOperationException) { Error(ex.Message); return; }
        }
    }

    private void SendPreferences(WebView view) => Post(view, new
    {
        type = "preferences",
        value = JsonSerializer.SerializeToElement(preferences.Value, PreferencesStore.Json),
        shortcutChanges = JsonSerializer.SerializeToElement(shortcutChanges, PreferencesStore.Json),
        platform = "windows",
        version = currentVersion
    });

    private void ClearShortcuts() { if (source is null) return; for (int id = 1; id <= 3; id++) UnregisterHotKey(source.Handle, id); }
    private bool RegisterShortcut(int id, Shortcut binding)
    {
        if (source is null) throw new InvalidOperationException("err.shortcutUnavailable");
        if (RegisterHotKey(source.Handle, id, binding.Modifiers, binding.VirtualKey)) return true;
        int error = Marshal.GetLastWin32Error();
        if (error == 1409) return false;
        throw new InvalidOperationException(binding.Display + " — " + new System.ComponentModel.Win32Exception(error).Message);
    }

    private void RefreshShortcutAvailability()
    {
        if (testing || source is null) return;
        var previous = preferences.Value;
        try
        {
            var resolution = shortcuts.Resolve(previous);
            try { preferences.Save(resolution.Preferences); } catch { shortcuts.Apply(previous); throw; }
            shortcutChanges.RemoveAll(change => resolution.Changes.Any(next => next.Target == change.Target));
            shortcutChanges.AddRange(resolution.Changes);
            SendPreferences(web);
            if (settingsWeb is not null) SendPreferences(settingsWeb);
        }
        catch (Exception ex) { Error(ex.Message); }
    }

    private void SavePreferences(AppPreferences value, string? editing = null)
    {
        var previous = preferences.Value;
        bool refresh = recordingShortcut || value.TextShortcut != previous.TextShortcut || value.OpenShortcut != previous.OpenShortcut;
        var resolution = refresh ? shortcuts.Resolve(value, editing) : new ShortcutResolution(value, Array.Empty<ShortcutChange>());
        try { preferences.Save(resolution.Preferences); } catch { if (refresh) shortcuts.Apply(previous); throw; }
        recordingShortcut = false;
        shortcutChanges.RemoveAll(change => change.Target == editing || resolution.Changes.Any(next => next.Target == change.Target));
        shortcutChanges.AddRange(resolution.Changes);
        if (resolution.Preferences.LaunchAtLogin != previous.LaunchAtLogin) ApplyLaunchAtLogin(resolution.Preferences.LaunchAtLogin);
        collectImages = resolution.Preferences.CollectImages;
        ignoredClipboard = GetClipboardSequenceNumber();
        clipboardRequest++;
        lastError = null;
        SendPreferences(web);
        if (settingsWeb is not null) SendPreferences(settingsWeb);
        State();
    }

    private void FinishShortcutRecording(bool cancelled = true)
    {
        if (!recordingShortcut || disposed) return;
        try { SavePreferences(preferences.Value); } catch (Exception ex) { Error(ex.Message); }
        finally { recordingShortcut = false; }
        if (cancelled && settingsWeb is not null) Post(settingsWeb, new { type = "recordingCancelled" });
    }

    private async void CollectSelectedText()
    {
        if (collectingText) return;
        collectingText = true;
        try
        {
            string text;
            if (IsActive && ready.Contains(web))
                text = JsonSerializer.Deserialize<string>(await web.CoreWebView2.ExecuteScriptAsync("window.getSelection().toString()")) ?? "";
            else
                text = await SelectedText.ReadAsync();
            if (string.IsNullOrWhiteSpace(text)) throw new InvalidOperationException("err.selectText");
            if (Encoding.UTF8.GetByteCount(text) > 65536) throw new ArgumentException("err.invalidText");
            CollectText(text);
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException or ExternalException or IOException or UnauthorizedAccessException) { Arrived(); Error(ex.Message); }
        finally { collectingText = false; }
    }

    private void Drag(InboxItem item)
    {
        var data = new DataObject();
        data.SetFileDropList(new StringCollection { item.ExportPath });
        if (item.Text is not null) data.SetText(item.Text);
        RunDrag(data);
    }
    private void DragText(string text) { var data = new DataObject(); data.SetText(text); RunDrag(data); }
    private void RunDrag(DataObject data)
    {
        dragging = true; dismiss.Stop();
        try { var result = DragDrop.DoDragDrop(web, data, DragDropEffects.Copy); }
        finally { dragging = false; ScheduleDismiss(); }
    }

    private void CloseSettings() => closeSettings?.Invoke();
    private async void OpenSettings(string mode)
    {
        dismiss.Stop(); hover.Stop();
        if (!expanded) screen = Forms.Screen.FromPoint(Forms.Cursor.Position);
        if (mode == "tray") { await ShowTrayMenuAsync(); return; }
        if (!recordingShortcut) RefreshShortcutAvailability();
        await ShowPreferencesAsync();
    }

    private Task PreparePreferencesAsync() => preferencesPreparation ??= PreparePreferencesCoreAsync();
    private async Task PreparePreferencesCoreAsync()
    {
        var window = new Window { Title = Label("Settings"), Width = 420, Height = 442, WindowStartupLocation = WindowStartupLocation.CenterScreen, Background = Brushes.Transparent, WindowStyle = WindowStyle.None, AllowsTransparency = true, ResizeMode = ResizeMode.NoResize, ShowInTaskbar = true, ShowActivated = false, Topmost = false };
        var view = new WebView { DefaultBackgroundColor = Drawing.Color.Transparent };
        var surface = new Grid(); surface.Children.Add(view); window.Content = surface;
        void DragArea(double width, double height, HorizontalAlignment horizontal, VerticalAlignment vertical, Thickness margin)
        {
            var handle = new Border { Background = Brushes.Transparent, HorizontalAlignment = horizontal, VerticalAlignment = vertical, Margin = margin };
            if (width > 0) handle.Width = width; if (height > 0) handle.Height = height;
            handle.MouseLeftButtonDown += (_, e) => { FinishShortcutRecording(); if (System.Windows.Input.Mouse.LeftButton == System.Windows.Input.MouseButtonState.Pressed) window.DragMove(); e.Handled = true; };
            surface.Children.Add(handle);
        }
        DragArea(0, 36, HorizontalAlignment.Stretch, VerticalAlignment.Top, new Thickness(0, 0, 80, 0));
        DragArea(0, 4, HorizontalAlignment.Stretch, VerticalAlignment.Top, new Thickness(0, 36, 0, 0));
        DragArea(12, 0, HorizontalAlignment.Left, VerticalAlignment.Stretch, new Thickness(0, 40, 0, 14));
        DragArea(12, 0, HorizontalAlignment.Right, VerticalAlignment.Stretch, new Thickness(0, 40, 0, 14));
        DragArea(0, 14, HorizontalAlignment.Stretch, VerticalAlignment.Bottom, new Thickness(0));
        preferencesWindow = window; preferencesWeb = view;
        window.Closed += (_, _) => { ready.Remove(view); sentItems.Remove(view); view.Dispose(); if (ReferenceEquals(preferencesWindow, window)) { preferencesWindow = null; preferencesWeb = null; preferencesPreparation = null; } if (ReferenceEquals(settings, window)) { settings = null; settingsWeb = null; settingsMode = ""; closeSettings = null; ScheduleDismiss(); } };
        window.Activated += (_, _) => window.Topmost = true;
        window.Deactivated += (_, _) => { window.Topmost = false; if (ReferenceEquals(settings, window)) { FinishShortcutRecording(); ScheduleDismiss(); } };
        view.SizeChanged += (_, _) => view.Clip = new RectangleGeometry(new Rect(0, 0, view.ActualWidth, view.ActualHeight), 16, 16);
        window.Show(); window.Hide();
        try { await InitializeWeb(view, "preferences"); } catch (Exception ex) { Error(ex.Message); window.Close(); }
    }

    private async Task ShowPreferencesAsync()
    {
        await PreparePreferencesAsync();
        if (disposed || preferencesWindow is null || preferencesWeb is null) return;
        if (ReferenceEquals(settings, preferencesWindow)) { PresentPreferences(); return; }
        if (settings is not null) CloseSettings();
        var window = preferencesWindow; var view = preferencesWeb; var closeOnce = new CloseOnce();
        void HideWindow() { if (closeOnce.TryBegin()) HidePreferences(window); }
        settings = window; settingsMode = "preferences"; settingsWeb = view; closeSettings = HideWindow;
        PresentPreferences(); SendPreferences(view); State();
    }

    private void PresentPreferences()
    {
        if (preferencesWindow is null) return;
        preferencesWindow.Topmost = true; preferencesWindow.ShowActivated = true;
        if (preferencesWindow.WindowState == WindowState.Minimized) preferencesWindow.WindowState = WindowState.Normal;
        preferencesWindow.Show(); preferencesWindow.Activate(); preferencesWeb?.Focus(); ScheduleDismiss();
    }

    private void HidePreferences(Window window)
    {
        if (!ReferenceEquals(preferencesWindow, window)) return;
        FinishShortcutRecording();
        if (window.IsVisible) window.Hide();
        window.ShowActivated = false;
        if (ReferenceEquals(settings, window)) { settings = null; settingsWeb = null; settingsMode = ""; closeSettings = null; ScheduleDismiss(); }
    }

    private Task PrepareTrayMenuAsync() => trayMenuPreparation ??= PrepareTrayMenuCoreAsync();
    private async Task PrepareTrayMenuCoreAsync()
    {
        var window = new Window { Title = Label("SnapSlot"), Width = 232, Height = 158, WindowStartupLocation = WindowStartupLocation.Manual, Background = Brushes.Transparent, WindowStyle = WindowStyle.None, AllowsTransparency = true, ResizeMode = ResizeMode.NoResize, ShowInTaskbar = false, ShowActivated = false, Topmost = true };
        var view = new WebView { DefaultBackgroundColor = Drawing.Color.Transparent };
        view.SizeChanged += (_, _) => view.Clip = new RectangleGeometry(new Rect(0, 0, view.ActualWidth, view.ActualHeight), 12, 12);
        window.Content = view;
        trayMenu = window; trayMenuWeb = view;
        window.SourceInitialized += (_, _) => PositionTrayMenu(window);
        window.Deactivated += (_, _) => { if (ReferenceEquals(settings, window)) CloseSettings(); };
        window.Closed += (_, _) => { ready.Remove(view); sentItems.Remove(view); view.Dispose(); if (ReferenceEquals(trayMenu, window)) { trayMenu = null; trayMenuWeb = null; trayMenuPreparation = null; } if (ReferenceEquals(settings, window)) { settings = null; settingsWeb = null; settingsMode = ""; closeSettings = null; ScheduleDismiss(); } };
        window.Show(); window.Hide();
        try { await InitializeWeb(view, "tray"); } catch (Exception ex) { Error(ex.Message); window.Close(); }
    }

    private async Task ShowTrayMenuAsync()
    {
        await PrepareTrayMenuAsync();
        if (disposed || trayMenu is null || trayMenuWeb is null) return;
        if (ReferenceEquals(settings, trayMenu)) return;
        if (settings is not null) CloseSettings();
        var window = trayMenu; var view = trayMenuWeb; var closeOnce = new CloseOnce();
        void HideWindow() { if (closeOnce.TryBegin()) HideTrayMenu(window); }
        settings = window; settingsMode = "tray"; settingsWeb = view; closeSettings = HideWindow;
        PositionTrayMenu(window); window.Show(); SendPreferences(view); State();
    }

    private void HideTrayMenu(Window window)
    {
        if (!ReferenceEquals(trayMenu, window)) return;
        if (window.IsVisible) window.Hide();
        if (ReferenceEquals(settings, window)) { settings = null; settingsWeb = null; settingsMode = ""; closeSettings = null; ScheduleDismiss(); }
    }

    private static void PositionTrayMenu(Window window)
    {
        var point = Forms.Cursor.Position; var area = Forms.Screen.FromPoint(point).WorkingArea; var dpi = VisualTreeHelper.GetDpi(window);
        var left = area.Left / dpi.DpiScaleX; var top = area.Top / dpi.DpiScaleY; var right = area.Right / dpi.DpiScaleX; var bottom = area.Bottom / dpi.DpiScaleY;
        var x = point.X / dpi.DpiScaleX - window.Width + 14; var y = point.Y / dpi.DpiScaleY - window.Height - 8;
        window.Left = Math.Max(left, Math.Min(x, right - window.Width)); window.Top = Math.Max(top, Math.Min(y, bottom - window.Height));
    }

    private void SetupTray()
    {
        tray = new Forms.NotifyIcon { Text = "SnapSlot" };
        var file = Path.Combine(AppContext.BaseDirectory, "SnapSlot.ico");
        // Start with the high-resolution master-derived frame, then fit its visible
        // artwork to the tray metric instead of preserving application-icon padding.
        icon = File.Exists(file) ? new Drawing.Icon(file, new Drawing.Size(256, 256)) : (Drawing.Icon)Drawing.SystemIcons.Application.Clone();
        using (var original = icon.ToBitmap()) iconSource = TrayIconGeometry.VisibleBounds(original.Width, original.Height, (x, y) => original.GetPixel(x, y).A);
        tray.MouseClick += (_, eventArgs) => Dispatcher.Invoke(() => Safe(() =>
        {
            if (eventArgs.Button == Forms.MouseButtons.Right) { if (settingsMode == "tray") CloseSettings(); else OpenSettings("tray"); }
            else if (eventArgs.Button == Forms.MouseButtons.Left) { if (settingsMode == "tray") CloseSettings(); else OpenSettings("tray"); }
        }));
        UpdateTrayIcon(); tray.Visible = true;
    }

    private void UpdateTrayIcon()
    {
        var size = Forms.SystemInformation.SmallIconSize;
        if (tray is null || icon is null || iconState == (pinned, collectImages, size)) return;
        using var bitmap = new Drawing.Bitmap(size.Width, size.Height);
        using (var graphics = Drawing.Graphics.FromImage(bitmap))
        {
            graphics.SmoothingMode = Drawing.Drawing2D.SmoothingMode.AntiAlias;
            graphics.InterpolationMode = Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            graphics.PixelOffsetMode = Drawing.Drawing2D.PixelOffsetMode.HighQuality;
            using var original = icon.ToBitmap();
            var destination = TrayIconGeometry.Fit(size, iconSource);
            if (collectImages) graphics.DrawImage(original, destination, iconSource, Drawing.GraphicsUnit.Pixel);
            else
            {
                using var attributes = new Drawing.Imaging.ImageAttributes();
                attributes.SetColorMatrix(new Drawing.Imaging.ColorMatrix(new[]
                {
                    new[] { .2126f, .2126f, .2126f, 0f, 0f }, new[] { .7152f, .7152f, .7152f, 0f, 0f }, new[] { .0722f, .0722f, .0722f, 0f, 0f }, new[] { 0f, 0f, 0f, .55f, 0f }, new[] { 0f, 0f, 0f, 0f, 1f }
                }));
                var corners = new[] { new Drawing.PointF(destination.Left, destination.Top), new Drawing.PointF(destination.Right, destination.Top), new Drawing.PointF(destination.Left, destination.Bottom) };
                graphics.DrawImage(original, corners, iconSource, Drawing.GraphicsUnit.Pixel, attributes);
            }
            if (pinned)
            {
                // Website Windows marker: 7 px, right/bottom 4 px, 1.5 px light ring on a 32 px button.
                float scale = size.Width / 32f;
                var dot = new Drawing.RectangleF(21 * scale, 21 * scale, 7 * scale, 7 * scale);
                using var ring = new Drawing.Pen(Drawing.Color.FromArgb(238, 240, 246), 3 * scale);
                using var fill = new Drawing.SolidBrush(Drawing.Color.FromArgb(108, 77, 255));
                graphics.DrawEllipse(ring, dot); graphics.FillEllipse(fill, dot);
            }
        }
        var handle = bitmap.GetHicon(); Drawing.Icon next;
        try { next = (Drawing.Icon)Drawing.Icon.FromHandle(handle).Clone(); } finally { DestroyIcon(handle); }
        var previous = stateIcon; tray.Icon = next; stateIcon = next; iconState = (pinned, collectImages, size); previous?.Dispose();
    }

    private void OnSource(object? sender, EventArgs e)
    {
        source = (HwndSource)PresentationSource.FromVisual(this);
        source.AddHook(WndProc);
        shortcuts = new GlobalShortcuts(RegisterShortcut, ClearShortcuts);
        if (testing) return;
        ignoredClipboard = GetClipboardSequenceNumber();
        AddClipboardFormatListener(source.Handle);
        try { var resolution = shortcuts.Resolve(preferences.Value); preferences.Save(resolution.Preferences); shortcutChanges.AddRange(resolution.Changes); } catch (Exception ex) { startupShortcutError = ex.Message; Error(ex.Message); }
        watcher = new EdgeWatcher();
        watcher.Entered += () =>
        {
            if (!expanded && settingsMode != "tray")
            {
                arming = true; screen = EdgeWatcher.TargetScreen; Position(); Show(); SetInteractive(false); State();
                hover.Start();
                edgeDwell.Reset();
                edgeProbe.Start();
            }
        };
        watcher.DragEnteredEdge += ArmDropTarget;
        watcher.LeftButtonUp += () => { if (dropArmed) DisarmDropTarget(); };
        watcher.Left += () =>
        {
            hover.Stop(); edgeProbe.Stop(); edgeDwell.Reset();
            if (arming && !expanded) { arming = false; State(); Hide(); }
            if (expanded && !KeepOpen()) ScheduleDismiss();
        };
        watcher.Moved += () =>
        {
            UpdatePointers();
            if (dropArmed && !dropHovering && !EdgeWatcher.IsLeftButtonHeld()) DisarmDropTarget();
            if (!expanded) return;
            if (KeepOpen()) dismiss.Stop(); else if (!dismiss.IsEnabled) ScheduleDismiss();
        };
        watcher.Clicked += () =>
        {
            if (settingsMode == "tray" && settings is not null)
            {
                var point = Forms.Cursor.Position;
                var local = settings.PointFromScreen(new Point(point.X, point.Y));
                if (local.X < 0 || local.Y < 0 || local.X >= settings.ActualWidth || local.Y >= settings.ActualHeight) CloseSettings();
            }
        };
        // Only poll edge dwell while the cursor is actually parked at the top edge.
        edgeProbe.Tick += (_, _) =>
        {
            if (expanded || settingsMode == "tray" || !EdgeWatcher.IsAtEdge())
            {
                edgeDwell.Reset(); edgeProbe.Stop(); return;
            }
            if (edgeDwell.Update(true, EdgeWatcher.CanReveal(source.Handle), DateTime.UtcNow))
            {
                edgeProbe.Stop(); Reveal(false);
            }
        };
        SystemParameters.StaticPropertyChanged += ParametersChanged;
    }

    private void ParametersChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(SystemParameters.ClientAreaAnimation)) State();
    }

    private IntPtr WndProc(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (message == 0x0312) { if (wParam.ToInt32() == 3) CollectSelectedText(); else ToggleRailFromShortcut(); handled = true; }
        if (message == 0x031D) { ReceiveClipboardImage(); handled = true; }
        if (message == 0x0021 && !pinned && !composing && !previewing) { handled = true; return new IntPtr(3); }
        if (message == 0x007E && expanded) { screen = Forms.Screen.FromPoint(Forms.Cursor.Position); Position(); State(); }
        return IntPtr.Zero;
    }

    private void Seed()
    {
        var bitmap = new RenderTargetBitmap(480, 300, 96, 96, PixelFormats.Pbgra32);
        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
        {
            dc.DrawRectangle(new SolidColorBrush(Color.FromRgb(129, 185, 203)), null, new Rect(0, 0, 480, 300));
            dc.DrawGeometry(new SolidColorBrush(Color.FromRgb(35, 95, 95)), null, Geometry.Parse("M0,300 200,40 480,300Z"));
        }
        bitmap.Render(visual); bitmap.Freeze();
        Add(new InboxItem("Mountains", bitmap));
        Add(new InboxItem(Strings.Get("text"), Strings.Get("sample")));
    }

    internal async Task RunSmokeTest(string output)
    {
        Directory.CreateDirectory(output);
        for (int i = 0; i < 100 && !ready.Contains(web); i++) await Task.Delay(100);
        if (!ready.Contains(web)) throw new InvalidOperationException("Offline UI did not become ready");
        if (items.Count == 0) Seed();
        var file = items[0].ExportPath;
        items.RemoveAt(0);
        if (!File.Exists(file)) throw new InvalidOperationException("Removing a note deleted its export");
        for (int i = 0; i < 35; i++) Add(new InboxItem("Note " + i, "Note " + i));
        Reveal(false); await Task.Delay(900);
        if (items.Count != 30) throw new InvalidOperationException("Note capacity must be 30");
        using (var stream = File.Create(Path.Combine(output, "windows-notes.png"))) await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, stream);
        var checks = new List<string> { "PASS: Offline native UI loaded", "PASS: 30-note capacity with website fan", "PASS: removal keeps export alive" };
        void Check(bool passed, string message) { if (!passed) throw new InvalidOperationException(message); checks.Add("PASS: " + message); }
        var dupBefore = items.Count;
        Add(new InboxItem("Note 34", "Note 34"));
        Check(items.Count == dupBefore, "Exact duplicate notes are deduplicated without growing session count");
        var editable = items[^1];
        editable.UpdateText("Updated note payload");
        Check(File.ReadAllText(editable.ExportPath) == "Updated note payload", "Editing a text note updates its exported file");
        ToggleRailFromShortcut(); Check(!expanded, "Pressing open shortcut while expanded collapses the rail");
        ToggleRailFromShortcut(); Check(expanded, "Pressing open shortcut while collapsed reveals the rail");
        await ShowPreferencesAsync(); var window = settings!; var view = settingsWeb!;
        for (int i = 0; i < 100 && !ready.Contains(view); i++) await Task.Delay(100);
        Check(ready.Contains(view), "Settings loads the offline native interface");
        dismissalPointer = () => new Drawing.Point(screen.Bounds.Left + 100, screen.WorkingArea.Top + 1000);
        foreach (string phase in new[] { "foreground", "background", "minimized" })
        {
            pinned = false; peekUntil = DateTime.MinValue; PresentPreferences(); Reveal(false);
            if (phase == "background") Activate();
            if (phase == "minimized") window.WindowState = WindowState.Minimized;
            ScheduleDismiss(); await Task.Delay(750);
            Check(!expanded && ReferenceEquals(settings, window), "Unpinned notes dismiss with Settings " + phase + " and leave Settings available");
        }
        await view.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('header button')[0].click()"); await Task.Delay(200);
        Check(window.WindowState == WindowState.Minimized, "The minimize control minimizes the real WPF settings window");
        await ShowPreferencesAsync();
        Check(ReferenceEquals(settings, window) && window.WindowState == WindowState.Normal && window.IsVisible, "Reopening Settings restores the same minimized window");
        Reveal(false); pinned = true; ScheduleDismiss(); await Task.Delay(650);
        Check(expanded, "Pinned notes remain visible with Settings open and pointer outside");
        pinned = false;
        var prefs = preferences.Value;
        await view.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-shortcut-row=text] button').click()"); await Task.Delay(100);
        Check(recordingShortcut, "The text row starts native recording");
        await view.CoreWebView2.ExecuteScriptAsync("dispatchEvent(new KeyboardEvent('keydown',{code:'KeyY',key:'Y',ctrlKey:true,altKey:true,shiftKey:true,bubbles:true}));dispatchEvent(new KeyboardEvent('keyup',{code:'KeyY',key:'Y',ctrlKey:true,altKey:true,shiftKey:true,bubbles:true}))"); await Task.Delay(150);
        Check(!recordingShortcut && preferences.Value.TextShortcut.Key == "KeyY", "Recording persists a registered shortcut after key release");
        await view.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-shortcut-row=open] button').click()"); await Task.Delay(100);
        await view.CoreWebView2.ExecuteScriptAsync("dispatchEvent(new KeyboardEvent('keydown',{code:'KeyO',key:'O',ctrlKey:true,altKey:true,shiftKey:true,bubbles:true}));dispatchEvent(new KeyboardEvent('keyup',{code:'KeyO',key:'O',ctrlKey:true,altKey:true,shiftKey:true,bubbles:true}))"); await Task.Delay(150);
        Check(preferences.Value.OpenShortcut.Key == "KeyO", "The opening shortcut can be edited independently");
        SavePreferences(prefs); ClearShortcuts(); CloseSettings(); CloseAllFloats();
        File.WriteAllLines(Path.Combine(output, "desktop-smoke.txt"), checks);
    }

    private void Dispose()
    {
        disposed = true; hover.Stop(); edgeProbe.Stop(); dismiss.Stop(); hide.Stop(); watcher?.Dispose(); SystemParameters.StaticPropertyChanged -= ParametersChanged;
        if (source is not null) { if (!testing) RemoveClipboardFormatListener(source.Handle); ClearShortcuts(); source.RemoveHook(WndProc); }
        CloseAllFloats(); CloseSettings(); trayMenu?.Close(); preferencesWindow?.Close(); web.Dispose(); tray?.Dispose(); stateIcon?.Dispose(); icon?.Dispose();
    }

    [DllImport("user32.dll")] private static extern bool AddClipboardFormatListener(IntPtr window);
    [DllImport("user32.dll")] private static extern bool DestroyIcon(IntPtr icon);
    [DllImport("user32.dll")] private static extern bool RemoveClipboardFormatListener(IntPtr window);
    [DllImport("user32.dll")] private static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll", SetLastError = true)] private static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool UnregisterHotKey(IntPtr window, int id);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] private static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll")] private static extern int SetWindowLong(IntPtr window, int index, int value);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr handle);
}
