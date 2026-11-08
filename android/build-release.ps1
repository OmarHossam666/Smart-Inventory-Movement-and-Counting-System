param(
    [string]$Keystore = "release-key.jks",
    [string]$Password = ""
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Auto-detect Android build-tools
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { "D:\Apps\Android" }
$buildToolsDir = Join-Path $sdkRoot "build-tools"
$latestVersion = Get-ChildItem $buildToolsDir | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty Name
$buildTools = Join-Path $buildToolsDir $latestVersion

Write-Host "Using Android Build Tools: $buildTools" -ForegroundColor Cyan

$releaseDir = ".\app\build\outputs\apk\release"
$unsignedApk = "$releaseDir\app-release-unsigned.apk"
$alignedApk = "$releaseDir\app-release-aligned.apk"
$signedApk = "$releaseDir\app-release-signed.apk"

Write-Host "==> [1/4] Building Release APK with Gradle..." -ForegroundColor Cyan
.\gradlew.bat assembleRelease

if (-not (Test-Path $unsignedApk)) {
    Write-Host "ERROR: Release APK was not generated." -ForegroundColor Red
    exit 1
}

Write-Host "==> [2/4] Aligning APK with zipalign..." -ForegroundColor Cyan
& "$buildTools\zipalign.exe" -f -v -p 4 $unsignedApk $alignedApk

Write-Host "==> [3/4] Signing APK with apksigner..." -ForegroundColor Cyan
if ($Password) {
    & "$buildTools\apksigner.bat" sign --ks $Keystore --ks-pass "pass:$Password" --out $signedApk $alignedApk
} else {
    & "$buildTools\apksigner.bat" sign --ks $Keystore --out $signedApk $alignedApk
}

Write-Host "==> [4/4] Verifying signed APK..." -ForegroundColor Cyan
& "$buildTools\apksigner.bat" verify $signedApk

Write-Host "==================================================" -ForegroundColor Green
Write-Host "SUCCESS: Release APK signed and verified!" -ForegroundColor Green
Write-Host "Path: $(Resolve-Path $signedApk)" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

