import AppKit
import ImageIO
import UniformTypeIdentifiers

/// Receives only newly written image bytes. Never scans files or starts capture.
final class ClipboardIntake {
    var onImage: ((Data, String) -> Void)?
    private let clipboard: NSPasteboard
    private let worker = DispatchQueue(label:"app.snapslot.clipboard-decode",qos:.userInitiated)
    private var timer: Timer?
    private var clipboardCount = 0
    private var generation = UUID()
    private(set) var running = false
    init(clipboard:NSPasteboard = .general) {self.clipboard=clipboard}
    func start() {
        guard !running else{return}
        running=true;generation=UUID();ignoreCurrentClipboard()
        let timer=Timer(timeInterval:0.5,repeats:true){[weak self] _ in self?.checkClipboard()}
        self.timer=timer;RunLoop.main.add(timer,forMode:.common)
    }
    func stop() {running=false;generation=UUID();timer?.invalidate();timer=nil}
    func ignoreCurrentClipboard() {clipboardCount=clipboard.changeCount}
    private func checkClipboard() {
        guard running,clipboard.changeCount != clipboardCount else{return}
        clipboardCount=clipboard.changeCount
        guard let data=clipboard.data(forType:.png) ?? clipboard.data(forType:.tiff),data.count<=100*1024*1024 else{return}
        let stamp=generation
        worker.async { [weak self] in
            guard let source=CGImageSourceCreateWithData(data as CFData,nil),let image=CGImageSourceCreateImageAtIndex(source,0,nil) else{return}
            let output=NSMutableData()
            guard let destination=CGImageDestinationCreateWithData(output,UTType.png.identifier as CFString,1,nil) else{return}
            CGImageDestinationAddImage(destination,image,nil)
            guard CGImageDestinationFinalize(destination) else{return}
            DispatchQueue.main.async {
                guard let self,self.running,self.generation==stamp else{return}
                self.onImage?(output as Data,"PNG")
            }
        }
    }
    deinit {timer?.invalidate()}
}
