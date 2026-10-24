$ErrorActionPreference = "Stop"
if ($env:CI -ne "true") { throw "Run this installer lifecycle check only on a clean Windows CI runner." }
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Version = (Get-Content -Raw (Join-Path $Root "release.json") | ConvertFrom-Json).version
$Folder = Join-Path $Root "apps/website/public/downloads/v$Version"
$Setup = Join-Path $Folder "SnapSlot-$Version-windows-x64-setup.exe"
$Registration = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SnapSlot"
if ((Test-Path $Registration) -or (Get-Process SnapSlot -ErrorAction SilentlyContinue)) { throw "An existing SnapSlot installation/session must not be touched by this check." }
$Stage = Join-Path $env:RUNNER_TEMP ("SnapSlot Installer Check " + [guid]::NewGuid().ToString("N"))
$Extracted = "$Stage-extracted"
$DesktopLink = Join-Path ([Environment]::GetFolderPath("DesktopDirectory")) "SnapSlot.lnk"
$StartLink = Join-Path ([Environment]::GetFolderPath("Programs")) "SnapSlot.lnk"
if ((Test-Path $DesktopLink) -or (Test-Path $StartLink)) { throw "Existing SnapSlot shortcuts must not be touched." }
try {
    node (Join-Path $Root "scripts/verify-release.mjs")
    if ($LASTEXITCODE) { throw "Release verification failed" }
    & "C:\Program Files\7-Zip\7z.exe" x -y -bso0 "-o$Extracted" $Setup
    if ($LASTEXITCODE) { throw "Cannot inspect the installer" }
    $Bootstrapper = Join-Path $Extracted '$PLUGINSDIR/MicrosoftEdgeWebview2Setup.exe'
    $Signature = Get-AuthenticodeSignature $Bootstrapper
    if ($Signature.Status -ne "Valid" -or $Signature.SignerCertificate.Subject -notmatch "Microsoft Corporation") { throw "The WebView2 bootstrapper must have a valid Microsoft signature" }
    $Manifest = Get-Content -Raw (Join-Path $Folder "manifest.json") | ConvertFrom-Json
    if ((Get-FileHash -Algorithm SHA256 $Bootstrapper).Hash.ToLowerInvariant() -ne $Manifest.dependencies.webview2Bootstrapper.sha256) { throw "WebView2 bootstrapper checksum differs" }
    $Running = [Threading.Mutex]::new($false, "Local\SnapSlot")
    try {
        $Blocked = Start-Process -FilePath $Setup -ArgumentList "/S /D=$Stage" -PassThru -Wait
        if ($Blocked.ExitCode -ne 2 -or (Test-Path $Stage)) { throw "Setup must stop before touching files while SnapSlot is running" }
    } finally { $Running.Dispose() }
    $Process = Start-Process -FilePath $Setup -ArgumentList "/S /D=$Stage" -PassThru -Wait
    if ($Process.ExitCode -ne 0) { throw "Installation failed: $($Process.ExitCode)" }
    foreach ($File in @("SnapSlot.exe", "coreclr.dll", "NativeUI/index.html", "NativeUI/desktop.js", "Uninstall.exe")) {
        if (-not (Test-Path (Join-Path $Stage $File))) { throw "Installed file missing: $File" }
    }
    if ((Get-Item (Join-Path $Stage "SnapSlot.exe")).VersionInfo.ProductVersion -notlike "$Version*") { throw "Wrong installed product version" }
    $Registered = Get-ItemProperty $Registration
    if ($Registered.DisplayVersion -ne $Version -or $Registered.InstallLocation -ne $Stage) { throw "Installed-apps registration differs" }
    $Shell = New-Object -ComObject WScript.Shell
    foreach ($Link in @($DesktopLink, $StartLink)) {
        if (-not (Test-Path $Link) -or $Shell.CreateShortcut($Link).TargetPath -ne (Join-Path $Stage "SnapSlot.exe")) { throw "Shortcut is missing or points to the wrong app: $Link" }
    }
    # Uninstall must preserve files it did not install.
    $Sentinel = Join-Path $Stage "user-kept.txt"
    Set-Content -Path $Sentinel -Value "Keep this user file"
    $Process = Start-Process -FilePath (Join-Path $Stage "Uninstall.exe") -ArgumentList "/S" -PassThru -Wait
    $Deadline = (Get-Date).AddSeconds(30)
    while (((Test-Path $Registration) -or (Test-Path (Join-Path $Stage "SnapSlot.exe"))) -and (Get-Date) -lt $Deadline) { Start-Sleep -Milliseconds 200 }
    foreach ($File in @("SnapSlot.exe", "coreclr.dll", "NativeUI")) {
        if (Test-Path (Join-Path $Stage $File)) { throw "Uninstall left an installed file: $File" }
    }
    foreach ($Entry in @($Registration, $DesktopLink, $StartLink)) {
        if (Test-Path $Entry) { throw "Uninstall left a registration or shortcut: $Entry" }
    }
    if (-not (Test-Path $Sentinel)) { throw "Uninstall deleted an unrelated user file" }
    Write-Output "PASS: Microsoft bootstrapper signature, silent install, app version, bundled runtime, shortcuts, installed-apps registration and clean uninstall; unrelated files preserved."
} finally {
    # Both directories were created for this isolated CI run.
    Remove-Item -Recurse -Force $Stage, $Extracted -ErrorAction SilentlyContinue
}
