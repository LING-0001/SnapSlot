import AppKit
import WebKit
import Carbon
import ApplicationServices
import SnapSlotCore

final class NotePanel: NSPanel {
    var keyboardAccess = false
    override var canBecomeKey: Bool { keyboardAccess }
    override var canBecomeMain: Bool { false }
}
final class StatusPinIndicator: NSView {
    override func draw(_ dirtyRect:NSRect) {
        NSColor.labelColor.setFill()
        NSBezierPath(ovalIn:bounds).fill()
    }
    // Keep the entire menu-bar button clickable, including the indicator.
    override func hitTest(_ point:NSPoint) -> NSView? { nil }
}
final class NativeWebView: WKWebView, NSDraggingSource {
    var onDragEnded: (() -> Void)?
    var onPointerMoved: ((NSPoint?) -> Void)?
    private var hoverTracking: NSTrackingArea?
    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let hoverTracking {removeTrackingArea(hoverTracking)}
        guard onPointerMoved != nil else{hoverTracking=nil;return}
        let area=NSTrackingArea(rect:.zero,options:[.activeAlways,.inVisibleRect,.mouseMoved,.mouseEnteredAndExited],owner:self,userInfo:nil)
        addTrackingArea(area);hoverTracking=area
    }
    override func mouseMoved(with event:NSEvent) {super.mouseMoved(with:event);onPointerMoved?(convert(event.locationInWindow,from:nil))}
    override func mouseEntered(with event:NSEvent) {super.mouseEntered(with:event);onPointerMoved?(convert(event.locationInWindow,from:nil))}
    override func mouseExited(with event:NSEvent) {super.mouseExited(with:event);onPointerMoved?(nil)}
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    func draggingSession(_ session: NSDraggingSession, sourceOperationMaskFor context: NSDraggingContext) -> NSDragOperation { .copy }
    func ignoreModifierKeys(for session: NSDraggingSession) -> Bool { true }
    func draggingSession(_ session: NSDraggingSession, endedAt screenPoint: NSPoint, operation: NSDragOperation) { onDragEnded?() }
}
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    let testing = CommandLine.arguments.contains("--smoke-test")
    var uiRoot: URL!
    var store: SessionStore!
    var panel: NotePanel!
    var web: NativeWebView!
    var settings: NSWindow?
    var settingsWeb: NativeWebView?
    var trayPanel: NotePanel?
    var trayWeb: NativeWebView?
    var materialViews: [String:NSVisualEffectView] = [:]
    var cardHitAreas: [(center:NSPoint,size:NSSize,angle:Double)] = []
    var arming = false
    var appearance = "glass"
    var allViews: [NativeWebView] { [web,settingsWeb,trayWeb].compactMap{$0} }
    var status: NSStatusItem?
    let statusPin = StatusPinIndicator(frame:.zero)
    var hotkeys: HotKeys?
    var shortcutChanges: [ShortcutChange] = []
    var recordingShortcut = false
    var preferences: PreferencesStore!
    var settingsMode = ""
    var collectingText = false
    var clipboardIntake: ClipboardIntake?
    var lastPointerUpdate = 0.0
    var pointerInside = false
    var globalMonitor: Any?
    var localMonitor: Any?
    var menuCopy: [String:[String:String]] = [:]
    var hover: Timer?
    var dismiss: Timer?
    var hideWork: DispatchWorkItem?
    var lastMouse: NSEvent?
    var activeScreen: NSScreen { currentScreen ?? NSScreen.main ?? NSScreen.screens[0] }
    var currentScreen: NSScreen?
    var expanded = false, pinned = false, dragging = false
    var previousEdge = false
    var peekUntil = Date.distantPast
    var locale = "en"
    var readyViews = Set<ObjectIdentifier>()
    var sentItems: [ObjectIdentifier:Set<String>] = [:]
    var lastError: String?
    var previews: [URL:String] = [:]
    var testingDataRoot: URL?
    var smokeStarted = false
    var previousApplication: NSRunningApplication?
    var restoredHandoff: URL?
    var startupFailed = false
    let names = ["English","简体中文","繁體中文","日本語","한국어","Español"]
    let locales = ["en","zh-Hans","zh-Hant","ja","ko","es"]
    func label(_ en: String, _ zh: String) -> String { menuCopy[locale]?[en] ?? (locale.hasPrefix("zh") ? zh : en) }
    func argument(_ key: String) -> String? { guard let index = CommandLine.arguments.firstIndex(of:key), index+1 < CommandLine.arguments.count else { return nil };return CommandLine.arguments[index+1] }
    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            NSApp.setActivationPolicy(testing ? .accessory : .regular)
            if !testing, let identifier = Bundle.main.bundleIdentifier, NSRunningApplication.runningApplications(withBundleIdentifier:identifier).filter({$0.processIdentifier != ProcessInfo.processInfo.processIdentifier}).count > 0 { NSApp.terminate(nil);return }
            if let image=brandIcon() {NSApp.applicationIconImage=image}
            uiRoot = argument("--ui-root").map { URL(fileURLWithPath:$0,isDirectory:true) } ?? Bundle.main.resourceURL!.appendingPathComponent("NativeUI",isDirectory:true)
            uiRoot = uiRoot.absoluteURL.standardizedFileURL
            guard uiRoot.isFileURL,FileManager.default.fileExists(atPath:uiRoot.appendingPathComponent("index.html").path) else{throw StoreError.invalidConfiguration("Offline UI files are missing")}
            menuCopy = (try? JSONSerialization.jsonObject(with:Data(contentsOf:uiRoot.appendingPathComponent("menus.json")))) as? [String:[String:String]] ?? [:]
            let appData = testing ? FileManager.default.temporaryDirectory.appendingPathComponent("SnapSlot-Smoke-"+UUID().uuidString) : FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("SnapSlot",isDirectory:true)
            if testing {testingDataRoot=appData}
            store = try SessionStore(root:appData.appendingPathComponent("Sessions",isDirectory:true))
            preferences=PreferencesStore(url:appData.appendingPathComponent("preferences.json"),legacyCollection:testing || UserDefaults.standard.object(forKey:"collectImages") as? Bool != false)
            if !testing {try restoreUpdateHandoff(appData:appData)}
            let preferred = UserDefaults.standard.string(forKey:"locale") ?? Locale.preferredLanguages.first ?? "en"
            locale = preferred.hasPrefix("zh") ? (preferred.contains("Hant") || preferred.contains("TW") || preferred.contains("HK") ? "zh-Hant":"zh-Hans") : locales.first(where:{preferred.hasPrefix($0)}) ?? "en"
            appearance = testing ? "glass" : UserDefaults.standard.string(forKey:"websiteAppearance") ?? "glass"
            if !["glass","paper","graphite"].contains(appearance) {appearance="glass"}
            panel = NotePanel(contentRect:.init(x:0,y:0,width:900,height:180),styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false)
            panel.isFloatingPanel=true;panel.hidesOnDeactivate=false;panel.becomesKeyOnlyIfNeeded=true
            panel.acceptsMouseMovedEvents=true
            panel.backgroundColor = .clear;panel.isOpaque=false;panel.hasShadow=false;panel.appearance=NSAppearance(named:.aqua)
            panel.level = .statusBar;panel.collectionBehavior=[.canJoinAllSpaces,.fullScreenAuxiliary,.ignoresCycle]
            panel.isReleasedWhenClosed=false;panel.title="SnapSlot";panel.delegate=self
            web = makeWebView(mode:"rail")
            let surface=NSView(frame:panel.contentView!.bounds);surface.autoresizingMask=[.width,.height]
            web.frame=surface.bounds;web.autoresizingMask=[.width,.height];surface.addSubview(web);panel.contentView=surface
            // Create the menu-bar entry independently of clipboard intake and
            // WebKit readiness. A failed secondary feature must not remove it.
            setupMenu()
            DispatchQueue.main.asyncAfter(deadline:.now()+1) { [weak self] in self?.writeStartupDiagnostics() }
            if testing {DispatchQueue.main.asyncAfter(deadline:.now()+15){if !self.smokeStarted {self.fatal(StoreError.invalidConfiguration("Offline interface did not initialize"))}}}
            if testing { seed();reveal(focus:false) } else {
                configureClipboardIntake();startPointerObservation();hotkeys=HotKeys()
                do {
                    let result=try hotkeys!.resolve(preferences.value)
                    if result.preferences != preferences.value {try preferences.save(result.preferences)}
                    shortcutChanges=result.changes
                    if !shortcutChanges.isEmpty {DispatchQueue.main.async{self.openSettings(mode:"preferences")}}
                } catch {self.error(error);DispatchQueue.main.async{self.openSettings(mode:"preferences")}}
                hotkeys?.action={ [weak self] id in guard let self else{return};if id==3 {self.collectSelectedText()}else if self.expanded { self.collapse() } else { self.reveal(focus:true) } }
            }
            NSWorkspace.shared.notificationCenter.addObserver(self,selector:#selector(willSleep),name:NSWorkspace.willSleepNotification,object:nil)
            NotificationCenter.default.addObserver(self,selector:#selector(screenChanged),name:NSApplication.didChangeScreenParametersNotification,object:nil)
        } catch { fatal(error) }
    }
    func makeWebView(mode:String) -> NativeWebView {
        let configuration=WKWebViewConfiguration()
        configuration.userContentController.add(self,name:"snapslot")
        let view=NativeWebView(frame:.zero,configuration:configuration)
        view.navigationDelegate=self;view.uiDelegate=self
        view.setValue(false,forKey:"drawsBackground");view.underPageBackgroundColor = .clear
        view.onDragEnded={ [weak self] in self?.dragging=false;self?.scheduleDismiss() }
        if mode=="tray" {
            view.onPointerMoved={ [weak self,weak view] point in
                guard let self,let view else{return}
                self.send(["type":"pointer","x":point.map{$0.x as Any} ?? NSNull(),"y":point.map{(view.isFlipped ? $0.y:view.bounds.height-$0.y) as Any} ?? NSNull()],to:view)
            }
        }
        var components=URLComponents(url:uiRoot.appendingPathComponent("index.html"),resolvingAgainstBaseURL:true)!
        if mode != "rail" { components.queryItems=[URLQueryItem(name:"mode",value:mode)] }
        view.loadFileURL(components.url!,allowingReadAccessTo:uiRoot)
        return view
    }
    func send(_ message:[String:Any],to view:WKWebView) {
        guard readyViews.contains(ObjectIdentifier(view)) else { return }
        view.callAsyncJavaScript("window.snapslotReceive(message)",arguments:["message":message],in:nil,in:.page) { _ in }
    }
    func screenAtPointer() -> NSScreen? {
        let point=NSEvent.mouseLocation
        return NSScreen.screens.first {point.x >= $0.frame.minX && point.x < $0.frame.maxX && point.y >= $0.frame.minY && point.y <= $0.frame.maxY}
    }
    func chooseScreenIfHidden() {if !expanded {currentScreen=screenAtPointer() ?? NSScreen.main}}
    func displayID(_ screen:NSScreen) -> String { String(describing:screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] ?? "main") }
    func imagePNG(_ image:NSImage) throws -> Data {
        guard let tiff=image.tiffRepresentation,let bitmap=NSBitmapImageRep(data:tiff),let data=bitmap.representation(using:.png,properties:[:]) else { throw StoreError.invalidImage };return data
    }
    func preview(_ url:URL) -> String {
        if let cached=previews[url] {return cached}
        guard let image=NSImage(contentsOf:url) else { return "" }
        let pixels=NSSize(width:image.representations.map{$0.pixelsWide}.max().map{CGFloat($0)} ?? image.size.width,height:image.representations.map{$0.pixelsHigh}.max().map{CGFloat($0)} ?? image.size.height)
        let ratio=min(1,1024/max(pixels.width,pixels.height)),size=NSSize(width:max(1,pixels.width*ratio),height:max(1,pixels.height*ratio))
        let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:Int(size.width),pixelsHigh:Int(size.height),bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
        NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
        image.draw(in:NSRect(origin:.zero,size:size));NSGraphicsContext.restoreGraphicsState()
        let value="data:image/png;base64,"+(bitmap.representation(using:.png,properties:[:])?.base64EncodedString() ?? "")
        previews[url]=value;return value
    }
    func state(focus:Bool=false) {
        updateStatusIndicator()
        for view in allViews where readyViews.contains(ObjectIdentifier(view)) {
            let key=ObjectIdentifier(view),known=sentItems[key] ?? []
            let visible=view===web ? store.items.filter{$0.display==displayID(activeScreen)}:[]
            let data:[[String:Any]]=visible.map { item in
                var value:[String:Any]=["id":item.id,"kind":item.kind,"title":item.title]
                if !known.contains(item.id) {
                    if let text=item.text {value["text"]=text} else {value["preview"]=preview(item.fileURL)}
                }
                return value
            }
            let message:[String:Any]=["type":"state","items":data,"locale":locale,"expanded":expanded,"reducedMotion":NSWorkspace.shared.accessibilityDisplayShouldReduceMotion,"focus":focus,"pinned":pinned,"arming":arming,"appearance":appearance,"count":store.items.count]
            send(message,to:view)
            sentItems[key]=Set(visible.map{$0.id})
        }
    }
    func error(_ error:Error) { lastError=error.localizedDescription;for view in allViews { send(["type":"error","message":error.localizedDescription],to:view) } }
    func sizePanel() {
        // Side cards rotate below the 230 px dial; leave room for their shadows.
        let screen=activeScreen,height=CGFloat(360)
        panel.setFrame(NSRect(x:screen.frame.minX,y:screen.visibleFrame.maxY-height,width:screen.frame.width,height:height),display:true)
    }
    func reveal(focus:Bool,peek:Bool=false) {
        hover?.invalidate();dismiss?.invalidate();hideWork?.cancel();arming=false
        if !expanded && !peek { currentScreen=screenAtPointer() ?? NSScreen.main }
        expanded=true;panel.keyboardAccess=focus;panel.ignoresMouseEvents=false
        if peek { peekUntil=Date().addingTimeInterval(2.5) }
        sizePanel();panel.orderFrontRegardless();state(focus:focus)
        if focus { previousApplication=NSWorkspace.shared.frontmostApplication;NSApp.activate(ignoringOtherApps:true);panel.makeKey() }
        if peek { scheduleDismiss() }
        if !testing {setupMenu()}
    }
    func collapse() {
        hover?.invalidate();dismiss?.invalidate();hideWork?.cancel();expanded=false;pinned=false;arming=false;panel.keyboardAccess=false
        closeTray()
        panel.ignoresMouseEvents=true;pointerInside=false;send(["type":"pointer","x":NSNull(),"y":NSNull()],to:web);state()
        if !testing {setupMenu()}
        let work=DispatchWorkItem{ [weak self] in guard let self,!self.expanded,!self.arming else{return};self.panel.orderOut(nil);self.materialViews.values.forEach{$0.removeFromSuperview()};self.materialViews.removeAll() }
        hideWork=work;DispatchQueue.main.asyncAfter(deadline:.now()+(NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? 0:0.24),execute:work)
    }
    func scheduleDismiss() {
        dismiss?.invalidate()
        guard expanded,!pinned,!dragging,trayPanel==nil else{return}
        let delay=max(0.45,peekUntil.timeIntervalSinceNow)
        dismiss=Timer.scheduledTimer(withTimeInterval:delay,repeats:false){ [weak self] _ in guard let self else{return};if !self.keepOpenAtPointer() { self.collapse() } }
    }
    var dismissalPointer: () -> NSPoint = { NSEvent.mouseLocation }
    func keepOpenAtPointer() -> Bool {
        let point=dismissalPointer(),screen=activeScreen
        return point.x>=screen.frame.minX && point.x<=screen.frame.maxX && point.y>=screen.visibleFrame.maxY-230 && point.y<=screen.frame.maxY
    }
    func canReveal(on screen:NSScreen) -> Bool {
        guard NSEvent.pressedMouseButtons==0,!dragging else{return false}
        guard let front=NSWorkspace.shared.frontmostApplication,front.processIdentifier != ProcessInfo.processInfo.processIdentifier,let windows=CGWindowListCopyWindowInfo([.optionOnScreenOnly,.excludeDesktopElements],kCGNullWindowID) as? [[String:Any]] else{return true}
        let primaryTop=NSScreen.screens.first?.frame.maxY ?? screen.frame.maxY
        for window in windows where (window[kCGWindowOwnerPID as String] as? Int)==Int(front.processIdentifier) && (window[kCGWindowLayer as String] as? Int)==0 {
            guard let rect=window[kCGWindowBounds as String] as? [String:CGFloat] else{continue}
            if (rect["X"] ?? .infinity)<=screen.frame.minX+1 && (rect["Y"] ?? .infinity)<=primaryTop-screen.frame.maxY+1 && (rect["Width"] ?? 0)>=screen.frame.width-1 && (rect["Height"] ?? 0)>=screen.frame.height-1 { return false }
        };return true
    }
    func pointerMoved(_ event:NSEvent) {
        lastMouse=event
        updateTrayPointer()
        if expanded { updatePointerFeedback();if keepOpenAtPointer() { dismiss?.invalidate() } else if dismiss?.isValid != true { scheduleDismiss() };return }
        guard NSEvent.pressedMouseButtons==0,let screen=screenAtPointer() else{cancelArming();previousEdge=false;return}
        let point=NSEvent.mouseLocation,atEdge=point.y>=screen.frame.maxY-2
        if atEdge && !previousEdge && canReveal(on:screen) {
            hover?.invalidate();currentScreen=screen;hideWork?.cancel();arming=true;sizePanel();panel.ignoresMouseEvents=true;panel.orderFrontRegardless();state()
            hover=Timer.scheduledTimer(withTimeInterval:0.5,repeats:false){ [weak self] _ in
                guard let self else{return}
                guard NSEvent.mouseLocation.y>=screen.frame.maxY-2,self.canReveal(on:screen) else{self.cancelArming();return};self.reveal(focus:false)
            }
        } else if !atEdge { cancelArming() }
        previousEdge=atEdge
    }
    func cancelArming() {
        hover?.invalidate()
        guard arming else{return};arming=false;state()
        if !expanded {panel.orderOut(nil)}
    }
    func updatePointerFeedback(at screenPoint:NSPoint=NSEvent.mouseLocation) {
        let point=panel.convertPoint(fromScreen:screenPoint)
        let local=web.convert(point,from:nil),inside=web.bounds.contains(local)
        updatePointerHitTest(at:screenPoint)
        guard inside || pointerInside else{return}
        let now=ProcessInfo.processInfo.systemUptime
        if inside && now-lastPointerUpdate<1.0/60 {return}
        lastPointerUpdate=now;pointerInside=inside
        // Nonactivating panels need hover feedback while another application is key.
        send(["type":"pointer","x":inside ? local.x as Any:NSNull(),"y":inside ? (web.isFlipped ? local.y:web.bounds.height-local.y) as Any:NSNull()],to:web)
    }
    func updatePointerHitTest(at screenPoint:NSPoint=NSEvent.mouseLocation) {
        guard expanded,!dragging else{return}
        let local=web.convert(panel.convertPoint(fromScreen:screenPoint),from:nil)
        let point=NSPoint(x:local.x,y:web.isFlipped ? local.y:web.bounds.height-local.y)
        let hit=cardHitAreas.contains { area in
            let dx=point.x-area.center.x,dy=point.y-area.center.y
            let x=dx*cos(area.angle)+dy*sin(area.angle),y = -dx*sin(area.angle)+dy*cos(area.angle)
            // Include the website's remove button, which protrudes from the card.
            return abs(x)<=area.size.width/2+12 && abs(y)<=area.size.height/2+12
        }
        panel.ignoresMouseEvents = !hit
    }
    func configureClipboardIntake() {
        if clipboardIntake==nil {
            let intake=ClipboardIntake(clipboard:testing ? NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")):.general);clipboardIntake=intake
            intake.onImage={ [weak self] data,title in
                guard let self else{return}
                do {self.chooseScreenIfHidden();try self.store.addPNG(data,title:title,display:self.displayID(self.activeScreen));self.arrived()}catch{self.error(error)}
            }
        }
        if preferences.value.collectImages {clipboardIntake?.start()}else{clipboardIntake?.stop()}
    }
    func sendPreferences(to view:WKWebView) {
        guard let data=try? JSONEncoder().encode(preferences.value),let value=try? JSONSerialization.jsonObject(with:data) else{return}
        let changes=(try? JSONSerialization.jsonObject(with:JSONEncoder().encode(shortcutChanges))) ?? []
        send(["type":"preferences","value":value,"platform":"macos","shortcutChanges":changes],to:view)
    }
    func savePreferences(_ next:AppPreferences,editing:ShortcutTarget? = nil) throws {
        let old=preferences.value
        var effective=next,changes:[ShortcutChange]=[]
        if let hotkeys,recordingShortcut || next.textShortcut != old.textShortcut || next.openShortcut != old.openShortcut {
            let result=try hotkeys.resolve(next,editing:editing);effective=result.preferences;changes=result.changes
        } else {try next.validate()}
        do{try preferences.save(effective)}catch{try? hotkeys?.apply(old);throw error}
        recordingShortcut=false
        shortcutChanges.removeAll {change in change.target==editing || changes.contains(where:{$0.target==change.target}) || (change.target == .text && next.textShortcut != old.textShortcut) || (change.target == .open && next.openShortcut != old.openShortcut)}
        shortcutChanges.append(contentsOf:changes)
        configureClipboardIntake();lastError=nil;if !testing{setupMenu()}
        for view in [settingsWeb,trayWeb].compactMap({$0}) {sendPreferences(to:view)}
        state()
    }
    func finishShortcutRecording(cancelled:Bool=true) {
        guard recordingShortcut else{return}
        if cancelled,let settingsWeb {send(["type":"recordingCancelled"],to:settingsWeb)}
        do {try savePreferences(preferences.value)}catch{recordingShortcut=false;self.error(error)}
    }
    func restoreUpdateHandoff(appData:URL,from supplied:String?=nil) throws {
        guard let path=supplied ?? argument("--restore-session") else{return}
        let directory=URL(fileURLWithPath:path,isDirectory:true).resolvingSymlinksInPath()
        let allowed=appData.appendingPathComponent("UpdateHandoffs",isDirectory:true).resolvingSymlinksInPath()
        guard directory.deletingLastPathComponent()==allowed,UUID(uuidString:directory.lastPathComponent) != nil else{return}
        let manifest=try JSONDecoder().decode([String].self,from:Data(contentsOf:directory.appendingPathComponent("manifest.json")))
        for name in manifest {
            guard name==URL(fileURLWithPath:name).lastPathComponent else{throw StoreError.invalidImage}
            let url=directory.appendingPathComponent(name).resolvingSymlinksInPath()
            guard url.deletingLastPathComponent()==directory else{throw StoreError.invalidImage}
            if url.pathExtension=="txt" {try store.addText(String(contentsOf:url,encoding:.utf8),display:displayID(activeScreen))}
            else if url.pathExtension=="png" {try store.addPNG(Data(contentsOf:url),title:label("Image","图片"),display:displayID(activeScreen))}
            else {throw StoreError.invalidImage}
        }
        // Retain a recovery copy until the updated app exits normally.
        restoredHandoff=directory
    }
    func startPointerObservation() {
        globalMonitor=NSEvent.addGlobalMonitorForEvents(matching:[.mouseMoved,.leftMouseDragged,.rightMouseDragged,.leftMouseDown,.rightMouseDown]){ [weak self] event in
            if event.type == .leftMouseDown || event.type == .rightMouseDown {self?.closeTray();self?.scheduleDismiss()}else{self?.pointerMoved(event)}
        }
        localMonitor=NSEvent.addLocalMonitorForEvents(matching:[.mouseMoved,.leftMouseDown,.leftMouseDragged,.rightMouseDragged,.keyDown]){ [weak self] event in
            if let self,let tray=self.trayPanel,event.type == .leftMouseDown,event.window !== tray {self.closeTray()}
            if event.type == .keyDown {self?.dismiss?.invalidate()}else{self?.pointerMoved(event)};return event
        }
    }
    @objc func screenChanged() { currentScreen=screenAtPointer() ?? NSScreen.main;if expanded { sizePanel();state() } }
    @objc func willSleep() { collapse() }
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage) {
        guard message.frameInfo.isMainFrame,let view=message.webView,view===web || view===settingsWeb || view===trayWeb,let value=message.body as? [String:Any],let type=value["type"] as? String else{return}
        do {
            switch type {
            case "ready": readyViews.insert(ObjectIdentifier(view));sentItems[ObjectIdentifier(view)]=[];state();if view===settingsWeb || view===trayWeb {sendPreferences(to:view)};if view===trayWeb {updateTrayPointer()};if let lastError {send(["type":"error","message":lastError],to:view)};if testing && view===web { DispatchQueue.main.asyncAfter(deadline:.now()+0.8){self.smoke()} }
            case "collapse":collapse()
            case "pin":pinNotes()
            case "unpin":collapse()
            case "openPreferences":closeTray();openSettings(mode:"preferences")
            case "quit":if view===trayWeb {quit()}
            case "setAppearance":
                guard let next=value["value"] as? String,["glass","paper","graphite"].contains(next) else{return}
                appearance=next;if !testing {UserDefaults.standard.set(next,forKey:"websiteAppearance")};state()
            case "setLocale":
                guard let next=value["value"] as? String,locales.contains(next) else{return}
                locale=next;if !testing {UserDefaults.standard.set(next,forKey:"locale");setupMenu()};state()
            case "clearNotes":store.clear();previews.removeAll();state()
            case "surfaces":if view===web,let surfaces=value["surfaces"] as? [[String:Any]] {updateMaterials(surfaces)}
            case "moveWindow":if view===settingsWeb,let event=lastMouse,event.type == .leftMouseDown {settings?.performDrag(with:event)}
            case "close":if view===trayWeb {closeTray()}else{closeSettings()}
            case "savePreferences":guard view===settingsWeb || view===trayWeb,let settings=value["value"] else{return};let next=try JSONDecoder().decode(AppPreferences.self,from:JSONSerialization.data(withJSONObject:settings));try savePreferences(next,editing:ShortcutTarget(rawValue:value["editingShortcut"] as? String ?? ""))
            case "beginShortcutRecording":if view===settingsWeb,!recordingShortcut {recordingShortcut=true;hotkeys?.suspend()}
            case "endShortcutRecording":if view===settingsWeb {finishShortcutRecording(cancelled:false)}
            case "minimizePreferences":if view===settingsWeb {settings?.miniaturize(nil)}
            case "resizePreferences":if view===settingsWeb,let height=value["height"] as? Double,height.isFinite,height>=350,height<=700 {resizeSettings(height:height)}
            case "copy","remove","drag":
                guard let id=value["id"] as? String else{return};let item=try store.item(id:id)
                guard item.display==displayID(activeScreen) else{return}
                if type=="remove" {store.remove(id:id);previews.removeValue(forKey:item.fileURL);state()}
                else if type=="copy" {try copy(item);send(["type":"copied","id":id],to:web)}
                else {try beginDrag(item)}
            default:break
            }
        } catch {self.error(error)}
    }
    func copy(_ item:InboxItem) throws {
        let clipboard=testing ? NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")):NSPasteboard.general;clipboard.clearContents()
        defer{clipboardIntake?.ignoreCurrentClipboard()}
        if let text=item.text {clipboard.setString(text,forType:.string)} else {
            let data=try Data(contentsOf:item.fileURL);clipboard.setData(data,forType:.png)
            if let image=NSImage(data:data),let tiff=image.tiffRepresentation {clipboard.setData(tiff,forType:.tiff)}
        }
    }
    func beginDrag(_ item:InboxItem) throws {
        guard let event=lastMouse else{return}
        let draggingItem=NSDraggingItem(pasteboardWriter:item.fileURL as NSURL)
        let image=NSImage(contentsOf:item.fileURL) ?? NSImage(systemSymbolName:"doc.text",accessibilityDescription:item.title)!
        let point=web.convert(event.locationInWindow,from:nil)
        draggingItem.setDraggingFrame(NSRect(x:point.x-50,y:point.y-35,width:100,height:70),contents:image)
        dragging=true;dismiss?.invalidate();web.beginDraggingSession(with:[draggingItem],event:event,source:web)
    }
    func arrived() {
        let live=Set(store.items.map{$0.fileURL});previews=previews.filter{live.contains($0.key)}
        reveal(focus:false,peek:true)
    }
    func pinNotes() {
        if !expanded {reveal(focus:false)}
        pinned=true;dismiss?.invalidate();state();if !testing {setupMenu()}
    }
    func collectSelectedText() {
        guard !collectingText else{return}
        guard let front=NSWorkspace.shared.frontmostApplication,front.processIdentifier != ProcessInfo.processInfo.processIdentifier else{return}
        let options=[kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String:true] as CFDictionary
        guard AXIsProcessTrustedWithOptions(options) else {
            selectionError(label("Allow SnapSlot in System Settings → Privacy & Security → Accessibility, then use the shortcut again.","请在系统设置 → 隐私与安全性 → 辅助功能中允许 SnapSlot，然后再按快捷键。"));return
        }
        var focused:CFTypeRef?
        let application=AXUIElementCreateApplication(front.processIdentifier)
        AXUIElementSetMessagingTimeout(application,0.5)
        AXUIElementCopyAttributeValue(application,kAXFocusedUIElementAttribute as CFString,&focused)
        if let focused,CFGetTypeID(focused)==AXUIElementGetTypeID() {
            let element=unsafeBitCast(focused,to:AXUIElement.self)
            AXUIElementSetMessagingTimeout(element,0.5)
            var subrole:CFTypeRef?;AXUIElementCopyAttributeValue(element,kAXSubroleAttribute as CFString,&subrole)
            if subrole as? String==kAXSecureTextFieldSubrole as String {selectionError(label("Select ordinary text first.","请先选中需要收取的文字。"));return}
            var selected:CFTypeRef?
            let result=AXUIElementCopyAttributeValue(element,kAXSelectedTextAttribute as CFString,&selected)
            if result == .success,let text=selected as? String {
                if !text.isEmpty {pinSelection(text)}else{selectionError(label("Select the text you want to pin first.","请先全选或选中需要的文字。"))};return
            }
        }
        // Some editors expose selection only through their normal Copy command.
        // Wait for the user's shortcut modifiers to lift; never paste stale clipboard text.
        collectingText=true;let target=front.processIdentifier
        Task { @MainActor in
            defer{collectingText=false}
            for _ in 0..<30 {
                if NSEvent.modifierFlags.intersection([.command,.control,.option,.shift]).isEmpty{break}
                try? await Task.sleep(nanoseconds:50_000_000)
            }
            guard NSWorkspace.shared.frontmostApplication?.processIdentifier==target,NSEvent.modifierFlags.intersection([.command,.control,.option,.shift]).isEmpty else{return}
            let clipboard=NSPasteboard.general,previous=clipboard.changeCount
            guard let source=CGEventSource(stateID:.hidSystemState),let down=CGEvent(keyboardEventSource:source,virtualKey:8,keyDown:true),let up=CGEvent(keyboardEventSource:source,virtualKey:8,keyDown:false) else{return}
            down.flags = .maskCommand;up.flags = .maskCommand;down.post(tap:.cghidEventTap);up.post(tap:.cghidEventTap)
            for _ in 0..<20 {
                try? await Task.sleep(nanoseconds:50_000_000)
                guard NSWorkspace.shared.frontmostApplication?.processIdentifier==target else{return}
                if clipboard.changeCount != previous,let text=clipboard.string(forType:.string),!text.isEmpty {pinSelection(text);return}
            }
            selectionError(label("No selected text was copied. Select text and try again.","没有收到选中文字，请先选中需要的文字再试一次。"))
        }
    }
    func pinSelection(_ text:String) {
        do {
            guard !text.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty,text.utf8.count<=65536 else{throw StoreError.invalidText}
            chooseScreenIfHidden();try store.addText(text,display:displayID(activeScreen))
            let clipboard=testing ? NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")):NSPasteboard.general
            clipboard.clearContents();clipboard.setString(text,forType:.string);clipboardIntake?.ignoreCurrentClipboard();arrived()
        }catch{selectionError(error.localizedDescription)}
    }
    func selectionError(_ message:String){arrived();error(NSError(domain:"SnapSlot.Selection",code:1,userInfo:[NSLocalizedDescriptionKey:message]))}
    func openSettings(mode:String) {
        dismiss?.invalidate();hover?.invalidate();chooseScreenIfHidden()
        if settings != nil {if settingsMode==mode {presentSettings();return};closeSettings()}
        previousApplication=NSWorkspace.shared.frontmostApplication
        let size=NSSize(width:420,height:442)
        let window=NotePanel(contentRect:NSRect(origin:.zero,size:size),styleMask:[.borderless,.miniaturizable],backing:.buffered,defer:false)
        window.keyboardAccess=true;window.isFloatingPanel=false;window.hidesOnDeactivate=false
        window.backgroundColor = .clear;window.isOpaque=false;window.hasShadow=true;window.appearance=NSAppearance(named:.aqua)
        window.title=label("Settings","设置");window.isReleasedWhenClosed=false
        window.delegate=self;settings=window;settingsMode="preferences";settingsWeb=makeWebView(mode:"preferences")
        let background=NSVisualEffectView(frame:NSRect(origin:.zero,size:size));background.material = .popover;background.blendingMode = .behindWindow;background.state = .active
        background.wantsLayer=true;background.layer?.cornerRadius=12;background.layer?.masksToBounds=true
        settingsWeb!.frame=background.bounds;settingsWeb!.autoresizingMask=[.width,.height];background.addSubview(settingsWeb!);window.contentView=background
        window.center();presentSettings()
    }
    func presentSettings() {
        guard let settings else{return}
        NSApp.activate(ignoringOtherApps:true)
        if settings.isMiniaturized {settings.deminiaturize(nil)}
        settings.makeKeyAndOrderFront(nil)
        if let settingsWeb {settings.makeFirstResponder(settingsWeb)}
        scheduleDismiss()
    }
    func resizeSettings(height:Double) {
        guard let settings else{return}
        let screen=settings.screen?.visibleFrame ?? activeScreen.visibleFrame
        var frame=settings.frame
        let next=min(max(442,height),max(350,screen.height-40))
        guard abs(frame.height-next)>1 else{return}
        frame.origin.y=max(screen.minY+20,frame.maxY-next);frame.size.height=next
        settings.setFrame(frame,display:true)
    }
    func closeSettings() {settings?.close()}
    func windowDidResignKey(_ notification:Notification) {
        if let window=notification.object as? NSWindow,window===settings {finishShortcutRecording()}
        if let window=notification.object as? NSWindow,window===panel {panel.keyboardAccess=false;scheduleDismiss()}
    }
    func windowWillClose(_ notification:Notification) {
        guard let window=notification.object as? NSWindow,window===settings else{return}
        finishShortcutRecording()
        if let settingsWeb {readyViews.remove(ObjectIdentifier(settingsWeb));sentItems.removeValue(forKey:ObjectIdentifier(settingsWeb));settingsWeb.configuration.userContentController.removeScriptMessageHandler(forName:"snapslot")}
        settingsWeb=nil;settings=nil;settingsMode="";previousApplication?.activate(options:[]);scheduleDismiss()
    }
    func webViewWebContentProcessDidTerminate(_ webView:WKWebView) {readyViews.remove(ObjectIdentifier(webView));sentItems.removeValue(forKey:ObjectIdentifier(webView));webView.reload()}
    func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping (WKNavigationActionPolicy)->Void) {
        guard let url=navigationAction.request.url,url.isFileURL,url.standardizedFileURL.path.hasPrefix(uiRoot.standardizedFileURL.path+"/") else{decisionHandler(.cancel);return};decisionHandler(.allow)
    }
    func brandIcon() -> NSImage? {
        Bundle.main.url(forResource:"BrandIcon",withExtension:"png").flatMap{NSImage(contentsOf:$0)}
    }
    func writeStartupDiagnostics() {
        guard let output=argument("--startup-diagnostics") else{return}
        let window=status?.button?.window
        let value:[String:Any]=["bundle":Bundle.main.bundleURL.path,"version":Bundle.main.object(forInfoDictionaryKey:"CFBundleShortVersionString") ?? "","build":Bundle.main.object(forInfoDictionaryKey:"CFBundleVersion") ?? "","statusVisible":status?.isVisible ?? false,"statusWindowVisible":window?.isVisible ?? false,"statusFrame":window.map{NSStringFromRect($0.frame)} ?? "","brandIconLoaded":brandIcon() != nil,"statusImageLoaded":status?.button?.image != nil,"statusOnScreen":window.map{window in NSScreen.screens.contains{$0.frame.intersects(window.frame)}} ?? false]
        do {try JSONSerialization.data(withJSONObject:value,options:[.prettyPrinted,.sortedKeys]).write(to:URL(fileURLWithPath:output),options:.atomic)}catch{fputs("SnapSlot diagnostics: \(error)\n",stderr)}
    }
    func setupMenu() {
        if status==nil {
            let item=NSStatusBar.system.statusItem(withLength:24)
            item.autosaveName="SnapSlot.MenuBar";item.behavior=[];item.isVisible=true
            status=item
        }
        status?.isVisible=true
        if let mark=brandIcon() ?? NSImage(systemSymbolName:"pin.fill",accessibilityDescription:"SnapSlot") {
            mark.size=NSSize(width:18,height:18);mark.isTemplate=false;status?.button?.image=mark
        }else{status?.button?.title="SS"}
        status?.button?.imagePosition = .imageOnly;status?.button?.imageScaling = .scaleProportionallyDown
        status?.button?.toolTip="SnapSlot · 快照贴";status?.button?.setAccessibilityLabel("SnapSlot 快照贴")
        updateStatusIndicator()
        status?.button?.setAccessibilityIdentifier("SnapSlot.MenuBar")
        status?.menu=nil;status?.button?.target=self;status?.button?.action=#selector(toggleTray)
        status?.button?.sendAction(on:[.leftMouseUp,.rightMouseUp])
        let menu=NSMenu()
        func item(_ title:String,_ action:Selector){let entry=NSMenuItem(title:title,action:action,keyEquivalent:"");entry.target=self;menu.addItem(entry)}
        item(label("Settings","设置")+"…",#selector(openPreferences));menu.addItem(.separator())
        let intake=NSMenuItem(title:label("Automatically collect clipboard images","自动收取剪贴板图片"),action:#selector(toggleImageIntake),keyEquivalent:"");intake.target=self;intake.state=preferences.value.collectImages ? .on:.off;menu.addItem(intake)
        let pin=NSMenuItem(title:label("Pin notes","固定便签"),action:#selector(togglePinned),keyEquivalent:"");pin.target=self;pin.state=pinned ? .on:.off;menu.addItem(pin)
        menu.addItem(.separator());item(label("Quit SnapSlot","退出快照贴"),#selector(quit))
        let main=NSMenu(),applicationItem=NSMenuItem(title:"SnapSlot",action:nil,keyEquivalent:"")
        let applicationMenu=menu.copy() as! NSMenu
        if let quit=applicationMenu.items.last {quit.keyEquivalent="q"}
        applicationItem.submenu=applicationMenu;main.addItem(applicationItem)
        let editItem=NSMenuItem(title:label("Edit","编辑"),action:nil,keyEquivalent:"");let edit=NSMenu(title:editItem.title)
        for(title,action,key) in [(label("Undo","撤销"),Selector(("undo:")),"z"),(label("Cut","剪切"),#selector(NSText.cut(_:)),"x"),(label("Copy","复制"),#selector(NSText.copy(_:)),"c"),(label("Paste","粘贴"),#selector(NSText.paste(_:)),"v"),(label("Select All","全选"),#selector(NSText.selectAll(_:)),"a")] {edit.addItem(NSMenuItem(title:title,action:action,keyEquivalent:key))}
        editItem.submenu=edit;main.addItem(editItem);NSApp.mainMenu=main
    }
    func updateStatusIndicator() {
        guard let button=status?.button else{return}
        if statusPin.superview !== button {
            statusPin.setAccessibilityElement(false)
            statusPin.autoresizingMask=[.minXMargin,.maxYMargin]
            button.addSubview(statusPin)
        }
        // The website's Mac marker is 5 px, 3 px from the right and 1 px from the bottom.
        let bottom=button.isFlipped ? button.bounds.maxY-6 : button.bounds.minY+1
        statusPin.frame=NSRect(x:button.bounds.maxX-8,y:bottom,width:5,height:5)
        statusPin.isHidden = !pinned
        button.setAccessibilityValue(pinned ? label("Pin notes","固定便签") : "")
    }
    func updateMaterials(_ surfaces:[[String:Any]]) {
        guard let root=panel.contentView else{return}
        let allowed=Set(store.items.filter{$0.display==displayID(activeScreen)}.map{$0.id})
        var live=Set<String>()
        cardHitAreas.removeAll(keepingCapacity:true)
        for surface in surfaces.prefix(9) {
            guard let id=surface["id"] as? String,allowed.contains(id),
                  let x=surface["x"] as? Double,let y=surface["y"] as? Double,
                  let width=surface["width"] as? Double,let height=surface["height"] as? Double,
                  let angle=surface["angle"] as? Double,let opacity=surface["opacity"] as? Double,
                  [x,y,width,height,angle,opacity].allSatisfy({$0.isFinite}),width>0,width<500,height>0,height<300 else{continue}
            if opacity>0.01 {cardHitAreas.append((center:NSPoint(x:x,y:y),size:NSSize(width:width,height:height),angle:angle * .pi/180))}
            guard appearance != "paper" else{continue}
            live.insert(id)
            let material=materialViews[id] ?? NSVisualEffectView()
            if materialViews[id]==nil {
                material.material = .hudWindow;material.blendingMode = .behindWindow;material.state = .active
                material.wantsLayer=true;material.layer?.masksToBounds=true;root.addSubview(material,positioned:.below,relativeTo:web);materialViews[id]=material
            }
            material.appearance=NSAppearance(named:appearance=="graphite" ? .darkAqua:.aqua)
            material.frameCenterRotation=0
            material.frame=NSRect(x:x-width/2,y:root.bounds.height-y-height/2,width:width,height:height)
            material.frameCenterRotation = CGFloat(-angle);material.layer?.cornerRadius=14*CGFloat(width/220)
            material.alphaValue=CGFloat(min(1,max(0,opacity)))
        }
        for id in Array(materialViews.keys) where !live.contains(id) {materialViews.removeValue(forKey:id)?.removeFromSuperview()}
        updatePointerHitTest()
    }
    @objc func toggleTray() {
        if trayPanel != nil {closeTray();return}
        guard let button=status?.button,let window=button.window else{return}
        dismiss?.invalidate();cancelArming()
        let anchor=window.convertToScreen(button.convert(button.bounds,to:nil))
        let screen=window.screen ?? activeScreen,size=NSSize(width:244,height:140)
        let popup=NotePanel(contentRect:NSRect(x:min(max(anchor.maxX-size.width,screen.visibleFrame.minX),screen.visibleFrame.maxX-size.width),y:anchor.minY-size.height,width:size.width,height:size.height),styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false)
        popup.keyboardAccess=true;popup.acceptsMouseMovedEvents=true;popup.level = .popUpMenu;popup.backgroundColor = .clear;popup.isOpaque=false;popup.hasShadow=false;popup.hidesOnDeactivate=false;popup.isReleasedWhenClosed=false
        trayPanel=popup;trayWeb=makeWebView(mode:"tray")
        let root=NSView(frame:NSRect(origin:.zero,size:size))
        let material=NSVisualEffectView(frame:root.bounds.insetBy(dx:6,dy:6));material.material = .popover;material.blendingMode = .behindWindow;material.state = .active
        material.appearance=NSAppearance(named:.aqua);material.wantsLayer=true;material.layer?.cornerRadius=10;material.layer?.masksToBounds=true
        root.addSubview(material);trayWeb!.frame=root.bounds;trayWeb!.autoresizingMask=[.width,.height];root.addSubview(trayWeb!)
        popup.contentView=root;popup.orderFrontRegardless()
    }
    func updateTrayPointer(at screenPoint:NSPoint=NSEvent.mouseLocation) {
        guard let trayPanel,let view=trayWeb else{return}
        let point=view.convert(trayPanel.convertPoint(fromScreen:screenPoint),from:nil)
        view.onPointerMoved?(view.bounds.contains(point) ? point:nil)
    }
    func closeTray() {
        if let view=trayWeb {readyViews.remove(ObjectIdentifier(view));sentItems.removeValue(forKey:ObjectIdentifier(view));view.configuration.userContentController.removeScriptMessageHandler(forName:"snapslot")}
        trayPanel?.orderOut(nil);trayPanel=nil;trayWeb=nil
    }
    @objc func togglePinned() {if pinned {collapse()}else{pinNotes()}}
    func applicationShouldHandleReopen(_ sender:NSApplication,hasVisibleWindows flag:Bool)->Bool {if settings != nil {presentSettings()}else{reveal(focus:true)};return false}
    @objc func toggleImageIntake(){var next=preferences.value;next.collectImages.toggle();do{try savePreferences(next)}catch{self.error(error)}}
    @objc func openPreferences(){closeTray();openSettings(mode:"preferences")}
    @objc func selectedText(){collectSelectedText()}
    @objc func showNotes(){reveal(focus:true)}
    @objc func quit(){NSApp.terminate(nil)}
    func seed(){
        let image=NSImage(size:NSSize(width:480,height:300));image.lockFocus();NSColor(calibratedRed:0.5,green:0.72,blue:0.8,alpha:1).setFill();NSBezierPath(rect:NSRect(x:0,y:0,width:480,height:300)).fill();NSColor(calibratedRed:0.15,green:0.4,blue:0.4,alpha:1).setFill();let path=NSBezierPath();path.move(to:.zero);path.line(to:NSPoint(x:200,y:260));path.line(to:NSPoint(x:480,y:0));path.close();path.fill();image.unlockFocus()
        _ = try? store.addPNG(imagePNG(image),title:"Mountains",display:displayID(activeScreen));_ = try? store.addText("A little idea\nKeep useful things close.\nTake a breath.",display:displayID(activeScreen))
    }
    func snapshot(_ view:WKWebView,to url:URL) async throws {
        let image:NSImage=try await withCheckedThrowingContinuation{ continuation in
            view.takeSnapshot(with:nil){image,error in
                if let error {continuation.resume(throwing:error)}
                else if let image {continuation.resume(returning:image)}
                else {continuation.resume(throwing:StoreError.invalidImage)}
            }
        }
        try imagePNG(image).write(to:url)
    }
    func smoke(){
        smokeStarted=true
        guard let output=argument("--smoke-test") else{return}
        Task { @MainActor in
            do {
                let directory=URL(fileURLWithPath:output,isDirectory:true);try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
                dismissalPointer = { NSPoint(x:self.activeScreen.frame.midX,y:self.activeScreen.visibleFrame.maxY-100) }
                var checks:[String]=[]
                func check(_ condition:Bool,_ description:String) throws {guard condition else{throw NSError(domain:"SnapSlot.Smoke",code:1,userInfo:[NSLocalizedDescriptionKey:description])};checks.append("PASS: "+description)}
                @MainActor func waitForSettings() async throws -> NativeWebView {
                    for _ in 0..<50 {if let view=self.settingsWeb,self.readyViews.contains(ObjectIdentifier(view)){return view};try await Task.sleep(nanoseconds:100_000_000)}
                    throw StoreError.invalidConfiguration("Settings did not initialize")
                }
                @MainActor func snapshotStatus(_ name:String) throws {
                    guard let button=status?.button,let bitmap=button.bitmapImageRepForCachingDisplay(in:button.bounds) else{throw StoreError.invalidConfiguration("Menu-bar snapshot failed")}
                    button.cacheDisplay(in:button.bounds,to:bitmap)
                    guard let data=bitmap.representation(using:.png,properties:[:]) else{throw StoreError.invalidImage}
                    try data.write(to:directory.appendingPathComponent(name))
                }
                try check(!panel.isKeyWindow,"Pointer reveal does not activate the note panel")
                try check(status?.isVisible==true && status?.button?.image != nil && status?.button?.window?.isVisible==true,"Menu-bar icon is visible from startup before opening notes or settings")
                try snapshotStatus("macos-status-unpinned.png")
                let sourceIcon=Bundle.main.url(forResource:"BrandIcon",withExtension:"png")
                try check(sourceIcon != nil && brandIcon() != nil && NSApp.applicationIconImage != nil,"Dock and menu-bar icons load the bundled current brand asset")
                let imageItem=store.items[0],textItem=store.items[1]
                let rectangle=try await web.evaluateJavaScript("(()=>{const r=document.querySelector('[data-note]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()") as! [String:Double]
                let clipboard=NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")),clipboardBefore=clipboard.changeCount
                let viewPoint=NSPoint(x:rectangle["x"]!,y:web.isFlipped ? rectangle["y"]!:web.bounds.height-rectangle["y"]!)
                let windowPoint=web.convert(viewPoint,to:nil)
                updatePointerFeedback(at:panel.convertPoint(toScreen:windowPoint))
                try await Task.sleep(nanoseconds:300_000_000)
                let highlighted=try await web.evaluateJavaScript("!!document.querySelector('[data-arm].host-hover') && getComputedStyle(document.querySelector('[data-arm].host-hover button:last-child')).opacity==='1'") as? Bool
                try check(highlighted==true && clipboard.changeCount==clipboardBefore,"Inactive-host hover reveals the website remove button without copying")
                updatePointerHitTest(at:panel.convertPoint(toScreen:windowPoint))
                let cardReceivesClicks = !panel.ignoresMouseEvents
                updatePointerHitTest(at:panel.convertPoint(toScreen:NSPoint(x:10,y:10)))
                try check(cardReceivesClicks && panel.ignoresMouseEvents,"Fan cards receive clicks while transparent space passes through to other apps")
                updatePointerHitTest(at:panel.convertPoint(toScreen:windowPoint))
                try check(web.acceptsFirstMouse(for:nil) && panel.acceptsMouseMovedEvents,"Native note view accepts the first click and mouse movement")
                for type in [NSEvent.EventType.leftMouseDown,.leftMouseUp] {
                    let event=NSEvent.mouseEvent(with:type,location:windowPoint,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:panel.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:type == .leftMouseDown ? 1:0)!
                    panel.sendEvent(event);try await Task.sleep(nanoseconds:100_000_000)
                }
                try check(clipboard.data(forType:.png)==Data(contentsOf:imageItem.fileURL),"First native click copies the original image without an activation click")
                try copy(textItem);try check(clipboard.string(forType:.string)==textItem.text,"Native text clipboard preserves the full payload")
                checks += try await checkClipboardIntake(sample:Data(contentsOf:imageItem.fileURL))
                store.remove(id:imageItem.id)
                try check(FileManager.default.fileExists(atPath:imageItem.fileURL.path),"Removed exports survive for existing file drag consumers")
                _ = try await web.evaluateJavaScript("window.arrivalProbe={starts:[],opacity:[]};window.arrivalListener=e=>{if(e.target.matches('[data-arm] > div'))window.arrivalProbe.starts.push(e.animationName)};document.addEventListener('animationstart',window.arrivalListener);window.arrivalStart=performance.now();function sampleArrival(){const elapsed=performance.now()-window.arrivalStart,card=document.querySelector('[data-focus=true]')?.parentElement;if(elapsed>900&&card)window.arrivalProbe.opacity.push(Number(getComputedStyle(card).opacity));if(elapsed<2050)requestAnimationFrame(sampleArrival)}requestAnimationFrame(sampleArrival)")
                try store.addPNG(Data(contentsOf:imageItem.fileURL),title:"Arrival regression",display:displayID(activeScreen));state()
                try await Task.sleep(nanoseconds:2_150_000_000)
                let stableArrival=try await web.evaluateJavaScript("document.removeEventListener('animationstart',window.arrivalListener);window.arrivalProbe.starts.length===1 && window.arrivalProbe.opacity.length>0 && Math.min(...window.arrivalProbe.opacity)>.99") as? Bool
                try check(stableArrival==true,"A new image animates once and stays opaque when the fresh marker expires in real WKWebView")
                for i in 0..<35 {try store.addText("Note \(i)\nKeep useful things close.",display:displayID(activeScreen))};state()
                try await Task.sleep(nanoseconds:900_000_000)
                let geometry=try await web.evaluateJavaScript("(()=>{const face=document.querySelector('[data-focus=true]'),arm=face.closest('[data-arm]'),style=getComputedStyle(face);return {count:document.querySelectorAll('[data-arm]').length,width:face.offsetWidth,height:face.offsetHeight,radius:style.borderRadius,origin:getComputedStyle(arm).transformOrigin}})()") as! [String:Any]
                try check(store.items.count==30 && geometry["count"] as? Int==30,"Native session and rendered fan enforce the website's 30-note capacity")
                try check(geometry["width"] as? Int==200 && geometry["height"] as? Int==144 && geometry["radius"] as? String=="14px","WKWebView uses the website's exact text-card dimensions and radius")
                let unclipped=try await web.evaluateJavaScript("Array.from(document.querySelectorAll('[data-arm][aria-hidden=false]')).every(arm=>arm.querySelector('[data-note]').getBoundingClientRect().bottom<innerHeight-20)") as? Bool
                try check(unclipped==true,"Native transparent window does not crop the fan's outer cards or shadows")
                try check(!materialViews.isEmpty,"AppKit supplies behind-window blur only underneath visible fan cards")
                updatePointerFeedback(at:NSPoint(x:-1000,y:-1000))
                try await snapshot(web,to:directory.appendingPathComponent("macos-notes-glass.png"))
                openSettings(mode:"preferences");let settingsView=try await waitForSettings()
                try await Task.sleep(nanoseconds:350_000_000)
                let controls=try await settingsView.evaluateJavaScript("document.querySelectorAll('[role=switch]').length===2 && document.querySelectorAll('[data-swatch]').length===3 && document.querySelectorAll('select option').length===6") as? Bool
                try check(controls==true && settings!.frame.width==420,"Compact website settings expose two switches, three appearances and six languages")
                let originalSettings=settings!
                _ = try await settingsView.evaluateJavaScript("document.querySelectorAll('header button')[1].click()")
                try await Task.sleep(nanoseconds:500_000_000)
                try check(originalSettings.isMiniaturized,"The settings minimize button minimizes its real AppKit window")
                openPreferences();try await Task.sleep(nanoseconds:500_000_000)
                try check(settings===originalSettings && !originalSettings.isMiniaturized && originalSettings.isVisible && originalSettings.isKeyWindow && NSApp.isActive,"Opening Settings from the status menu restores the same minimized window to the foreground")
                dismissalPointer = { NSPoint(x:self.activeScreen.frame.midX,y:self.activeScreen.visibleFrame.maxY-400) }
                for phase in ["foreground","background","minimized"] {
                    pinned=false;peekUntil = .distantPast
                    if phase=="foreground" {presentSettings();reveal(focus:false)}
                    if phase=="background" {reveal(focus:true)}
                    if phase=="minimized" {originalSettings.miniaturize(nil);reveal(focus:false)}
                    scheduleDismiss();try await Task.sleep(nanoseconds:750_000_000)
                    try check(!expanded && settings===originalSettings,"Unpinned notes dismiss with Settings \(phase) and leave Settings available")
                }
                presentSettings();reveal(focus:false);pinned=true;scheduleDismiss()
                try await Task.sleep(nanoseconds:650_000_000)
                try check(expanded && pinned,"Pinned notes remain visible when the pointer leaves with Settings open")
                pinned=false;dismissalPointer = { NSPoint(x:self.activeScreen.frame.midX,y:self.activeScreen.visibleFrame.maxY-100) };reveal(focus:false);state()
                _ = try await settingsView.evaluateJavaScript("document.querySelector('[data-shortcut-row=text] button').click()")
                try await Task.sleep(nanoseconds:150_000_000)
                try check(recordingShortcut,"The text shortcut row starts native shortcut recording")
                _ = try await settingsView.evaluateJavaScript("dispatchEvent(new KeyboardEvent('keydown',{code:'KeyY',key:'Y',ctrlKey:true,altKey:true,shiftKey:true,bubbles:true}));dispatchEvent(new KeyboardEvent('keyup',{code:'KeyY',key:'Y',ctrlKey:true,altKey:true,shiftKey:true,bubbles:true}))")
                try await Task.sleep(nanoseconds:250_000_000)
                try check(!recordingShortcut && preferences.value.textShortcut==Shortcut(key:"KeyY",shift:true),"Recording a text shortcut persists the actual combination after key release")
                _ = try await settingsView.evaluateJavaScript("document.querySelector('[data-shortcut-row=open] button').click()")
                try await Task.sleep(nanoseconds:100_000_000)
                _ = try await settingsView.evaluateJavaScript("dispatchEvent(new KeyboardEvent('keydown',{code:'KeyO',key:'O',ctrlKey:true,altKey:true,shiftKey:true,bubbles:true}));dispatchEvent(new KeyboardEvent('keyup',{code:'KeyO',key:'O',ctrlKey:true,altKey:true,shiftKey:true,bubbles:true}))")
                try await Task.sleep(nanoseconds:250_000_000)
                try check(preferences.value.openShortcut==Shortcut(key:"KeyO",shift:true),"The opening shortcut is editable and persisted independently of the text shortcut")
                _ = try await settingsView.evaluateJavaScript("document.querySelector('[role=switch]').click()")
                try await Task.sleep(nanoseconds:250_000_000)
                try check(!preferences.value.collectImages && PreferencesStore(url:preferences.url).value==preferences.value,"Website intake switch immediately updates and persists native preferences")
                _ = try await settingsView.evaluateJavaScript("document.querySelector('[data-swatch=paper]').click()")
                try await Task.sleep(nanoseconds:500_000_000)
                let paper=try await web.evaluateJavaScript("getComputedStyle(document.querySelector('[data-focus=true]')).backgroundColor") as? String
                try check(appearance=="paper" && paper=="rgb(251, 250, 247)" && materialViews.isEmpty,"Paper preset synchronizes settings and fan and disables native blur")
                try await snapshot(web,to:directory.appendingPathComponent("macos-notes-paper.png"))
                _ = try await settingsView.evaluateJavaScript("document.querySelector('[data-swatch=graphite]').click()")
                try await Task.sleep(nanoseconds:500_000_000)
                let graphite=try await web.evaluateJavaScript("getComputedStyle(document.querySelector('[data-focus=true]')).color") as? String
                try check(appearance=="graphite" && graphite=="rgb(245, 245, 247)","Graphite preset uses the website's dark material and light text")
                try await snapshot(web,to:directory.appendingPathComponent("macos-notes-graphite.png"))
                _ = try await settingsView.evaluateJavaScript("document.querySelector('[data-swatch=glass]').click();const select=document.querySelector('select');select.value='zh-Hans';select.dispatchEvent(new Event('change',{bubbles:true}))")
                try await Task.sleep(nanoseconds:350_000_000)
                try check(locale=="zh-Hans","Website language selector changes the native locale immediately")
                shortcutChanges=[ShortcutChange(target:.text,requested:Shortcut(key:"KeyT"),replacement:preferences.value.textShortcut),ShortcutChange(target:.open,requested:.open,replacement:preferences.value.openShortcut)]
                sendPreferences(to:settingsView);try await Task.sleep(nanoseconds:250_000_000)
                let conflictRows=try await settingsView.evaluateJavaScript("Array.from(document.querySelectorAll('.native-shortcut-hint')).filter(row=>row.textContent.includes('被占用，已修改为')).length===2") as? Bool
                try check(conflictRows==true,"Both shortcut rows show the occupied combination, actual replacement and a way to edit it")
                let lastControlVisible=try await settingsView.evaluateJavaScript("Array.from(document.querySelectorAll('.native-window button')).at(-1).getBoundingClientRect().bottom<innerHeight") as? Bool
                try check(settings!.frame.height>442 && lastControlVisible==true,"Settings grows to fit conflict explanations without hiding the last control")
                try await snapshot(settingsView,to:directory.appendingPathComponent("macos-shortcut-conflicts.png"))
                try savePreferences(preferences.value,editing:.text)
                try check(shortcutChanges.count==1 && shortcutChanges[0].target == .open,"A deliberate shortcut change clears only that action's conflict explanation")
                _ = try await settingsView.evaluateJavaScript("document.querySelectorAll('[role=switch]')[1].click()")
                try await Task.sleep(nanoseconds:150_000_000)
                try check(pinned && expanded,"Settings pin switch opens and pins the fan")
                let button=status!.button!
                let bottomInset=button.isFlipped ? button.bounds.maxY-statusPin.frame.maxY : statusPin.frame.minY-button.bounds.minY
                try check(!statusPin.isHidden && statusPin.superview===button && statusPin.frame.size==NSSize(width:5,height:5) && button.bounds.maxX-statusPin.frame.maxX==3 && bottomInset==1 && statusPin.hitTest(.zero)==nil,"Pinning adds the website's bottom-right 5 px menu-bar dot without blocking clicks")
                try snapshotStatus("macos-status-pinned.png")
                _ = try await settingsView.evaluateJavaScript("document.querySelectorAll('[role=switch]')[1].click()")
                try await Task.sleep(nanoseconds:150_000_000)
                try check(!pinned && statusPin.isHidden,"Unpinning immediately removes the menu-bar dot")
                _ = try await settingsView.evaluateJavaScript("document.querySelectorAll('[role=switch]')[1].click()")
                try await Task.sleep(nanoseconds:150_000_000)
                pinSelection("全选或者选中这段文字\nFull selected payload 📝")
                try check(pinned && clipboard.string(forType:.string)==store.items.last?.text,"New selected text keeps the pinned fan open and copies the full payload")
                try await snapshot(settingsView,to:directory.appendingPathComponent("macos-settings.png"))
                closeSettings();try check(pinned,"Closing settings preserves the user's pinned state")
                setupMenu();try await Task.sleep(nanoseconds:250_000_000);toggleTray()
                for _ in 0..<50 {if let view=trayWeb,readyViews.contains(ObjectIdentifier(view)){break};try await Task.sleep(nanoseconds:100_000_000)}
                if let trayWeb {
                    try await Task.sleep(nanoseconds:350_000_000)
                    let menu=try await trayWeb.evaluateJavaScript("document.querySelectorAll('[role=menuitem]').length===2 && document.querySelectorAll('[role=menuitemcheckbox]').length===2") as? Bool
                    try check(menu==true,"Real menu-bar popup matches the website's four-row menu with Quit")
                    let painted=try await trayWeb.evaluateJavaScript("(()=>{const menu=document.querySelector('[role=menu]');return menu.getBoundingClientRect().width>200 && Number(getComputedStyle(menu).opacity)>.99})()") as? Bool
                    try check(painted==true && trayPanel!.frame.intersects(activeScreen.frame),"Menu-bar popup is on screen and finishes its opening animation")
                    let rows=try await trayWeb.evaluateJavaScript("Array.from(document.querySelectorAll('.native-menu button')).map(button=>{const r=button.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})") as! [[String:Double]]
                    var highlighted=true
                    for (index,row) in rows.enumerated() {
                        let local=NSPoint(x:row["x"]!,y:trayWeb.isFlipped ? row["y"]!:trayWeb.bounds.height-row["y"]!)
                        let point=trayWeb.convert(local,to:nil)
                        let event=NSEvent.mouseEvent(with:.mouseMoved,location:point,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:trayPanel!.windowNumber,context:nil,eventNumber:index,clickCount:0,pressure:0)!
                        trayWeb.mouseMoved(with:event)
                        try await Task.sleep(nanoseconds:80_000_000)
                        let selected=try await trayWeb.evaluateJavaScript("(()=>{const rows=document.querySelectorAll('.native-menu button'),row=rows[\(index)],style=getComputedStyle(row);return document.querySelectorAll('.native-menu .host-hover').length===1 && row.classList.contains('host-hover') && style.backgroundColor==='rgb(10, 132, 255)' && style.color==='rgb(255, 255, 255)' && getComputedStyle(row.firstElementChild).color==='rgb(255, 255, 255)'})()") as? Bool
                        highlighted = highlighted && selected==true
                    }
                    try check(highlighted && trayPanel!.acceptsMouseMovedEvents && trayWeb.trackingAreas.contains{$0.options.contains(.activeAlways)},"All four inactive menu rows highlight blue with white text and checkmarks on native mouse movement")
                    try await snapshot(trayWeb,to:directory.appendingPathComponent("macos-menu.png"))
                    trayWeb.onPointerMoved?(nil);try await Task.sleep(nanoseconds:80_000_000)
                    let cleared=try await trayWeb.evaluateJavaScript("document.querySelectorAll('.native-menu .host-hover').length===0") as? Bool
                    try check(cleared==true,"Menu hover selection clears when the pointer leaves the popup")
                }else{throw StoreError.invalidText}
                closeTray();checks += try checkHotKeyTransaction()
                try (checks.joined(separator:"\n")+"\n").write(to:directory.appendingPathComponent("macos-smoke.txt"),atomically:true,encoding:.utf8)
                if CommandLine.arguments.contains("--keep-open") {reveal(focus:false);pinNotes()}else{NSApp.terminate(nil)}
            }catch{fatal(error)}
        }
    }
    func checkHotKeyTransaction() throws -> [String] {
        func key(_ number:Int)->Shortcut{Shortcut(key:"F\(number)",shift:true,meta:true)}
        let subject=HotKeys(),competitor=HotKeys(),probe=HotKeys()
        let original=AppPreferences(textShortcut:key(3),openShortcut:key(1))
        try subject.apply(original);try competitor.apply(AppPreferences(textShortcut:key(7),openShortcut:key(5)))
        var failed=false
        do{try subject.apply(AppPreferences(textShortcut:key(7),openShortcut:key(1)))}catch{failed=true}
        guard failed else{throw StoreError.invalidConfiguration("A conflicting global shortcut must be rejected")}
        failed=false
        do{try probe.apply(AppPreferences(textShortcut:key(3),openShortcut:key(9)))}catch{failed=true}
        guard failed else{throw StoreError.invalidConfiguration("A rejected shortcut change must restore the original registration")}
        try probe.apply(AppPreferences(textShortcut:key(8),openShortcut:key(9)))
        let resolved=try subject.resolve(AppPreferences(textShortcut:key(7),openShortcut:key(5)))
        guard resolved.changes.count==2,resolved.preferences.textShortcut != key(7),resolved.preferences.openShortcut != key(5) else{throw StoreError.invalidConfiguration("Both occupied shortcuts must receive registered alternatives")}
        failed=false
        do{try probe.apply(AppPreferences(textShortcut:resolved.preferences.textShortcut,openShortcut:key(9)))}catch{failed=true}
        guard failed else{throw StoreError.invalidConfiguration("Reported fallback must actually be registered")}
        let manual=try subject.resolve(AppPreferences(textShortcut:resolved.preferences.textShortcut,openShortcut:resolved.preferences.textShortcut),editing:.open)
        guard manual.preferences.textShortcut==resolved.preferences.textShortcut,manual.changes.count==1,manual.changes[0].target == .open else{throw StoreError.invalidConfiguration("Changing one shortcut must preserve the other action")}
        subject.suspend();try probe.apply(manual.preferences)
        try probe.apply(AppPreferences(textShortcut:key(8),openShortcut:key(9)));try subject.apply(manual.preferences)
        return ["PASS: Real macOS global hotkey conflicts retain the previous text shortcut","PASS: Both occupied shortcuts receive alternatives that are actually registered","PASS: Rebinding one action preserves the other; recording releases and restores both registrations"]
    }
    func checkClipboardIntake(sample:Data) async throws -> [String] {
        let clipboard=NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke"))
        func check(_ condition:Bool,_ title:String) throws -> String {guard condition else {throw NSError(domain:"SnapSlot.IntakeSmoke",code:1,userInfo:[NSLocalizedDescriptionKey:title])};return "PASS: "+title}
        clipboard.clearContents();clipboard.setData(sample,forType:.png)
        let intake=ClipboardIntake(clipboard:clipboard)
        var received:[Data]=[],checks:[String]=[]
        intake.onImage={data,_ in received.append(data)};intake.start();clipboardIntake=intake
        defer{intake.stop();clipboardIntake=nil;clipboard.clearContents()}
        try await Task.sleep(nanoseconds:650_000_000)
        checks.append(try check(received.isEmpty,"Clipboard image intake ignores the launch clipboard"))
        clipboard.clearContents();clipboard.setString("Ordinary copied text",forType:.string)
        try await Task.sleep(nanoseconds:650_000_000)
        checks.append(try check(received.isEmpty,"Ordinary copied text is not collected automatically"))
        let file=testingDataRoot!.appendingPathComponent("image-file.png");try sample.write(to:file)
        clipboard.clearContents();clipboard.writeObjects([file as NSURL])
        try await Task.sleep(nanoseconds:650_000_000)
        checks.append(try check(received.isEmpty,"File URLs and newly saved files are not imported"))
        clipboard.clearContents();clipboard.setData(sample,forType:.png)
        try await Task.sleep(nanoseconds:750_000_000)
        checks.append(try check(received.count==1,"A new clipboard image is received once"))
        let own=try store.addPNG(sample,title:"Test",display:displayID(activeScreen));try copy(own);store.remove(id:own.id)
        try await Task.sleep(nanoseconds:650_000_000)
        checks.append(try check(received.count==1,"Copying a native note does not feed it back into the inbox"))
        intake.stop();clipboard.clearContents();clipboard.setData(sample,forType:.png)
        try await Task.sleep(nanoseconds:600_000_000)
        checks.append(try check(received.count==1,"Turning automatic intake off stops receiving clipboard images"))
        return checks
    }
    func fatal(_ error:Error){startupFailed=true;fputs("SnapSlot: \(error)\n",stderr);if testing{exit(1)};let alert=NSAlert(error:error);alert.runModal();NSApp.terminate(nil)}
    func applicationWillTerminate(_ notification:Notification){
        hover?.invalidate();dismiss?.invalidate();hideWork?.cancel();clipboardIntake?.stop();
        if let globalMonitor{NSEvent.removeMonitor(globalMonitor)};if let localMonitor{NSEvent.removeMonitor(localMonitor)}
        web?.configuration.userContentController.removeScriptMessageHandler(forName:"snapslot");settingsWeb?.configuration.userContentController.removeScriptMessageHandler(forName:"snapslot")
        hotkeys=nil;store?.cleanup();if !startupFailed,let web,readyViews.contains(ObjectIdentifier(web)),let restoredHandoff {try? FileManager.default.removeItem(at:restoredHandoff)};if let testingDataRoot {try? FileManager.default.removeItem(at:testingDataRoot)}
        NSWorkspace.shared.notificationCenter.removeObserver(self);NotificationCenter.default.removeObserver(self)
    }
}
let application=NSApplication.shared
let delegate=AppDelegate()
application.delegate=delegate
withExtendedLifetime(delegate) { application.run() }
