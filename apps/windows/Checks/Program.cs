using System;
using System.IO;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using SnapSlot;

static void Check(bool value,string description){if(!value)throw new Exception(description);Console.WriteLine("PASS: "+description);}
static void Reject(Action action){try{action();}catch(ArgumentException){return;}catch(System.Text.Json.JsonException){return;}throw new Exception("Expected rejection");}
var uiRoot=Path.GetFullPath(args.Length>0?args[0]:"artifacts/native-ui");
var root=Path.Combine(Path.GetTempPath(),"SnapSlot-Checks-"+Guid.NewGuid().ToString("N"));
try
{
    using var store=new SkinStore(root,uiRoot);var original=store.Source;store.Validate(original);
    var value=JsonNode.Parse(original)!;value["card"]!["height"]=180;var next=value.ToJsonString();store.Apply(next);
    Check(store.Height==180,"Skin geometry applies and persists");
    var invalid=JsonNode.Parse(original)!;invalid["card"]!["width"]=99;Reject(()=>store.Apply(invalid.ToJsonString()));
    invalid=JsonNode.Parse(original)!;invalid["pin"]!["enabled"]=1;Reject(()=>store.Apply(invalid.ToJsonString()));
    invalid=JsonNode.Parse(original)!;invalid["schemaVersion"]=2;Reject(()=>store.Apply(invalid.ToJsonString()));
    invalid=JsonNode.Parse(original)!;invalid["script"]="alert(1)";Reject(()=>store.Apply(invalid.ToJsonString()));
    invalid=JsonNode.Parse(original)!;invalid["background"]=JsonNode.Parse("{\"image\":\"https://example.com/art.png\",\"fit\":\"cover\"}");Reject(()=>store.Apply(invalid.ToJsonString()));
    Reject(()=>store.Validate(new string(' ',SkinStore.MaxBytes+1)));
    Check(store.Source==next,"Invalid fields, unsafe images and oversized JSON preserve the last good skin");
    var validSignal=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    var invalidSignal=new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    store.Changed+=source=>{store.Apply(source);validSignal.TrySetResult();};store.Invalid+=_=>invalidSignal.TrySetResult();
    File.WriteAllText(store.ActivePath,original);
    await validSignal.Task.WaitAsync(TimeSpan.FromSeconds(5));Check(store.Height==136,"In-place JSON edits reload through FileSystemWatcher");
    File.WriteAllText(store.ActivePath,"{}");await invalidSignal.Task.WaitAsync(TimeSpan.FromSeconds(5));Check(store.Height==136,"Invalid watched edits retain the valid skin");
    using var reopened=new SkinStore(root,uiRoot);Check(reopened.Height==136,"Restart recovers the persisted last good skin while active.json is invalid");
    string settingsPath=Path.Combine(root,"preferences.json");var preferences=new PreferencesStore(settingsPath);
    Check(preferences.Value.CollectScreenshots&&preferences.Value.CaptureShortcut==new Shortcut("KeyS",Control:true,Alt:false,Shift:true),"Screenshot intake defaults on with separate screenshot/text shortcuts");
    var changed=preferences.Value with{CollectScreenshots=false,TextShortcut=new("KeyC",Shift:true)};preferences.Save(changed);
    Check(new PreferencesStore(settingsPath).Value==changed,"Native preferences survive restart");
    Reject(()=>preferences.Save(changed with{CaptureShortcut=changed.TextShortcut}));
    Reject(()=>preferences.Save(changed with{TextShortcut=Shortcut.Open}));
    Reject(()=>preferences.Save(changed with{TextShortcut=new("KeyT",false,false,true)}));
    Reject(()=>preferences.Save(changed with{TextShortcut=new("KeyC",true,false)}));
    Check(new PreferencesStore(settingsPath).Value==changed,"Duplicate, reserved and modifier-free bindings do not overwrite settings");
    Reject(()=>System.Text.Json.JsonSerializer.Deserialize<AppPreferences>("{}",PreferencesStore.Json));
    Check(!EdgeWatcher.ShouldSuppressReveal(0,0,1920,1080,0,0,1920,1080,true),"Maximized foreground windows do not suppress top-edge reveal");
    Check(EdgeWatcher.ShouldSuppressReveal(0,0,1920,1080,0,0,1920,1080,false),"Borderless full-screen foreground windows suppress top-edge reveal");
    Check(!EdgeWatcher.IsPointerWithinRail(100,185,0,0,1920,184),"Pointer below the visible rail starts dismissal");
    Check(EdgeWatcher.IsAtTopEdge(-120,0,-120,0,900),"Top-edge detection supports a monitor with a negative origin");
    Check(!EdgeWatcher.IsAtTopEdge(900,0,-120,0,900),"Top-edge detection excludes the adjacent monitor boundary");
    var dwell=new EdgeDwell();var start=DateTime.UnixEpoch;
    Check(!dwell.Update(true,true,start),"Top-edge dwell does not reveal immediately");
    Check(!dwell.Update(true,true,start.AddMilliseconds(499)),"Top-edge dwell waits the full 500 ms");
    Check(dwell.Update(true,true,start.AddMilliseconds(500)),"Top-edge dwell reveals after 500 ms");
    Check(!dwell.Update(false,true,start.AddMilliseconds(550))&&!dwell.Update(true,true,start.AddMilliseconds(600)),"Leaving the edge resets the dwell timer");
}
finally{Directory.Delete(root,true);}
