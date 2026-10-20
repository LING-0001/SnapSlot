param([ValidateSet("win-x64","win-arm64")][string]$Runtime = "win-x64")
$ErrorActionPreference = "Stop"
$SnapSlotRoot = Split-Path -Parent $PSScriptRoot
Push-Location $SnapSlotRoot
try {
    if (-not (Test-Path "apps/website/node_modules")) { npm ci --prefix apps/website; if ($LASTEXITCODE) { throw "npm ci failed" } }
    npm run build:native --prefix apps/website
    if ($LASTEXITCODE) { throw "Native UI build failed" }
    $Dotnet = if (Test-Path ".tools/dotnet/dotnet.exe") { Join-Path $SnapSlotRoot ".tools/dotnet/dotnet.exe" } else { "dotnet" }
    & $Dotnet run --project apps/windows/Checks/SnapSlot.Windows.Checks.csproj -- artifacts/native-ui
    if ($LASTEXITCODE) { throw "Windows core checks failed" }
    $Output = Join-Path $SnapSlotRoot "artifacts/windows/$Runtime"
    & $Dotnet publish apps/windows/SnapSlot.Windows.csproj -c Release -r $Runtime --self-contained true -p:PublishSingleFile=false -o $Output
    if ($LASTEXITCODE) { throw "Windows publish failed" }
    Compress-Archive -Path "$Output/*" -DestinationPath "artifacts/windows/SnapSlot-$Runtime.zip" -Force
    Write-Output "Built: $Output/SnapSlot.exe"
    Write-Output "Keep the NativeUI directory and DLLs beside the exe. Distribute the ZIP, not the exe alone."
} finally { Pop-Location }
