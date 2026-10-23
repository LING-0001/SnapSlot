import AppKit
// Draws the SnapSlot mark (apps/website/public/icon.svg): a fan of notes hanging from the screen's top edge.
// Geometry is authored on the SVG's 64-unit grid, top-left origin, and flipped for AppKit.
let folder=URL(fileURLWithPath:CommandLine.arguments[1],isDirectory:true)
try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
func rgb(_ hex:Int,_ alpha:CGFloat=1)->NSColor{NSColor(calibratedRed:CGFloat(hex>>16&255)/255,green:CGFloat(hex>>8&255)/255,blue:CGFloat(hex&255)/255,alpha:alpha)}
func box(_ x:CGFloat,_ y:CGFloat,_ w:CGFloat,_ h:CGFloat,_ r:CGFloat)->NSBezierPath{NSBezierPath(roundedRect:NSRect(x:x,y:64-y-h,width:w,height:h),xRadius:r,yRadius:r)}
func turned(_ path:NSBezierPath,_ degrees:CGFloat)->NSBezierPath{
    // Rotate about (32, 64) in SVG space, which is (32, 0) in AppKit space; SVG's clockwise is AppKit's counter-clockwise.
    let t=AffineTransform(translationByX:32,byY:0);var m=t;m.rotate(byDegrees:-degrees);m.translate(x:-32,y:0)
    let copy=path.copy() as! NSBezierPath;copy.transform(using:m);return copy
}
for size in [16,32,128,256,512] {
    for scale in [1,2] {
        let pixels=size*scale
        let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:pixels,pixelsHigh:pixels,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
        NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
        let transform=NSAffineTransform();transform.scale(by:CGFloat(pixels)/64);transform.concat()
        NSGradient(starting:rgb(0x4a94ff),ending:rgb(0x0b57d9))!.draw(in:box(0,0,64,64,14.5),angle:-90)
        let shift:CGFloat=6
        rgb(0xffffff,0.5).setFill();box(10,9+shift,44,2.4,1.2).fill()
        let side=box(20,17+shift,24,19,4);turned(side,-17).fill();turned(side,17).fill()
        rgb(0xffffff).setFill();box(18,16+shift,28,23,4.6).fill()
        let sky=box(21,19+shift,22,14.5,2.4)
        NSGradient(starting:rgb(0xcfe2ff),ending:rgb(0xeef5ff))!.draw(in:sky,angle:-90)
        NSGraphicsContext.saveGraphicsState();sky.addClip()
        let hill=NSBezierPath();for (i,p) in [(21,31.5),(27,25.7),(31,29.2),(34.6,26.4),(43,32.5),(43,40),(21,40)].enumerated(){let q=NSPoint(x:p.0,y:64-(p.1+shift));i==0 ? hill.move(to:q):hill.line(to:q)};hill.close()
        rgb(0x3a84f4).setFill();hill.fill()
        NSGraphicsContext.restoreGraphicsState()
        let pin=NSBezierPath(ovalIn:NSRect(x:32-3.3,y:64-(16+shift)-3.3,width:6.6,height:6.6))
        rgb(0x0b57d9).setFill();pin.fill();rgb(0xffffff).setStroke();pin.lineWidth=1.7;pin.stroke()
        NSGraphicsContext.restoreGraphicsState()
        let name="icon_\(size)x\(size)"+(scale==2 ? "@2x":"")+".png"
        try bitmap.representation(using:.png,properties:[:])!.write(to:folder.appendingPathComponent(name))
    }
}
