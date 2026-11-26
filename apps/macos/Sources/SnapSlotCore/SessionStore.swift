import Foundation
import CryptoKit

public enum StoreError: LocalizedError {
    case invalidText, invalidImage, invalidConfiguration(String), unknownItem
    public var errorKey: String? {
        switch self {
        case .invalidText: return "err.invalidText"
        case .invalidImage: return "err.invalidImage"
        case .unknownItem: return "err.unknownItem"
        case .invalidConfiguration: return nil
        }
    }
    public var errorDescription: String? {
        switch self {
        case .invalidText: return "Text must be nonempty and at most 64 KB."
        case .invalidImage: return "The image could not be opened."
        case .invalidConfiguration(let field): return "Invalid configuration: \(field)"
        case .unknownItem: return "This note is no longer available."
        }
    }
}

public enum SemVer {
    public static func parse(_ raw: String) -> [Int]? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let stripped = trimmed.hasPrefix("v") || trimmed.hasPrefix("V") ? String(trimmed.dropFirst()) : trimmed
        let core = stripped.split(separator: "-", maxSplits: 1).first.map(String.init) ?? stripped
        let parts = core.split(separator: ".").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return parts
    }
    public static func isNewer(_ candidate: String, than current: String) -> Bool {
        guard let next = parse(candidate), let now = parse(current) else { return false }
        for (a, b) in zip(next, now) {
            if a != b { return a > b }
        }
        return false
    }
}

public struct InboxItem: Identifiable {
    public let id: String
    public let title: String
    public let text: String?
    public let fileURL: URL
    public let display: String
    public let contentHash: String
    public let width: Int?
    public let height: Int?
    public var kind: String { text == nil ? "image" : "text" }
}

public final class SessionStore {
    public static let capacity = 30
    public let directory: URL
    public private(set) var items: [InboxItem] = []

    public init(root: URL) throws {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        // Only UUID directories owned by this application are eligible for cleanup.
        for url in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: [.isDirectoryKey]) {
            if UUID(uuidString: url.lastPathComponent) != nil && (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true {
                try? FileManager.default.removeItem(at: url)
            }
        }
        directory = root.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    public static func sanitizeFileStem(_ raw: String, fallback: String, limit: Int = 24) -> String {
        let invalid = CharacterSet(charactersIn: "/\\:*?\"<>|").union(.controlCharacters).union(.newlines)
        let cleaned = raw
            .components(separatedBy: invalid)
            .joined(separator: " ")
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
            .trimmingCharacters(in: CharacterSet(charactersIn: ". "))
        guard !cleaned.isEmpty else { return fallback }
        return String(cleaned.prefix(limit)).trimmingCharacters(in: CharacterSet(charactersIn: ". "))
    }

    private func uniqueURL(stem: String, ext: String) -> URL {
        let base = stem.isEmpty ? "SnapSlot" : stem
        var candidate = directory.appendingPathComponent("\(base).\(ext)")
        var suffix = 2
        while FileManager.default.fileExists(atPath: candidate.path) {
            candidate = directory.appendingPathComponent("\(base)-\(suffix).\(ext)")
            suffix += 1
        }
        return candidate
    }

    private static func timestampStamp() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HHmmss"
        return formatter.string(from: Date())
    }

    private static func fullTimestampStamp() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter.string(from: Date())
    }

    private static func hashHex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    @discardableResult
    public func addText(_ text: String, display: String = "") throws -> InboxItem {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, text.utf8.count <= 65536 else {
            throw StoreError.invalidText
        }
        let payload = Data(text.utf8)
        let id = UUID().uuidString
        let firstLine = text.components(separatedBy: .newlines).first(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) ?? "Note"
        let title = String(firstLine.trimmingCharacters(in: .whitespaces).prefix(30))
        let stem = "\(Self.sanitizeFileStem(firstLine, fallback: "SnapSlot-note"))-\(Self.timestampStamp())"
        let url = uniqueURL(stem: stem, ext: "txt")
        try payload.write(to: url, options: .atomic)
        let item = InboxItem(id: id, title: title, text: text, fileURL: url, display: display, contentHash: Self.hashHex(payload), width: nil, height: nil)
        append(item)
        return item
    }

    @discardableResult
    public func updateText(id: String, text: String) throws -> InboxItem {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, text.utf8.count <= 65536 else {
            throw StoreError.invalidText
        }
        guard let index = items.firstIndex(where: { $0.id == id }), items[index].kind == "text" else {
            throw StoreError.unknownItem
        }
        let existing = items[index]
        let payload = Data(text.utf8)
        try payload.write(to: existing.fileURL, options: .atomic)
        let firstLine = text.components(separatedBy: .newlines).first(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) ?? "Note"
        let title = String(firstLine.trimmingCharacters(in: .whitespaces).prefix(30))
        let updated = InboxItem(
            id: existing.id,
            title: title,
            text: text,
            fileURL: existing.fileURL,
            display: existing.display,
            contentHash: Self.hashHex(payload),
            width: nil,
            height: nil
        )
        items[index] = updated
        // Remove any other card that now duplicates this updated text.
        items.removeAll { $0.id != updated.id && $0.kind == "text" && $0.contentHash == updated.contentHash }
        return updated
    }

    @discardableResult
    public func addPNG(_ data: Data, title: String, display: String = "", width: Int? = nil, height: Int? = nil, fileStem: String? = nil) throws -> InboxItem {
        guard data.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]) else { throw StoreError.invalidImage }
        let id = UUID().uuidString
        let preferredStem = fileStem.map { Self.sanitizeFileStem($0, fallback: "SnapSlot-\(Self.fullTimestampStamp())", limit: 36) }
            ?? "SnapSlot-\(Self.fullTimestampStamp())"
        let url = uniqueURL(stem: preferredStem, ext: "png")
        try data.write(to: url, options: .atomic)
        let item = InboxItem(id: id, title: title, text: nil, fileURL: url, display: display, contentHash: Self.hashHex(data), width: width, height: height)
        append(item)
        return item
    }

    private func append(_ item: InboxItem) {
        // Deduplicate exact matches by promoting the newly arrived card to the newest slot.
        items.removeAll { $0.kind == item.kind && $0.contentHash == item.contentHash }
        items.append(item)
        if items.count > Self.capacity { items.removeFirst(items.count - Self.capacity) }
    }

    public func clear() { items.removeAll() }
    public func item(id: String) throws -> InboxItem {
        guard let item = items.first(where: { $0.id == id }) else { throw StoreError.unknownItem }
        return item
    }
    public func remove(id: String) { items.removeAll { $0.id == id } }
    // Keep exported files alive after removal: external applications may still be reading a dropped copy.
    public func cleanup() { try? FileManager.default.removeItem(at: directory) }
}
