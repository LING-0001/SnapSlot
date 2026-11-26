import Foundation
import SnapSlotCore
final class StoreChecks {
    func root() -> URL {FileManager.default.temporaryDirectory.appendingPathComponent("SnapSlot-Tests-"+UUID().uuidString)}
    func testTextRoundTripRemovalAndSessionCleanup() throws {
        let directory=root();defer{try? FileManager.default.removeItem(at:directory)}
        let store=try SessionStore(root:directory)
        let item=try store.addText("你好\nFull text",display:"A")
        expectEqual(try String(contentsOf:item.fileURL,encoding:.utf8),"你好\nFull text")
        for i in 0..<25 {try store.addText("Note \(i)",display:i%2==0 ? "A":"B")}
        expectEqual(store.items.count,26)
        store.remove(id:item.id);expectTrue(FileManager.default.fileExists(atPath:item.fileURL.path))
        expectThrows(try store.item(id:item.id))
        expectThrows(try store.addText(String(repeating:"界",count:22000),display:"A"))
        expectThrows(try store.addText("  \n",display:"A"))
        store.cleanup();expectFalse(FileManager.default.fileExists(atPath:item.fileURL.path))
    }
    func testCleanupDoesNotTouchUnownedFolders() throws {
        let directory=root();defer{try? FileManager.default.removeItem(at:directory)}
        let original=directory.appendingPathComponent("originals");try FileManager.default.createDirectory(at:original,withIntermediateDirectories:true)
        let keep=original.appendingPathComponent("photo.png");try Data([1,2,3]).write(to:keep)
        let store=try SessionStore(root:directory);store.cleanup();expectTrue(FileManager.default.fileExists(atPath:keep.path))
    }
    func testCapacityAndClearPreserveExports() throws {
        let directory=root();defer{try? FileManager.default.removeItem(at:directory)}
        let store=try SessionStore(root:directory)
        let first=try store.addText("Oldest",display:"A")
        for i in 0..<30 {try store.addText("Note \(i)",display:i%2==0 ? "A":"B")}
        expectEqual(store.items.count,30);expectEqual(store.items.first?.text,"Note 0")
        expectThrows(try store.item(id:first.id))
        expectTrue(FileManager.default.fileExists(atPath:first.fileURL.path))
        let exports=store.items.map{$0.fileURL};store.clear();expectTrue(store.items.isEmpty)
        expectTrue(exports.allSatisfy{FileManager.default.fileExists(atPath:$0.path)})
        store.cleanup();expectFalse(FileManager.default.fileExists(atPath:first.fileURL.path))
    }
    func testPreferencesPersistAndRejectConflicts() throws {
        let directory=root();defer{try? FileManager.default.removeItem(at:directory)}
        let url=directory.appendingPathComponent("preferences.json"),store=PreferencesStore(url:url)
        expectTrue(store.value.collectImages)
        var value=store.value;value.collectImages=false;value.textShortcut=Shortcut(key:"KeyC",shift:true);value.openShortcut=Shortcut(key:"KeyO",shift:true)
        try store.save(value);expectEqual(PreferencesStore(url:url).value,value)
        var conflict=value;conflict.textShortcut = value.openShortcut;expectThrows(try store.save(conflict))
        conflict=value;conflict.textShortcut=Shortcut(key:"KeyT",control:false,alt:false,shift:true);expectThrows(try store.save(conflict))
        conflict=value;conflict.textShortcut=Shortcut(key:"KeyC",control:false,alt:false,meta:true);expectThrows(try store.save(conflict))
        try Data("{}".utf8).write(to:url);expectFalse(PreferencesStore(url:url,legacyCollection:false).value.collectImages)
        let legacy="{\"collectScreenshots\":false,\"captureShortcut\":{\"key\":\"KeyS\",\"control\":true,\"alt\":true,\"shift\":false,\"meta\":false},\"textShortcut\":{\"key\":\"KeyT\",\"control\":true,\"alt\":true,\"shift\":false,\"meta\":false}}"
        try Data(legacy.utf8).write(to:url)
        let migrated=PreferencesStore(url:url);expectFalse(migrated.value.collectImages);expectEqual(migrated.value.textShortcut,Shortcut(key:"KeyT"));expectEqual(migrated.value.openShortcut,.open)
        try migrated.save(migrated.value)
        let saved=try String(contentsOf:url,encoding:.utf8);expectFalse(saved.contains("captureShortcut"));expectFalse(saved.contains("collectScreenshots"));expectTrue(saved.contains("openShortcut"))
        expectFalse(migrated.value.launchAtLogin);expectTrue(migrated.value.showInDock)
        var toggles=migrated.value;toggles.launchAtLogin=true;toggles.showInDock=false
        try store.save(toggles);let reloaded=PreferencesStore(url:url).value
        expectTrue(reloaded.launchAtLogin);expectFalse(reloaded.showInDock)
    }
    func testDeduplicationReadableNamesEditAndSemVer() throws {
        let directory=root();defer{try? FileManager.default.removeItem(at:directory)}
        let store=try SessionStore(root:directory)
        let first=try store.addText("Design review: Q4/Q5*",display:"A")
        expectTrue(first.fileURL.lastPathComponent.hasPrefix("Design review Q4 Q5"))
        expectTrue(first.fileURL.pathExtension=="txt")
        let dup=try store.addText("Design review: Q4/Q5*",display:"B")
        expectEqual(store.items.count,1)
        expectEqual(store.items.last?.id,dup.id)
        let edited=try store.updateText(id:dup.id,text:"Design review updated")
        expectEqual(edited.text,"Design review updated")
        expectEqual(try String(contentsOf:edited.fileURL,encoding:.utf8),"Design review updated")
        let png=Data([137,80,78,71,13,10,26,10,0,0,0,0])
        let img1=try store.addPNG(png,title:"Figma · 14:25",display:"A",width:1200,height:800,fileStem:"mock/shot")
        expectTrue(img1.fileURL.lastPathComponent.hasPrefix("mock shot"))
        let img2=try store.addPNG(png,title:"Figma · 14:26",display:"B",width:1200,height:800)
        expectEqual(store.items.filter{$0.kind=="image"}.count,1)
        expectEqual(store.items.last?.id,img2.id)
        expectTrue(SemVer.isNewer("v1.2.0",than:"1.1.3"))
        expectTrue(SemVer.isNewer("1.1.4",than:"1.1.3"))
        expectFalse(SemVer.isNewer("v1.1.3",than:"1.1.3"))
        expectFalse(SemVer.isNewer("v1.0.9",than:"1.1.3"))
        store.cleanup()
    }
}

