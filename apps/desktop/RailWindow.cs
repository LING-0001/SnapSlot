using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Automation;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using System.Windows.Threading;
using Forms = System.Windows.Forms;
using Drawing = System.Drawing;
using Path = System.IO.Path;

namespace SnapSlot;

public sealed class RailWindow : Window
{
    private readonly List<InboxItem> items = new();
    private readonly StackPanel root = new();
    private readonly StackPanel drawer = new();
    private readonly StackPanel cardRow = new() { Orientation = Orientation.Horizontal };
    private readonly TextBlock status = new();
    private readonly Button handle = new();
    private readonly DispatcherTimer hover = new() { Interval = TimeSpan.FromMilliseconds(220) };
    private readonly DispatcherTimer dismiss = new() { Interval = TimeSpan.FromMilliseconds(450) };
    private readonly DispatcherTimer feedback = new() { Interval = TimeSpan.FromMilliseconds(1800) };
    private readonly TranslateTransform slide = new();
    private EdgeWatcher? edgeWatcher;
    private bool keyboardMode, draggingOut, busy, menuOpen;
    private int visibilityVersion;
    private readonly Dictionary<Guid, Button> itemButtons = new();
    private readonly HashSet<DispatcherTimer> animationTimers = new();
    private Forms.NotifyIcon? tray;
    private Drawing.Icon? trayIcon;
    private HwndSource? source;
    private bool expanded, overflow;
    private bool hotkeyRegistered;
    private readonly Brush ink = Brush("#252B28");
    private readonly bool testing;
    private static readonly string[] Accents = ["#E95843", "#2878ED", "#EABD42", "#508B62"];

