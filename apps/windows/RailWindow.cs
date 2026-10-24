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
    private bool collectingText;
    private string? lastError,startupShortcutError;
    private readonly HashSet<WebView> ready=new();
    private readonly Dictionary<WebView,HashSet<Guid>> sentItems=new();
    private CoreWebView2Environment? environment;
    private readonly DispatcherTimer hover=new(){Interval=TimeSpan.FromMilliseconds(500)};
    private readonly DispatcherTimer edgeProbe=new(){Interval=TimeSpan.FromMilliseconds(50)};
    private readonly DispatcherTimer dismiss=new(){Interval=TimeSpan.FromMilliseconds(450)};
    private readonly DispatcherTimer hide=new(){Interval=TimeSpan.FromMilliseconds(240)};
    private EdgeWatcher? watcher;
    private readonly EdgeDwell edgeDwell=new();
    private Forms.NotifyIcon? tray;
    private Drawing.Icon? icon;
    private Drawing.Icon? stateIcon;
    private (bool Pinned,bool CollectImages)? iconState;
    private HwndSource? source;
    private bool expanded,pinned,arming,dragging,disposed;
    private string appearance="glass";
    private readonly List<(double X,double Y,double Width,double Height,double Angle)> hitAreas=new();
    private bool collectImages=true;
    private uint ignoredClipboard;
    private int clipboardRequest;
    private readonly bool testing;
    private Forms.Screen screen=Forms.Screen.PrimaryScreen!;
    private DateTime peekUntil=DateTime.MinValue;
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
        collectImages=!File.Exists(Path.Combine(appData,"image-intake-off"));
        preferences=new PreferencesStore(Path.Combine(appData,"preferences.json"),collectImages);collectImages=preferences.Value.CollectImages;
        var preferred=File.Exists(Path.Combine(appData,"locale.txt"))?File.ReadAllText(Path.Combine(appData,"locale.txt")):CultureInfo.CurrentUICulture.Name;
        locale=preferred.StartsWith("zh",StringComparison.OrdinalIgnoreCase)?(preferred.Contains("TW")||preferred.Contains("HK")||preferred.Contains("Hant")?"zh-Hant":"zh-Hans"):Strings.Locales.FirstOrDefault(value=>preferred.StartsWith(value,StringComparison.OrdinalIgnoreCase))??"en";
        Strings.Locale=locale;
        var savedLook=Path.Combine(appData,"appearance.txt");if(File.Exists(savedLook)&&new[]{"glass","paper","graphite"}.Contains(File.ReadAllText(savedLook)))appearance=File.ReadAllText(savedLook);
        Title="SnapSlot";WindowStyle=WindowStyle.None;AllowsTransparency=true;Background=Brushes.Transparent;ResizeMode=ResizeMode.NoResize;
        Topmost=true;ShowInTaskbar=false;ShowActivated=false;Width=SystemParameters.PrimaryScreenWidth;Height=360;Left=0;Top=0;
        Content=web;
        hover.Tick+=(_,_)=>{hover.Stop();if(EdgeWatcher.IsAtEdge()&&EdgeWatcher.CanReveal(source?.Handle??IntPtr.Zero))Reveal(false);};
        dismiss.Tick+=(_,_)=>{dismiss.Stop();if(!KeepOpen()&&!pinned&&!dragging&&settings is null)Collapse();};
        hide.Tick+=(_,_)=>{hide.Stop();if(!expanded)Hide();};
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
        core.ProcessFailed+=(_,_)=>{ready.Remove(view);sentItems.Remove(view);if(!disposed)view.Reload();};
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
        UpdateTrayIcon();
        foreach(var view in ready.ToArray())
        {
            var known=sentItems.GetValueOrDefault(view)??new HashSet<Guid>();
            var visible=view==web?items.Where(item=>item.Display==screen.DeviceName).ToArray():Array.Empty<InboxItem>();
            var captures=visible.Select(item=>new{id=item.Id.ToString(),kind=item.Text is null?"image":"text",title=item.Title,text=known.Contains(item.Id)?null:item.Text,preview=!known.Contains(item.Id)&&item.Text is null?Preview(item):null}).ToArray();
            Post(view,new{type="state",items=captures,locale,expanded,reducedMotion=!SystemParameters.ClientAreaAnimation,focus,pinned,arming,appearance,count=items.Count,platform="windows"});
            sentItems[view]=visible.Select(item=>item.Id).ToHashSet();
        }
    }
    private void Receive(WebView view,string json)
    {
        if(Encoding.UTF8.GetByteCount(json)>131072)return;
        using var message=JsonDocument.Parse(json);var value=message.RootElement;
        string? Get(string key)=>value.TryGetProperty(key,out var field)&&field.ValueKind==JsonValueKind.String?field.GetString():null;
        switch(Get("type"))
        {
            case "ready":ready.Add(view);sentItems[view]=new();State();if(view==settingsWeb&&(settingsMode=="preferences"||settingsMode=="tray"))SendPreferences(view);if(lastError is not null)Post(view,new{type="error",message=lastError});break;
            case "collapse":Collapse();break;
            case "toggleRail":if(settingsMode=="tray")settings?.Close();if(expanded)Collapse();else Reveal(true);break;
            case "pin":Pin();break;
            case "unpin":Unpin();break;
            case "openPreferences":OpenSettings("preferences");break;
            case "quit":if(view==settingsWeb&&settingsMode=="tray")Application.Current.Shutdown();break;
            case "close":settings?.Close();break;
            case "savePreferences":if(view==settingsWeb&&value.TryGetProperty("value",out var next)){var preference=JsonSerializer.Deserialize<AppPreferences>(next.GetRawText(),PreferencesStore.Json)??throw new ArgumentException("Invalid settings");SavePreferences(preference);}break;
            case "setAppearance":if(Get("value") is string look&&new[]{"glass","paper","graphite"}.Contains(look)){appearance=look;Directory.CreateDirectory(appData);File.WriteAllText(Path.Combine(appData,"appearance.txt"),look);State();}break;
            case "setLocale":if(Get("value") is string language&&Strings.Locales.Contains(language)){locale=language;Strings.Locale=language;Directory.CreateDirectory(appData);File.WriteAllText(Path.Combine(appData,"locale.txt"),language);State();}break;
            case "clearNotes":items.Clear();State();break;
            case "moveWindow":if(view==settingsWeb&&settingsMode=="preferences"&&System.Windows.Input.Mouse.LeftButton==System.Windows.Input.MouseButtonState.Pressed)settings?.DragMove();break;
            case "surfaces":if(view==web&&value.TryGetProperty("surfaces",out var surfaces))UpdateHitAreas(surfaces);break;
            case "copy":case "remove":case "drag":
                if(!Guid.TryParse(Get("id"),out var id))return;
                var item=items.FirstOrDefault(item=>item.Id==id&&item.Display==screen.DeviceName);if(item is null)return;
                if(Get("type")=="remove"){items.Remove(item);State();}
                else if(Get("type")=="copy"){Copy(item);Post(web,new{type="copied",id=item.Id.ToString()});}
                else Drag(item);
                break;
        }
    }
    private void Add(InboxItem item){item.Display=screen.DeviceName;items.Add(item);if(items.Count>30)items.RemoveAt(0);}
    private void UpdateHitAreas(JsonElement surfaces)
    {
        hitAreas.Clear();
        if(surfaces.ValueKind!=JsonValueKind.Array)return;
        foreach(var shape in surfaces.EnumerateArray().Take(9)){
            if(!Guid.TryParse(shape.GetProperty("id").GetString(),out var id)||!items.Any(item=>item.Id==id&&item.Display==screen.DeviceName))continue;
            double x=shape.GetProperty("x").GetDouble(),y=shape.GetProperty("y").GetDouble(),width=shape.GetProperty("width").GetDouble(),height=shape.GetProperty("height").GetDouble(),angle=shape.GetProperty("angle").GetDouble();
            if(new[]{x,y,width,height,angle}.All(double.IsFinite)&&width>0&&width<500&&height>0&&height<300)hitAreas.Add((x,y,width,height,angle*Math.PI/180));
        }
        UpdatePointers();
    }
    private void UpdatePointers()
    {
        var screenPoint=Forms.Cursor.Position;
        void Pointer(WebView view){if(!ready.Contains(view))return;var p=view.PointFromScreen(new Point(screenPoint.X,screenPoint.Y));bool inside=p.X>=0&&p.Y>=0&&p.X<view.ActualWidth&&p.Y<view.ActualHeight;Post(view,new{type="pointer",x=inside?(double?)p.X:null,y=inside?(double?)p.Y:null});}
        if(expanded){
            Pointer(web);var p=web.PointFromScreen(new Point(screenPoint.X,screenPoint.Y));
            bool hit=hitAreas.Any(area=>{var dx=p.X-area.X;var dy=p.Y-area.Y;return Math.Abs(dx*Math.Cos(area.Angle)+dy*Math.Sin(area.Angle))<=area.Width/2+12&&Math.Abs(-dx*Math.Sin(area.Angle)+dy*Math.Cos(area.Angle))<=area.Height/2+12;});
            if(!dragging)SetInteractive(hit);
        }
        if(settingsMode=="tray"&&settingsWeb is not null)Pointer(settingsWeb);
    }
    private void Position()
    {
        Height=360;
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
        expanded=true;arming=false;if(peek)peekUntil=DateTime.UtcNow.AddMilliseconds(2500);
        Position();Show();SetInteractive(true);State(focus);
        if(focus){Activate();web.Focus();}
        if(peek)ScheduleDismiss();
    }
    private void Collapse()
    {
        hover.Stop();dismiss.Stop();hide.Stop();expanded=false;pinned=false;arming=false;SetInteractive(false);State();
        if(SystemParameters.ClientAreaAnimation)hide.Start();else Hide();
    }
    private void Pin()
    {
        if(!expanded)Reveal(false);
        pinned=true;dismiss.Stop();State();
    }
    private void Unpin()=>Collapse();
    private void SetInteractive(bool interactive)
    {
        if(source is null)return;var style=GetWindowLong(source.Handle,-20);
        SetWindowLong(source.Handle,-20,interactive?style&~0x20:style|0x20);
    }
    private bool KeepOpen()
    {
        if(!expanded)return false;var point=Forms.Cursor.Position;var scale=source?.CompositionTarget?.TransformToDevice.M22??1;
        return NotesGeometry.IsPointerWithinRail(point.X,point.Y,screen.Bounds.Left,screen.WorkingArea.Top,screen.Bounds.Width,(int)Math.Ceiling(230*scale));
    }
    private void ScheduleDismiss()
    {
        if(disposed||!expanded||pinned||dragging||settings is not null)return;
        dismiss.Stop();dismiss.Interval=TimeSpan.FromMilliseconds(Math.Max(450,(peekUntil-DateTime.UtcNow).TotalMilliseconds));dismiss.Start();
    }
    private void Arrived(){Reveal(false,true);}
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
                if(image is not null){if(!expanded)screen=Forms.Screen.FromPoint(Forms.Cursor.Position);Add(new InboxItem("PNG",image));Arrived();}
                return;
            } catch(ExternalException) { /* Screenshot tools can hold the clipboard while publishing pixels. */ }
              catch(Exception ex) when(ex is IOException or NotSupportedException or InvalidOperationException){Error(ex.Message);return;}
        }
    }
    private void SendPreferences(WebView view)=>Post(view,new{type="preferences",value=JsonSerializer.SerializeToElement(preferences.Value,PreferencesStore.Json),platform="windows"});
    private void ClearShortcuts(){if(source is null)return;for(int id=1;id<=3;id++)UnregisterHotKey(source.Handle,id);}
    private void RegisterShortcuts(AppPreferences value)
    {
        if(source is null)return;
        foreach(var binding in new[]{(1,Shortcut.Open),(3,value.TextShortcut)})
            if(!RegisterHotKey(source.Handle,binding.Item1,binding.Item2.Modifiers,binding.Item2.VirtualKey))throw new InvalidOperationException(binding.Item2.Display+" — "+Strings.Get("hotkey"));
    }
    private void ApplyShortcuts(AppPreferences value)
    {
        value.Validate();var previous=registeredPreferences;ClearShortcuts();
        try{RegisterShortcuts(value);registeredPreferences=value;}
        catch{ClearShortcuts();if(previous is not null){try{RegisterShortcuts(previous);}catch{ClearShortcuts();}}throw;}
    }
    private void SavePreferences(AppPreferences value,bool refreshShortcuts=true)
    {
        value.Validate();var previous=preferences.Value;
        if(!testing&&refreshShortcuts&&value.TextShortcut!=previous.TextShortcut)ApplyShortcuts(value);
        try{preferences.Save(value);}catch{if(!testing&&refreshShortcuts)ApplyShortcuts(previous);throw;}
        collectImages=value.CollectImages;ignoredClipboard=GetClipboardSequenceNumber();clipboardRequest++;lastError=null;
        if(settingsWeb is not null)SendPreferences(settingsWeb);State();
    }
    private async void CollectSelectedText()
    {
        if(collectingText)return;collectingText=true;
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
        finally{dragging=false;ScheduleDismiss();}
    }
    private async void OpenSettings(string mode)
    {
        dismiss.Stop();hover.Stop();if(!expanded)screen=Forms.Screen.FromPoint(Forms.Cursor.Position);
        if(settings is not null){if(settingsMode==mode){settings.Activate();return;}settings.Close();}
        bool menu=mode=="tray";
        var window=new Window{Title=Label(menu?"SnapSlot":"Settings"),Width=menu?244:420,Height=menu?170:442,WindowStartupLocation=menu?WindowStartupLocation.Manual:WindowStartupLocation.CenterScreen,Background=Brushes.Transparent,WindowStyle=WindowStyle.None,AllowsTransparency=true,ResizeMode=ResizeMode.NoResize,ShowInTaskbar=!menu,ShowActivated=!menu,Topmost=menu};
        var view=new WebView{DefaultBackgroundColor=Drawing.Color.Transparent};window.Content=view;
        settings=window;settingsMode=mode;settingsWeb=view;
        if(menu){
            window.SourceInitialized+=(_,_)=>PositionTrayMenu(window);
            window.Deactivated+=(_,_)=>window.Close();
        }
        window.Closed+=(_,_)=>{ready.Remove(view);sentItems.Remove(view);view.Dispose();settings=null;settingsWeb=null;settingsMode="";ScheduleDismiss();};
        window.Show();
        try{await InitializeWeb(view,mode);}catch(Exception ex){Error(ex.Message);window.Close();}
    }
    private static void PositionTrayMenu(Window window)
    {
        var point=Forms.Cursor.Position;var area=Forms.Screen.FromPoint(point).WorkingArea;var dpi=VisualTreeHelper.GetDpi(window);
        var left=area.Left/dpi.DpiScaleX;var top=area.Top/dpi.DpiScaleY;var right=area.Right/dpi.DpiScaleX;var bottom=area.Bottom/dpi.DpiScaleY;
        var x=point.X/dpi.DpiScaleX-window.Width+14;var y=point.Y/dpi.DpiScaleY-window.Height-8;
        window.Left=Math.Max(left,Math.Min(x,right-window.Width));window.Top=Math.Max(top,Math.Min(y,bottom-window.Height));
    }
    private void SetupTray()
    {
        tray=new Forms.NotifyIcon{Text="SnapSlot"};
        var small=Forms.SystemInformation.SmallIconSize;var file=Path.Combine(AppContext.BaseDirectory,"SnapSlot.ico");
        icon=File.Exists(file)?new Drawing.Icon(file,small):(Drawing.Icon)Drawing.SystemIcons.Application.Clone();tray.Icon=icon;
        tray.MouseClick+=(_,eventArgs)=>Dispatcher.Invoke(()=>Safe(()=>{
            if(eventArgs.Button==Forms.MouseButtons.Right){if(settingsMode=="tray")settings?.Close();else OpenSettings("tray");}
            else if(eventArgs.Button==Forms.MouseButtons.Left){if(expanded)Collapse();else Reveal(true);}
        }));
        UpdateTrayIcon();tray.Visible=true;
    }
    private void UpdateTrayIcon()
    {
        if(tray is null||icon is null||iconState==(pinned,collectImages))return;
        var size=Forms.SystemInformation.SmallIconSize;
        using var bitmap=new Drawing.Bitmap(size.Width,size.Height);
        using(var graphics=Drawing.Graphics.FromImage(bitmap)){
            graphics.SmoothingMode=Drawing.Drawing2D.SmoothingMode.AntiAlias;
            using var original=icon.ToBitmap();
            if(collectImages)graphics.DrawImage(original,new Drawing.Rectangle(Drawing.Point.Empty,size));
            else{
                using var attributes=new Drawing.Imaging.ImageAttributes();
                attributes.SetColorMatrix(new Drawing.Imaging.ColorMatrix(new[]{
                    new[]{.2126f,.2126f,.2126f,0f,0f},new[]{.7152f,.7152f,.7152f,0f,0f},new[]{.0722f,.0722f,.0722f,0f,0f},new[]{0f,0f,0f,.55f,0f},new[]{0f,0f,0f,0f,1f}}));
                graphics.DrawImage(original,new Drawing.Rectangle(Drawing.Point.Empty,size),0,0,original.Width,original.Height,Drawing.GraphicsUnit.Pixel,attributes);
            }
            if(pinned){
                // Website Windows marker: 7 px, right/bottom 4 px, 1.5 px light ring on a 32 px button.
                float scale=size.Width/32f;
                var dot=new Drawing.RectangleF(21*scale,21*scale,7*scale,7*scale);
                using var ring=new Drawing.Pen(Drawing.Color.FromArgb(238,240,246),3*scale);
                using var fill=new Drawing.SolidBrush(Drawing.Color.FromArgb(0,103,192));
                graphics.DrawEllipse(ring,dot);graphics.FillEllipse(fill,dot);
            }
        }
        var handle=bitmap.GetHicon();Drawing.Icon next;
        try{next=(Drawing.Icon)Drawing.Icon.FromHandle(handle).Clone();}finally{DestroyIcon(handle);}
        var previous=stateIcon;tray.Icon=next;stateIcon=next;iconState=(pinned,collectImages);previous?.Dispose();
    }
    private void OnSource(object? sender,EventArgs e)
    {
        source=(HwndSource)PresentationSource.FromVisual(this);source.AddHook(WndProc);if(testing)return;
        ignoredClipboard=GetClipboardSequenceNumber();AddClipboardFormatListener(source.Handle);
        try{ApplyShortcuts(preferences.Value);}catch(Exception ex){startupShortcutError=ex.Message;Error(ex.Message);}
        watcher=new EdgeWatcher();watcher.Entered+=()=>{if(!expanded&&settings is null){arming=true;screen=EdgeWatcher.TargetScreen;Position();Show();SetInteractive(false);State();hover.Start();}};watcher.Left+=()=>{hover.Stop();if(arming&&!expanded){arming=false;State();Hide();}if(expanded&&!KeepOpen())ScheduleDismiss();};
        watcher.Moved+=()=>{UpdatePointers();if(!expanded)return;if(KeepOpen())dismiss.Stop();else if(!dismiss.IsEnabled)ScheduleDismiss();};
        watcher.Clicked+=()=>{if(settingsMode=="tray"&&settings is not null){var point=Forms.Cursor.Position;var local=settings.PointFromScreen(new Point(point.X,point.Y));if(local.X<0||local.Y<0||local.X>=settings.ActualWidth||local.Y>=settings.ActualHeight)settings.Close();}};
        edgeProbe.Tick+=(_,_)=>{if(expanded||settings is not null){edgeDwell.Reset();return;}if(edgeDwell.Update(EdgeWatcher.IsAtEdge(),EdgeWatcher.CanReveal(source.Handle),DateTime.UtcNow))Reveal(false);};edgeProbe.Start();
        SystemParameters.StaticPropertyChanged+=ParametersChanged;
    }
    private void ParametersChanged(object? sender,System.ComponentModel.PropertyChangedEventArgs e){if(e.PropertyName==nameof(SystemParameters.ClientAreaAnimation))State();}
    private IntPtr WndProc(IntPtr hwnd,int message,IntPtr wParam,IntPtr lParam,ref bool handled)
    {
        if(message==0x0312){if(wParam.ToInt32()==3)CollectSelectedText();else if(expanded)Collapse();else Reveal(true);handled=true;}
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
        for(int i=0;i<35;i++)Add(new InboxItem("Note "+i,"Note "+i));Reveal(false);await Task.Delay(900);if(items.Count!=30)throw new InvalidOperationException("Note capacity must be 30");
        using(var stream=File.Create(Path.Combine(output,"windows-notes.png")))await web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,stream);
        File.WriteAllText(Path.Combine(output,"desktop-smoke.txt"),"PASS: Offline native UI loaded\nPASS: 30-note capacity with website fan\nPASS: removal keeps export alive\n");
    }
    private void Dispose()
    {
        disposed=true;hover.Stop();edgeProbe.Stop();dismiss.Stop();hide.Stop();watcher?.Dispose();SystemParameters.StaticPropertyChanged-=ParametersChanged;
        if(source is not null){if(!testing)RemoveClipboardFormatListener(source.Handle);ClearShortcuts();source.RemoveHook(WndProc);}settings?.Close();web.Dispose();tray?.Dispose();stateIcon?.Dispose();icon?.Dispose();
    }
    [DllImport("user32.dll")]private static extern bool AddClipboardFormatListener(IntPtr window);
    [DllImport("user32.dll")]private static extern bool DestroyIcon(IntPtr icon);
    [DllImport("user32.dll")]private static extern bool RemoveClipboardFormatListener(IntPtr window);
    [DllImport("user32.dll")]private static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll")]private static extern bool RegisterHotKey(IntPtr window,int id,uint modifiers,uint key);
    [DllImport("user32.dll")]private static extern bool UnregisterHotKey(IntPtr window,int id);
    [DllImport("user32.dll")]private static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
    [DllImport("user32.dll")]private static extern int GetWindowLong(IntPtr window,int index);
    [DllImport("user32.dll")]private static extern int SetWindowLong(IntPtr window,int index,int value);
}
