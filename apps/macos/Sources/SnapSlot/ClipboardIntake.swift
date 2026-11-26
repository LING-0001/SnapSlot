import AppKit
import ImageIO
import UniformTypeIdentifiers

/// Receives only newly written image bytes. Never scans files or starts capture.
final class ClipboardIntake {
    struct Payload {
        let pngData: Data
        let title: String
        let width: Int
        let height: Int
        let thumbnailDataURI: String
    }

    var onImage: ((Payload) -> Void)?
    private let clipboard: NSPasteboard
    private let worker = DispatchQueue(label: "app.snapslot.clipboard-decode", qos: .userInitiated)
    private var timer: Timer?
    private var clipboardCount = 0
    private var generation = UUID()
    private(set) var running = false

    init(clipboard: NSPasteboard = .general) { self.clipboard = clipboard }

    func start() {
        guard !running else { return }
        running = true
        generation = UUID()
        ignoreCurrentClipboard()
        let timer = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in self?.checkClipboard() }
        self.timer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    func stop() {
        running = false
        generation = UUID()
        timer?.invalidate()
        timer = nil
    }

    func ignoreCurrentClipboard() { clipboardCount = clipboard.changeCount }

    static func encodeThumbnailDataURI(from cgImage: CGImage, maxEdge: CGFloat = 560) -> String {
        let w = CGFloat(cgImage.width), h = CGFloat(cgImage.height)
        guard w > 0, h > 0 else { return "" }
        let ratio = min(1, maxEdge / max(w, h))
        let targetW = max(1, Int((w * ratio).rounded()))
        let targetH = max(1, Int((h * ratio).rounded()))
        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let ctx = CGContext(
                  data: nil,
                  width: targetW,
                  height: targetH,
                  bitsPerComponent: 8,
                  bytesPerRow: 0,
                  space: colorSpace,
                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
              ) else { return "" }
        ctx.interpolationQuality = .high
        ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: targetW, height: targetH))
        guard let scaled = ctx.makeImage() else { return "" }
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, UTType.png.identifier as CFString, 1, nil) else { return "" }
        CGImageDestinationAddImage(dest, scaled, nil)
        guard CGImageDestinationFinalize(dest) else { return "" }
        return "data:image/png;base64," + (out as Data).base64EncodedString()
    }

    static func formatImageTitle(appName: String?, width: Int, height: Int, date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        let clock = formatter.string(from: date)
        if let appName = appName?.trimmingCharacters(in: .whitespacesAndNewlines), !appName.isEmpty, appName != "SnapSlot" {
            return "\(appName) · \(clock)"
        }
        if width > 0 && height > 0 {
            return "\(width)×\(height) · \(clock)"
        }
        return "PNG · \(clock)"
    }

    private func checkClipboard() {
        guard running, clipboard.changeCount != clipboardCount else { return }
        clipboardCount = clipboard.changeCount
        guard let data = clipboard.data(forType: .png) ?? clipboard.data(forType: .tiff), data.count <= 100 * 1024 * 1024 else { return }
        let frontAppName = NSWorkspace.shared.frontmostApplication?.localizedName
        let stamp = generation
        worker.async { [weak self] in
            guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                  let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return }
            let output = NSMutableData()
            guard let destination = CGImageDestinationCreateWithData(output, UTType.png.identifier as CFString, 1, nil) else { return }
            CGImageDestinationAddImage(destination, image, nil)
            guard CGImageDestinationFinalize(destination) else { return }
            let thumb = Self.encodeThumbnailDataURI(from: image)
            let title = Self.formatImageTitle(appName: frontAppName, width: image.width, height: image.height)
            let payload = Payload(pngData: output as Data, title: title, width: image.width, height: image.height, thumbnailDataURI: thumb)
            DispatchQueue.main.async {
                guard let self, self.running, self.generation == stamp else { return }
                self.onImage?(payload)
            }
        }
    }

    deinit { timer?.invalidate() }
}