    public RailWindow(bool testing = false)
    {
        this.testing = testing;
        Title = "SnapSlot";
        WindowStyle = WindowStyle.None; AllowsTransparency = true;
        Background = Brushes.Transparent; ResizeMode = ResizeMode.NoResize;
        Topmost = true; ShowInTaskbar = false; ShowActivated = false;
        Width = SystemParameters.PrimaryScreenWidth;
        Left = 0; Top = 0; Height = 124;
        FontFamily = new FontFamily("Segoe UI, Microsoft YaHei");
        FontSize = 12;
        root.RenderTransform = slide;
        root.Background = new LinearGradientBrush(Color.FromArgb(250, 48, 57, 49), Color.FromArgb(244, 37, 43, 40), 90);
        var content = new Grid();
        content.Children.Add(root);
        status.Foreground = Brush("#B5C2AC"); status.FontSize = 10;
        status.HorizontalAlignment = HorizontalAlignment.Right;
        status.VerticalAlignment = VerticalAlignment.Bottom;
        status.Margin = new Thickness(0, 0, 62, 6);
        status.IsHitTestVisible = false;
        content.Children.Add(status);
        Content = content;
        hover.Tick += (_, _) =>
        {
            hover.Stop();
            if (EdgeWatcher.IsAtEdge() && EdgeWatcher.CanReveal(source?.Handle ?? IntPtr.Zero)) Expand(false);
        };
        dismiss.Tick += (_, _) =>
        {
            dismiss.Stop();
            if (!IsMouseOver && !keyboardMode && !draggingOut && !busy && !menuOpen) Collapse();
        };
        feedback.Tick += (_, _) => { feedback.Stop(); status.Text = ""; };
        MouseEnter += (_, _) => dismiss.Stop();
        MouseLeave += (_, _) => ScheduleCollapse();
        Deactivated += (_, _) => { keyboardMode = false; ScheduleCollapse(); };
        Loaded += (_, _) => { if (!expanded) Hide(); };
        PreviewKeyDown += OnKey;
        SourceInitialized += OnSource;
        Closed += (_, _) => Dispose();
        var culture = CultureInfo.CurrentUICulture.Name;
        Strings.Locale = culture.StartsWith("zh", StringComparison.OrdinalIgnoreCase)
            ? (culture.Contains("TW") || culture.Contains("HK") || culture.Contains("Hant") ? "zh-Hant" : "zh-Hans")
            : Strings.Locales.FirstOrDefault(l => culture.StartsWith(l, StringComparison.OrdinalIgnoreCase)) ?? "en";
        if (testing) AddSamples();
        Build();
        SetupTray();
    }
    private static SolidColorBrush Brush(string hex) => new((Color)ColorConverter.ConvertFromString(hex));
    private Button Action(string key, Action action)
    {
        var button = new Button { Content = Strings.Get(key), ToolTip = Strings.Get(key) };
        AutomationProperties.SetName(button, Strings.Get(key));
        button.Click += (_, _) => Safe(action);
        return button;
    }
    private void Safe(Action action)
    {
        try { action(); }
        catch (Exception ex) when (ex is IOException or ExternalException or NotSupportedException or ArgumentException or FormatException or UnauthorizedAccessException or InvalidOperationException or System.Security.SecurityException)
        { SetStatus(Strings.Get("error")); }
    }
    private void SetStatus(string message) { status.Text = message; feedback.Stop(); feedback.Start(); }
    private void Build()
    {
        if (cardRow.Parent is ScrollViewer previousScroll) previousScroll.Content = null;
        root.Children.Clear(); drawer.Children.Clear();
        root.Children.Add(new Border { Height = 2, Background = Brush("#63725C") });
        drawer.Margin = new Thickness(24, 10, 16, 0);
        var surface = new DockPanel();
        var tools = new StackPanel { Width = 30, Margin = new Thickness(16, 0, 0, 0) };
        var add = Action("add", AddFiles); add.Content = "+"; add.Height = 28; add.Margin = new Thickness(0, 0, 0, 4); add.Padding = new Thickness(0);
        tools.Children.Add(add);
        var more = Action("more", () => { });
        more.Content = "···"; more.Height = 28; more.Margin = new Thickness(0, 0, 0, 4); more.Padding = new Thickness(0);
        var menu = new ContextMenu();
        void AddMenu(string key, Action action)
        {
            var item = new MenuItem { Header = Strings.Get(key) };
            item.Click += (_, _) => Safe(action); menu.Items.Add(item);
        }
        AddMenu("paste", () => { Paste(); Expand(false); });
        AddMenu("demo", () => { AddSamples(); Build(); Expand(false); });
        menu.Opened += (_, _) => { menuOpen = true; dismiss.Stop(); };
        menu.Closed += (_, _) => { menuOpen = false; ScheduleCollapse(); };
        more.ContextMenu = menu;
        more.Click += (_, _) => { menu.PlacementTarget = more; menu.IsOpen = true; };
        tools.Children.Add(more);
        handle.Content = "⌃"; handle.Height = 26; handle.Padding = new Thickness(0); handle.Margin = new Thickness(0);
        handle.ToolTip = Strings.Get("hide"); handle.Click -= HandleClick; handle.Click += HandleClick;
        AutomationProperties.SetName(handle, Strings.Get("hide"));
        // The previous parent must release the reusable collapse button.
        if (handle.Parent is Panel previousTools) previousTools.Children.Remove(handle);
        tools.Children.Add(handle);
        DockPanel.SetDock(tools, Dock.Right); surface.Children.Add(tools);
        var scroll = new ScrollViewer { Content = cardRow, HorizontalScrollBarVisibility = ScrollBarVisibility.Hidden, VerticalScrollBarVisibility = ScrollBarVisibility.Disabled, Height = 106 };
        scroll.PreviewMouseWheel += (_, e) => { scroll.ScrollToHorizontalOffset(scroll.HorizontalOffset - e.Delta); e.Handled = true; };
        RenderCards();
        surface.Children.Add(scroll); drawer.Children.Add(surface); root.Children.Add(drawer);
        status.Text = "";
    }
    private void HandleClick(object sender, RoutedEventArgs e) => Collapse();
    private void ScheduleCollapse()
    {
        if (expanded && !keyboardMode && !busy && !menuOpen && !draggingOut) { dismiss.Stop(); dismiss.Start(); }
    }
    private void Expand(bool focus)
    {
        hover.Stop(); dismiss.Stop();
        bool entering = !expanded || !IsVisible;
        expanded = true; keyboardMode = focus; visibilityVersion++;
        drawer.Visibility = Visibility.Visible;
        var bounds = Forms.Screen.PrimaryScreen!.Bounds;
        var dpi = source?.CompositionTarget?.TransformFromDevice ?? Matrix.Identity;
        var corner = dpi.Transform(new Point(bounds.Left, bounds.Top));
        Left = corner.X; Top = corner.Y; Width = dpi.Transform(new Vector(bounds.Width, 0)).X;
        Height = 124;
        Show();
        if (entering && SystemParameters.ClientAreaAnimation)
            slide.BeginAnimation(TranslateTransform.YProperty, new DoubleAnimation(-Height, 0, TimeSpan.FromMilliseconds(180)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } });
        else { slide.BeginAnimation(TranslateTransform.YProperty, null); slide.Y = 0; }
        if (focus) { Activate(); itemButtons.Values.FirstOrDefault()?.Focus(); }
    }
    private void Collapse()
    {
        hover.Stop(); dismiss.Stop(); keyboardMode = false;
        expanded = false;
        int version = ++visibilityVersion;
        if (!IsVisible || !SystemParameters.ClientAreaAnimation) { Hide(); drawer.Visibility = Visibility.Collapsed; return; }
        var animation = new DoubleAnimation(0, -Height, TimeSpan.FromMilliseconds(140));
        animation.Completed += (_, _) => { if (version == visibilityVersion && !expanded) { Hide(); drawer.Visibility = Visibility.Collapsed; } };
        slide.BeginAnimation(TranslateTransform.YProperty, animation);
    }
    private void RenderCards()
    {
        cardRow.Children.Clear(); itemButtons.Clear();
        if (items.Count <= 8) overflow = false;
        var visible = overflow ? items.Skip(8).ToArray() : items.Take(8).ToArray();
        if (items.Count == 0)
            cardRow.Children.Add(new TextBlock { Text = Strings.Get("empty"), Foreground = Brush("#BCC8B4"), Margin = new Thickness(15, 40, 15, 0) });
        foreach (var item in visible) cardRow.Children.Add(CreateCard(item));
        if (items.Count > 8)
        {
            var more = Action(overflow ? "back" : "more", () => { overflow = !overflow; RenderCards(); });
            more.Content = overflow ? "← " + Strings.Get("back") : $"+{items.Count - 8} " + Strings.Get("more");
            more.Width = 66; more.Height = 82; cardRow.Children.Add(more);
        }
    }
    private FrameworkElement CreateCard(InboxItem item)
    {
        var host = new Grid { Width = 144, Height = 106, Margin = new Thickness(0, 0, 14, 0) };
        var stack = new StackPanel();
        stack.Children.Add(new Rectangle { Width = 5, Height = 3, Fill = Brush(Accents[items.IndexOf(item) % 4]), Margin = new Thickness(0, 0, 0, 4) });
        var button = new Button { Height = 80, Padding = new Thickness(3), Margin = new Thickness(0), Background = Brush("#F6F4ED"), Foreground = ink, HorizontalContentAlignment = HorizontalAlignment.Stretch, VerticalContentAlignment = VerticalAlignment.Stretch };
        if (item.Image is not null)
            button.Content = new Image { Source = item.Image, Stretch = Stretch.UniformToFill, ClipToBounds = true };
        else
            button.Content = new TextBlock { Text = item.Text!.Length > 180 ? item.Text[..180] + "…" : item.Text, TextWrapping = TextWrapping.Wrap, TextTrimming = TextTrimming.CharacterEllipsis, FontSize = 11, LineHeight = 20, MaxHeight = 62, Margin = new Thickness(8), VerticalAlignment = VerticalAlignment.Top };
        AutomationProperties.SetName(button, $"{Strings.Get("copy")}: {item.Title}");
        button.ToolTip = $"{Strings.Get("copy")}: {item.Title}";
        Point start = new();
        bool dragging = false;
        button.PreviewMouseLeftButtonDown += (_, e) => { start = e.GetPosition(button); dragging = false; };
        button.PreviewMouseMove += (_, e) =>
        {
            if (e.LeftButton != MouseButtonState.Pressed || dragging || item.IsRemoving) return;
            var now = e.GetPosition(button);
            if (Math.Abs(now.X - start.X) < SystemParameters.MinimumHorizontalDragDistance && Math.Abs(now.Y - start.Y) < SystemParameters.MinimumVerticalDragDistance) return;
            dragging = true;
            draggingOut = true; dismiss.Stop();
            try { Safe(() => { var data = new DataObject(); data.SetFileDropList(new StringCollection { item.ExportPath }); DragDrop.DoDragDrop(button, data, DragDropEffects.Copy); }); }
            finally { draggingOut = false; keyboardMode = false; ScheduleCollapse(); }
        };
        button.Click += (_, _) => { if (!dragging && !item.IsRemoving) Safe(() => Copy(item)); dragging = false; };
        button.PreviewKeyDown += (_, e) =>
        {
            if (e.Key == Key.Delete) { e.Handled = true; Remove(item, host); }
            if (e.Key is Key.Left or Key.Right)
            {
                var buttons = itemButtons.Values.ToArray();
                int index = Array.IndexOf(buttons, button);
                buttons[(index + (e.Key == Key.Left ? -1 : 1) + buttons.Length) % buttons.Length].Focus();
                e.Handled = true;
            }
        };
        itemButtons[item.Id] = button; stack.Children.Add(button);
        stack.Children.Add(new TextBlock { Text = item.Title, Foreground = Brush("#BFC9B7"), FontSize = 10, Margin = new Thickness(1, 5, 1, 0), TextTrimming = TextTrimming.CharacterEllipsis });
        host.Children.Add(stack);
        var remove = Action("remove", () => Remove(item, host));
        remove.Content = "×"; remove.Width = 23; remove.Height = 23;
        remove.Padding = new Thickness(0); remove.Margin = new Thickness(0, 7, 0, 0);
        remove.VerticalAlignment = VerticalAlignment.Top; remove.HorizontalAlignment = HorizontalAlignment.Right;
        remove.Opacity = 0;
        host.MouseEnter += (_, _) => remove.Opacity = 1;
        host.MouseLeave += (_, _) => { if (!host.IsKeyboardFocusWithin) remove.Opacity = 0; };
        host.IsKeyboardFocusWithinChanged += (_, _) => remove.Opacity = host.IsKeyboardFocusWithin || host.IsMouseOver ? 1 : 0;
        host.Children.Add(remove);
        return host;
    }
    private void Remove(InboxItem item, Grid host)
    {
        if (item.IsRemoving) return;
        item.IsRemoving = true;
        bool focusInCard = host.IsKeyboardFocusWithin;
        var particles = new Canvas { IsHitTestVisible = false };
        foreach (UIElement child in host.Children) child.Visibility = Visibility.Hidden;
        host.Children.Add(particles);
        bool motion = SystemParameters.ClientAreaAnimation;
        if (motion)
            for (int i = 0; i < 24; i++)
            {
                double x = (i % 6) * 23, y = 8 + (i / 6) * 20;
                var pixel = new Rectangle { Width = 7, Height = 7, Fill = Brush(Accents[i % 4]) };
                Canvas.SetLeft(pixel, x); Canvas.SetTop(pixel, y); particles.Children.Add(pixel);
                var duration = TimeSpan.FromMilliseconds(420 + i % 5 * 18);
                pixel.BeginAnimation(Canvas.LeftProperty, new DoubleAnimation(x, host.Width - 8, duration) { EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn } });
                pixel.BeginAnimation(Canvas.TopProperty, new DoubleAnimation(y, 98, duration));
                pixel.BeginAnimation(OpacityProperty, new DoubleAnimation(1, 0, duration));
            }
        var timer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(motion ? 550 : 30) };
        animationTimers.Add(timer);
        timer.Tick += (_, _) =>
        {
            timer.Stop(); animationTimers.Remove(timer); items.Remove(item);
            // Export files remain until session end: an external drop target can
            // finish reading a previously dragged copy after the card is removed.
            Build(); SetStatus(Strings.Get("removed"));
            if (focusInCard) { if (itemButtons.Count > 0) itemButtons.Values.First().Focus(); else handle.Focus(); }
        };
        timer.Start();
    }
    private void Copy(InboxItem item)
    {
        if (item.Image is not null) Clipboard.SetImage(item.Image);
        else Clipboard.SetText(item.Text!);
        SetStatus(Strings.Get("copied"));
    }
    private void AddFiles()
    {
        var dialog = new Microsoft.Win32.OpenFileDialog { Filter = "Images|*.png;*.jpg;*.jpeg;*.bmp", Multiselect = true };
        busy = true; dismiss.Stop();
        bool? selected;
        try { selected = dialog.ShowDialog(this); } finally { busy = false; }
        if (selected != true) { ScheduleCollapse(); return; }
        foreach (var path in dialog.FileNames) items.Add(InboxItem.FromFile(path));
        overflow = items.Count > 8; Build();
    }
    private void Paste()
    {
        if (Clipboard.ContainsImage())
        {
            var image = Clipboard.GetImage();
            if (image is not null) items.Add(new InboxItem("PNG", image));
        }
        else if (Clipboard.ContainsText())
        {
            var text = Clipboard.GetText();
            if (System.Text.Encoding.UTF8.GetByteCount(text) > 65536) { SetStatus(Strings.Get("tooLarge")); return; }
            if (string.IsNullOrWhiteSpace(text)) { SetStatus(Strings.Get("clipboard")); return; }
            items.Add(new InboxItem(text.Split('\n')[0].Trim()[..Math.Min(text.Split('\n')[0].Trim().Length, 30)], text));
        }
        else { SetStatus(Strings.Get("clipboard")); return; }
        overflow = items.Count > 8; Build();
    }
    private void AddSamples()
    {
        var visual = new DrawingVisual();
        using (var dc = visual.RenderOpen())
        {
            dc.DrawRectangle(Brush("#9DC6CE"), null, new Rect(0, 0, 480, 300));
            dc.DrawEllipse(Brush("#F5DCA1"), null, new Point(370, 74), 33, 33);
            var mountains = Geometry.Parse("M0,220 L100,90 175,175 265,50 440,230 480,170 480,300 0,300Z");
            dc.DrawGeometry(Brush("#4A7772"), null, mountains);
            dc.DrawGeometry(Brush("#D6E0D6"), null, Geometry.Parse("M265,50 L222,112 257,98 275,117 294,90Z"));
            dc.DrawRectangle(Brush("#376B73"), null, new Rect(0, 230, 480, 70));
        }
        var bitmap = new RenderTargetBitmap(480, 300, 96, 96, PixelFormats.Pbgra32);
        bitmap.Render(visual); bitmap.Freeze();
        items.Add(new InboxItem("SnapSlot · PNG", bitmap));
        items.Add(new InboxItem(Strings.Get("text"), Strings.Get("sample")));
    }
    private void SetupTray()
    {
        if (testing) return;
        tray ??= new Forms.NotifyIcon { Text = "SnapSlot" };
        if (trayIcon is null)
        {
            using var bitmap = new Drawing.Bitmap(32, 32);
            using (var graphics = Drawing.Graphics.FromImage(bitmap))
            {
                graphics.Clear(Drawing.Color.FromArgb(37, 43, 40));
                using var paper = new Drawing.SolidBrush(Drawing.Color.FromArgb(246, 244, 237));
                using var blue = new Drawing.SolidBrush(Drawing.Color.FromArgb(40, 120, 237));
                graphics.FillRectangle(paper, 5, 7, 22, 4);
                graphics.FillRectangle(paper, 5, 14, 4, 12);
                graphics.FillRectangle(paper, 23, 14, 4, 12);
                graphics.FillRectangle(paper, 9, 22, 14, 4);
                graphics.FillRectangle(blue, 12, 14, 8, 6);
            }
            var iconHandle = bitmap.GetHicon();
            using var borrowed = Drawing.Icon.FromHandle(iconHandle);
            trayIcon = (Drawing.Icon)borrowed.Clone();
            DestroyIcon(iconHandle);
            tray.Icon = trayIcon;
            tray.DoubleClick += (_, _) => Dispatcher.Invoke(() => Expand(true));
        }
        tray.ContextMenuStrip?.Dispose();
        var menu = new Forms.ContextMenuStrip();
        menu.Items.Add(Strings.Get("show"), null, (_, _) => Dispatcher.Invoke(() => Expand(true)));
        var languages = new Forms.ToolStripMenuItem(Strings.Get("language"));
        for (int i = 0; i < Strings.Locales.Length; i++)
        {
            string locale = Strings.Locales[i];
            var entry = new Forms.ToolStripMenuItem(Strings.Names[i]) { Checked = Strings.Locale == locale };
            entry.Click += (_, _) => Dispatcher.Invoke(() => { Strings.Locale = locale; Build(); SetupTray(); });
            languages.DropDownItems.Add(entry);
        }
        menu.Items.Add(languages);
        menu.Items.Add(Strings.Get("exit"), null, (_, _) => Dispatcher.Invoke(() => Application.Current.Shutdown()));
        tray.ContextMenuStrip = menu; tray.Visible = true;
    }
    private void OnSource(object? sender, EventArgs e)
    {
        source = (HwndSource)PresentationSource.FromVisual(this);
        source.AddHook(WndProc);
        if (testing) return;
        hotkeyRegistered = RegisterHotKey(source.Handle, 1, 0x4000 | 0x0002 | 0x0001, 0x20);
        if (!hotkeyRegistered) status.Text = Strings.Get("hotkey");
        try
        {
            edgeWatcher = new EdgeWatcher();
            edgeWatcher.Entered += () => { if (!expanded) hover.Start(); };
            edgeWatcher.Left += () => hover.Stop();
        }
        catch (System.ComponentModel.Win32Exception) { status.Text = Strings.Get("error"); }
    }
    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == 0x0312 && wParam.ToInt32() == 1) { if (expanded) Collapse(); else Expand(true); handled = true; }
        return IntPtr.Zero;
    }
    private void OnKey(object sender, KeyEventArgs e) { if (e.Key == Key.Escape) { Collapse(); e.Handled = true; } }
    private void Dispose()
    {
        hover.Stop(); dismiss.Stop(); feedback.Stop(); edgeWatcher?.Dispose();
        foreach (var timer in animationTimers) timer.Stop();
        animationTimers.Clear();
        if (source is not null) { if (hotkeyRegistered) UnregisterHotKey(source.Handle, 1); source.RemoveHook(WndProc); }
        tray?.Dispose(); trayIcon?.Dispose();
    }
    internal async Task RunSmokeTest(string output)
    {
        Directory.CreateDirectory(output);
        var checks = new List<string>();
        void Check(bool value, string description)
        {
            if (!value) throw new InvalidOperationException(description);
            checks.Add(description);
        }
        Check(items.Count == 2, "Initial image and text samples");
        var sampleFile = items[0].ExportPath;
        Check(File.Exists(sampleFile), "Image export exists");
        var imported = InboxItem.FromFile(sampleFile);
        Check(imported.Image?.PixelWidth == 480, "PNG round trip keeps image dimensions");
        items.Add(imported); Build();
        foreach (var locale in Strings.Locales)
        {
            Strings.Locale = locale; Build();
            Check(drawer.Children.Count == 1, $"Single-row layout: {locale}");
        }
        Strings.Locale = "zh-Hans";
        Collapse(); await Task.Delay(200);
        Check(!IsVisible, "Idle window is fully hidden and cannot intercept clicks");
        Expand(false); await Task.Delay(220);
        Check(drawer.Visibility == Visibility.Visible && Height == 124, "Expanded rail is a compact 124-DIP row");
        var screenWidth = source!.CompositionTarget!.TransformFromDevice.Transform(new Vector(Forms.Screen.PrimaryScreen!.Bounds.Width, 0)).X;
        Check(Math.Abs(Width - screenWidth) < 1 && Left == 0, "Rail spans the primary screen edge to edge");
        Check(!IsActive, "Pointer reveal does not activate the window");
        for (int i = 0; i < 4; i++) AddSamples();
        Build();
        Check(itemButtons.Count == 8, "First page is bounded to eight cards");
        overflow = true; RenderCards();
        Check(itemButtons.Count == items.Count - 8, "Overflow exposes remaining items");
        overflow = false;
        var removed = items[0]; RenderCards();
        Remove(removed, (Grid)cardRow.Children[0]);
        await Task.Delay(700);
        Check(!items.Contains(removed), "Pixel dissolve removes the requested card");
        Check(File.Exists(sampleFile), "Removal preserves original and session export for existing drop consumers");
        bool textRejected = false;
        try { _ = new InboxItem("oversize", new string('x', 65537)); }
        catch (ArgumentOutOfRangeException) { textRejected = true; }
        Check(textRejected, "Oversize text is rejected");
        items.Clear(); Build(); Check(cardRow.Children.Count == 1, "Empty state is actionable");
        AddSamples(); Build(); UpdateLayout();
        await Task.Delay(100);
        var dpi = VisualTreeHelper.GetDpi(this);
        var bitmap = new RenderTargetBitmap((int)Math.Ceiling(ActualWidth * dpi.DpiScaleX), (int)Math.Ceiling(ActualHeight * dpi.DpiScaleY), dpi.PixelsPerInchX, dpi.PixelsPerInchY, PixelFormats.Pbgra32);
        bitmap.Render(this);
        var encoder = new PngBitmapEncoder();
        encoder.Frames.Add(BitmapFrame.Create(bitmap));
        using (var stream = File.Create(Path.Combine(output, "desktop-preview.png"))) encoder.Save(stream);
        File.WriteAllLines(Path.Combine(output, "desktop-smoke.txt"), checks);
    }
    [DllImport("user32.dll", SetLastError = true)] private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")] private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll")] private static extern bool DestroyIcon(IntPtr hIcon);
}
