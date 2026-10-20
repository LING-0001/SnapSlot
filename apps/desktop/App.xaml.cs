using System;
using System.IO;
using System.Windows;
using System.Threading;

namespace SnapSlot;

public partial class App : Application
{
    private Mutex? instance;
    public static string SessionDirectory { get; private set; } = "";
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        bool smoke = e.Args.Length > 1 && e.Args[0] == "--smoke-test";
        instance = new Mutex(true, smoke ? @"Local\SnapSlot.SmokeTest" : @"Local\SnapSlot.UIPrototype", out bool first);
        if (!first) { Shutdown(); return; }
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SnapSlot", smoke ? "SmokeSessions" : "Sessions");
        Directory.CreateDirectory(root);
        // Only our own exact GUID session directories are eligible for cleanup.
        foreach (var dir in Directory.GetDirectories(root))
            if (Guid.TryParseExact(Path.GetFileName(dir), "N", out _))
                try { Directory.Delete(dir, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        SessionDirectory = Path.Combine(root, Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(SessionDirectory);
        MainWindow = new RailWindow(smoke);
        MainWindow.Show();
        if (smoke)
        {
            var output = Path.GetFullPath(e.Args[1]);
            MainWindow.Dispatcher.BeginInvoke(async () =>
            {
                try
                {
                    await ((RailWindow)MainWindow).RunSmokeTest(output);
                    Shutdown(0);
                }
                catch (Exception ex)
                {
                    Directory.CreateDirectory(output);
                    File.WriteAllText(Path.Combine(output, "desktop-error.txt"), ex.ToString());
                    Shutdown(1);
                }
            });
        }
    }
    protected override void OnExit(ExitEventArgs e)
    {
        if (SessionDirectory.Length > 0)
            try { Directory.Delete(SessionDirectory, true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
        instance?.Dispose();
        base.OnExit(e);
    }
}
