using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace SnapSlot;

internal sealed record RecordedKey(string Code,string Key,bool Down,bool Control,bool Alt,bool Shift,bool Meta,bool Repeat)
{public string Type=>"shortcutKey";}

// Keep the hook only while the foreground preferences window is recording.
internal sealed class ShortcutRecording : IDisposable
{
    private delegate IntPtr KeyboardHook(int code,IntPtr message,IntPtr data);
    private readonly KeyboardHook handler;
    private readonly HashSet<int> pressed=new();
    private IntPtr hook,window;
    private Action<RecordedKey>? receive;
    public ShortcutRecording(){handler=Handle;}
    public void Begin(IntPtr foreground,Action<RecordedKey> receive)
    {
        if(hook!=IntPtr.Zero)return;
        if(GetForegroundWindow()!=foreground)throw new InvalidOperationException("Activate Settings before recording a shortcut.");
        window=foreground;this.receive=receive;
        foreach(int key in new[]{91,92,160,161,162,163,164,165})if((GetAsyncKeyState(key)&0x8000)!=0)pressed.Add(key);
        hook=SetWindowsHookEx(13,handler,GetModuleHandle(null),0);
        if(hook==IntPtr.Zero){End();throw new InvalidOperationException("Could not pause global shortcuts. Try recording again.");}
    }
    private IntPtr Handle(int code,IntPtr message,IntPtr data)
    {
        int kind=message.ToInt32();
        if(code<0||GetForegroundWindow()!=window||(kind!=0x100&&kind!=0x101&&kind!=0x104&&kind!=0x105))return CallNextHookEx(hook,code,message,data);
        int key=Marshal.ReadInt32(data);bool down=kind==0x100||kind==0x104;
        bool repeat=down&&pressed.Contains(key);
        if(down)pressed.Add(key);else pressed.Remove(key);
        string dom=key switch {
            >=65 and <=90=>"Key"+(char)key, >=48 and <=57=>"Digit"+(char)key,
            >=112 and <=122=>"F"+(key-111), 32=>"Space",27=>"Escape",
            16 or 160=>"ShiftLeft",161=>"ShiftRight",17 or 162=>"ControlLeft",163=>"ControlRight",
            18 or 164=>"AltLeft",165=>"AltRight",91=>"MetaLeft",92=>"MetaRight",_=>"Unknown"
        };
        try{receive?.Invoke(new(dom,key==27?"Escape":dom,down,pressed.Contains(17)||pressed.Contains(162)||pressed.Contains(163),pressed.Contains(18)||pressed.Contains(164)||pressed.Contains(165),pressed.Contains(16)||pressed.Contains(160)||pressed.Contains(161),pressed.Contains(91)||pressed.Contains(92),repeat));}
        catch{End();return CallNextHookEx(IntPtr.Zero,code,message,data);}
        return new IntPtr(1);
    }
    public void End(){if(hook!=IntPtr.Zero){UnhookWindowsHookEx(hook);hook=IntPtr.Zero;}pressed.Clear();receive=null;window=IntPtr.Zero;}
    public void Dispose()=>End();
    [DllImport("user32.dll",SetLastError=true)]private static extern IntPtr SetWindowsHookEx(int kind,KeyboardHook handler,IntPtr module,uint thread);
    [DllImport("user32.dll")]private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")]private static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr message,IntPtr data);
    [DllImport("user32.dll")]private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]private static extern short GetAsyncKeyState(int key);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]private static extern IntPtr GetModuleHandle(string? name);
}
