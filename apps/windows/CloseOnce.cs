namespace SnapSlot;

// WPF can deliver another activation/deactivation notification while a window
// is processing Close(). Calling Close() again at that point terminates the app.
internal sealed class CloseOnce
{
    private bool requested;

    internal bool TryBegin()
    {
        if (requested) return false;
        requested = true;
        return true;
    }
}
