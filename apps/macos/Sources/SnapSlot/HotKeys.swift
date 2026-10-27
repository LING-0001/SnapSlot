import AppKit
import Carbon
import SnapSlotCore

enum ShortcutTarget: String, Codable { case text, open }
struct ShortcutChange: Codable {
    let target: ShortcutTarget
    let requested: Shortcut
    let replacement: Shortcut
}
struct ShortcutResolution {
    let preferences: AppPreferences
    let changes: [ShortcutChange]
}

/// Records only events delivered to the foreground Settings window.
/// Other applications and system shortcuts continue to handle their own keys.
final class ShortcutRecording {
    private(set) var active = false
    func begin() throws {
        guard NSApp.isActive else {
            throw NSError(domain:"SnapSlot.Recording",code:1,userInfo:[NSLocalizedDescriptionKey:Locale.preferredLanguages.first?.hasPrefix("zh")==true ? "请先激活设置窗口，再录入快捷键。":"Activate Settings before recording a shortcut."])
        }
        active=true
    }
    func end() {active=false}
    func keyMessage(_ event:NSEvent) -> [String:Any] {
        let letters:[UInt16]=[0,11,8,2,14,3,5,4,34,38,40,37,46,45,31,35,12,15,1,17,32,9,13,7,16,6]
        let digits:[UInt16]=[29,18,19,20,21,23,22,26,28,25]
        let functions:[UInt16]=[122,120,99,118,96,97,98,100,101,109,103]
        let key=event.keyCode,code:String
        if let index=letters.firstIndex(of:key) {code="Key"+String(UnicodeScalar(65+index)!)}
        else if let index=digits.firstIndex(of:key) {code="Digit\(index)"}
        else if let index=functions.firstIndex(of:key) {code="F\(index+1)"}
        else {code=key==49 ? "Space":key==53 ? "Escape":"Unknown"}
        let flags=event.modifierFlags
        return ["type":"shortcutKey","code":code,"key":code,"down":event.type == .keyDown,"control":flags.contains(.control),"alt":flags.contains(.option),"shift":flags.contains(.shift),"meta":flags.contains(.command),"repeat":event.type == .keyDown && event.isARepeat]
    }
    deinit {end()}
}

