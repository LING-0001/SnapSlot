using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Automation;

namespace SnapSlot;
internal static class SelectedText
{
    public static async Task<string> ReadAsync()
    {
        var target=GetForegroundWindow();GetWindowThreadProcessId(target,out uint pid);
        if(target==IntPtr.Zero||pid==Environment.ProcessId)throw new InvalidOperationException("Select text in another app first.");
        string? selected=null;bool supported=false;
        try {
            var selection=await Task.Run(()=>{
                var element=AutomationElement.FocusedElement;
                if(element is null)return (false,(string?)null);
                if(element.Current.IsPassword)throw new InvalidOperationException("Select ordinary text first.");
                if(element.TryGetCurrentPattern(TextPattern.Pattern,out var raw)&&raw is TextPattern pattern){var ranges=pattern.GetSelection();return(true,ranges.Length>0?ranges[0].GetText(65537):"");}
                return(false,(string?)null);
            }).WaitAsync(TimeSpan.FromSeconds(1));
            supported=selection.Item1;selected=selection.Item2;
        }catch(ElementNotAvailableException){}catch(TimeoutException){}
        if(GetForegroundWindow()!=target)throw new InvalidOperationException("Select text and use the shortcut again.");
        if(supported){if(string.IsNullOrWhiteSpace(selected))throw new InvalidOperationException("Select the text you want to pin first.");return selected!;}
        // Editors without TextPattern can still expose their current selection through Copy.
        for(int i=0;i<30&&ModifiersHeld();i++)await Task.Delay(50);
        if(ModifiersHeld()||GetForegroundWindow()!=target)throw new InvalidOperationException("Release the shortcut keys and try again.");
        uint sequence=GetClipboardSequenceNumber();
        var input=new[]{Key(0x11,false),Key(0x43,false),Key(0x43,true),Key(0x11,true)};
        if(SendInput((uint)input.Length,input,Marshal.SizeOf<Input>())!=input.Length){SendInput(2,new[]{Key(0x43,true),Key(0x11,true)},Marshal.SizeOf<Input>());throw new InvalidOperationException("This app could not copy the selection. Try an app running with normal permissions.");}
        for(int i=0;i<20;i++){
            await Task.Delay(50);if(GetForegroundWindow()!=target)break;
            if(GetClipboardSequenceNumber()!=sequence&&Clipboard.ContainsText()){var text=Clipboard.GetText();if(!string.IsNullOrWhiteSpace(text))return text;}
        }
        throw new InvalidOperationException("No new selected text was copied. Select text and try again.");
    }
    private static bool ModifiersHeld(){foreach(int key in new[]{0x10,0x11,0x12,0x5B,0x5C})if((GetAsyncKeyState(key)&0x8000)!=0)return true;return false;}
    private static Input Key(ushort key,bool up)=>new(){Type=1,Data=new InputUnion{Keyboard=new KeyboardInput{VirtualKey=key,Flags=up?2u:0}}};
    [StructLayout(LayoutKind.Sequential)]private struct Input{public uint Type;public InputUnion Data;}
    [StructLayout(LayoutKind.Explicit)]private struct InputUnion{[FieldOffset(0)]public KeyboardInput Keyboard;[FieldOffset(0)]public MouseInput Mouse;}
    [StructLayout(LayoutKind.Sequential)]private struct KeyboardInput{public ushort VirtualKey,Scan;public uint Flags,Time;public UIntPtr Extra;}
    [StructLayout(LayoutKind.Sequential)]private struct MouseInput{public int X,Y;public uint MouseData,Flags,Time;public UIntPtr Extra;}
    [DllImport("user32.dll")]private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]private static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
    [DllImport("user32.dll")]private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")]private static extern uint GetClipboardSequenceNumber();
    [DllImport("user32.dll",SetLastError=true)]private static extern uint SendInput(uint count,Input[] inputs,int size);
}
