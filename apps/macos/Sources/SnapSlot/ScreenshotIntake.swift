import AppKit
import ImageIO
import UniformTypeIdentifiers
import CryptoKit

/// Receives newly saved system screenshots and new image-only clipboard writes.
/// Original screenshot files and the user's clipboard are never modified here.
final class ScreenshotIntake: NSObject {
    var onImage: ((Data, String) -> Void)?
    var onError: ((Error) -> Void)?
    private let clipboard: NSPasteboard
    private let folderOverride: URL?
    private let useMetadataQuery: Bool
    private let ignoredDirectory: URL?
    private let worker = DispatchQueue(label: "app.snapslot.screenshot-decode", qos: .userInitiated)
    private var query: NSMetadataQuery?
    private var watcher: DispatchSourceFileSystemObject?
    private var timer: Timer?
    private var directory: URL?
    private var pending: [URL: DispatchWorkItem] = [:]
    private var seen = Set<URL>()
    private var recent: [SHA256.Digest: (Date, String)] = [:]
    private var clipboardCount = 0
    private var since = Date()
    private var generation = UUID()
    private var ticks = 0
    private(set) var running = false

    init(clipboard: NSPasteboard = .general, directory: URL? = nil, metadataQuery: Bool = true, ignoring: URL? = nil) {
        self.clipboard = clipboard; folderOverride = directory; useMetadataQuery = metadataQuery; ignoredDirectory = ignoring?.standardizedFileURL
    }
    func start() {
        guard !running else { return }
        running = true; since = Date(); generation = UUID(); seen.removeAll(); recent.removeAll()
        ignoreCurrentClipboard(); configureDirectory()
        if useMetadataQuery {
            let query = NSMetadataQuery()
            query.predicate = NSPredicate(format: "kMDItemIsScreenCapture == 1 AND kMDItemFSCreationDate >= %@", since as NSDate)
            query.searchScopes = [NSMetadataQueryUserHomeScope]
            query.notificationBatchingInterval = 0.2
            NotificationCenter.default.addObserver(self, selector: #selector(metadataChanged), name: .NSMetadataQueryDidFinishGathering, object: query)
            NotificationCenter.default.addObserver(self, selector: #selector(metadataChanged), name: .NSMetadataQueryDidUpdate, object: query)
            self.query = query; query.start()
        }
        timer = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.checkClipboard(); self.ticks += 1
            // The system screenshot destination can change while the app is open.
            if self.ticks % 6 == 0 { self.configureDirectory() }
        }
        RunLoop.main.add(timer!, forMode: .common)
    }
    func stop() {
        running = false; generation = UUID(); timer?.invalidate(); timer = nil
        watcher?.cancel(); watcher = nil; directory = nil
        if let query { query.stop(); NotificationCenter.default.removeObserver(self, name: .NSMetadataQueryDidFinishGathering, object: query); NotificationCenter.default.removeObserver(self, name: .NSMetadataQueryDidUpdate, object: query) }
        query = nil; pending.values.forEach { $0.cancel() }; pending.removeAll()
    }
    func ignoreCurrentClipboard() { clipboardCount = clipboard.changeCount }
    private func screenshotDirectory() -> URL {
        if let folderOverride { return folderOverride }
        let domain = "com.apple.screencapture" as CFString
        CFPreferencesAppSynchronize(domain)
        if let path = CFPreferencesCopyAppValue("location" as CFString, domain) as? String, !path.isEmpty {
            return URL(fileURLWithPath: (path as NSString).expandingTildeInPath, isDirectory: true)
        }
        return FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask)[0]
    }
    private func configureDirectory() {
        let next = screenshotDirectory().standardizedFileURL
        guard next != directory || watcher == nil else { return }
        watcher?.cancel(); watcher = nil; directory = next
        let fd = open(next.path, O_EVTONLY)
        guard fd >= 0 else { return } // Spotlight can still deliver screenshots from other destinations.
        let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: [.write, .rename, .delete], queue: .main)
        source.setEventHandler { [weak self, weak source] in
            guard let self else { return }
            if source?.data.contains(.delete) == true || source?.data.contains(.rename) == true { self.watcher?.cancel(); self.watcher = nil }
            self.scanDirectory()
        }
        source.setCancelHandler { Darwin.close(fd) }; source.resume(); watcher = source
        scanDirectory()
    }
    private func scanDirectory() {
        guard running, let directory else { return }
        let stamp = generation, started = since
        worker.async { [weak self] in
            do {
                let files = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.creationDateKey, .isRegularFileKey], options: [.skipsHiddenFiles])
                let fresh = files.filter {
                    guard ["png", "jpg", "jpeg", "tif", "tiff", "heic"].contains($0.pathExtension.lowercased()) else { return false }
                    guard let values = try? $0.resourceValues(forKeys: [.creationDateKey, .isRegularFileKey]) else { return false }
                    return values.isRegularFile == true && (values.creationDate ?? .distantPast) >= started
                }
                DispatchQueue.main.async {
                    guard let self, self.running, self.generation == stamp else { return }
                    for url in fresh { self.enqueue(url) }
                }
            } catch {
                DispatchQueue.main.async { guard let self, self.running, self.generation == stamp else { return }; self.onError?(error) }
            }
        }
    }
    @objc private func metadataChanged() {
        guard let query, running else { return }
        query.disableUpdates(); defer { query.enableUpdates() }
        for index in 0..<query.resultCount {
            guard let item = query.result(at: index) as? NSMetadataItem, let path = item.value(forAttribute: NSMetadataItemPathKey) as? String else { continue }
            enqueue(URL(fileURLWithPath: path))
        }
    }
    private func enqueue(_ raw: URL, attempt: Int = 0) {
        let url = raw.standardizedFileURL
        guard running, !seen.contains(url), pending[url] == nil else { return }
        if let ignoredDirectory, url.path.hasPrefix(ignoredDirectory.path + "/") { return }
        let stamp = generation, started = since
        let work = DispatchWorkItem { [weak self] in
            guard let self, self.running, self.generation == stamp else { return }
            self.worker.async {
                // Retry while screencapture finishes writing pixels and extended attributes.
                let values = try? url.resourceValues(forKeys: [.creationDateKey, .isRegularFileKey])
                let isNew = values?.isRegularFile == true && (values?.creationDate ?? .distantPast) >= started
                var data: Data?
                if isNew && Self.isScreenshot(url), let original = try? Data(contentsOf: url), original.count <= 100 * 1024 * 1024 {
                    data = Self.png(original)
                }
                DispatchQueue.main.async { [weak self] in
                    guard let self, self.running, self.generation == stamp else { return }
                    self.pending.removeValue(forKey: url)
                    if let data { self.seen.insert(url); self.deliver(data, source: "file", title: url.deletingPathExtension().lastPathComponent) }
                    else if isNew && attempt < 12 { self.enqueue(url, attempt: attempt + 1) }
                }
            }
        }
        pending[url] = work
        DispatchQueue.main.asyncAfter(deadline: .now() + (attempt == 0 ? 0.12 : 0.35), execute: work)
    }
    private static func isScreenshot(_ url: URL) -> Bool {
        let key = "com.apple.metadata:kMDItemIsScreenCapture"
        let length = getxattr(url.path, key, nil, 0, 0, 0)
        guard length > 0, length < 4096 else { return false }
        var bytes = [UInt8](repeating: 0, count: length)
        let count = bytes.withUnsafeMutableBytes { getxattr(url.path, key, $0.baseAddress, length, 0, 0) }
        guard count == length else { return false }
        return ((try? PropertyListSerialization.propertyList(from: Data(bytes), format: nil)) as? NSNumber)?.boolValue == true
    }
    private static func png(_ data: Data) -> Data? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { return nil }
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.png.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(destination, image, nil)
        return CGImageDestinationFinalize(destination) ? output as Data : nil
    }
    private func checkClipboard() {
        guard running, clipboard.changeCount != clipboardCount else { return }
        let count = clipboard.changeCount; clipboardCount = count
        // File promises, URLs, plain text and the clipboard present at launch are ignored.
        guard let data = clipboard.data(forType: .png) ?? clipboard.data(forType: .tiff), data.count <= 100 * 1024 * 1024 else { return }
        let stamp = generation
        worker.async { [weak self] in
            guard let png = Self.png(data) else { return }
            DispatchQueue.main.async {
                guard let self, self.running, self.generation == stamp else { return }
                self.deliver(png, source: "clipboard", title: "PNG")
            }
        }
    }
    private func deliver(_ data: Data, source: String, title: String) {
        let now = Date(), hash = SHA256.hash(data: data)
        recent = recent.filter { now.timeIntervalSince($0.value.0) < 10 }
        // One capture may be published both as a file and as clipboard image data.
        if let previous = recent[hash], previous.1 != source { return }
        recent[hash] = (now, source); onImage?(data, title)
    }
    deinit { timer?.invalidate(); watcher?.cancel(); query?.stop(); NotificationCenter.default.removeObserver(self) }
}
