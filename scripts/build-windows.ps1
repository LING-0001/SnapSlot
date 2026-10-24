param([ValidateSet("win-x64","win-arm64")][string]$Runtime = "win-x64", [switch]$Archive)
$ErrorActionPreference = "Stop"
$SnapSlotRoot = Split-Path -Parent $PSScriptRoot
$SnapSlotVersion = (Get-Content -Raw (Join-Path $SnapSlotRoot "release.json") | ConvertFrom-Json).version
$SnapSlotTemporary = Join-Path ([System.IO.Path]::GetTempPath()) ("snapslot-build-" + [guid]::NewGuid().ToString("N"))
$PreviousUiOutput = $env:SNAPSLOT_UI_OUTPUT
Push-Location $SnapSlotRoot
try {
    New-Item -ItemType Directory -Path $SnapSlotTemporary | Out-Null
    if (-not (Test-Path "apps/website/node_modules")) { npm ci --prefix apps/website; if ($LASTEXITCODE) { throw "npm ci failed" } }
    $env:SNAPSLOT_UI_OUTPUT = Join-Path $SnapSlotTemporary "NativeUI"
    node apps/native-ui/build.mjs
    if ($LASTEXITCODE) { throw "Native UI build failed" }
    $Dotnet = if (Test-Path ".tools/dotnet/dotnet.exe") { Join-Path $SnapSlotRoot ".tools/dotnet/dotnet.exe" } else { "dotnet" }
    & $Dotnet run --project apps/windows/Checks/SnapSlot.Windows.Checks.csproj
    if ($LASTEXITCODE) { throw "Windows core checks failed" }
    $Stage = Join-Path $SnapSlotTemporary $Runtime
    & $Dotnet publish apps/windows/SnapSlot.Windows.csproj -c Release -r $Runtime --self-contained true -p:PublishSingleFile=false "-p:Version=$SnapSlotVersion" "-p:NativeUiPath=$env:SNAPSLOT_UI_OUTPUT" -p:DebugType=None -p:DebugSymbols=false -o $Stage
    if ($LASTEXITCODE) { throw "Windows publish failed" }
    $Zip = Join-Path $SnapSlotTemporary "SnapSlot-$Runtime.zip"
    if ($Archive) { Compress-Archive -Path "$Stage/*" -DestinationPath $Zip }
    $OutputRoot = Join-Path $SnapSlotRoot "artifacts/windows"
    New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
    foreach ($Old in @("win-x64", "win-arm64", "SnapSlot-win-x64.zip", "SnapSlot-win-arm64.zip")) {
        $OldPath = Join-Path $OutputRoot $Old
        if (Test-Path $OldPath) { Remove-Item -Recurse -Force $OldPath }
    }
    if ($Archive) {
        Move-Item $Zip (Join-Path $OutputRoot "SnapSlot-$Runtime.zip")
        Write-Output "Built: $OutputRoot/SnapSlot-$Runtime.zip"
    } else {
        Move-Item $Stage (Join-Path $OutputRoot $Runtime)
        Write-Output "Built: $OutputRoot/$Runtime/SnapSlot.exe"
        Write-Output "Keep NativeUI and the DLLs beside the exe. Use -Archive for a ZIP-only package."
    }
} finally {
    $env:SNAPSLOT_UI_OUTPUT = $PreviousUiOutput
    if (Test-Path $SnapSlotTemporary) { Remove-Item -Recurse -Force $SnapSlotTemporary }
    Pop-Location
}
