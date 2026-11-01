import AppKit

// Use the canonical brand asset, rather than a separately redrawn Mac logo.
let folder = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let source = CommandLine.arguments.count > 2 ? URL(fileURLWithPath: CommandLine.arguments[2]) : URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("assets/brand/snapslot-icon-1024.png")
guard let image = NSImage(contentsOf: source) else { fatalError("Missing brand icon: \(source.path)") }
try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        NSGraphicsContext.current?.imageInterpolation = .high
        image.draw(in: NSRect(x: 0, y: 0, width: CGFloat(pixels), height: CGFloat(pixels)), from: .zero, operation: .copy, fraction: 1)
        NSGraphicsContext.restoreGraphicsState()
        let name = "icon_\(size)x\(size)" + (scale == 2 ? "@2x" : "") + ".png"
        try bitmap.representation(using: .png, properties: [:])!.write(to: folder.appendingPathComponent(name))
    }
}

// Optional Windows ICO output, assembled from the same PNG renders without redrawing the mark.
if CommandLine.arguments.count > 3 {
    let sizes=[16,32,64,128,256]
    let names=["icon_16x16.png","icon_32x32.png","icon_32x32@2x.png","icon_128x128.png","icon_256x256.png"]
    let images=try names.map{try Data(contentsOf:folder.appendingPathComponent($0))}
    var header=Data([0,0,1,0,UInt8(sizes.count),0]),payload=Data()
    func word(_ value:UInt16)->Data {var little=value.littleEndian;return withUnsafeBytes(of:&little){Data($0)}}
    func dword(_ value:UInt32)->Data {var little=value.littleEndian;return withUnsafeBytes(of:&little){Data($0)}}
    var offset=UInt32(6+16*sizes.count)
    for (index,size) in sizes.enumerated() {
        header.append(contentsOf:[size==256 ? 0:UInt8(size),size==256 ? 0:UInt8(size),0,0])
        header.append(word(1));header.append(word(32));header.append(dword(UInt32(images[index].count)));header.append(dword(offset))
        payload.append(images[index]);offset+=UInt32(images[index].count)
    }
    header.append(payload);try header.write(to:URL(fileURLWithPath:CommandLine.arguments[3]),options:.atomic)
}
