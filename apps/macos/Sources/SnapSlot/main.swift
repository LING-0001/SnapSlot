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
final class NativeWebView: WKWebView, NSDraggingSource {
    var onDragEnded: (() -> Void)?
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    func draggingSession(_ session: NSDraggingSession, sourceOperationMaskFor context: NSDraggingContext) -> NSDragOperation { .copy }
    func ignoreModifierKeys(for session: NSDraggingSession) -> Bool { true }
    func draggingSession(_ session: NSDraggingSession, endedAt screenPoint: NSPoint, operation: NSDragOperation) { onDragEnded?() }
}
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    let testing = CommandLine.arguments.contains("--smoke-test")
    var uiRoot: URL!
    var store: SessionStore!
    var skins: SkinStore!
    var panel: NotePanel!
    var web: NativeWebView!
    var settings: NSWindow?
    var settingsWeb: NativeWebView?
    var status: NSStatusItem?
    var hotkeys: HotKeys?
    var preferences: PreferencesStore!
    var settingsMode = ""
    var collectingText = false
    var screenshotIntake: ScreenshotIntake?
    var lastPointerUpdate = 0.0
    var pointerInside = false
    var globalMonitor: Any?
    var localMonitor: Any?
    var skinWatcher: DispatchSourceFileSystemObject?
    var activeSkinWatcher: DispatchSourceFileSystemObject?
    var menuCopy: [String:[String:String]] = [:]
    var watchWork: DispatchWorkItem?
    var hover: Timer?
    var dismiss: Timer?
    var hideWork: DispatchWorkItem?
    var lastMouse: NSEvent?
    var activeScreen: NSScreen { currentScreen ?? NSScreen.main ?? NSScreen.screens[0] }
    var currentScreen: NSScreen?
    var expanded = false, pinned = false, busy = false, dragging = false
    var previousEdge = false
    var peekUntil = Date.distantPast
    var locale = "en"
    var readyViews = Set<ObjectIdentifier>()
    var sentItems: [ObjectIdentifier:Set<String>] = [:]
    var sentSkins: [ObjectIdentifier:String] = [:]
    var lastError: String?
    var previews: [URL:String] = [:]
    var captureProcess: Process?
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
            uiRoot = argument("--ui-root").map { URL(fileURLWithPath:$0,isDirectory:true) } ?? Bundle.main.resourceURL!.appendingPathComponent("NativeUI",isDirectory:true)
            uiRoot = uiRoot.absoluteURL.standardizedFileURL
            guard uiRoot.isFileURL,FileManager.default.fileExists(atPath:uiRoot.appendingPathComponent("index.html").path) else{throw StoreError.invalidSkin("Offline UI files are missing")}
            menuCopy = (try? JSONSerialization.jsonObject(with:Data(contentsOf:uiRoot.appendingPathComponent("menus.json")))) as? [String:[String:String]] ?? [:]
            let template = try String(contentsOf:uiRoot.appendingPathComponent("skins/notes.json"),encoding:.utf8)
            let appData = testing ? FileManager.default.temporaryDirectory.appendingPathComponent("SnapSlot-Smoke-"+UUID().uuidString) : FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0].appendingPathComponent("SnapSlot",isDirectory:true)
            if testing {testingDataRoot=appData}
            store = try SessionStore(root:appData.appendingPathComponent("Sessions",isDirectory:true))
            preferences=PreferencesStore(url:appData.appendingPathComponent("preferences.json"),legacyCollection:testing || UserDefaults.standard.object(forKey:"collectScreenshots") as? Bool != false)
            if !testing {try restoreUpdateHandoff(appData:appData)}
            skins = try SkinStore(directory:appData.appendingPathComponent("Skins",isDirectory:true),template:template)
            for name in ["notes.json","cards.json"] {
                let destination = skins.directory.appendingPathComponent(name)
                if !FileManager.default.fileExists(atPath:destination.path) { try FileManager.default.copyItem(at:uiRoot.appendingPathComponent("skins/"+name),to:destination) }
            }
            let preferred = UserDefaults.standard.string(forKey:"locale") ?? Locale.preferredLanguages.first ?? "en"
            locale = preferred.hasPrefix("zh") ? (preferred.contains("Hant") || preferred.contains("TW") || preferred.contains("HK") ? "zh-Hant":"zh-Hans") : locales.first(where:{preferred.hasPrefix($0)}) ?? "en"
            panel = NotePanel(contentRect:.init(x:0,y:0,width:900,height:180),styleMask:[.borderless,.nonactivatingPanel],backing:.buffered,defer:false)
            panel.isFloatingPanel=true;panel.hidesOnDeactivate=false;panel.becomesKeyOnlyIfNeeded=true
            panel.acceptsMouseMovedEvents=true
            panel.backgroundColor = .clear;panel.isOpaque=false;panel.hasShadow=false
            panel.level = .statusBar;panel.collectionBehavior=[.canJoinAllSpaces,.fullScreenAuxiliary,.ignoresCycle]
            panel.isReleasedWhenClosed=false;panel.title="SnapSlot";panel.delegate=self
            web = makeWebView(mode:"rail");panel.contentView=web
            if testing {DispatchQueue.main.asyncAfter(deadline:.now()+15){if !self.smokeStarted {self.fatal(StoreError.invalidSkin("Offline interface did not initialize"))}}}
            startSkinWatcher()
            if testing { seed();reveal(focus:false) } else {
                configureScreenshotIntake();setupMenu();startPointerObservation();hotkeys=HotKeys()
                do{try hotkeys?.apply(preferences.value)}catch{self.error(error);DispatchQueue.main.async{self.openSettings(mode:"preferences")}}
                hotkeys?.action={ [weak self] id in guard let self else{return};if id==2 { self.capture() }else if id==3 {self.collectSelectedText()}else if self.expanded { self.collapse() } else { self.reveal(focus:true) } }
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
        view.onDragEnded={ [weak self] in self?.dragging=false;self?.pinned=false;self?.scheduleDismiss() }
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
        for view in [web,settingsWeb].compactMap({$0}) where readyViews.contains(ObjectIdentifier(view)) {
            let key=ObjectIdentifier(view),known=sentItems[key] ?? []
            let visible=view===web ? store.items.filter{$0.display==displayID(activeScreen)}:[]
            let data:[[String:Any]]=visible.map { item in
                var value:[String:Any]=["id":item.id,"kind":item.kind,"title":item.title]
                if !known.contains(item.id) {
                    if let text=item.text {value["text"]=text} else {value["preview"]=preview(item.fileURL)}
                }
                return value
            }
            var message:[String:Any]=["type":"state","items":data,"locale":locale,"expanded":expanded,"reducedMotion":NSWorkspace.shared.accessibilityDisplayShouldReduceMotion,"focus":focus]
            if sentSkins[key] != skins.source {message["skin"]=skins.source;sentSkins[key]=skins.source}
            send(message,to:view)
            sentItems[key]=Set(visible.map{$0.id})
        }
    }
    func error(_ error:Error) { lastError=error.localizedDescription;for view in [web,settingsWeb].compactMap({$0}) { send(["type":"error","message":error.localizedDescription],to:view) } }
    func sizePanel() {
        let screen=activeScreen,height=CGFloat(SkinDocument.height(skins.source)+48)
        panel.setFrame(NSRect(x:screen.frame.minX,y:screen.visibleFrame.maxY-height,width:screen.frame.width,height:height),display:true)
    }
    func reveal(focus:Bool,peek:Bool=false) {
        hover?.invalidate();dismiss?.invalidate();hideWork?.cancel()
        if !expanded && !peek { currentScreen=screenAtPointer() ?? NSScreen.main }
        expanded=true;pinned=focus;panel.keyboardAccess=focus;panel.ignoresMouseEvents=false
        if peek { peekUntil=Date().addingTimeInterval(2.5) }
        sizePanel();panel.orderFrontRegardless();state(focus:focus)
        if focus { previousApplication=NSWorkspace.shared.frontmostApplication;NSApp.activate(ignoringOtherApps:true);panel.makeKey() }
        if peek { scheduleDismiss() }
    }
    func collapse() {
        hover?.invalidate();dismiss?.invalidate();hideWork?.cancel();expanded=false;pinned=false
        panel.ignoresMouseEvents=true;pointerInside=false;send(["type":"pointer","x":NSNull(),"y":NSNull()],to:web);state()
        let work=DispatchWorkItem{ [weak self] in guard let self,!self.expanded else{return};self.panel.orderOut(nil) }
        hideWork=work;DispatchQueue.main.asyncAfter(deadline:.now()+(NSWorkspace.shared.accessibilityDisplayShouldReduceMotion ? 0:0.24),execute:work)
    }
    func scheduleDismiss() {
        dismiss?.invalidate()
        guard expanded,!pinned,!busy,!dragging,settings==nil else{return}
        let delay=max(0.45,peekUntil.timeIntervalSinceNow)
        dismiss=Timer.scheduledTimer(withTimeInterval:delay,repeats:false){ [weak self] _ in guard let self else{return};if !self.keepOpenAtPointer() { self.collapse() } }
    }
    func keepOpenAtPointer() -> Bool {
        let point=NSEvent.mouseLocation,screen=activeScreen
        return point.x>=screen.frame.minX && point.x<=screen.frame.maxX && point.y>=panel.frame.minY-16 && point.y<=screen.frame.maxY
    }
    func canReveal(on screen:NSScreen) -> Bool {
        guard NSEvent.pressedMouseButtons==0,!busy,!dragging,settings==nil else{return false}
        guard let front=NSWorkspace.shared.frontmostApplication,front.processIdentifier != ProcessInfo.processInfo.processIdentifier,let windows=CGWindowListCopyWindowInfo([.optionOnScreenOnly,.excludeDesktopElements],kCGNullWindowID) as? [[String:Any]] else{return true}
        let primaryTop=NSScreen.screens.first?.frame.maxY ?? screen.frame.maxY
        for window in windows where (window[kCGWindowOwnerPID as String] as? Int)==Int(front.processIdentifier) && (window[kCGWindowLayer as String] as? Int)==0 {
            guard let rect=window[kCGWindowBounds as String] as? [String:CGFloat] else{continue}
            if (rect["X"] ?? .infinity)<=screen.frame.minX+1 && (rect["Y"] ?? .infinity)<=primaryTop-screen.frame.maxY+1 && (rect["Width"] ?? 0)>=screen.frame.width-1 && (rect["Height"] ?? 0)>=screen.frame.height-1 { return false }
        };return true
    }
    func pointerMoved(_ event:NSEvent) {
        lastMouse=event
        if expanded { updatePointerFeedback();if keepOpenAtPointer() { dismiss?.invalidate() } else if dismiss?.isValid != true { scheduleDismiss() };return }
        guard NSEvent.pressedMouseButtons==0,let screen=screenAtPointer() else{hover?.invalidate();previousEdge=false;return}
        let point=NSEvent.mouseLocation,atEdge=point.y>=screen.frame.maxY-2
        if atEdge && !previousEdge && canReveal(on:screen) {
            hover?.invalidate();currentScreen=screen
            hover=Timer.scheduledTimer(withTimeInterval:0.5,repeats:false){ [weak self] _ in
                guard let self,NSEvent.mouseLocation.y>=screen.frame.maxY-2,self.canReveal(on:screen) else{return};self.reveal(focus:false)
            }
        } else if !atEdge { hover?.invalidate() }
        previousEdge=atEdge
    }
    func updatePointerFeedback(at screenPoint:NSPoint=NSEvent.mouseLocation) {
        let point=panel.convertPoint(fromScreen:screenPoint)
        let local=web.convert(point,from:nil),inside=web.bounds.contains(local)
        guard inside || pointerInside else{return}
        let now=ProcessInfo.processInfo.systemUptime
        if inside && now-lastPointerUpdate<1.0/60 {return}
        lastPointerUpdate=now;pointerInside=inside
        // Nonactivating panels need hover feedback while another application is key.
        send(["type":"pointer","x":inside ? local.x as Any:NSNull(),"y":inside ? (web.isFlipped ? local.y:web.bounds.height-local.y) as Any:NSNull()],to:web)
    }
    func configureScreenshotIntake() {
        if screenshotIntake==nil {
            let intake=testing ? ScreenshotIntake(clipboard:NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")),directory:testingDataRoot!.appendingPathComponent("SystemScreenshots"),metadataQuery:false,ignoring:store.directory.deletingLastPathComponent()):ScreenshotIntake(ignoring:store.directory.deletingLastPathComponent());screenshotIntake=intake
            intake.onImage={ [weak self] data,title in
                guard let self else{return}
                do {self.chooseScreenIfHidden();try self.store.addPNG(data,title:title,display:self.displayID(self.activeScreen));self.arrived()}catch{self.error(error)}
            }
            intake.onError={ [weak self] in self?.error($0) }
        }
        if preferences.value.collectScreenshots {screenshotIntake?.start()}else{screenshotIntake?.stop()}
    }
    func sendPreferences(to view:WKWebView) {
        guard let data=try? JSONEncoder().encode(preferences.value),let value=try? JSONSerialization.jsonObject(with:data) else{return}
        send(["type":"preferences","value":value,"platform":"macos"],to:view)
    }
    func savePreferences(_ next:AppPreferences) throws {
        try next.validate();let old=preferences.value
        try hotkeys?.apply(next)
        do{try preferences.save(next)}catch{try? hotkeys?.apply(old);throw error}
        configureScreenshotIntake();lastError=nil;if !testing{setupMenu()}
        if let settingsWeb,settingsMode=="preferences"{sendPreferences(to:settingsWeb)}
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
            else if url.pathExtension=="png" {try store.addPNG(Data(contentsOf:url),title:label("Screenshot","截图"),display:displayID(activeScreen))}
            else {throw StoreError.invalidImage}
        }
        // Retain a recovery copy until the updated app exits normally.
        restoredHandoff=directory
    }
    func startPointerObservation() {
        globalMonitor=NSEvent.addGlobalMonitorForEvents(matching:[.mouseMoved,.leftMouseDragged,.rightMouseDragged]){ [weak self] in self?.pointerMoved($0) }
        localMonitor=NSEvent.addLocalMonitorForEvents(matching:[.mouseMoved,.leftMouseDown,.leftMouseDragged,.rightMouseDragged,.keyDown]){ [weak self] event in
            if event.type == .keyDown { self?.pinned=true;self?.dismiss?.invalidate() } else { self?.pointerMoved(event) };return event
        }
    }
    @objc func screenChanged() { currentScreen=screenAtPointer() ?? NSScreen.main;if expanded { sizePanel();state() } }
    @objc func willSleep() { collapse() }
    func startSkinWatcher() {
        let fd=open(skins.directory.path,O_EVTONLY);guard fd>=0 else{return}
        let source=DispatchSource.makeFileSystemObjectSource(fileDescriptor:fd,eventMask:[.write,.rename,.delete],queue:.main)
        source.setEventHandler{ [weak self] in self?.scheduleSkinReload() }
        source.setCancelHandler{ Darwin.close(fd) };source.resume();skinWatcher=source
        armActiveSkinWatcher();scheduleSkinReload()
    }
    func armActiveSkinWatcher() {
        activeSkinWatcher?.cancel()
        let fd=open(skins.activeURL.path,O_EVTONLY);guard fd>=0 else{activeSkinWatcher=nil;return}
        let source=DispatchSource.makeFileSystemObjectSource(fileDescriptor:fd,eventMask:[.write,.rename,.delete,.attrib],queue:.main)
        source.setEventHandler{ [weak self] in self?.scheduleSkinReload() }
        source.setCancelHandler{ Darwin.close(fd) };source.resume();activeSkinWatcher=source
    }
    func scheduleSkinReload() {
        watchWork?.cancel()
        let work=DispatchWorkItem{ [weak self] in
            guard let self else{return}
            do {
                let candidate=try self.skins.readCandidate(),hadError=self.lastError != nil
                if candidate != self.skins.source {try self.skins.apply(candidate);self.sizePanel();self.lastError=nil;self.state()}
                else if hadError {self.lastError=nil;self.state()}
            }catch{self.error(error)}
            self.armActiveSkinWatcher()
        }
        watchWork=work;DispatchQueue.main.asyncAfter(deadline:.now()+0.25,execute:work)
    }
    func userContentController(_ userContentController:WKUserContentController,didReceive message:WKScriptMessage) {
        guard message.frameInfo.isMainFrame,let view=message.webView,view===web || view===settingsWeb,let value=message.body as? [String:Any],let type=value["type"] as? String else{return}
        do {
            switch type {
            case "ready": readyViews.insert(ObjectIdentifier(view));sentItems[ObjectIdentifier(view)]=[];sentSkins.removeValue(forKey:ObjectIdentifier(view));state();if view===settingsWeb && settingsMode=="preferences" {sendPreferences(to:view)};if let lastError {send(["type":"error","message":lastError],to:view)};if testing && view===web { DispatchQueue.main.asyncAfter(deadline:.now()+0.8){self.smoke()} }
            case "collapse":collapse()
            case "pin":pinned=true;dismiss?.invalidate()
            case "capture":capture()
            case "paste":try paste()
            case "addImages":addImages()
            case "newText":openSettings(mode:"text")
            case "appearance":openSettings(mode:"settings")
            case "close":closeSettings()
            case "openSkinFolder":NSWorkspace.shared.open(skins.directory)
            case "saveText":guard let text=value["text"] as? String else{return};try store.addText(text,display:displayID(activeScreen));closeSettings();arrived()
            case "savePreferences":guard view===settingsWeb,settingsMode=="preferences",let settings=value["value"] else{return};let next=try JSONDecoder().decode(AppPreferences.self,from:JSONSerialization.data(withJSONObject:settings));try savePreferences(next)
            case "applySkin":guard let source=value["source"] as? String else{return};try skins.apply(source);sizePanel();state()
            case "exportSkin":guard let source=value["source"] as? String else{return};try SkinDocument.validate(source,template:skins.template);exportSkin(source)
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
        defer{screenshotIntake?.ignoreCurrentClipboard()}
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
    func arrived() {reveal(focus:false,peek:true)}
    func paste() throws {
        chooseScreenIfHidden()
        let clipboard=NSPasteboard.general
        if let image=NSImage(pasteboard:clipboard) {try store.addPNG(imagePNG(image),title:"PNG",display:displayID(activeScreen))}
        else if let text=clipboard.string(forType:.string) {try store.addText(text,display:displayID(activeScreen))}
        else {throw StoreError.invalidText};arrived()
    }
    func collectSelectedText() {
        guard !collectingText,!busy else{return}
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
            clipboard.clearContents();clipboard.setString(text,forType:.string);screenshotIntake?.ignoreCurrentClipboard();arrived()
        }catch{selectionError(error.localizedDescription)}
    }
    func selectionError(_ message:String){arrived();error(NSError(domain:"SnapSlot.Selection",code:1,userInfo:[NSLocalizedDescriptionKey:message]))}
    func addImages() {
        chooseScreenIfHidden()
        let picker=NSOpenPanel();picker.allowedContentTypes=[.png,.jpeg,.bmp,.tiff,.webP];picker.allowsMultipleSelection=true
        busy=true;dismiss?.invalidate();picker.begin{ [weak self] response in
            guard let self else{return};self.busy=false
            if response == .OK { for url in picker.urls {do{let access=url.startAccessingSecurityScopedResource();defer{if access{url.stopAccessingSecurityScopedResource()}};guard let image=NSImage(contentsOf:url) else{throw StoreError.invalidImage};try self.store.addPNG(self.imagePNG(image),title:url.deletingPathExtension().lastPathComponent,display:self.displayID(self.activeScreen))}catch{self.error(error)}};self.arrived() } else{self.scheduleDismiss()}
        }
    }
    func capture() {
        guard !busy else{return};chooseScreenIfHidden();busy=true;collapse()
        let url=store.directory.appendingPathComponent(UUID().uuidString+".png"),display=displayID(activeScreen)
        DispatchQueue.main.asyncAfter(deadline:.now()+0.3){
            let process=Process();process.executableURL=URL(fileURLWithPath:"/usr/sbin/screencapture");process.arguments=["-i","-x","-t","png",url.path]
            process.terminationHandler={ [weak self] process in DispatchQueue.main.async{
                guard let self else{return};self.busy=false;self.captureProcess=nil
                if process.terminationStatus==0 {do{let data=try Data(contentsOf:url);try self.store.addPNG(data,title:self.label("Screenshot","截图"),display:display);try? FileManager.default.removeItem(at:url);self.arrived()}catch{self.error(error)}} else {try? FileManager.default.removeItem(at:url)}
            }}
            do{try process.run();self.captureProcess=process}catch{self.busy=false;self.error(error)}
        }
    }
    func openSettings(mode:String) {
        dismiss?.invalidate();hover?.invalidate();chooseScreenIfHidden()
        if let settings {if settingsMode==mode {settings.makeKeyAndOrderFront(nil);return};closeSettings()}
        previousApplication=NSWorkspace.shared.frontmostApplication
        let size=mode=="settings" ? NSSize(width:1080,height:790):mode=="preferences" ? NSSize(width:600,height:580):NSSize(width:520,height:360)
        let window=NSWindow(contentRect:NSRect(origin:.zero,size:size),styleMask:[.titled,.closable,.resizable],backing:.buffered,defer:false)
        window.title=mode=="settings" ? label("Appearance","自定义外观"):mode=="preferences" ? label("Settings","设置"):label("Add text","贴上文字")
        window.isReleasedWhenClosed=false;window.minSize=mode=="settings" ? NSSize(width:650,height:560):mode=="preferences" ? NSSize(width:520,height:520):NSSize(width:360,height:280)
        window.delegate=self;settings=window;settingsMode=mode;settingsWeb=makeWebView(mode:mode);window.contentView=settingsWeb
        window.center();NSApp.activate(ignoringOtherApps:true);window.makeKeyAndOrderFront(nil)
    }
    func closeSettings() {settings?.close()}
    func windowDidResignKey(_ notification:Notification) {
        if let window=notification.object as? NSWindow,window===panel {pinned=false;scheduleDismiss()}
        if let window=notification.object as? NSWindow,window===settings,settingsMode=="preferences"{do{try hotkeys?.resume()}catch{self.error(error)}}
    }
    func windowDidBecomeKey(_ notification:Notification){if let window=notification.object as? NSWindow,window===settings,settingsMode=="preferences"{hotkeys?.suspend()}}
    func windowWillClose(_ notification:Notification) {
        guard let window=notification.object as? NSWindow,window===settings else{return}
        if let settingsWeb {readyViews.remove(ObjectIdentifier(settingsWeb));sentItems.removeValue(forKey:ObjectIdentifier(settingsWeb));sentSkins.removeValue(forKey:ObjectIdentifier(settingsWeb));settingsWeb.configuration.userContentController.removeScriptMessageHandler(forName:"snapslot")}
        settingsWeb=nil;settings=nil;settingsMode="";do{try hotkeys?.resume()}catch{self.error(error)};pinned=false;previousApplication?.activate(options:[]);scheduleDismiss()
    }
    func exportSkin(_ source:String) {
        let picker=NSSavePanel();picker.nameFieldStringValue="skin.json";picker.allowedContentTypes=[.json]
        picker.begin{ [weak self] response in if response == .OK,let url=picker.url {do{try Data(source.utf8).write(to:url,options:.atomic)}catch{self?.error(error)}} }
    }
    func webViewWebContentProcessDidTerminate(_ webView:WKWebView) {readyViews.remove(ObjectIdentifier(webView));sentItems.removeValue(forKey:ObjectIdentifier(webView));sentSkins.removeValue(forKey:ObjectIdentifier(webView));webView.reload()}
    func webView(_ webView:WKWebView,runOpenPanelWith parameters:WKOpenPanelParameters,initiatedByFrame frame:WKFrameInfo,completionHandler:@escaping ([URL]?) -> Void) {
        let picker=NSOpenPanel();picker.allowsMultipleSelection=parameters.allowsMultipleSelection;picker.canChooseDirectories=false;picker.canChooseFiles=true
        picker.begin { response in completionHandler(response == .OK ? picker.urls:nil) }
    }
    func webView(_ webView:WKWebView,decidePolicyFor navigationAction:WKNavigationAction,decisionHandler:@escaping (WKNavigationActionPolicy)->Void) {
        guard let url=navigationAction.request.url,url.isFileURL,url.standardizedFileURL.path.hasPrefix(uiRoot.standardizedFileURL.path+"/") else{decisionHandler(.cancel);return};decisionHandler(.allow)
    }
    func setupMenu() {
        if status==nil {status=NSStatusBar.system.statusItem(withLength:NSStatusItem.squareLength);let mark=Bundle.main.url(forResource:"AppIcon",withExtension:"icns").flatMap{NSImage(contentsOf:$0)} ?? NSImage(systemSymbolName:"pin.fill",accessibilityDescription:"SnapSlot");mark?.size=NSSize(width:18,height:18);status?.button?.image=mark;status?.button?.toolTip="SnapSlot"}
        let menu=NSMenu()
        func item(_ title:String,_ action:Selector){let entry=NSMenuItem(title:title,action:action,keyEquivalent:"");entry.target=self;menu.addItem(entry)}
        item(label("Open notes","展开便签")+"  ⌃⌥Space",#selector(showNotes));item(label("Take a screenshot","截一张图")+"  "+preferences.value.captureShortcut.display,#selector(takeScreenshot));item(label("Pin selected text","收取选中文字")+"  "+preferences.value.textShortcut.display,#selector(selectedText));item(label("Paste once","粘贴一次"),#selector(pasteOnce));item(label("Add text","贴上文字"),#selector(newText));item(label("Add images","添加图片"),#selector(importImages));menu.addItem(.separator())
        let intake=NSMenuItem(title:label("Automatically collect screenshots and images","自动收取截图和剪贴板图片"),action:#selector(toggleScreenshotIntake),keyEquivalent:"");intake.target=self;intake.state=screenshotIntake?.running == true ? .on:.off;menu.addItem(intake)
        item(label("Appearance","自定义外观"),#selector(appearance));item(label("Open skin folder","打开皮肤文件夹"),#selector(openSkinFolder))
        item(label("Settings","设置")+"…",#selector(openPreferences))
        let language=NSMenuItem(title:label("Language","语言"),action:nil,keyEquivalent:"");let submenu=NSMenu()
        for(index,code) in locales.enumerated(){let entry=NSMenuItem(title:names[index],action:#selector(changeLocale(_:)),keyEquivalent:"");entry.target=self;entry.representedObject=code;entry.state=locale==code ? .on:.off;submenu.addItem(entry)};language.submenu=submenu;menu.addItem(language)
        menu.addItem(.separator());item(label("Quit SnapSlot","退出快照贴"),#selector(quit));status?.menu=menu
        let main=NSMenu(),applicationItem=NSMenuItem(title:"SnapSlot",action:nil,keyEquivalent:"")
        let applicationMenu=menu.copy() as! NSMenu
        if let quit=applicationMenu.items.last {quit.keyEquivalent="q"}
        applicationItem.submenu=applicationMenu;main.addItem(applicationItem)
        let editItem=NSMenuItem(title:label("Edit","编辑"),action:nil,keyEquivalent:"");let edit=NSMenu(title:editItem.title)
        for(title,action,key) in [(label("Undo","撤销"),Selector(("undo:")),"z"),(label("Cut","剪切"),#selector(NSText.cut(_:)),"x"),(label("Copy","复制"),#selector(NSText.copy(_:)),"c"),(label("Paste","粘贴"),#selector(NSText.paste(_:)),"v"),(label("Select All","全选"),#selector(NSText.selectAll(_:)),"a")] {edit.addItem(NSMenuItem(title:title,action:action,keyEquivalent:key))}
        editItem.submenu=edit;main.addItem(editItem);NSApp.mainMenu=main
    }
    func applicationShouldHandleReopen(_ sender:NSApplication,hasVisibleWindows flag:Bool)->Bool {if let settings {settings.makeKeyAndOrderFront(nil)}else{reveal(focus:true)};return false}
    @objc func toggleScreenshotIntake(){var next=preferences.value;next.collectScreenshots.toggle();do{try savePreferences(next)}catch{self.error(error)}}
    @objc func openPreferences(){openSettings(mode:"preferences")}
    @objc func selectedText(){collectSelectedText()}
    @objc func showNotes(){reveal(focus:true)}
    @objc func takeScreenshot(){capture()}
    @objc func pasteOnce(){do{try paste()}catch{self.error(error)}}
    @objc func newText(){openSettings(mode:"text")}
    @objc func importImages(){addImages()}
    @objc func appearance(){openSettings(mode:"settings")}
    @objc func openSkinFolder(){NSWorkspace.shared.open(skins.directory)}
    @objc func changeLocale(_ sender:NSMenuItem){if let code=sender.representedObject as? String {locale=code;UserDefaults.standard.set(code,forKey:"locale");setupMenu();state()}}
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
                var checks:[String]=[]
                func check(_ condition:Bool,_ description:String) throws {guard condition else{throw NSError(domain:"SnapSlot.Smoke",code:1,userInfo:[NSLocalizedDescriptionKey:description])};checks.append("PASS: "+description)}
                try check(!panel.isKeyWindow,"Pointer reveal does not activate the note panel")
                let imageItem=store.items[0],textItem=store.items[1]
                let rectangle=try await web.evaluateJavaScript("(()=>{const r=document.querySelector('.card-copy').getBoundingClientRect();return {x:r.x+30,y:r.y+30}})()") as! [String:Double]
                let clipboardBefore=NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")).changeCount
                let viewPoint=NSPoint(x:rectangle["x"]!,y:web.isFlipped ? rectangle["y"]!:web.bounds.height-rectangle["y"]!)
                let windowPoint=web.convert(viewPoint,to:nil)
                updatePointerFeedback(at:panel.convertPoint(toScreen:windowPoint))
                try await Task.sleep(nanoseconds:250_000_000)
                let highlighted=try await web.evaluateJavaScript("!!document.querySelector('.capture-card.host-hover') && getComputedStyle(document.querySelector('.capture-card.host-hover .copy-overlay')).opacity==='1'") as? Bool
                try check(highlighted==true && NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")).changeCount==clipboardBefore,"Inactive-host hover highlights a note without copying it")
                try check(web.acceptsFirstMouse(for:nil) && panel.acceptsMouseMovedEvents,"Native note view accepts the first click and mouse movement")
                for type in [NSEvent.EventType.leftMouseDown,.leftMouseUp] {
                    let event=NSEvent.mouseEvent(with:type,location:windowPoint,modifierFlags:[],timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:panel.windowNumber,context:nil,eventNumber:1,clickCount:1,pressure:type == .leftMouseDown ? 1:0)!
                    panel.sendEvent(event)
                    try await Task.sleep(nanoseconds:100_000_000)
                }
                try check(NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")).data(forType:.png)==Data(contentsOf:imageItem.fileURL),"First native click copies an image without a preceding activation click")
                try copy(textItem)
                try check(NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")).string(forType:.string)==textItem.text,"Native text clipboard preserves the full payload")
                try copy(imageItem)
                try check(NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")).data(forType:.png)==Data(contentsOf:imageItem.fileURL),"Native image clipboard preserves the original PNG")
                checks += try await checkScreenshotIntake(sample:Data(contentsOf:imageItem.fileURL))
                let handoff=testingDataRoot!.appendingPathComponent("UpdateHandoffs/"+UUID().uuidString,isDirectory:true)
                try FileManager.default.createDirectory(at:handoff,withIntermediateDirectories:true)
                try FileManager.default.copyItem(at:textItem.fileURL,to:handoff.appendingPathComponent("note.txt"))
                try JSONEncoder().encode(["note.txt"]).write(to:handoff.appendingPathComponent("manifest.json"))
                try restoreUpdateHandoff(appData:testingDataRoot!,from:handoff.path)
                let restored=store.items.last!
                try check(restored.text==textItem.text && FileManager.default.fileExists(atPath:handoff.appendingPathComponent("note.txt").path),"Updating the app can restore temporary notes while retaining its recovery copy")
                store.remove(id:restored.id)
                store.remove(id:imageItem.id)
                try check(FileManager.default.fileExists(atPath:imageItem.fileURL.path),"Removed exports survive for existing file drag consumers")
                try store.addText("Second note",display:displayID(activeScreen));for i in 0..<19 {try store.addText("Note \(i)",display:displayID(activeScreen))};state()
                try check(store.items.count==21,"21 notes remain in a continuous row without pagination")
                let original=skins.source,next=original.replacingOccurrences(of:"\"height\": 136",with:"\"height\": 180")
                try Data(next.utf8).write(to:skins.activeURL)
                try await Task.sleep(nanoseconds:800_000_000)
                try check(SkinDocument.height(skins.source)==180,"Saving JSON in place hot-reloads the active skin")
                try Data("{}".utf8).write(to:skins.activeURL)
                try await Task.sleep(nanoseconds:650_000_000)
                try check(SkinDocument.height(skins.source)==180,"Invalid JSON retains the previous valid skin")
                try Data(original.utf8).write(to:skins.activeURL,options:.atomic)
                try await Task.sleep(nanoseconds:800_000_000)
                try check(SkinDocument.height(skins.source)==136,"Atomic replacement also hot-reloads the skin")
                try await snapshot(web,to:directory.appendingPathComponent("macos-notes.png"))
                openSettings(mode:"settings")
                for _ in 0..<50 {if let settingsWeb,readyViews.contains(ObjectIdentifier(settingsWeb)){break};try await Task.sleep(nanoseconds:100_000_000)}
                guard let settingsWeb,readyViews.contains(ObjectIdentifier(settingsWeb)) else{throw StoreError.invalidSkin("Appearance editor did not load")}
                try await Task.sleep(nanoseconds:400_000_000)
                try await snapshot(settingsWeb,to:directory.appendingPathComponent("macos-appearance.png"))
                checks.append("PASS: Shared appearance editor renders offline in WKWebView")
                closeSettings();openSettings(mode:"preferences")
                for _ in 0..<50 {if let view=self.settingsWeb,readyViews.contains(ObjectIdentifier(view)){break};try await Task.sleep(nanoseconds:100_000_000)}
                guard let preferencesWeb=self.settingsWeb else{throw StoreError.invalidText}
                try await Task.sleep(nanoseconds:250_000_000)
                let controls=try await preferencesWeb.evaluateJavaScript("document.querySelectorAll('.shortcut-recorder').length===2 && document.querySelector('input[role=switch]').checked") as? Bool
                try check(controls==true,"Native right-click settings load two shortcut recorders and default-on screenshot intake")
                _ = try await preferencesWeb.evaluateJavaScript("document.querySelector('input[role=switch]').click()")
                try await Task.sleep(nanoseconds:100_000_000)
                _ = try await preferencesWeb.evaluateJavaScript("document.querySelector('.preferences-save').click()")
                try await Task.sleep(nanoseconds:350_000_000)
                try check(!preferences.value.collectScreenshots && PreferencesStore(url:preferences.url).value==preferences.value,"Saving preferences from WKWebView updates native intake and persists across restart")
                try await snapshot(preferencesWeb,to:directory.appendingPathComponent("macos-settings.png"))
                let selected="全选或者选中这段文字\nFull selected payload 📝"
                pinSelection(selected)
                try check(store.items.last?.text==selected && NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke")).string(forType:.string)==selected,"Selected text becomes a full text note and native clipboard payload")
                store.remove(id:store.items.last!.id)
                checks += try checkHotKeyTransaction()
                try (checks.joined(separator:"\n")+"\n").write(to:directory.appendingPathComponent("macos-smoke.txt"),atomically:true,encoding:.utf8)
                NSApp.terminate(nil)
            }catch{fatal(error)}
        }
    }
    func checkHotKeyTransaction() throws -> [String] {
        func key(_ number:Int)->Shortcut{Shortcut(key:"F\(number)",shift:true,meta:true)}
        let subject=HotKeys(opening:key(1)),competitor=HotKeys(opening:key(5)),probe=HotKeys(opening:key(9))
        let original=AppPreferences(captureShortcut:key(3),textShortcut:key(4))
        try subject.apply(original);try competitor.apply(AppPreferences(captureShortcut:key(6),textShortcut:key(7)))
        var failed=false
        do{try subject.apply(AppPreferences(captureShortcut:key(8),textShortcut:key(6)))}catch{failed=true}
        guard failed else{throw StoreError.invalidSkin("A conflicting global shortcut must be rejected")}
        failed=false
        do{try probe.apply(AppPreferences(captureShortcut:key(3),textShortcut:key(10)))}catch{failed=true}
        guard failed else{throw StoreError.invalidSkin("A rejected shortcut change must restore the original registration")}
        try probe.apply(AppPreferences(captureShortcut:key(8),textShortcut:key(10)))
        return ["PASS: Real macOS global hotkey conflicts retain old bindings and release partial new registrations"]
    }
    func checkScreenshotIntake(sample:Data) async throws -> [String] {
        let folder=testingDataRoot!.appendingPathComponent("SystemScreenshots",isDirectory:true)
        try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
        let clipboard=NSPasteboard(name:NSPasteboard.Name("app.snapslot.smoke"))
        func markScreenshot(_ url:URL) throws {
            let attribute=try PropertyListSerialization.data(fromPropertyList:true,format:.binary,options:0)
            let result=attribute.withUnsafeBytes { setxattr(url.path,"com.apple.metadata:kMDItemIsScreenCapture",$0.baseAddress,attribute.count,0,0) }
            if result != 0 {throw NSError(domain:NSPOSIXErrorDomain,code:Int(errno))}
        }
        func check(_ condition:Bool,_ title:String) throws -> String {guard condition else {throw NSError(domain:"SnapSlot.IntakeSmoke",code:1,userInfo:[NSLocalizedDescriptionKey:title])};return "PASS: "+title}
        let old=folder.appendingPathComponent("old.png");try sample.write(to:old);try markScreenshot(old)
        clipboard.clearContents();clipboard.setData(sample,forType:.png)
        let intake=ScreenshotIntake(clipboard:clipboard,directory:folder,metadataQuery:false)
        var received:[Data]=[];var checks:[String]=[]
        intake.onImage={data,_ in received.append(data)}
        intake.start();screenshotIntake=intake
        defer {intake.stop();screenshotIntake=nil;clipboard.clearContents()}
        try await Task.sleep(nanoseconds:650_000_000)
        checks.append(try check(received.isEmpty,"Screenshot intake ignores old files and the launch clipboard"))
        try sample.write(to:folder.appendingPathComponent("ordinary-image.png"),options:.atomic)
        try await Task.sleep(nanoseconds:650_000_000)
        checks.append(try check(received.isEmpty,"An ordinary new image file is not mistaken for a system screenshot"))
        let fresh=folder.appendingPathComponent("new-system-screenshot.png")
        try sample.write(to:fresh,options:.atomic)
        try await Task.sleep(nanoseconds:200_000_000) // Attributes can arrive after the file event.
        try markScreenshot(fresh)
        try await Task.sleep(nanoseconds:900_000_000)
        checks.append(try check(received.count==1 && FileManager.default.fileExists(atPath:fresh.path),"New screenshot file is received after delayed metadata; original stays intact"))
        try sample.write(to:fresh)
        clipboard.clearContents();clipboard.setData(sample,forType:.png)
        try await Task.sleep(nanoseconds:750_000_000)
        checks.append(try check(received.count==1,"File notifications and clipboard publication do not duplicate one screenshot"))
        let image=NSImage(size:NSSize(width:32,height:32));image.lockFocus();NSColor.orange.setFill();NSBezierPath(rect:NSRect(x:0,y:0,width:32,height:32)).fill();image.unlockFocus()
        let next=try imagePNG(image);clipboard.clearContents();clipboard.setData(next,forType:.png)
        try await Task.sleep(nanoseconds:750_000_000)
        checks.append(try check(received.count==2,"A new clipboard-only screenshot is received automatically"))
        let own=try store.addPNG(next,title:"Test",display:displayID(activeScreen));try copy(own);store.remove(id:own.id)
        try await Task.sleep(nanoseconds:650_000_000)
        checks.append(try check(received.count==2,"Copying a native note does not feed it back into the inbox"))
        intake.stop();clipboard.clearContents();clipboard.setData(sample,forType:.png)
        try await Task.sleep(nanoseconds:600_000_000)
        checks.append(try check(received.count==2,"Turning automatic intake off stops receiving clipboard images"))
        return checks
    }
    func fatal(_ error:Error){startupFailed=true;fputs("SnapSlot: \(error)\n",stderr);if testing{exit(1)};let alert=NSAlert(error:error);alert.runModal();NSApp.terminate(nil)}
    func applicationWillTerminate(_ notification:Notification){
        hover?.invalidate();dismiss?.invalidate();hideWork?.cancel();watchWork?.cancel();skinWatcher?.cancel();activeSkinWatcher?.cancel();screenshotIntake?.stop();captureProcess?.terminate()
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
