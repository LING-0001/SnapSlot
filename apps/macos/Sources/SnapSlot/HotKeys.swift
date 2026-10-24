import AppKit
import Carbon
import SnapSlotCore

final class HotKeys {
    private var handler: EventHandlerRef?
    private var references: [EventHotKeyRef] = []
    private var desired: AppPreferences?
    private let opening: Shortcut
    var action: ((UInt32) -> Void)?
    init(opening:Shortcut = .open) {
        self.opening=opening
        var type=EventTypeSpec(eventClass:OSType(kEventClassKeyboard),eventKind:UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(),{ _,event,context in
            guard let event,let context else{return OSStatus(eventNotHandledErr)}
            var id=EventHotKeyID()
            GetEventParameter(event,EventParamName(kEventParamDirectObject),EventParamType(typeEventHotKeyID),nil,MemoryLayout<EventHotKeyID>.size,nil,&id)
            Unmanaged<HotKeys>.fromOpaque(context).takeUnretainedValue().action?(id.id);return noErr
        },1,&type,Unmanaged.passUnretained(self).toOpaque(),&handler)
    }
    private func clear() {references.forEach{UnregisterEventHotKey($0)};references.removeAll()}
    private func register(_ preferences:AppPreferences) throws {
        let letters:[UInt32]=[0,11,8,2,14,3,5,4,34,38,40,37,46,45,31,35,12,15,1,17,32,9,13,7,16,6]
        let digits:[UInt32]=[29,18,19,20,21,23,22,26,28,25]
        let functions:[UInt32]=[122,120,99,118,96,97,98,100,101,109,103]
        for (id,shortcut) in [(UInt32(1),opening),(3,preferences.textShortcut)] {
            let key:UInt32
            if shortcut.key=="Space" {key=49}
            else if shortcut.key.hasPrefix("Key"),let scalar=shortcut.key.last?.asciiValue {key=letters[Int(scalar)-65]}
            else if shortcut.key.hasPrefix("Digit"),let number=Int(shortcut.key.suffix(1)) {key=digits[number]}
            else if let number=Int(shortcut.key.dropFirst()),(1...11).contains(number) {key=functions[number-1]}
            else {throw PreferencesError.invalidShortcut}
            let modifiers=UInt32((shortcut.control ? controlKey:0) | (shortcut.alt ? optionKey:0) | (shortcut.shift ? shiftKey:0) | (shortcut.meta ? cmdKey:0))
            var reference:EventHotKeyRef?
            let result=RegisterEventHotKey(key,modifiers,EventHotKeyID(signature:0x53534c54,id:id),GetApplicationEventTarget(),0,&reference)
            guard result==noErr,let reference else {throw NSError(domain:"SnapSlot.HotKey",code:Int(result),userInfo:[NSLocalizedDescriptionKey:"\(shortcut.display) — "+(Locale.preferredLanguages.first?.hasPrefix("zh")==true ? "快捷键已被占用，请换一个组合。":"Shortcut unavailable. Choose another combination.")])}
            references.append(reference)
        }
    }
    func apply(_ preferences:AppPreferences) throws {
        try preferences.validate();let previous=desired;clear()
        do {try register(preferences);desired=preferences}
        catch {clear();if let previous {do{try register(previous)}catch{clear()}};throw error}
    }
    deinit {clear();if let handler{RemoveEventHandler(handler)}}
}
