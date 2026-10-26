using System;
using System.IO;
using SnapSlot;

static void Check(bool value,string description){if(!value)throw new Exception(description);Console.WriteLine("PASS: "+description);}
static void Reject(Action action){try{action();}catch(ArgumentException){return;}catch(System.Text.Json.JsonException){return;}throw new Exception("Expected rejection");}
var root=Path.Combine(Path.GetTempPath(),"SnapSlot-Checks-"+Guid.NewGuid().ToString("N"));
try
{
    string settingsPath=Path.Combine(root,"preferences.json");var preferences=new PreferencesStore(settingsPath);
    Check(preferences.Value.CollectImages&&preferences.Value.TextShortcut==new Shortcut("KeyT"),"Clipboard image intake defaults on with the website text shortcut");
    var changed=preferences.Value with{CollectImages=false,TextShortcut=new("KeyC",Shift:true)};preferences.Save(changed);
    Check(new PreferencesStore(settingsPath).Value==changed,"Native preferences survive restart");
    Reject(()=>preferences.Save(changed with{TextShortcut=Shortcut.Open}));
    Reject(()=>preferences.Save(changed with{TextShortcut=new("KeyT",false,false,true)}));
    Reject(()=>preferences.Save(changed with{TextShortcut=new("KeyC",true,false)}));
    Check(new PreferencesStore(settingsPath).Value==changed,"Reserved and modifier-free bindings do not overwrite settings");
    File.WriteAllText(settingsPath,"{\"collectScreenshots\":false,\"captureShortcut\":{\"key\":\"KeyS\",\"control\":true,\"alt\":true,\"shift\":false,\"meta\":false},\"textShortcut\":{\"key\":\"KeyT\",\"control\":true,\"alt\":true,\"shift\":false,\"meta\":false}}");
    var migrated=new PreferencesStore(settingsPath);Check(!migrated.Value.CollectImages&&migrated.Value.TextShortcut==new Shortcut("KeyT"),"Old preferences preserve the image collection choice and text shortcut");
    migrated.Save(migrated.Value);Check(!File.ReadAllText(settingsPath).Contains("captureShortcut")&&!File.ReadAllText(settingsPath).Contains("collectScreenshots"),"Saving migrated preferences removes obsolete fields");
    Reject(()=>System.Text.Json.JsonSerializer.Deserialize<AppPreferences>("{}",PreferencesStore.Json));
    Check(!NotesGeometry.ShouldSuppressReveal(0,0,1920,1080,0,0,1920,1080,true),"Maximized foreground windows do not suppress top-edge reveal");
    Check(NotesGeometry.ShouldSuppressReveal(0,0,1920,1080,0,0,1920,1080,false),"Borderless full-screen foreground windows suppress top-edge reveal");
    Check(!NotesGeometry.IsPointerWithinRail(100,185,0,0,1920,184),"Pointer below the visible rail starts dismissal");
    Check(NotesGeometry.IsAtTopEdge(-120,0,-120,0,900),"Top-edge detection supports a monitor with a negative origin");
    Check(!NotesGeometry.IsAtTopEdge(900,0,-120,0,900),"Top-edge detection excludes the adjacent monitor boundary");
    var dwell=new EdgeDwell();var start=DateTime.UnixEpoch;
    Check(!dwell.Update(true,true,start),"Top-edge dwell does not reveal immediately");
    Check(!dwell.Update(true,true,start.AddMilliseconds(499)),"Top-edge dwell waits the full 500 ms");
    Check(dwell.Update(true,true,start.AddMilliseconds(500)),"Top-edge dwell reveals after 500 ms");
    Check(!dwell.Update(false,true,start.AddMilliseconds(550))&&!dwell.Update(true,true,start.AddMilliseconds(600)),"Leaving the edge resets the dwell timer");
    var closeOnce=new CloseOnce();
    Check(closeOnce.TryBegin()&&!closeOnce.TryBegin(),"A deactivated tray window can request Close only once");
}
finally{Directory.Delete(root,true);}
