using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using System.Windows.Threading;

namespace SnapSlot;

// Passive mouse observation: never intercept or modify another application's input.
// All UI callbacks are posted asynchronously so the low-level mouse hook always
// returns immediately and is never silently dropped by Windows' LowLevelHooksTimeout.
internal sealed class EdgeWatcher : IDisposable
{
    private readonly Dispatcher dispatcher;
    private readonly HookProc callback;
    private IntPtr hook;
    private bool atEdge;
    private int moveQueued;
    public static Screen TargetScreen { get; private set; } = Screen.PrimaryScreen!;
    private int previousY = int.MaxValue;
    public event Action? Entered;
    public event Action? DragEnteredEdge;
    public event Action? Moved;
    public event Action? Left;
    public event Action? Clicked;
    public event Action? LeftButtonUp;

    public EdgeWatcher(Dispatcher dispatcher)
    {
        this.dispatcher = dispatcher;
        callback = OnMouse;
        hook = SetWindowsHookEx(14, callback, GetModuleHandle(null), 0);
        if (hook == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }

    public static bool IsAtEdge()
    {
        if (!GetCursorPos(out var point)) return false;
        TargetScreen = Screen.FromPoint(new System.Drawing.Point(point.X, point.Y));
        var bounds = TargetScreen.Bounds;
        return NotesGeometry.IsAtTopEdge(point.X, point.Y, bounds.Left, bounds.Top, bounds.Right);
    }

    public static bool IsLeftButtonHeld() => (GetAsyncKeyState(1) & 0x8000) != 0;

    public static bool CanReveal(IntPtr ownWindow)
    {
        if ((GetAsyncKeyState(1) & 0x8000) != 0 || (GetAsyncKeyState(2) & 0x8000) != 0 || (GetAsyncKeyState(4) & 0x8000) != 0) return false;
        var foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || foreground == ownWindow) return true;
        var name = new StringBuilder(256); GetClassName(foreground, name, name.Capacity);
        if (name.ToString() is "Progman" or "WorkerW" or "Shell_TrayWnd") return true;
        if (!GetWindowRect(foreground, out var rect)) return true;
        var target = GetCursorPos(out var point) ? Screen.FromPoint(new System.Drawing.Point(point.X, point.Y)) : TargetScreen;
        TargetScreen = target;
        var screen = target.Bounds;
        return !NotesGeometry.ShouldSuppressReveal(rect.Left, rect.Top, rect.Right, rect.Bottom, screen.Left, screen.Top, screen.Right, screen.Bottom, IsZoomed(foreground));
    }

    private void Post(Action? handler)
    {
        if (handler is null) return;
        dispatcher.BeginInvoke(DispatcherPriority.Input, handler);
    }

    private IntPtr OnMouse(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0)
        {
            int msg = message.ToInt32();
            if (msg is 0x0201 or 0x0204) Post(Clicked);
            else if (msg == 0x0202) Post(LeftButtonUp);
            else if (msg == 0x0200)
            {
                var point = Marshal.PtrToStructure<MouseData>(data).Point;
                var target = Screen.FromPoint(new System.Drawing.Point(point.X, point.Y));
                if (target.DeviceName != TargetScreen.DeviceName)
                {
                    if (atEdge) Post(Left);
                    atEdge = false;
                    previousY = int.MaxValue;
                }
                TargetScreen = target;
                var screen = target.Bounds;
                bool now = NotesGeometry.IsAtTopEdge(point.X, point.Y, screen.Left, screen.Top, screen.Right);
                if (now && !atEdge && point.Y <= previousY)
                {
                    if (IsLeftButtonHeld()) Post(DragEnteredEdge);
                    else Post(Entered);
                }
                if (!now && atEdge) Post(Left);
                if (Moved is not null && Interlocked.Exchange(ref moveQueued, 1) == 0)
                {
                    dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
                    {
                        Interlocked.Exchange(ref moveQueued, 0);
                        Moved?.Invoke();
                    }));
                }
                previousY = point.Y;
                atEdge = now;
            }
        }
        return CallNextHookEx(hook, code, message, data);
    }

    public void Dispose() { if (hook != IntPtr.Zero) { UnhookWindowsHookEx(hook); hook = IntPtr.Zero; } }
    private delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
    [StructLayout(LayoutKind.Sequential)] private struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] private struct MouseData { public Point Point; public uint Mouse, Flags, Time; public UIntPtr Extra; }
    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr module, uint thread);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool IsZoomed(IntPtr window);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder name, int count);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
}