final class HotKeys {
    private var handler: EventHandlerRef?
    private var references: [EventHotKeyRef] = []
    private var desired: AppPreferences?
    var action: ((UInt32) -> Void)?
    init() {
        var type=EventTypeSpec(eventClass:OSType(kEventClassKeyboard),eventKind:UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(),{ _,event,context in
            guard let event,let context else{return OSStatus(eventNotHandledErr)}
            var id=EventHotKeyID()
            GetEventParameter(event,EventParamName(kEventParamDirectObject),EventParamType(typeEventHotKeyID),nil,MemoryLayout<EventHotKeyID>.size,nil,&id)
            Unmanaged<HotKeys>.fromOpaque(context).takeUnretainedValue().action?(id.id);return noErr
        },1,&type,Unmanaged.passUnretained(self).toOpaque(),&handler)
    }
    private func clear() {references.forEach{UnregisterEventHotKey($0)};references.removeAll()}
    private func register(_ shortcut:Shortcut,id:UInt32) throws {
        let letters:[UInt32]=[0,11,8,2,14,3,5,4,34,38,40,37,46,45,31,35,12,15,1,17,32,9,13,7,16,6]
        let digits:[UInt32]=[29,18,19,20,21,23,22,26,28,25]
        let functions:[UInt32]=[122,120,99,118,96,97,98,100,101,109,103]
        let key:UInt32
        if shortcut.key=="Space" {key=49}
        else if shortcut.key.hasPrefix("Key"),let scalar=shortcut.key.last?.asciiValue {key=letters[Int(scalar)-65]}
        else if shortcut.key.hasPrefix("Digit"),let number=Int(shortcut.key.suffix(1)) {key=digits[number]}
        else if let number=Int(shortcut.key.dropFirst()),(1...11).contains(number) {key=functions[number-1]}
        else {throw PreferencesError.invalidShortcut}
        let modifiers=UInt32((shortcut.control ? controlKey:0) | (shortcut.alt ? optionKey:0) | (shortcut.shift ? shiftKey:0) | (shortcut.meta ? cmdKey:0))
        // System shortcuts are not always represented by a Carbon registration.
        var symbolic:Unmanaged<CFArray>?
        let status=CopySymbolicHotKeys(&symbolic)
        let systemKeys=symbolic?.takeRetainedValue() as? [[String:Any]] ?? []
        if status==noErr,systemKeys.contains(where:{entry in
            (entry[kHISymbolicHotKeyEnabled as String] as? NSNumber)?.boolValue==true &&
            (entry[kHISymbolicHotKeyCode as String] as? NSNumber)?.uint32Value==key &&
            (entry[kHISymbolicHotKeyModifiers as String] as? NSNumber)?.uint32Value==modifiers
        }) {throw unavailable(shortcut,code:OSStatus(eventHotKeyExistsErr))}
        var reference:EventHotKeyRef?
        // Shared registration can succeed even when another app owns this key.
        // Request exclusivity so unavailable combinations reach the fallback path.
        let result=RegisterEventHotKey(key,modifiers,EventHotKeyID(signature:0x53534c54,id:id),GetApplicationEventTarget(),OptionBits(kEventHotKeyExclusive),&reference)
        guard result==noErr,let reference else {throw unavailable(shortcut,code:result)}
        references.append(reference)
    }
    private func unavailable(_ shortcut:Shortcut,code:OSStatus) -> NSError {
        NSError(domain:"SnapSlot.HotKey",code:Int(code),userInfo:[NSLocalizedDescriptionKey:"\(shortcut.display) — "+(Locale.preferredLanguages.first?.hasPrefix("zh")==true ? "快捷键不可用，请换一个组合。":"Shortcut unavailable. Choose another combination.")])
    }
    private func registerExact(_ value:AppPreferences) throws {
        try register(value.openShortcut,id:1);try register(value.textShortcut,id:3)
    }
    private func restore(_ previous:AppPreferences?) {
        clear();desired=previous
        if let previous {do{try registerExact(previous)}catch{clear();desired=nil}}
    }
    func apply(_ value:AppPreferences) throws {
        try value.validate();let previous=desired;clear()
        do {try registerExact(value);desired=value}
        catch {restore(previous);throw error}
    }
    /// Register real alternatives before reporting that a shortcut has changed.
    func resolve(_ requested:AppPreferences,editing:ShortcutTarget? = nil) throws -> ShortcutResolution {
        try requested.openShortcut.validate();try requested.textShortcut.validate()
        let previous=desired;clear()
        var value=requested,changes:[ShortcutChange]=[]
        do {
            let bindings:[(UInt32,ShortcutTarget,Shortcut)] = editing == .open ? [(3,.text,requested.textShortcut),(1,.open,requested.openShortcut)] : [(1,.open,requested.openShortcut),(3,.text,requested.textShortcut)]
            for (id,target,shortcut) in bindings {
                do {try register(shortcut,id:id)}
                catch {
                    let originalError=error
                    guard (error as NSError).domain=="SnapSlot.HotKey",(error as NSError).code==Int(eventHotKeyExistsErr) else{throw error}
                    let other=target == .open ? value.textShortcut:value.openShortcut
                    let alternatives=[Shortcut(key:shortcut.key,shift:true),Shortcut(key:shortcut.key,alt:false,shift:true,meta:true),Shortcut(key:shortcut.key,shift:true,meta:true)] + (6...11).map{Shortcut(key:"F\($0)",shift:true)}
                    var replacement:Shortcut?
                    for candidate in alternatives where candidate != shortcut && candidate != other {
                        do {try candidate.validate();try register(candidate,id:id);replacement=candidate;break}catch{continue}
                    }
                    guard let replacement else{throw originalError}
                    if target == .open {value.openShortcut=replacement}else{value.textShortcut=replacement}
                    changes.append(ShortcutChange(target:target,requested:shortcut,replacement:replacement))
                }
            }
            try value.validate();desired=value
            return ShortcutResolution(preferences:value,changes:changes)
        } catch {restore(previous);throw error}
    }
    func suspend() {clear()}
    deinit {clear();if let handler{RemoveEventHandler(handler)}}
}
