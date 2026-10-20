using System;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using Forms=System.Windows.Forms;
using Drawing=System.Drawing;

namespace SnapSlot;
internal sealed class CaptureWindow : Window
{
    private readonly BitmapSource screenshot;
    private readonly Forms.Screen screen;
    private readonly Canvas canvas=new(){Background=Brushes.Transparent};
    private readonly Rectangle selection=new(){Stroke=Brushes.DodgerBlue,StrokeThickness=2,Fill=new SolidColorBrush(Color.FromArgb(35,18,99,215))};
    private Point? start;
    public BitmapSource? Result {get;private set;}
    public CaptureWindow(Forms.Screen screen)
    {
        this.screen=screen;
        using var bitmap=new Drawing.Bitmap(screen.Bounds.Width,screen.Bounds.Height,System.Drawing.Imaging.PixelFormat.Format32bppArgb);
        using(var graphics=Drawing.Graphics.FromImage(bitmap))graphics.CopyFromScreen(screen.Bounds.Location,Drawing.Point.Empty,screen.Bounds.Size);
        using var stream=new MemoryStream();bitmap.Save(stream,ImageFormat.Png);stream.Position=0;
        var source=new BitmapImage();source.BeginInit();source.CacheOption=BitmapCacheOption.OnLoad;source.StreamSource=stream;source.EndInit();source.Freeze();screenshot=source;
        WindowStyle=WindowStyle.None;ResizeMode=ResizeMode.NoResize;Topmost=true;ShowInTaskbar=false;Cursor=Cursors.Cross;
        var grid=new Grid();grid.Children.Add(new Image{Source=screenshot,Stretch=Stretch.Fill});grid.Children.Add(new Border{Background=new SolidColorBrush(Color.FromArgb(55,0,0,0)),IsHitTestVisible=false});grid.Children.Add(canvas);canvas.Children.Add(selection);Content=grid;
        SourceInitialized+=(_,_)=>SetWindowPos(new WindowInteropHelper(this).Handle,new IntPtr(-1),screen.Bounds.X,screen.Bounds.Y,screen.Bounds.Width,screen.Bounds.Height,0x0040);
        DpiChanged+=(_,_)=>Dispatcher.BeginInvoke(()=>SetWindowPos(new WindowInteropHelper(this).Handle,new IntPtr(-1),screen.Bounds.X,screen.Bounds.Y,screen.Bounds.Width,screen.Bounds.Height,0x0040));
        KeyDown+=(_,e)=>{if(e.Key==Key.Escape){DialogResult=false;}};
        canvas.MouseLeftButtonDown+=(_,e)=>{start=e.GetPosition(canvas);Canvas.SetLeft(selection,start.Value.X);Canvas.SetTop(selection,start.Value.Y);selection.Width=0;selection.Height=0;canvas.CaptureMouse();};
        canvas.MouseMove+=(_,e)=>{if(start is not Point origin)return;var now=e.GetPosition(canvas);Canvas.SetLeft(selection,Math.Min(origin.X,now.X));Canvas.SetTop(selection,Math.Min(origin.Y,now.Y));selection.Width=Math.Abs(now.X-origin.X);selection.Height=Math.Abs(now.Y-origin.Y);};
        canvas.MouseLeftButtonUp+=(_,_)=>
        {
            canvas.ReleaseMouseCapture();if(start is null)return;start=null;
            var sx=screenshot.PixelWidth/ActualWidth;var sy=screenshot.PixelHeight/ActualHeight;
            int x=Math.Clamp((int)Math.Round(Canvas.GetLeft(selection)*sx),0,screenshot.PixelWidth-1),y=Math.Clamp((int)Math.Round(Canvas.GetTop(selection)*sy),0,screenshot.PixelHeight-1);
            int width=Math.Min(screenshot.PixelWidth-x,(int)Math.Round(selection.Width*sx)),height=Math.Min(screenshot.PixelHeight-y,(int)Math.Round(selection.Height*sy));
            if(width<2||height<2){DialogResult=false;return;}
            var image=new CroppedBitmap(screenshot,new Int32Rect(x,y,width,height));image.Freeze();Result=image;DialogResult=true;
        };
    }
    [DllImport("user32.dll")]private static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
}