func expectEqual<T:Equatable>(_ actual:T,_ expected:T) {precondition(actual==expected,"Expected \(expected), got \(actual)")}
func expectTrue(_ value:Bool) {precondition(value,"Expected true")}
func expectFalse(_ value:Bool) {precondition(!value,"Expected false")}
func expectThrows<T>(_ action:@autoclosure () throws -> T) {do{_ = try action();fatalError("Expected an error")}catch{}}
func expectNoThrow<T>(_ action:@autoclosure () throws -> T) {do{_ = try action()}catch{fatalError("Unexpected error: \(error)")}}
let checks=StoreChecks()
try checks.testTextRoundTripRemovalAndSessionCleanup();print("PASS: full text, removal and cleanup")
try checks.testCapacityAndClearPreserveExports();print("PASS: 30-note capacity, oldest eviction, clear and export lifetime")
try checks.testCleanupDoesNotTouchUnownedFolders();print("PASS: original files and unowned directories preserved")
try checks.testPreferencesPersistAndRejectConflicts();print("PASS: both shortcuts persist; legacy opening defaults migrate; duplicate, Copy and modifier-free shortcuts rejected")
try checks.testDeduplicationReadableNamesEditAndSemVer();print("PASS: deduplication, readable filenames, in-place text edits and semver comparison")
