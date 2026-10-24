import AppKit

guard CommandLine.arguments.count == 2 else { fatalError("Usage: swift dmg-background.swift OUTPUT.png") }
let size = NSSize(width: 620, height: 400)
let image = NSImage(size: size)
image.lockFocus()
NSColor(srgbRed: 0.98, green: 0.98, blue: 0.97, alpha: 1).setFill()
NSBezierPath(rect: NSRect(origin: .zero, size: size)).fill()
func text(_ value: String, y: CGFloat, font: NSFont, color: NSColor) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    (value as NSString).draw(in: NSRect(x: 36, y: y, width: 548, height: 38), withAttributes: [.font: font, .foregroundColor: color, .paragraphStyle: paragraph])
}
let ink = NSColor(srgbRed: 0.12, green: 0.14, blue: 0.16, alpha: 1)
let secondary = NSColor(srgbRed: 0.35, green: 0.38, blue: 0.42, alpha: 1)
text("SnapSlot", y: 310, font: .systemFont(ofSize: 30, weight: .semibold), color: ink)
text("拖到右侧文件夹，完成安装", y: 272, font: .systemFont(ofSize: 17, weight: .medium), color: ink)
text("Drag SnapSlot to Applications to install", y: 247, font: .systemFont(ofSize: 14), color: secondary)
NSColor(srgbRed: 0.35, green: 0.43, blue: 0.55, alpha: 1).setStroke()
let arrow = NSBezierPath()
arrow.lineWidth = 2.5
arrow.lineCapStyle = .round
arrow.lineJoinStyle = .round
arrow.move(to: NSPoint(x: 273, y: 185)); arrow.line(to: NSPoint(x: 347, y: 185))
arrow.move(to: NSPoint(x: 337, y: 195)); arrow.line(to: NSPoint(x: 347, y: 185)); arrow.line(to: NSPoint(x: 337, y: 175))
arrow.stroke()
text("安装后，请从“应用程序”打开 SnapSlot", y: 42, font: .systemFont(ofSize: 13), color: secondary)
text("Then open SnapSlot from Applications", y: 20, font: .systemFont(ofSize: 12), color: secondary)
image.unlockFocus()
let output = URL(fileURLWithPath: CommandLine.arguments[1])
for scale in [1, 2] {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 620 * scale, pixelsHigh: 400 * scale, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSGraphicsContext.current!.cgContext.scaleBy(x: CGFloat(scale), y: CGFloat(scale))
    image.draw(in: NSRect(origin: .zero, size: size))
    NSGraphicsContext.restoreGraphicsState()
    bitmap.size = size
    // dmgbuild discovers background@2x.png beside background.png.
    let filename = scale == 1 ? output : output.deletingLastPathComponent().appendingPathComponent(output.deletingPathExtension().lastPathComponent + "@2x.png")
    try bitmap.representation(using: .png, properties: [:])!.write(to: filename)
}
