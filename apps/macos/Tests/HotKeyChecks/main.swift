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

// Another app can claim our bindings while our own registrations are suspended.
// Reopening settings must discover both conflicts before the user edits one.
if CommandLine.arguments.contains("--late-peer") {
    var refs:[EventHotKeyRef]=[]
    for (id,key) in [(UInt32(1),UInt32(99)),(UInt32(2),UInt32(122))] {
        var ref:EventHotKeyRef?
        let status=RegisterEventHotKey(key,UInt32(controlKey|optionKey|shiftKey|cmdKey),EventHotKeyID(signature:0x53535052,id:id),GetApplicationEventTarget(),OptionBits(kEventHotKeyExclusive),&ref)
        guard status==noErr,let ref else{exit(1)}
        refs.append(ref)
    }
    FileHandle.standardOutput.write(Data("ready\n".utf8))
    _ = FileHandle.standardInput.readData(ofLength:1)
    refs.forEach{UnregisterEventHotKey($0)}
    exit(0)
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
    try check(true,"Recording releases and restores only this app's registrations")
    keys.suspend();probe.suspend();try keys.apply(previous);keys.suspend()
    let late=Process(),lateInput=Pipe(),lateOutput=Pipe()
    late.executableURL=URL(fileURLWithPath:CommandLine.arguments[0]);late.arguments=["--late-peer"]
    late.standardInput=lateInput;late.standardOutput=lateOutput
    try late.run()
    defer{try? lateInput.fileHandleForWriting.write(contentsOf:Data([0]));late.waitUntilExit()}
    try check(String(data:lateOutput.fileHandleForReading.readData(ofLength:6),encoding:.utf8)=="ready\n","Another app claims both bindings while SnapSlot recording has released them")
    let refreshed=try keys.resolve(previous)
    try check(refreshed.changes.count==2,"Settings preflight detects both late conflicts before either shortcut is edited")
    keys.suspend()
    var symbolic:Unmanaged<CFArray>?
    _ = CopySymbolicHotKeys(&symbolic)
    let systemKeys=symbolic?.takeRetainedValue() as? [[String:Any]] ?? []
    if systemKeys.contains(where:{ ($0[kHISymbolicHotKeyEnabled as String] as? NSNumber)?.boolValue==true && ($0[kHISymbolicHotKeyCode as String] as? NSNumber)?.uint32Value==21 && ($0[kHISymbolicHotKeyModifiers as String] as? NSNumber)?.uint32Value==UInt32(shiftKey|cmdKey) }) {
        rejected=false
        do {try keys.apply(AppPreferences(textShortcut:Shortcut(key:"Digit4",control:false,alt:false,shift:true,meta:true),openShortcut:binding(2)))}catch{rejected=true}
        try check(rejected,"Enabled system screenshot shortcuts are detected without pressing them")
    }
} catch {fputs("FAIL: \(error)\n",stderr);exit(1)}
