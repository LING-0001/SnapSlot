import AppKit
let folder=URL(fileURLWithPath:CommandLine.arguments[1],isDirectory:true)
try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
for size in [16,32,128,256,512] {
    for scale in [1,2] {
        let pixels=size*scale
        let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:pixels,pixelsHigh:pixels,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
        NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
        let factor=CGFloat(pixels)/1024;let transform=NSAffineTransform();transform.scale(by:factor);transform.concat()
        NSColor(calibratedRed:18/255,green:99/255,blue:215/255,alpha:1).setFill();NSBezierPath(roundedRect:NSRect(x:16,y:16,width:992,height:992),xRadius:220,yRadius:220).fill()
        NSColor.white.setFill();NSBezierPath(roundedRect:NSRect(x:268,y:184,width:488,height:612),xRadius:75,yRadius:75).fill()
        NSColor(calibratedRed:0.75,green:0.87,blue:1,alpha:1).setFill();NSBezierPath(roundedRect:NSRect(x:385,y:716,width:254,height:146),xRadius:50,yRadius:50).fill()
        NSColor(calibratedRed:18/255,green:99/255,blue:215/255,alpha:1).setFill();NSBezierPath(roundedRect:NSRect(x:444,y:755,width:136,height:38),xRadius:19,yRadius:19).fill()
        NSGraphicsContext.restoreGraphicsState()
        let name="icon_\(size)x\(size)"+(scale==2 ? "@2x":"")+".png"
        try bitmap.representation(using:.png,properties:[:])!.write(to:folder.appendingPathComponent(name))
    }
}
