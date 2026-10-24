import Foundation

public enum StoreError: LocalizedError {
    case invalidText, invalidImage, invalidConfiguration(String), unknownItem
    public var errorDescription: String? {
        switch self {
        case .invalidText: return "Text must be nonempty and at most 64 KB."
        case .invalidImage: return "The image could not be opened."
        case .invalidConfiguration(let field): return "Invalid configuration: \(field)"
        case .unknownItem: return "This note is no longer available."
        }
    }
}
public struct InboxItem: Identifiable {
    public let id: String
    public let title: String
    public let text: String?
    public let fileURL: URL
    public let display: String
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
    @discardableResult public func addText(_ text: String, display: String) throws -> InboxItem {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, text.utf8.count <= 65536 else { throw StoreError.invalidText }
        let id = UUID().uuidString
        let url = directory.appendingPathComponent(id + ".txt")
        try Data(text.utf8).write(to: url, options: .atomic)
        let title = String((text.components(separatedBy: .newlines).first ?? "Text").prefix(30))
        let item = InboxItem(id: id, title: title, text: text, fileURL: url, display: display)
        append(item); return item
    }
    @discardableResult public func addPNG(_ data: Data, title: String, display: String) throws -> InboxItem {
        guard data.starts(with: [137,80,78,71,13,10,26,10]) else { throw StoreError.invalidImage }
        let id = UUID().uuidString, url = directory.appendingPathComponent(UUID().uuidString + ".png")
        try data.write(to: url, options: .atomic)
        let item = InboxItem(id: id, title: title, text: nil, fileURL: url, display: display)
        append(item); return item
    }
    private func append(_ item: InboxItem) {
        items.append(item)
        if items.count > Self.capacity { items.removeFirst(items.count - Self.capacity) }
    }
    public func clear() { items.removeAll() }
    public func item(id: String) throws -> InboxItem {
        guard let item = items.first(where: { $0.id == id }) else { throw StoreError.unknownItem }; return item
    }
    public func remove(id: String) { items.removeAll { $0.id == id } }
    // Keep exported files alive after removal: external applications may still be reading a dropped copy.
    public func cleanup() { try? FileManager.default.removeItem(at: directory) }
}
