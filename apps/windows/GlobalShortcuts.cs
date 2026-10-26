using System;
using System.Collections.Generic;

namespace SnapSlot;

internal sealed record ShortcutChange(string Target,Shortcut Requested,Shortcut Replacement);
internal sealed record ShortcutResolution(AppPreferences Preferences,IReadOnlyList<ShortcutChange> Changes);

// Registration succeeds before a replacement is reported or persisted.
internal sealed class GlobalShortcuts(Func<int,Shortcut,bool> register,Action clear)
{
    private AppPreferences? current;
    public void Suspend()=>clear();
    public void Apply(AppPreferences value)
    {
        value.Validate();var previous=current;clear();
        try{Register(value);current=value;}
        catch{Restore(previous);throw;}
    }
    private void Register(AppPreferences value)
    {
        foreach(var pair in new[]{(1,value.OpenShortcut),(3,value.TextShortcut)})
            if(!register(pair.Item1,pair.Item2))throw new InvalidOperationException(pair.Item2.Display+" is already in use.");
    }
    private void Restore(AppPreferences? previous)
    {
        clear();if(previous is null)return;
        try{Register(previous);}catch{clear();}
    }
    public ShortcutResolution Resolve(AppPreferences requested,string? editing=null)
    {
        requested.TextShortcut.Validate();requested.OpenShortcut.Validate();
        var previous=current;clear();var changes=new List<ShortcutChange>();
        var effective=requested;Shortcut? taken=null;
        try{
            foreach(string target in editing=="open"?new[]{"text","open"}:new[]{"open","text"}){
                var wanted=target=="open"?requested.OpenShortcut:requested.TextShortcut;
                var selected=wanted;
                int id=target=="open"?1:3;
                if(wanted==taken||!register(id,wanted)){
                    bool found=false;
                    foreach(var candidate in Candidates(wanted)){
                        if(candidate==wanted||candidate==taken)continue;
                        if(register(id,candidate)){selected=candidate;found=true;break;}
                    }
                    if(!found)throw new InvalidOperationException("No available shortcut could be registered. Choose another combination.");
                    changes.Add(new(target,wanted,selected));
                }
                effective=target=="open"?effective with{OpenShortcut=selected}:effective with{TextShortcut=selected};taken=selected;
            }
            effective.Validate();current=effective;return new(effective,changes);
        }catch{Restore(previous);throw;}
    }
    private static IEnumerable<Shortcut> Candidates(Shortcut requested)
    {
        yield return new(requested.Key,true,true,true);
        yield return new(requested.Key,true,false,true,true);
        yield return new(requested.Key,true,true,true,true);
        for(int key=6;key<=11;key++)yield return new("F"+key,true,true,true);
    }
}
