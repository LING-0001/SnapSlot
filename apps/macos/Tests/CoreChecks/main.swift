import Foundation
import SnapSlotCore
final class StoreChecks {
    func root() -> URL {FileManager.default.temporaryDirectory.appendingPathComponent("SnapSlot-Tests-"+UUID().uuidString)}
    func template() throws -> String {
        let file=URL(fileURLWithPath:#filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("apps/website/public/skins/notes.json")
        return try String(contentsOf:file,encoding:.utf8)
    }
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
    func testSkinPresetsAndRejectedFields() throws {
        let source=try template();try SkinDocument.validate(source,template:source)
        var value=try JSONSerialization.jsonObject(with:Data(source.utf8)) as! [String:Any]
        value["schemaVersion"]=2;expectThrows(try SkinDocument.validate(String(data:JSONSerialization.data(withJSONObject:value),encoding:.utf8)!,template:source))
        value["schemaVersion"]=1;value["script"]="alert(1)";expectThrows(try SkinDocument.validate(String(data:JSONSerialization.data(withJSONObject:value),encoding:.utf8)!,template:source))
        value.removeValue(forKey:"script");var card=value["card"] as! [String:Any];card["width"]=99;value["card"]=card
        expectThrows(try SkinDocument.validate(String(data:JSONSerialization.data(withJSONObject:value),encoding:.utf8)!,template:source))
        expectThrows(try SkinDocument.validate(String(repeating:" ",count:SkinDocument.maxBytes+1),template:source))
    }
    func testHotReloadKeepsLastGoodSkinOnInvalidEdits() throws {
        let directory=root();defer{try? FileManager.default.removeItem(at:directory)}
        let source=try template(),store=try SkinStore(directory:directory,template:source)
        let next=source.replacingOccurrences(of:"\"height\": 136",with:"\"height\": 180")
        try Data(next.utf8).write(to:store.activeURL,options:.atomic)
        let candidate=try store.readCandidate();try store.apply(candidate);expectEqual(SkinDocument.height(store.source),180)
        try Data("{\"schemaVersion\":99}".utf8).write(to:store.activeURL,options:.atomic)
        expectThrows(try store.readCandidate());expectEqual(SkinDocument.height(store.source),180)
        expectThrows(try store.apply("{}"));expectEqual(SkinDocument.height(store.source),180)
        let reopened=try SkinStore(directory:directory,template:source);expectEqual(SkinDocument.height(reopened.source),180)
    }
    func testEmbeddedRasterAndStrictTypes() throws {
        let source=try template();var value=try JSONSerialization.jsonObject(with:Data(source.utf8)) as! [String:Any]
        func validate() throws {try SkinDocument.validate(String(data:JSONSerialization.data(withJSONObject:value),encoding:.utf8)!,template:source)}
        value["background"]=["image":"data:image/png;base64,iVBORw0KGgo=","fit":"cover"];expectNoThrow(try validate())
        value["background"]=["image":"https://example.com/picture.png","fit":"cover"];expectThrows(try validate())
        value["background"]=["image":"data:image/svg+xml;base64,PHN2Zy8+","fit":"cover"];expectThrows(try validate())
        value.removeValue(forKey:"background");var pin=value["pin"] as! [String:Any];pin["enabled"]=1;value["pin"]=pin;expectThrows(try validate())
    }
    func testPreferencesPersistAndRejectConflicts() throws {
        let directory=root();defer{try? FileManager.default.removeItem(at:directory)}
        let url=directory.appendingPathComponent("preferences.json"),store=PreferencesStore(url:url)
        expectTrue(store.value.collectScreenshots);expectEqual(store.value.captureShortcut,Shortcut(key:"KeyS"))
        var value=store.value;value.collectScreenshots=false;value.textShortcut=Shortcut(key:"KeyC",shift:true)
        try store.save(value);expectEqual(PreferencesStore(url:url).value,value)
        var conflict=value;conflict.captureShortcut=conflict.textShortcut
        expectThrows(try store.save(conflict));expectEqual(store.value,value);expectEqual(PreferencesStore(url:url).value,value)
        conflict=value;conflict.textShortcut = .open;expectThrows(try store.save(conflict))
        conflict=value;conflict.textShortcut=Shortcut(key:"KeyT",control:false,alt:false,shift:true);expectThrows(try store.save(conflict))
        conflict=value;conflict.textShortcut=Shortcut(key:"KeyC",control:false,alt:false,meta:true);expectThrows(try store.save(conflict))
        try Data("{}".utf8).write(to:url);expectFalse(PreferencesStore(url:url,legacyCollection:false).value.collectScreenshots)
    }
}

func expectEqual<T:Equatable>(_ actual:T,_ expected:T) {precondition(actual==expected,"Expected \(expected), got \(actual)")}
func expectTrue(_ value:Bool) {precondition(value,"Expected true")}
func expectFalse(_ value:Bool) {precondition(!value,"Expected false")}
func expectThrows<T>(_ action:@autoclosure () throws -> T) {do{_ = try action();fatalError("Expected an error")}catch{}}
func expectNoThrow<T>(_ action:@autoclosure () throws -> T) {do{_ = try action()}catch{fatalError("Unexpected error: \(error)")}}
let checks=StoreChecks()
try checks.testTextRoundTripRemovalAndSessionCleanup();print("PASS: full text, no item cap, removal and cleanup")
try checks.testCleanupDoesNotTouchUnownedFolders();print("PASS: original files and unowned directories preserved")
try checks.testSkinPresetsAndRejectedFields();print("PASS: skin geometry, versions and strict fields")
try checks.testHotReloadKeepsLastGoodSkinOnInvalidEdits();print("PASS: atomic edits and last good skin")
try checks.testEmbeddedRasterAndStrictTypes();print("PASS: embedded raster and strict scalar types")
try checks.testPreferencesPersistAndRejectConflicts();print("PASS: preferences persist; duplicate, reserved and modifier-free shortcuts rejected")
