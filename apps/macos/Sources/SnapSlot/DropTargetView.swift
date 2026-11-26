import AppKit
import ImageIO
import UniformTypeIdentifiers

enum DroppedPayload {
    case image(pngData: Data, title: String, fileStem: String?, width: Int, height: Int, thumbnail: String)
    case text(String)
}

final class DropTargetView: NSView {
    var onDragHoverChanged: ((Bool) -> Void)?
    var onDropped: (([DroppedPayload]) -> Void)?

    private static let textExtensions: Set<String> = ["txt", "md", "markdown", "json", "csv", "log", "xml", "yaml", "yml", "swift", "ts", "tsx", "js", "py", "cs", "html", "css"]

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        registerForDraggedTypes([.fileURL, .png, .tiff, .string])
        isHidden = true
    }

    required init?(coder: NSCoder) { nil }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        guard canAccept(sender.draggingPasteboard) else { return [] }
        onDragHoverChanged?(true)
        return .copy
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        canAccept(sender.draggingPasteboard) ? .copy : []
    }

    override func draggingExited(_ sender: NSDraggingInfo?) {
        onDragHoverChanged?(false)
    }

    override func draggingEnded(_ sender: NSDraggingInfo) {
        onDragHoverChanged?(false)
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        let pasteboard = sender.draggingPasteboard
        let payloads = extractPayloads(from: pasteboard)
        onDragHoverChanged?(false)
        guard !payloads.isEmpty else { return false }
        onDropped?(payloads)
        return true
    }

    private func canAccept(_ pasteboard: NSPasteboard) -> Bool {
        guard let types = pasteboard.types else { return false }
        return types.contains(.fileURL) || types.contains(.png) || types.contains(.tiff) || types.contains(.string)
    }

    private func extractPayloads(from pasteboard: NSPasteboard) -> [DroppedPayload] {
        var results: [DroppedPayload] = []
        if let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL], !urls.isEmpty {
            for url in urls.prefix(8) {
                guard let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey]),
                      values.isRegularFile == true else { continue }
                let size = values.fileSize ?? 0
                if size > 0 && size <= 100 * 1024 * 1024,
                   let source = CGImageSourceCreateWithURL(url as CFURL, nil),
                   let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil),
                   let png = encodePNG(cgImage) {
                    let thumb = ClipboardIntake.encodeThumbnailDataURI(from: cgImage)
                    let stem = url.deletingPathExtension().lastPathComponent
                    results.append(.image(pngData: png, title: url.lastPathComponent, fileStem: stem, width: cgImage.width, height: cgImage.height, thumbnail: thumb))
                    continue
                }
                let ext = url.pathExtension.lowercased()
                if Self.textExtensions.contains(ext), size > 0 && size <= 65536,
                   let text = try? String(contentsOf: url, encoding: .utf8),
                   !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    results.append(.text(text))
                }
            }
            if !results.isEmpty { return results }
        }
        if let data = pasteboard.data(forType: .png) ?? pasteboard.data(forType: .tiff),
           data.count <= 100 * 1024 * 1024,
           let source = CGImageSourceCreateWithData(data as CFData, nil),
           let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil),
           let png = encodePNG(cgImage) {
            let thumb = ClipboardIntake.encodeThumbnailDataURI(from: cgImage)
            let title = ClipboardIntake.formatImageTitle(appName: nil, width: cgImage.width, height: cgImage.height)
            results.append(.image(pngData: png, title: title, fileStem: nil, width: cgImage.width, height: cgImage.height, thumbnail: thumb))
            return results
        }
        if let text = pasteboard.string(forType: .string),
           !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           text.utf8.count <= 65536 {
            results.append(.text(text))
        }
        return results
    }

    private func encodePNG(_ image: CGImage) -> Data? {
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.png.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, nil)
        guard CGImageDestinationFinalize(dest) else { return nil }
        return out as Data
    }
}
