using System;

namespace SnapSlot;

internal sealed class EdgeDwell
{
    private DateTime? started;
    internal bool Update(bool atEdge, bool canReveal, DateTime now)
    {
        if (!atEdge || !canReveal) { started=null; return false; }
        started??=now;
        if (now-started.Value<TimeSpan.FromMilliseconds(500)) return false;
        started=null;return true;
    }
    internal void Reset()=>started=null;
}

internal static class NotesGeometry
{
    internal static bool IsAtTopEdge(int x,int y,int left,int top,int right)
        => x>=left&&x<right&&y>=top&&y<=top+1;
    internal static bool ShouldSuppressReveal(int left, int top, int right, int bottom, int screenLeft, int screenTop, int screenRight, int screenBottom, bool isMaximized)
        => !isMaximized && left <= screenLeft && top <= screenTop && right >= screenRight && bottom >= screenBottom;
    internal static bool IsPointerWithinRail(int x, int y, int left, int top, int width, int physicalHeight)
        => x >= left && x < left + width && y >= top && y < top + physicalHeight;
}
