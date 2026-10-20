import Foundation

public struct Shortcut: Codable, Equatable, Hashable {
    public var key: String
    public var control: Bool
    public var alt: Bool
    public var shift: Bool
    public var meta: Bool
    public init(key: String, control: Bool = true, alt: Bool = true, shift: Bool = false, meta: Bool = false) {
        self.key=key; self.control=control; self.alt=alt; self.shift=shift; self.meta=meta
    }
    public static let open = Shortcut(key:"Space")
    public var display: String {
        (control ? "⌃":"") + (alt ? "⌥":"") + (shift ? "⇧":"") + (meta ? "⌘":"") + (key=="Space" ? "Space":key.replacingOccurrences(of:"Key",with:"").replacingOccurrences(of:"Digit",with:""))
    }
    public func validate() throws {
        let keys = (65...90).map {"Key"+String(UnicodeScalar($0)!)} + (0...9).map {"Digit\($0)"} + (1...11).map {"F\($0)"} + ["Space"]
        guard keys.contains(key),control || alt || meta else {throw PreferencesError.invalidShortcut}
        if key=="KeyC",!alt,!shift,control != meta {throw PreferencesError.systemCopyShortcut}
    }
}
public enum PreferencesError: LocalizedError {
    case invalidShortcut, duplicateShortcut, systemCopyShortcut
    public var errorDescription: String? {
        switch self {
        case .invalidShortcut:return "Use Control, Option/Alt or Command/Win with a letter, number, Space or F1–F11."
        case .duplicateShortcut:return "Shortcuts must be different. Control+Option/Alt+Space is reserved for opening notes."
        case .systemCopyShortcut:return "Keep Command+C / Ctrl+C available for ordinary Copy. Choose another shortcut."
        }
    }
}
public struct AppPreferences: Codable, Equatable {
    public var collectScreenshots: Bool
    public var captureShortcut: Shortcut
    public var textShortcut: Shortcut
    public init(collectScreenshots:Bool=true,captureShortcut:Shortcut=Shortcut(key:"KeyS"),textShortcut:Shortcut=Shortcut(key:"KeyT")) {
        self.collectScreenshots=collectScreenshots;self.captureShortcut=captureShortcut;self.textShortcut=textShortcut
    }
    public func validate() throws {
        try captureShortcut.validate();try textShortcut.validate()
        guard captureShortcut != textShortcut,captureShortcut != .open,textShortcut != .open else{throw PreferencesError.duplicateShortcut}
    }
}
public final class PreferencesStore {
    public let url: URL
    public private(set) var value: AppPreferences
    public init(url:URL,legacyCollection:Bool=true) {
        self.url=url
        if let data=try? Data(contentsOf:url),let value=try? JSONDecoder().decode(AppPreferences.self,from:data),(try? value.validate()) != nil {self.value=value}
        else {value=AppPreferences(collectScreenshots:legacyCollection)}
    }
    public func save(_ next:AppPreferences) throws {
        try next.validate();try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true)
        let encoder=JSONEncoder();encoder.outputFormatting=[.prettyPrinted,.sortedKeys]
        try encoder.encode(next).write(to:url,options:.atomic);value=next
    }
}
