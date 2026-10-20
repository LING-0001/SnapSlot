using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;

namespace SnapSlot;

internal sealed class SkinStore : IDisposable
{
    public const int MaxBytes = 2 * 1024 * 1024;
    public string DirectoryPath { get; }
    public string ActivePath => Path.Combine(DirectoryPath, "active.json");
    public string Source { get; private set; }
    private readonly string template;
    private readonly FileSystemWatcher watcher;
    private Timer? debounce;
    public event Action<string>? Changed;
    public event Action<string>? Invalid;
    private static readonly Dictionary<string, (double Min, double Max)> Limits = new()
    {
        ["card.width"]=(100,480),["card.textWidth"]=(100,480),["card.height"]=(80,280),["card.gap"]=(8,64),["card.padding"]=(2,24),["card.radius"]=(0,48),["card.borderWidth"]=(0,8),["card.fontSize"]=(12,24),
        ["shadow.blur"]=(0,48),["shadow.offsetY"]=(0,24),["pin.width"]=(8,40),["pin.height"]=(8,48),["pin.x"]=(10,90),["pin.y"]=(-24,8),["buttons.size"]=(20,40),["buttons.inset"]=(0,16)
    };
    public SkinStore(string directory, string uiRoot)
    {
        DirectoryPath=directory;Directory.CreateDirectory(directory);
        template=File.ReadAllText(Path.Combine(uiRoot,"skins","notes.json"));Source=template;
        foreach(var name in new[]{"notes.json","cards.json"})
            if(!File.Exists(Path.Combine(directory,name)))File.Copy(Path.Combine(uiRoot,"skins",name),Path.Combine(directory,name));
        if(File.Exists(ActivePath)) { try { var candidate=Read();Validate(candidate);Source=candidate; } catch(Exception ex) when(ex is IOException or JsonException or ArgumentException) { try{var backup=File.ReadAllText(Path.Combine(directory,"last-good.json"));Validate(backup);Source=backup;}catch(Exception backupError) when(backupError is IOException or JsonException or ArgumentException){} } }
        else File.WriteAllText(ActivePath,template,new UTF8Encoding(false));
        if(!File.Exists(Path.Combine(directory,"last-good.json")))File.WriteAllText(Path.Combine(directory,"last-good.json"),Source,new UTF8Encoding(false));
        watcher=new FileSystemWatcher(directory,"active.json") { NotifyFilter=NotifyFilters.FileName|NotifyFilters.LastWrite|NotifyFilters.Size };
        watcher.Changed+=OnChange;watcher.Created+=OnChange;watcher.Renamed+=OnChange;watcher.Deleted+=OnChange;watcher.EnableRaisingEvents=true;
    }
    public double Height { get {using var value=JsonDocument.Parse(Source);return value.RootElement.GetProperty("card").GetProperty("height").GetDouble();} }
    public void Apply(string next)
    {
        Validate(next);if(Source==next && File.Exists(ActivePath))return;
        var temporary=Path.Combine(DirectoryPath,Guid.NewGuid().ToString("N")+".tmp");
        try {File.WriteAllText(temporary,next,new UTF8Encoding(false));File.Move(temporary,ActivePath,true);Source=next;File.WriteAllText(Path.Combine(DirectoryPath,"last-good.json"),next,new UTF8Encoding(false));}
        finally {if(File.Exists(temporary))File.Delete(temporary);}
    }
    private string Read() {if(new FileInfo(ActivePath).Length>MaxBytes)throw new ArgumentException("JSON: maximum 2 MB");return File.ReadAllText(ActivePath);}
    public void Validate(string source)
    {
        if(Encoding.UTF8.GetByteCount(source)>MaxBytes)throw new ArgumentException("JSON: maximum 2 MB");
        using var actual=JsonDocument.Parse(source);using var sample=JsonDocument.Parse(template);
        Validate(actual.RootElement,sample.RootElement,"");
        var card=actual.RootElement.GetProperty("card");
        if(new[]{"width","textWidth","height"}.Min(key=>card.GetProperty(key).GetDouble())-2*(card.GetProperty("padding").GetDouble()+card.GetProperty("borderWidth").GetDouble())<48)throw new ArgumentException("card: content area must be at least 48 px");
    }
    private static void Validate(JsonElement value,JsonElement model,string path)
    {
        void Fail()=>throw new ArgumentException("Invalid skin: "+path);
        if(model.ValueKind==JsonValueKind.Object)
        {
            if(value.ValueKind!=JsonValueKind.Object){Fail();return;}
            var keys=new HashSet<string>();
            foreach(var field in value.EnumerateObject())
            {
                if(!keys.Add(field.Name))Fail();
                if(path==""&&field.Name=="background")
                {
                    var background=field.Value;
                    if(background.ValueKind!=JsonValueKind.Object || background.EnumerateObject().Count()!=2 || !background.TryGetProperty("image",out var image) || !background.TryGetProperty("fit",out var fit) || fit.ValueKind!=JsonValueKind.String || fit.GetString() is not ("contain" or "cover") || image.ValueKind!=JsonValueKind.String || !ValidRaster(image.GetString()!))Fail();
                }
                else if(!model.TryGetProperty(field.Name,out _))Fail();
            }
            foreach(var field in model.EnumerateObject())
            {if(!value.TryGetProperty(field.Name,out var item))throw new ArgumentException("Missing field: "+path+"."+field.Name);Validate(item,field.Value,path.Length==0?field.Name:path+"."+field.Name);}
        }
        else if(model.ValueKind is JsonValueKind.True or JsonValueKind.False) {if(value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))Fail();}
        else if(model.ValueKind==JsonValueKind.Number)
        {var range=Limits.GetValueOrDefault(path,(1,1));if(value.ValueKind!=JsonValueKind.Number||!value.TryGetDouble(out var number)||!double.IsFinite(number)||number<range.Item1||number>range.Item2)Fail();}
        else if(model.ValueKind==JsonValueKind.String)
        {
            if(value.ValueKind!=JsonValueKind.String){Fail();return;}var text=value.GetString()!;
            if(path=="name"){if(string.IsNullOrWhiteSpace(text)||text.Length>60)Fail();}
            else if(path=="card.imageFit"){if(text is not ("cover" or "contain"))Fail();}
            else if(!Regex.IsMatch(text,"^#[a-fA-F0-9]{6}([a-fA-F0-9]{2})?$"))Fail();
        }
        else Fail();
    }
    private static bool ValidRaster(string image)
    {
        var match=Regex.Match(image,@"^data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$");if(!match.Success)return false;
        try {var data=Convert.FromBase64String(match.Groups[2].Value);return match.Groups[1].Value switch {"png"=>data.AsSpan().StartsWith(new byte[]{137,80,78,71,13,10,26,10}),"jpeg"=>data.AsSpan().StartsWith(new byte[]{255,216,255}),_=>data.Length>=12&&Encoding.ASCII.GetString(data,0,4)=="RIFF"&&Encoding.ASCII.GetString(data,8,4)=="WEBP"};}catch(FormatException){return false;}
    }
    private void OnChange(object sender,FileSystemEventArgs e)
    {
        debounce?.Dispose();debounce=new Timer(_=>{try{var next=Read();Validate(next);if(next!=Source)Changed?.Invoke(next);}catch(Exception ex) when(ex is IOException or UnauthorizedAccessException or JsonException or ArgumentException){Invalid?.Invoke(ex.Message);}},null,250,Timeout.Infinite);
    }
    public void Dispose(){watcher.EnableRaisingEvents=false;watcher.Dispose();debounce?.Dispose();}
}
