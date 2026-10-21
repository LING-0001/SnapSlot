using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SnapSlot;
internal sealed record Shortcut(string Key,bool Control=true,bool Alt=true,bool Shift=false,bool Meta=false)
{
    public static readonly Shortcut Open=new("Space");
    [JsonIgnore]public uint Modifiers=>(Control?2u:0)|(Alt?1u:0)|(Shift?4u:0)|(Meta?8u:0)|0x4000u;
    [JsonIgnore]public uint VirtualKey=>Key=="Space"?0x20u:Key.StartsWith("Key",StringComparison.Ordinal)?Key[3]:Key.StartsWith("Digit",StringComparison.Ordinal)?Key[5]:(uint)(0x70+int.Parse(Key[1..])-1);
    [JsonIgnore]public string Display=>string.Join(" + ",new[]{Control?"Ctrl":null,Alt?"Alt":null,Shift?"Shift":null,Meta?"Win":null,Key.Replace("Key","").Replace("Digit","")}.Where(value=>value is not null));
    public void Validate()
    {
        if(string.IsNullOrEmpty(Key))throw new ArgumentException("Choose a shortcut key.");
        bool valid=Key=="Space" || (Key.Length==4&&Key.StartsWith("Key",StringComparison.Ordinal)&&Key[3]>='A'&&Key[3]<='Z') || (Key.Length==6&&Key.StartsWith("Digit",StringComparison.Ordinal)&&char.IsAsciiDigit(Key[5])) || (Key.StartsWith('F')&&int.TryParse(Key[1..],out int function)&&function>=1&&function<=11&&Key=="F"+function);
        if(!valid||!(Control||Alt||Meta))throw new ArgumentException("Use Ctrl, Alt or Win with a letter, number, Space or F1–F11.");
        if(Key=="KeyC"&&!Alt&&!Shift&&Control!=Meta)throw new ArgumentException("Keep Ctrl+C available for ordinary Copy. Choose another shortcut.");
    }
}
internal sealed record AppPreferences(bool CollectScreenshots,Shortcut CaptureShortcut,Shortcut TextShortcut)
{
    public static AppPreferences Default=>new(true,new("KeyS",Control:true,Alt:false,Shift:true),new("KeyT"));
    public void Validate()
    {
        if(CaptureShortcut is null||TextShortcut is null)throw new ArgumentException("Both shortcuts are required.");
        CaptureShortcut.Validate();TextShortcut.Validate();
        if(CaptureShortcut==TextShortcut||CaptureShortcut==Shortcut.Open||TextShortcut==Shortcut.Open)throw new ArgumentException("Shortcuts must be different. Ctrl+Alt+Space is reserved for opening notes.");
    }
}
internal sealed class PreferencesStore
{
    public static readonly JsonSerializerOptions Json=new(){PropertyNamingPolicy=JsonNamingPolicy.CamelCase,WriteIndented=true,RespectRequiredConstructorParameters=true};
    private readonly string path;
    public AppPreferences Value {get;private set;}
    public PreferencesStore(string path,bool legacyCollection=true)
    {
        this.path=path;Value=AppPreferences.Default with{CollectScreenshots=legacyCollection};
        try{var value=JsonSerializer.Deserialize<AppPreferences>(File.ReadAllText(path),Json);if(value is not null){value.Validate();Value=value;}}
        catch(Exception ex) when(ex is IOException or UnauthorizedAccessException or JsonException or ArgumentException){}
    }
    public void Save(AppPreferences value)
    {
        value.Validate();Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        string temporary=path+"."+Guid.NewGuid().ToString("N")+".tmp";
        try{File.WriteAllText(temporary,JsonSerializer.Serialize(value,Json));File.Move(temporary,path,true);Value=value;}
        finally{if(File.Exists(temporary))File.Delete(temporary);}
    }
}
