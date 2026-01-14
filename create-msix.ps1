# Quick File Converter MSIX Package Builder
# Creates an unsigned MSIX package for Microsoft Store submission

param(
    [string]$OutputPath = ".\QuickFileConverter.msix",
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Quick File Converter MSIX Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$AppDir = ".\release\technician-app-win32-x64"
$TempMsixDir = ".\msix-temp"
$AssetsDir = ".\public\assets"

# Find MakeAppx.exe
$SdkPaths = @(
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.26100.0\x64\makeappx.exe",
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.22621.0\x64\makeappx.exe",
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.22000.0\x64\makeappx.exe",
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.19041.0\x64\makeappx.exe"
)

$MakeAppx = $null
foreach ($path in $SdkPaths) {
    if (Test-Path $path) {
        $MakeAppx = $path
        break
    }
}

if (-not $MakeAppx) {
    # Try to find any version
    $sdkBin = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
    if (Test-Path $sdkBin) {
        $versions = Get-ChildItem $sdkBin -Directory | Where-Object { $_.Name -match "^10\.0\." } | Sort-Object Name -Descending
        foreach ($ver in $versions) {
            $testPath = Join-Path $ver.FullName "x64\makeappx.exe"
            if (Test-Path $testPath) {
                $MakeAppx = $testPath
                break
            }
        }
    }
}

if (-not $MakeAppx) {
    Write-Error "MakeAppx.exe not found. Please install Windows 10 SDK."
    exit 1
}

Write-Host "Using MakeAppx: $MakeAppx" -ForegroundColor Gray

# Step 1: Build application (optional)
if (-not $SkipBuild) {
    Write-Host "[1/4] Building application..." -ForegroundColor Green
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build application"
        exit 1
    }
    Write-Host "[2/4] Build completed (electron-packager included in build)..." -ForegroundColor Green
} else {
    Write-Host "[1/4] Skipping build (using existing release)..." -ForegroundColor Yellow
    Write-Host "[2/4] Skipping packaging..." -ForegroundColor Yellow
}

# Verify source directory exists
if (-not (Test-Path $AppDir)) {
    Write-Error "Application directory not found: $AppDir"
    exit 1
}

# Step 3: Prepare MSIX structure
Write-Host "[3/4] Preparing MSIX package structure..." -ForegroundColor Green

# Clean and create temp directory
if (Test-Path $TempMsixDir) {
    Remove-Item $TempMsixDir -Recurse -Force
}
New-Item -ItemType Directory -Path $TempMsixDir | Out-Null

# First, clean up any recursive folders in the release directory
$recursiveMsixTemp = "$AppDir\resources\app\msix-temp"
if (Test-Path $recursiveMsixTemp) {
    Write-Host "  Cleaning recursive msix-temp from release..." -ForegroundColor Yellow
    Remove-Item $recursiveMsixTemp -Recurse -Force
}

# Copy only the necessary Electron runtime files (exclude full source code)
Write-Host "  Copying Electron runtime files..." -ForegroundColor Gray

# Copy root level files (exe, dll, pak, etc.)
Get-ChildItem "$AppDir" -File | ForEach-Object {
    Copy-Item $_.FullName "$TempMsixDir\" -Force
}

# Copy locales folder
Copy-Item "$AppDir\locales" "$TempMsixDir\locales" -Recurse -Force

# Copy resources folder but ONLY the bare minimum needed to run
# Exclude: node_modules, src, public, and other source files
Write-Host "  Copying resources (excluding source code)..." -ForegroundColor Gray
New-Item -ItemType Directory -Path "$TempMsixDir\resources" -Force | Out-Null
New-Item -ItemType Directory -Path "$TempMsixDir\resources\app" -Force | Out-Null

# Copy only essential runtime files from resources/app
Copy-Item "$AppDir\resources\app\dist" "$TempMsixDir\resources\app\dist" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$AppDir\resources\app\package.json" "$TempMsixDir\resources\app\" -Force -ErrorAction SilentlyContinue
Copy-Item "$AppDir\resources\app\main.js" "$TempMsixDir\resources\app\" -Force -ErrorAction SilentlyContinue
Copy-Item "$AppDir\resources\app\preload.js" "$TempMsixDir\resources\app\" -Force -ErrorAction SilentlyContinue
Copy-Item "$AppDir\resources\app\index.html" "$TempMsixDir\resources\app\" -Force -ErrorAction SilentlyContinue

Write-Host "  Runtime files copied successfully" -ForegroundColor Green

# Copy AppxManifest.xml
Write-Host "  Copying AppxManifest.xml..." -ForegroundColor Gray
Copy-Item -Path ".\AppxManifest.xml" -Destination $TempMsixDir -Force

# Create assets directory and copy logos
$MsixAssetsDir = "$TempMsixDir\assets"
if (-not (Test-Path $MsixAssetsDir)) {
    New-Item -ItemType Directory -Path $MsixAssetsDir | Out-Null
}

# Copy/Create logo assets for MSIX
Write-Host "  Copying logo assets..." -ForegroundColor Gray
$sourceIcon = "$AssetsDir\icon.png"

if (Test-Path $sourceIcon) {
    # Create all required logo files from the existing icon
    $logoFiles = @(
        "StoreLogo.png",
        "Square44x44Logo.png",
        "Square150x150Logo.png",
        "Wide310x150Logo.png",
        "Square71x71Logo.png"
    )
    
    foreach ($logo in $logoFiles) {
        Copy-Item -Path $sourceIcon -Destination "$MsixAssetsDir\$logo" -Force
    }
    Write-Host "  Logo assets created from icon.png" -ForegroundColor Gray
} else {
    Write-Warning "  Icon file not found at $sourceIcon. Logo assets may be missing."
}

# Step 4: Create MSIX package
Write-Host "[4/4] Creating MSIX package..." -ForegroundColor Green

# Remove existing output file
if (Test-Path $OutputPath) {
    Remove-Item $OutputPath -Force
}

# Use absolute paths for MakeAppx
$AbsTempDir = (Resolve-Path $TempMsixDir).Path
$AbsOutputPath = Join-Path (Get-Location).Path $OutputPath.TrimStart(".\")

# Run MakeAppx with absolute paths
Write-Host "  Running MakeAppx..." -ForegroundColor Gray
& $MakeAppx pack /d "$AbsTempDir" /p "$AbsOutputPath" /nv
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create MSIX package"
    exit 1
}

# Cleanup temp directory
Write-Host "  Cleaning up temporary files..." -ForegroundColor Gray
Remove-Item $TempMsixDir -Recurse -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MSIX Package Created Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output: $OutputPath" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Upload $OutputPath to Microsoft Partner Center" -ForegroundColor Gray
Write-Host "  2. Partner Center will sign the package automatically" -ForegroundColor Gray
Write-Host ""

