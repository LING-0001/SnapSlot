using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace SnapSlot;

// Passive mouse observation: never intercept or modify another application's input.
// This lets the rail HWND be completely hidden rather than cover a clickable top strip.
internal sealed class EdgeWatcher : IDisposable
{
    private readonly HookProc callback;
    private IntPtr hook;
    private bool atEdge;
    private int previousY = int.MaxValue;
    public event Action? Entered;
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
        var bounds = Screen.PrimaryScreen!.Bounds;
        return point.X >= bounds.Left && point.X < bounds.Right && point.Y >= bounds.Top && point.Y <= bounds.Top + 1;
    }
    public static bool CanReveal(IntPtr ownWindow)
    {
        if ((GetAsyncKeyState(1) & 0x8000) != 0 || (GetAsyncKeyState(2) & 0x8000) != 0 || (GetAsyncKeyState(4) & 0x8000) != 0) return false;
        var foreground = GetForegroundWindow();
        if (foreground == IntPtr.Zero || foreground == ownWindow) return true;
        var name = new StringBuilder(256); GetClassName(foreground, name, name.Capacity);
        if (name.ToString() is "Progman" or "WorkerW" or "Shell_TrayWnd") return true;
        if (!GetWindowRect(foreground, out var rect)) return true;
        var screen = Screen.PrimaryScreen!.Bounds;
        return !(rect.Left <= screen.Left && rect.Top <= screen.Top && rect.Right >= screen.Right && rect.Bottom >= screen.Bottom);
    }
    private IntPtr OnMouse(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0 && message.ToInt32() == 0x0200)
        {
            var point = Marshal.PtrToStructure<MouseData>(data).Point;
            var screen = Screen.PrimaryScreen!.Bounds;
            bool now = point.X >= screen.Left && point.X < screen.Right && point.Y >= screen.Top && point.Y <= screen.Top + 1;
            if (now && !atEdge && point.Y <= previousY) Entered?.Invoke();
            if (!now && atEdge) Left?.Invoke();
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
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder name, int count);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
}
