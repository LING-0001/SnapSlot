using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace SnapSlot;

internal sealed class EdgeDwell
{
    private DateTime? started;
    internal bool Update(bool atEdge, bool canReveal, DateTime now)
    {
        if (!atEdge || !canReveal) { started=null; return false; }
        started??=now;
        if (now-started.Value<TimeSpan.FromMilliseconds(500)) return false;
        started=null;return true;
    }
    internal void Reset()=>started=null;
}

// Passive mouse observation: never intercept or modify another application's input.
// This lets the rail HWND be completely hidden rather than cover a clickable top strip.
internal sealed class EdgeWatcher : IDisposable
{
    private readonly HookProc callback;
    private IntPtr hook;
    private bool atEdge;
    public static Screen TargetScreen { get; private set; } = Screen.PrimaryScreen!;
    private int previousY = int.MaxValue;
    public event Action? Entered;
    public event Action? Moved;
    public event Action? Left;
    public EdgeWatcher()
    {
        callback = OnMouse;
        hook = SetWindowsHookEx(14, callback, GetModuleHandle(null), 0);
        if (hook == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    public static bool IsAtEdge()
    {
        GetCursorPos(out var point);
        TargetScreen=Screen.FromPoint(new System.Drawing.Point(point.X,point.Y));
        var bounds = TargetScreen.Bounds;
        return IsAtTopEdge(point.X,point.Y,bounds.Left,bounds.Top,bounds.Right);
    }
    internal static bool IsAtTopEdge(int x,int y,int left,int top,int right)
        => x>=left&&x<right&&y>=top&&y<=top+1;
    public static bool CanReveal(IntPtr ownWindow)
    {
        if ((GetAsyncKeyState(1) & 0x8000) != 0 || (GetAsyncKeyState(2) & 0x8000) != 0 || (GetAsyncKeyState(4) & 0x8000) != 0) return false;
        var foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || foreground == ownWindow) return true;
        var name = new StringBuilder(256); GetClassName(foreground, name, name.Capacity);
        if (name.ToString() is "Progman" or "WorkerW" or "Shell_TrayWnd") return true;
        if (!GetWindowRect(foreground, out var rect)) return true;
        var screen = TargetScreen.Bounds;
        return !ShouldSuppressReveal(rect.Left, rect.Top, rect.Right, rect.Bottom, screen.Left, screen.Top, screen.Right, screen.Bottom, IsZoomed(foreground));
    }
    internal static bool ShouldSuppressReveal(int left, int top, int right, int bottom, int screenLeft, int screenTop, int screenRight, int screenBottom, bool isMaximized)
        => !isMaximized && left <= screenLeft && top <= screenTop && right >= screenRight && bottom >= screenBottom;
    internal static bool IsPointerWithinRail(int x, int y, int left, int top, int width, int physicalHeight)
        => x >= left && x < left + width && y >= top && y < top + physicalHeight;
    private IntPtr OnMouse(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0 && message.ToInt32() == 0x0200)
        {
            var point = Marshal.PtrToStructure<MouseData>(data).Point;
            var target=Screen.FromPoint(new System.Drawing.Point(point.X,point.Y));
            if(target.DeviceName!=TargetScreen.DeviceName){if(atEdge)Left?.Invoke();atEdge=false;previousY=int.MaxValue;}
            TargetScreen=target;
            var screen = target.Bounds;
            bool now = IsAtTopEdge(point.X,point.Y,screen.Left,screen.Top,screen.Right);
            if (now && !atEdge && point.Y <= previousY) Entered?.Invoke();
            if (!now && atEdge) Left?.Invoke();
            Moved?.Invoke();
            previousY = point.Y;
            atEdge = now;
        }
        return CallNextHookEx(hook, code, message, data);
    }
    public void Dispose() { if (hook != IntPtr.Zero) { UnhookWindowsHookEx(hook); hook = IntPtr.Zero; } }
    private delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
    [StructLayout(LayoutKind.Sequential)] private struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] private struct MouseData { public Point Point; public uint Mouse, Flags, Time; public UIntPtr Extra; }
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr module, uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool IsZoomed(IntPtr window);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder name, int count);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
}
