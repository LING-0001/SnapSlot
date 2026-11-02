using System;
using System.Drawing;

namespace SnapSlot;

internal static class TrayIconGeometry
{
    public static Rectangle VisibleBounds(int width,int height,Func<int,int,byte> alpha)
    {
        int left=width,top=height,right=-1,bottom=-1;
        for(int y=0;y<height;y++)for(int x=0;x<width;x++)
        {
            if(alpha(x,y)<20)continue;
            left=Math.Min(left,x);top=Math.Min(top,y);right=Math.Max(right,x);bottom=Math.Max(bottom,y);
        }
        return right<left?new Rectangle(0,0,width,height):Rectangle.FromLTRB(left,top,right+1,bottom+1);
    }

    public static RectangleF Fit(Size canvas,Rectangle source)
    {
        float inset=Math.Max(1f,Math.Min(canvas.Width,canvas.Height)/32f);
        float width=canvas.Width-2*inset,height=canvas.Height-2*inset;
        // Keep the limiting axis exact rather than multiplying a rounded scale
        // back into it; the other axis retains the artwork's aspect ratio.
        if(source.Width*(double)height>=source.Height*(double)width)height=width*source.Height/source.Width;
        else width=height*source.Width/source.Height;
        return new RectangleF((canvas.Width-width)/2,(canvas.Height-height)/2,width,height);
    }
}
