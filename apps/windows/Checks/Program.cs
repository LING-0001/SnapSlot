using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using SnapSlot;

static void Check(bool value,string description){if(!value)throw new Exception(description);Console.WriteLine("PASS: "+description);}
static void Reject(Action action){try{action();}catch(ArgumentException){return;}catch(System.Text.Json.JsonException){return;}throw new Exception("Expected rejection");}
var root=Path.Combine(Path.GetTempPath(),"SnapSlot-Checks-"+Guid.NewGuid().ToString("N"));
try
{
    string settingsPath=Path.Combine(root,"preferences.json");var preferences=new PreferencesStore(settingsPath);
    Check(preferences.Value.CollectImages&&preferences.Value.TextShortcut==new Shortcut("KeyT"),"Clipboard image intake defaults on with the website text shortcut");
    var changed=preferences.Value with{CollectImages=false,TextShortcut=new("KeyC",Shift:true),OpenShortcut=new("KeyO",Shift:true)};preferences.Save(changed);
    Check(new PreferencesStore(settingsPath).Value==changed,"Native preferences survive restart");
    Reject(()=>preferences.Save(changed with{TextShortcut=changed.OpenShortcut}));
    Reject(()=>preferences.Save(changed with{TextShortcut=new("KeyT",false,false,true)}));
    Reject(()=>preferences.Save(changed with{TextShortcut=new("KeyC",true,false)}));
    Check(new PreferencesStore(settingsPath).Value==changed,"Reserved and modifier-free bindings do not overwrite settings");
    File.WriteAllText(settingsPath,"{\"collectScreenshots\":false,\"captureShortcut\":{\"key\":\"KeyS\",\"control\":true,\"alt\":true,\"shift\":false,\"meta\":false},\"textShortcut\":{\"key\":\"KeyT\",\"control\":true,\"alt\":true,\"shift\":false,\"meta\":false}}");
    var migrated=new PreferencesStore(settingsPath);Check(!migrated.Value.CollectImages&&migrated.Value.TextShortcut==new Shortcut("KeyT"),"Old preferences preserve the image collection choice and text shortcut");
    Check(migrated.Value.OpenShortcut==Shortcut.Open,"Old preferences migrate the default opening shortcut");
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
    var occupied=new HashSet<Shortcut>{Shortcut.Open,new("KeyT")};
    var registered=new Dictionary<int,Shortcut>();
    bool Register(int id,Shortcut binding){if(occupied.Contains(binding)||registered.Values.Contains(binding))return false;registered.Add(id,binding);return true;}
    var keys=new GlobalShortcuts(Register,()=>registered.Clear());
    var resolved=keys.Resolve(AppPreferences.Default);
    Check(resolved.Changes.Count==2&&registered[1]==resolved.Preferences.OpenShortcut&&registered[3]==resolved.Preferences.TextShortcut,"Both occupied actions get replacements that have actually been registered");
    Check(resolved.Changes.All(change=>change.Requested!=change.Replacement),"Conflict notices contain both requested and effective combinations");
    var editing=keys.Resolve(resolved.Preferences with{OpenShortcut=resolved.Preferences.TextShortcut},"open");
    Check(editing.Preferences.TextShortcut==resolved.Preferences.TextShortcut&&editing.Changes.Single().Target=="open","Editing one action preserves the other action even when the chosen combination is the same");
    var before=editing.Preferences;
    try{keys.Apply(AppPreferences.Default);throw new Exception("Occupied registration must fail");}catch(InvalidOperationException){}
    Check(registered[1]==before.OpenShortcut&&registered[3]==before.TextShortcut,"Failed strict registration restores both previous actions");
    keys.Suspend();Check(registered.Count==0,"Recording releases this app's global shortcuts");
    keys.Apply(before);Check(registered.Count==2,"Cancelling recording restores both shortcuts");
    var impossible=new GlobalShortcuts((_,_)=>false,()=>{});
    try{impossible.Resolve(AppPreferences.Default);throw new Exception("All occupied bindings must fail");}catch(InvalidOperationException){}
    Check(true,"Exhausted alternatives fail without reporting an unregistered shortcut");
    var closeOnce=new CloseOnce();
    Check(closeOnce.TryBegin()&&!closeOnce.TryBegin(),"A deactivated tray window can request Close only once");
}
finally{Directory.Delete(root,true);}
