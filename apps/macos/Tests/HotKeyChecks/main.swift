import AppKit
import Carbon
import SnapSlotCore

func check(_ condition:Bool,_ message:String) throws {
    guard condition else {throw NSError(domain:"SnapSlot.HotKeyChecks",code:1,userInfo:[NSLocalizedDescriptionKey:message])}
    print("PASS: "+message)
}
func binding(_ number:Int)->Shortcut {Shortcut(key:"F\(number)",shift:true,meta:true)}
let occupied=AppPreferences(textShortcut:binding(7),openShortcut:binding(5))

// A separate process matters: Carbon rejects duplicate registrations within one
// app even in shared mode, which hid this regression in the original smoke check.
if CommandLine.arguments.contains("--peer") {
    do {
        let keys=HotKeys();try keys.apply(occupied)
        FileHandle.standardOutput.write(Data("ready\n".utf8))
        _ = FileHandle.standardInput.readData(ofLength:1)
        withExtendedLifetime(keys) {}
        exit(0)
    } catch {fputs("Peer failed: \(error)\n",stderr);exit(1)}
}

let peer=Process(),input=Pipe(),output=Pipe()
peer.executableURL=URL(fileURLWithPath:CommandLine.arguments[0])
peer.arguments=["--peer"];peer.standardInput=input;peer.standardOutput=output
do {
    try peer.run()
    defer {
        try? input.fileHandleForWriting.write(contentsOf:Data([0]))
        try? input.fileHandleForWriting.close()
        peer.waitUntilExit()
    }
    let ready=output.fileHandleForReading.readData(ofLength:6)
    try check(String(data:ready,encoding:.utf8)=="ready\n","Independent process holds the competing global shortcuts")
    var shared:EventHotKeyRef?
    let accepted=RegisterEventHotKey(98,UInt32(controlKey|optionKey|shiftKey|cmdKey),EventHotKeyID(signature:0x53535453,id:1),GetApplicationEventTarget(),0,&shared)
    if let shared {UnregisterEventHotKey(shared)}
    try check(accepted==noErr,"Regression reproduced: shared registration reports success against another app's exclusive shortcut")
    let keys=HotKeys(),probe=HotKeys()
    let previous=AppPreferences(textShortcut:binding(3),openShortcut:binding(1))
    try keys.apply(previous)
    var rejected=false
    do {try keys.apply(occupied)} catch {rejected=true}
    try check(rejected,"Exclusive registration rejects shortcuts occupied by another process")
    rejected=false
    do {try probe.apply(previous)} catch {rejected=true}
    try check(rejected,"A failed change restores both previous registrations")
    let result=try keys.resolve(occupied)
    try check(result.changes.count==2 && result.preferences.textShortcut != occupied.textShortcut && result.preferences.openShortcut != occupied.openShortcut,"Both cross-process conflicts receive replacements and notices")
    try check(result.changes.allSatisfy {change in change.requested == (change.target == .text ? occupied.textShortcut:occupied.openShortcut) && change.replacement == (change.target == .text ? result.preferences.textShortcut:result.preferences.openShortcut)},"Notices contain the requested and actually selected combinations")
    rejected=false
    do {try probe.apply(result.preferences)} catch {rejected=true}
    try check(rejected,"Reported replacement shortcuts are actually reserved")
    let editing=try keys.resolve(AppPreferences(textShortcut:result.preferences.textShortcut,openShortcut:result.preferences.textShortcut),editing:.open)
    try check(editing.preferences.textShortcut==result.preferences.textShortcut && editing.changes.count==1 && editing.changes[0].target == .open,"Editing the opening action preserves the text action")
    keys.suspend();try probe.apply(editing.preferences);probe.suspend();try keys.apply(editing.preferences)
    try check(true,"Recording releases and restores the exclusive registrations")
} catch {fputs("FAIL: \(error)\n",stderr);exit(1)}
