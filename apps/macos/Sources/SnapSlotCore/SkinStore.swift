import Foundation
import CoreFoundation

public enum SkinDocument {
    public static let maxBytes = 2 * 1024 * 1024
    private static let limits: [String: ClosedRange<Double>] = [
        "card.width":100...480,"card.textWidth":100...480,"card.height":80...280,"card.gap":8...64,"card.padding":2...24,"card.radius":0...48,"card.borderWidth":0...8,"card.fontSize":12...24,
        "shadow.blur":0...48,"shadow.offsetY":0...24,"pin.width":8...40,"pin.height":8...48,"pin.x":10...90,"pin.y":(-24)...8,"buttons.size":20...40,"buttons.inset":0...16
    ]
    public static func validate(_ source: String, template: String) throws {
        guard source.utf8.count <= maxBytes else { throw StoreError.invalidSkin("maximum 2 MB") }
        let value = try JSONSerialization.jsonObject(with: Data(source.utf8))
        let model = try JSONSerialization.jsonObject(with: Data(template.utf8))
        try validate(value, model: model, path: "")
        let root = value as! [String:Any], card = root["card"] as! [String:Any]
        let inner = min((card["width"] as! NSNumber).doubleValue, (card["textWidth"] as! NSNumber).doubleValue, (card["height"] as! NSNumber).doubleValue) - 2 * ((card["padding"] as! NSNumber).doubleValue + (card["borderWidth"] as! NSNumber).doubleValue)
        guard inner >= 48 else { throw StoreError.invalidSkin("card content must be at least 48 px") }
    }
    private static func validate(_ value: Any, model: Any, path: String) throws {
        func fail() throws -> Never { throw StoreError.invalidSkin(path.isEmpty ? "root" : path) }
        if let expected = model as? [String:Any] {
            guard let actual = value as? [String:Any] else { try fail() }
            for key in actual.keys where expected[key] == nil {
                guard path.isEmpty, key == "background", let background = actual[key] as? [String:Any], Set(background.keys) == Set(["image","fit"]), let image = background["image"] as? String, let fit = background["fit"] as? String, ["cover","contain"].contains(fit), validRaster(image) else { try fail() }
            }
            for (key,sample) in expected {
                guard let field = actual[key] else { throw StoreError.invalidSkin(path + "." + key) }
                try validate(field, model: sample, path: path.isEmpty ? key : path + "." + key)
            }
        } else if let sample = model as? NSNumber {
            guard let actual = value as? NSNumber else { try fail() }
            if CFGetTypeID(sample) == CFBooleanGetTypeID() {
                guard CFGetTypeID(actual) == CFBooleanGetTypeID() else { try fail() }
            } else {
                guard CFGetTypeID(actual) != CFBooleanGetTypeID(), actual.doubleValue.isFinite, (limits[path] ?? 1...1).contains(actual.doubleValue) else { try fail() }
            }
        } else if model is String {
            guard let actual = value as? String else { try fail() }
            if path == "name" {
                guard !actual.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, actual.utf16.count <= 60 else { try fail() }
            } else if path == "card.imageFit" {
                guard ["contain","cover"].contains(actual) else { try fail() }
            } else {
                guard actual.range(of: "^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$", options: .regularExpression) != nil else { try fail() }
            }
        } else { try fail() }
    }
    private static func validRaster(_ image: String) -> Bool {
        guard let comma = image.firstIndex(of: ","), let data = Data(base64Encoded: String(image[image.index(after:comma)...])) else { return false }
        switch String(image[..<comma]) {
        case "data:image/png;base64": return data.starts(with:[137,80,78,71,13,10,26,10])
        case "data:image/jpeg;base64": return data.starts(with:[255,216,255])
        case "data:image/webp;base64": return data.count >= 12 && data.prefix(4) == Data("RIFF".utf8) && data.subdata(in:8..<12) == Data("WEBP".utf8)
        default: return false
        }
    }
    public static func height(_ source: String) -> Double {
        guard let value = try? JSONSerialization.jsonObject(with: Data(source.utf8)) as? [String:Any], let card = value["card"] as? [String:Any], let height = card["height"] as? Double else { return 136 }
        return min(280,max(80,height))
    }
}
public final class SkinStore {
    public let directory: URL
    public let activeURL: URL
    public let template: String
    public private(set) var source: String
    public init(directory: URL, template: String) throws {
        self.directory = directory; self.template = template
        activeURL = directory.appendingPathComponent("active.json")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        source = template
        if let existing = try? String(contentsOf: activeURL, encoding: .utf8), (try? SkinDocument.validate(existing, template: template)) != nil { source = existing }
        else {
            let backup=directory.appendingPathComponent("last-good.json")
            if let existing=try? String(contentsOf:backup,encoding:.utf8),(try? SkinDocument.validate(existing,template:template)) != nil {source=existing}
            if !FileManager.default.fileExists(atPath:activeURL.path) {try Data(source.utf8).write(to:activeURL,options:.atomic)}
        }
        if !FileManager.default.fileExists(atPath:directory.appendingPathComponent("last-good.json").path) {try Data(source.utf8).write(to:directory.appendingPathComponent("last-good.json"),options:.atomic)}
    }
    public func apply(_ next: String) throws {
        try SkinDocument.validate(next, template: template)
        if source != next || !FileManager.default.fileExists(atPath: activeURL.path) {
            try Data(next.utf8).write(to: activeURL, options: .atomic)
            source = next
            try Data(next.utf8).write(to:directory.appendingPathComponent("last-good.json"),options:.atomic)
        }
    }
    public func readCandidate() throws -> String {
        let attributes = try FileManager.default.attributesOfItem(atPath: activeURL.path)
        guard (attributes[.size] as? NSNumber)?.intValue ?? 0 <= SkinDocument.maxBytes else { throw StoreError.invalidSkin("maximum 2 MB") }
        let candidate = try String(contentsOf: activeURL, encoding: .utf8)
        try SkinDocument.validate(candidate, template: template)
        return candidate
    }
}
