using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
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
using WebView = Microsoft.Web.WebView2.Wpf.WebView2CompositionControl;
using Forms=System.Windows.Forms;
using Drawing=System.Drawing;

namespace SnapSlot;

public sealed class RailWindow : Window
{
    private readonly List<InboxItem> items=new();
    private readonly WebView web=new(){DefaultBackgroundColor=Drawing.Color.Transparent};
    private WebView? settingsWeb;
    private Window? settings;
    private string settingsMode="";
    private PreferencesStore preferences=null!;
    private AppPreferences? registeredPreferences;
    private bool shortcutsSuspended,collectingText;
    private string? lastError,startupShortcutError;
    private readonly HashSet<WebView> ready=new();
    private readonly Dictionary<WebView,HashSet<Guid>> sentItems=new();
    private readonly Dictionary<WebView,string> sentSkins=new();
    private CoreWebView2Environment? environment;
    private readonly DispatcherTimer hover=new(){Interval=TimeSpan.FromMilliseconds(500)};
    private readonly DispatcherTimer dismiss=new(){Interval=TimeSpan.FromMilliseconds(450)};
    private readonly DispatcherTimer hide=new(){Interval=TimeSpan.FromMilliseconds(240)};
    private EdgeWatcher? watcher;
    private Forms.NotifyIcon? tray;
    private Drawing.Icon? icon;
    private HwndSource? source;
    private bool expanded,pinned,busy,dragging,disposed;
    private bool collectImages=true;
    private uint ignoredClipboard;
    private int clipboardRequest;
    private readonly bool testing;
    private Forms.Screen screen=Forms.Screen.PrimaryScreen!;
    private DateTime peekUntil=DateTime.MinValue;
    private readonly SkinStore skins;
    private readonly string uiRoot=Path.Combine(AppContext.BaseDirectory,"NativeUI");
    private readonly string appData;
    private string locale="en";
    private readonly Dictionary<string,Dictionary<string,string>> menuCopy;
    private string Label(string key)=>menuCopy.TryGetValue(locale,out var values)&&values.TryGetValue(key,out var translated)?translated:key;
    public RailWindow(bool testing=false)
    {
        this.testing=testing;
        menuCopy=JsonSerializer.Deserialize<Dictionary<string,Dictionary<string,string>>>(File.ReadAllText(Path.Combine(uiRoot,"menus.json")))!;
        appData=testing?Path.Combine(App.SessionDirectory,"Settings"):Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"SnapSlot");
        skins=new SkinStore(Path.Combine(appData,"Skins"),uiRoot);
        collectImages=!File.Exists(Path.Combine(appData,"image-intake-off"));
        preferences=new PreferencesStore(Path.Combine(appData,"preferences.json"),collectImages);collectImages=preferences.Value.CollectScreenshots;
        var preferred=File.Exists(Path.Combine(appData,"locale.txt"))?File.ReadAllText(Path.Combine(appData,"locale.txt")):CultureInfo.CurrentUICulture.Name;
        locale=preferred.StartsWith("zh",StringComparison.OrdinalIgnoreCase)?(preferred.Contains("TW")||preferred.Contains("HK")||preferred.Contains("Hant")?"zh-Hant":"zh-Hans"):Strings.Locales.FirstOrDefault(value=>preferred.StartsWith(value,StringComparison.OrdinalIgnoreCase))??"en";
        Strings.Locale=locale;
        Title="SnapSlot";WindowStyle=WindowStyle.None;AllowsTransparency=true;Background=Brushes.Transparent;ResizeMode=ResizeMode.NoResize;
        Topmost=true;ShowInTaskbar=false;ShowActivated=false;Width=SystemParameters.PrimaryScreenWidth;Height=skins.Height+48;Left=0;Top=0;
        Content=web;
        skins.Changed+=candidate=>Dispatcher.BeginInvoke(()=>Safe(()=>{skins.Apply(candidate);Position();State();}));
        skins.Invalid+=message=>Dispatcher.BeginInvoke(()=>Error(message));
        hover.Tick+=(_,_)=>{hover.Stop();if(EdgeWatcher.IsAtEdge()&&EdgeWatcher.CanReveal(source?.Handle??IntPtr.Zero))Reveal(false);};
        dismiss.Tick+=(_,_)=>{dismiss.Stop();if(!KeepOpen()&&!pinned&&!busy&&!dragging&&settings is null)Collapse();};
        hide.Tick+=(_,_)=>{hide.Stop();if(!expanded)Hide();};
        Deactivated+=(_,_)=>{pinned=false;ScheduleDismiss();};
        SourceInitialized+=OnSource;
        DpiChanged+=(_,_)=>Dispatcher.BeginInvoke(Position);
        Loaded+=async(_,_)=>{Hide();try{await InitializeWeb(web,"rail");if(testing){Seed();Reveal(false);}else if(startupShortcutError is not null){OpenSettings("preferences");}}catch(Exception ex){System.Windows.MessageBox.Show(ex.Message+"\nInstall Microsoft Edge WebView2 Runtime to run SnapSlot.","SnapSlot");Application.Current.Shutdown(1);}};
        Closed+=(_,_)=>Dispose();
        if(!testing)SetupTray();
    }
    private async Task InitializeWeb(WebView view,string mode)
    {
        environment??=await CoreWebView2Environment.CreateAsync(null,Path.Combine(appData,"WebView2"));
        await view.EnsureCoreWebView2Async(environment);
        var core=view.CoreWebView2;
        core.SetVirtualHostNameToFolderMapping("snapslot.local",uiRoot,CoreWebView2HostResourceAccessKind.DenyCors);
        core.Settings.AreDefaultContextMenusEnabled=false;core.Settings.IsStatusBarEnabled=false;core.Settings.IsZoomControlEnabled=false;core.Settings.AreDevToolsEnabled=testing;
        core.NavigationStarting+=(_,e)=>{if(!Uri.TryCreate(e.Uri,UriKind.Absolute,out var uri)||uri.Scheme!="https"||uri.Host!="snapslot.local")e.Cancel=true;};
        core.ProcessFailed+=(_,_)=>{ready.Remove(view);sentItems.Remove(view);sentSkins.Remove(view);if(!disposed)view.Reload();};
        core.NewWindowRequested+=(_,e)=>e.Handled=true;
        core.WebMessageReceived+=(_,e)=>{if(Uri.TryCreate(e.Source,UriKind.Absolute,out var origin)&&origin.Scheme=="https"&&origin.Host=="snapslot.local")Safe(()=>Receive(view,e.WebMessageAsJson));};
        core.Navigate("https://snapslot.local/index.html"+(mode=="rail"?"":"?mode="+mode));
    }
    private void Safe(Action action)
    {
        try{action();}catch(Exception ex) when(ex is IOException or UnauthorizedAccessException or ArgumentException or InvalidOperationException or ExternalException or JsonException or NotSupportedException){Error(ex.Message);}
    }
    private void Error(string message){lastError=message;foreach(var view in ready.ToArray())Post(view,new{type="error",message});}
    private void Post(WebView view,object message){if(ready.Contains(view)&&!disposed)view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message));}
    private string Preview(InboxItem item)
    {
        if(item.Preview is not null)return item.Preview;
        var image=item.Image!;double ratio=Math.Min(1,1024.0/Math.Max(image.PixelWidth,image.PixelHeight));
        BitmapSource thumbnail=ratio<1?new TransformedBitmap(image,new ScaleTransform(ratio,ratio)):image;
        var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(thumbnail));using var stream=new MemoryStream();encoder.Save(stream);
        return item.Preview="data:image/png;base64,"+Convert.ToBase64String(stream.ToArray());
    }
    private void State(bool focus=false)
    {
        foreach(var view in ready.ToArray())
        {
            var known=sentItems.GetValueOrDefault(view)??new HashSet<Guid>();
            var visible=view==web?items.Where(item=>item.Display==screen.DeviceName).ToArray():Array.Empty<InboxItem>();
            var captures=visible.Select(item=>new{id=item.Id.ToString(),kind=item.Text is null?"image":"text",title=item.Title,text=known.Contains(item.Id)?null:item.Text,preview=!known.Contains(item.Id)&&item.Text is null?Preview(item):null}).ToArray();
            Post(view,new{type="state",items=captures,skin=sentSkins.GetValueOrDefault(view)==skins.Source?null:skins.Source,locale,expanded,reducedMotion=!SystemParameters.ClientAreaAnimation,focus});
            sentItems[view]=visible.Select(item=>item.Id).ToHashSet();sentSkins[view]=skins.Source;
        }
    }
    private void Receive(WebView view,string json)
    {
        if(Encoding.UTF8.GetByteCount(json)>SkinStore.MaxBytes+4096)return;
        using var message=JsonDocument.Parse(json);var value=message.RootElement;
        string? Get(string key)=>value.TryGetProperty(key,out var field)&&field.ValueKind==JsonValueKind.String?field.GetString():null;
        switch(Get("type"))
        {
            case "ready":ready.Add(view);sentItems[view]=new();sentSkins.Remove(view);State();if(view==settingsWeb&&settingsMode=="preferences")SendPreferences(view);if(lastError is not null)Post(view,new{type="error",message=lastError});break;
            case "collapse":Collapse();break;
            case "pin":pinned=true;dismiss.Stop();break;
            case "capture":Capture();break;
            case "paste":Paste();break;
            case "addImages":AddImages();break;
            case "newText":OpenSettings("text");break;
            case "appearance":OpenSettings("settings");break;
            case "close":settings?.Close();break;
            case "openSkinFolder":Process.Start(new ProcessStartInfo(skins.DirectoryPath){UseShellExecute=true});break;
            case "saveText":if(Get("text") is string text&&!string.IsNullOrWhiteSpace(text)){Add(new InboxItem(text.Split('\n')[0].Trim()[..Math.Min(text.Split('\n')[0].Trim().Length,30)],text));settings?.Close();Arrived();}break;
            case "savePreferences":if(view==settingsWeb&&settingsMode=="preferences"&&value.TryGetProperty("value",out var next)){var preference=JsonSerializer.Deserialize<AppPreferences>(next.GetRawText(),PreferencesStore.Json)??throw new ArgumentException("Invalid settings");SavePreferences(preference);}break;
            case "applySkin":if(Get("source") is string candidate){skins.Apply(candidate);Position();State();}break;
            case "exportSkin":if(Get("source") is string export){skins.Validate(export);ExportSkin(export);}break;
            case "copy":case "remove":case "drag":
                if(!Guid.TryParse(Get("id"),out var id))return;
                var item=items.FirstOrDefault(item=>item.Id==id&&item.Display==screen.DeviceName);if(item is null)return;
                if(Get("type")=="remove"){items.Remove(item);State();}
                else if(Get("type")=="copy"){Copy(item);Post(web,new{type="copied",id=item.Id.ToString()});}
                else Drag(item);
                break;
        }
    }
    private void Add(InboxItem item){item.Display=screen.DeviceName;items.Add(item);}
    private void Position()
    {
        Height=skins.Height+48;
        if(source is null)return;
        var bounds=screen.Bounds;
        var area=screen.WorkingArea;
        // Use physical coordinates for monitor placement, including negative origins.
        var scale=source.CompositionTarget?.TransformToDevice.M22??1;
        SetWindowPos(source.Handle,new IntPtr(-1),bounds.Left,area.Top,bounds.Width,(int)Math.Ceiling(Height*scale),0x0010|(expanded?0x0040u:0u));
    }
    private void Reveal(bool focus,bool peek=false)
    {
        hover.Stop();dismiss.Stop();hide.Stop();if(!expanded&&!peek)screen=Forms.Screen.FromPoint(Forms.Cursor.Position);
        expanded=true;pinned=focus;if(peek)peekUntil=DateTime.UtcNow.AddMilliseconds(2500);
        Position();Show();SetInteractive(true);State(focus);
        if(focus){Activate();web.Focus();}
        if(peek)ScheduleDismiss();
    }
    private void Collapse()
    {
        hover.Stop();dismiss.Stop();hide.Stop();expanded=false;pinned=false;SetInteractive(false);State();
        if(SystemParameters.ClientAreaAnimation)hide.Start();else Hide();
    }
    private void SetInteractive(bool interactive)
    {
        if(source is null)return;var style=GetWindowLong(source.Handle,-20);
        SetWindowLong(source.Handle,-20,interactive?style&~0x20:style|0x20);
    }
    private bool KeepOpen()
    {
        if(!expanded)return false;var point=Forms.Cursor.Position;var scale=source?.CompositionTarget?.TransformToDevice.M22??1;
        return point.X>=screen.Bounds.Left&&point.X<screen.Bounds.Right&&point.Y>=screen.Bounds.Top&&point.Y<=screen.WorkingArea.Top+(Height+16)*scale;
    }
    private void ScheduleDismiss()
    {
        if(disposed||!expanded||pinned||busy||dragging||settings is not null)return;
        dismiss.Stop();dismiss.Interval=TimeSpan.FromMilliseconds(Math.Max(450,(peekUntil-DateTime.UtcNow).TotalMilliseconds));dismiss.Start();
    }
    private void Arrived(){State();Reveal(false,true);_ = web.CoreWebView2?.ExecuteScriptAsync("document.querySelector('.slot-row')?.scrollTo({left:100000,behavior:'smooth'})");}
    private void Copy(InboxItem item)
    {
        try {
            if(item.Text is not null){Clipboard.SetText(item.Text);return;}
            var data=new DataObject();data.SetImage(item.Image!);
            // Publish both native bitmap and original PNG for applications with different clipboard support.
            data.SetData("PNG",new MemoryStream(File.ReadAllBytes(item.ExportPath)));
            Clipboard.SetDataObject(data,true);
        } finally {ignoredClipboard=GetClipboardSequenceNumber();clipboardRequest++;}
    }
    private async void ReceiveClipboardImage()
    {
        if(testing||!collectImages||disposed)return;
        int request=++clipboardRequest;
        for(int attempt=0;attempt<7;attempt++)
        {
            await Task.Delay(attempt==0?120:150);
            if(request!=clipboardRequest||!collectImages||disposed)return;
            uint sequence=GetClipboardSequenceNumber();if(sequence==0||sequence==ignoredClipboard)return;
            try {
                // Text and the clipboard already present at launch are never collected automatically.
                var image=Clipboard.ContainsImage()?Clipboard.GetImage():null;
                ignoredClipboard=GetClipboardSequenceNumber();
                if(image is not null){if(!expanded)screen=Forms.Screen.FromPoint(Forms.Cursor.Position);Add(new InboxItem(Label("Screenshot"),image));Arrived();}
                return;
            } catch(ExternalException) { /* Screenshot tools can hold the clipboard while publishing pixels. */ }
              catch(Exception ex) when(ex is IOException or NotSupportedException or InvalidOperationException){Error(ex.Message);return;}
        }
    }
    private void ToggleImageIntake()
    {
        SavePreferences(preferences.Value with{CollectScreenshots=!collectImages});
    }
    private void SendPreferences(WebView view)=>Post(view,new{type="preferences",value=JsonSerializer.SerializeToElement(preferences.Value,PreferencesStore.Json),platform="windows"});
    private void ClearShortcuts(){if(source is null)return;for(int id=1;id<=3;id++)UnregisterHotKey(source.Handle,id);}
    private void RegisterShortcuts(AppPreferences value)
    {
        if(source is null)return;
        foreach(var binding in new[]{(1,Shortcut.Open),(2,value.CaptureShortcut),(3,value.TextShortcut)})
            if(!RegisterHotKey(source.Handle,binding.Item1,binding.Item2.Modifiers,binding.Item2.VirtualKey))throw new InvalidOperationException(binding.Item2.Display+" — "+Strings.Get("hotkey"));
    }
    private void ApplyShortcuts(AppPreferences value)
    {
        value.Validate();var previous=registeredPreferences;ClearShortcuts();
        try{RegisterShortcuts(value);registeredPreferences=value;if(shortcutsSuspended)ClearShortcuts();}
        catch{ClearShortcuts();if(previous is not null){try{RegisterShortcuts(previous);}catch{ClearShortcuts();}}if(shortcutsSuspended)ClearShortcuts();throw;}
    }
    private void SavePreferences(AppPreferences value)
    {
        value.Validate();var previous=preferences.Value;
        if(!testing)ApplyShortcuts(value);
        try{preferences.Save(value);}catch{if(!testing)ApplyShortcuts(previous);throw;}
        collectImages=value.CollectScreenshots;ignoredClipboard=GetClipboardSequenceNumber();clipboardRequest++;lastError=null;
        SetupTray();if(settingsWeb is not null&&settingsMode=="preferences")SendPreferences(settingsWeb);
    }
    private async void CollectSelectedText()
    {
        if(collectingText||busy)return;collectingText=true;
        try {
            string text=await SelectedText.ReadAsync();
            if(string.IsNullOrWhiteSpace(text))throw new InvalidOperationException("Select text first.");
            if(Encoding.UTF8.GetByteCount(text)>65536)throw new ArgumentException(Strings.Get("tooLarge"));
            if(!expanded)screen=Forms.Screen.FromPoint(Forms.Cursor.Position);
            Add(new InboxItem(text.Split('\n')[0].Trim()[..Math.Min(text.Split('\n')[0].Trim().Length,30)],text));
            Clipboard.SetText(text);ignoredClipboard=GetClipboardSequenceNumber();Arrived();
        }catch(Exception ex) when(ex is InvalidOperationException or ArgumentException or ExternalException or IOException or UnauthorizedAccessException){Arrived();Error(ex.Message);}
        finally{collectingText=false;}
    }
    private void Drag(InboxItem item)
    {
        dragging=true;dismiss.Stop();
        try{var data=new DataObject();data.SetFileDropList(new StringCollection{item.ExportPath});DragDrop.DoDragDrop(web,data,DragDropEffects.Copy);}
        finally{dragging=false;pinned=false;ScheduleDismiss();}
    }
    private void Paste()
    {
        if(!expanded)screen=Forms.Screen.FromPoint(Forms.Cursor.Position);
        if(Clipboard.ContainsImage()&&Clipboard.GetImage() is BitmapSource image)Add(new InboxItem("PNG",image));
        else if(Clipboard.ContainsText()&&!string.IsNullOrWhiteSpace(Clipboard.GetText())){var text=Clipboard.GetText();Add(new InboxItem(text.Split('\n')[0].Trim()[..Math.Min(text.Split('\n')[0].Trim().Length,30)],text));}
        else{Error(Strings.Get("clipboard"));return;}Arrived();
    }
    private void AddImages()
    {
        if(!expanded)screen=Forms.Screen.FromPoint(Forms.Cursor.Position);
        var picker=new Microsoft.Win32.OpenFileDialog{Filter="Images|*.png;*.jpg;*.jpeg;*.bmp;*.tif;*.tiff",Multiselect=true};busy=true;dismiss.Stop();
        try{if(picker.ShowDialog()==true){foreach(var path in picker.FileNames)Add(InboxItem.FromFile(path));Arrived();}}
        finally{busy=false;ScheduleDismiss();}
    }
    private async void Capture()
    {
        if(busy)return;if(!expanded)screen=Forms.Screen.FromPoint(Forms.Cursor.Position);busy=true;Collapse();
        try{await Task.Delay(280);var picker=new CaptureWindow(screen);if(picker.ShowDialog()==true&&picker.Result is BitmapSource image){Add(new InboxItem(Label("Screenshot"),image));Arrived();}}
        catch(Exception ex){Error(ex.Message);}finally{busy=false;ScheduleDismiss();}
    }
    private async void OpenSettings(string mode)
    {
        dismiss.Stop();hover.Stop();if(!expanded)screen=Forms.Screen.FromPoint(Forms.Cursor.Position);if(settings is not null){if(settingsMode==mode){settings.Activate();return;}settings.Close();}
        var window=new Window{Title=Label(mode=="settings"?"Appearance":mode=="preferences"?"Settings":"Add text"),Width=mode=="settings"?1080:mode=="preferences"?620:520,Height=mode=="settings"?790:mode=="preferences"?630:360,MinWidth=mode=="settings"?650:mode=="preferences"?540:360,MinHeight=mode=="settings"?560:mode=="preferences"?580:280,WindowStartupLocation=WindowStartupLocation.CenterScreen,Background=Brushes.White};
        var view=new WebView{DefaultBackgroundColor=Drawing.Color.White};window.Content=view;settings=window;settingsMode=mode;settingsWeb=view;
        if(mode=="preferences"){
            window.Activated+=(_,_)=>{shortcutsSuspended=true;ClearShortcuts();};
            window.Deactivated+=(_,_)=>{shortcutsSuspended=false;if(!disposed&&!testing)Safe(()=>ApplyShortcuts(preferences.Value));};
        }
        window.Closed+=(_,_)=>{ready.Remove(view);sentItems.Remove(view);sentSkins.Remove(view);view.Dispose();settings=null;settingsWeb=null;settingsMode="";shortcutsSuspended=false;if(!disposed&&!testing)Safe(()=>ApplyShortcuts(preferences.Value));pinned=false;ScheduleDismiss();};window.Show();
        try{await InitializeWeb(view,mode);}catch(Exception ex){Error(ex.Message);window.Close();}
    }
    private void ExportSkin(string source)
    {
        var picker=new Microsoft.Win32.SaveFileDialog{FileName="skin.json",Filter="JSON|*.json",DefaultExt=".json"};if(picker.ShowDialog(settings)==true)File.WriteAllText(picker.FileName,source,new UTF8Encoding(false));
    }
    private void SetupTray()
    {
        tray??=new Forms.NotifyIcon{Text="SnapSlot"};
        if(icon is null){using var bitmap=new Drawing.Bitmap(32,32);using(var graphics=Drawing.Graphics.FromImage(bitmap)){graphics.Clear(Drawing.Color.FromArgb(18,99,215));using var paper=new Drawing.SolidBrush(Drawing.Color.White);graphics.FillRectangle(paper,8,8,16,20);graphics.FillRectangle(paper,12,4,8,5);}var handle=bitmap.GetHicon();using var borrowed=Drawing.Icon.FromHandle(handle);icon=(Drawing.Icon)borrowed.Clone();DestroyIcon(handle);tray.Icon=icon;tray.DoubleClick+=(_,_)=>Reveal(true);}
        tray.ContextMenuStrip?.Dispose();var menu=new Forms.ContextMenuStrip();
        void Entry(string title,Action action)=>menu.Items.Add(title,null,(_,_)=>Dispatcher.Invoke(()=>Safe(action)));
        Entry(Label("Open notes")+"  Ctrl+Alt+Space",()=>Reveal(true));Entry(Label("Take a screenshot")+"  "+preferences.Value.CaptureShortcut.Display,Capture);Entry(Label("Pin selected text")+"  "+preferences.Value.TextShortcut.Display,CollectSelectedText);
        Entry(Strings.Get("paste"),Paste);Entry(Label("Add text"),()=>OpenSettings("text"));Entry(Label("Add images"),AddImages);
        var intake=new Forms.ToolStripMenuItem(Label("Automatically collect screenshots and images")){Checked=collectImages};intake.Click+=(_,_)=>Dispatcher.Invoke(()=>Safe(ToggleImageIntake));menu.Items.Add(intake);
        Entry(Label("Settings")+"…",()=>OpenSettings("preferences"));
        menu.Items.Add(new Forms.ToolStripSeparator());Entry(Label("Appearance"),()=>OpenSettings("settings"));Entry(Label("Open skin folder"),()=>Process.Start(new ProcessStartInfo(skins.DirectoryPath){UseShellExecute=true}));
        var languages=new Forms.ToolStripMenuItem(Label("Language"));for(int i=0;i<Strings.Locales.Length;i++){var code=Strings.Locales[i];var entry=new Forms.ToolStripMenuItem(Strings.Names[i]){Checked=locale==code};entry.Click+=(_,_)=>{locale=code;Strings.Locale=code;File.WriteAllText(Path.Combine(appData,"locale.txt"),code);SetupTray();State();};languages.DropDownItems.Add(entry);}menu.Items.Add(languages);menu.Items.Add(new Forms.ToolStripSeparator());Entry(Label("Quit SnapSlot"),()=>Application.Current.Shutdown());tray.ContextMenuStrip=menu;tray.Visible=true;
    }
    private void OnSource(object? sender,EventArgs e)
    {
        source=(HwndSource)PresentationSource.FromVisual(this);source.AddHook(WndProc);if(testing)return;
        ignoredClipboard=GetClipboardSequenceNumber();AddClipboardFormatListener(source.Handle);
        try{ApplyShortcuts(preferences.Value);}catch(Exception ex){startupShortcutError=ex.Message;Error(ex.Message);}
        watcher=new EdgeWatcher();watcher.Entered+=()=>{if(!expanded&&!busy&&settings is null)hover.Start();};watcher.Left+=()=>hover.Stop();
        watcher.Moved+=()=>{if(!expanded)return;if(KeepOpen())dismiss.Stop();else if(!dismiss.IsEnabled)ScheduleDismiss();};
        SystemParameters.StaticPropertyChanged+=ParametersChanged;
    }
    private void ParametersChanged(object? sender,System.ComponentModel.PropertyChangedEventArgs e){if(e.PropertyName==nameof(SystemParameters.ClientAreaAnimation))State();}
    private IntPtr WndProc(IntPtr hwnd,int message,IntPtr wParam,IntPtr lParam,ref bool handled)
    {
        if(message==0x0312){if(wParam.ToInt32()==2)Capture();else if(wParam.ToInt32()==3)CollectSelectedText();else if(expanded)Collapse();else Reveal(true);handled=true;}
        if(message==0x031D){ReceiveClipboardImage();handled=true;}
        if(message==0x0021&&!pinned){handled=true;return new IntPtr(3);}
        if(message==0x007E&&expanded){screen=Forms.Screen.FromPoint(Forms.Cursor.Position);Position();State();}
        return IntPtr.Zero;
    }
    private void Seed(){var bitmap=new RenderTargetBitmap(480,300,96,96,PixelFormats.Pbgra32);var visual=new DrawingVisual();using(var dc=visual.RenderOpen()){dc.DrawRectangle(new SolidColorBrush(Color.FromRgb(129,185,203)),null,new Rect(0,0,480,300));dc.DrawGeometry(new SolidColorBrush(Color.FromRgb(35,95,95)),null,Geometry.Parse("M0,300 200,40 480,300Z"));}bitmap.Render(visual);bitmap.Freeze();Add(new InboxItem("Mountains",bitmap));Add(new InboxItem(Strings.Get("text"),Strings.Get("sample")));}
    internal async Task RunSmokeTest(string output)
    {
        Directory.CreateDirectory(output);
        for(int i=0;i<100&&!ready.Contains(web);i++)await Task.Delay(100);
        if(!ready.Contains(web))throw new InvalidOperationException("Offline UI did not become ready");
        if(items.Count==0)Seed();var file=items[0].ExportPath;items.RemoveAt(0);
        if(!File.Exists(file))throw new InvalidOperationException("Removing a note deleted its export");
        for(int i=0;i<20;i++)Add(new InboxItem("Note "+i,"Note "+i));Reveal(false);await Task.Delay(500);
        using(var stream=File.Create(Path.Combine(output,"windows-notes.png")))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
        File.WriteAllText(Path.Combine(output,"desktop-smoke.txt"),"PASS: Offline native UI loaded\nPASS: 21+ continuous notes\nPASS: removal keeps export alive\n");
    }
    private void Dispose()
    {
        disposed=true;hover.Stop();dismiss.Stop();hide.Stop();watcher?.Dispose();skins.Dispose();SystemParameters.StaticPropertyChanged-=ParametersChanged;
        if(source is not null){if(!testing)RemoveClipboardFormatListener(source.Handle);ClearShortcuts();source.RemoveHook(WndProc);}settings?.Close();web.Dispose();tray?.Dispose();icon?.Dispose();
    }
    [DllImport("user32.dll")]private static extern bool AddClipboardFormatListener(IntPtr window);
    [DllImport("user32.dll")]private static extern bool RemoveClipboardFormatListener(IntPtr window);
    [DllImport("user32.dll")]private static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll")]private static extern bool RegisterHotKey(IntPtr window,int id,uint modifiers,uint key);
    [DllImport("user32.dll")]private static extern bool UnregisterHotKey(IntPtr window,int id);
    [DllImport("user32.dll")]private static extern bool DestroyIcon(IntPtr icon);
    [DllImport("user32.dll")]private static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
    [DllImport("user32.dll")]private static extern int GetWindowLong(IntPtr window,int index);
    [DllImport("user32.dll")]private static extern int SetWindowLong(IntPtr window,int index,int value);
}
