# Echopad Release Script
# Usage: .\scripts\release.ps1 -Version "0.2.0"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Preparing release v$Version" -ForegroundColor Cyan

# Validate version format
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Host "❌ Invalid version format. Use semantic versioning (e.g., 0.2.0)" -ForegroundColor Red
    exit 1
}

# Update version in package.json
Write-Host "📦 Updating package.json..." -ForegroundColor Yellow
$packageJson = Get-Content -Path "package.json" -Raw | ConvertFrom-Json
$packageJson.version = $Version
$packageJson | ConvertTo-Json -Depth 100 | Set-Content -Path "package.json"

# Update version in tauri.conf.json
Write-Host "⚙️  Updating tauri.conf.json..." -ForegroundColor Yellow
$tauriConf = Get-Content -Path "src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json
$tauriConf.version = $Version
$tauriConf | ConvertTo-Json -Depth 100 | Set-Content -Path "src-tauri/tauri.conf.json"

# Update version in Cargo.toml
Write-Host "🦀 Updating Cargo.toml..." -ForegroundColor Yellow
$cargoToml = Get-Content -Path "src-tauri/Cargo.toml" -Raw
$cargoToml = $cargoToml -replace 'version = "[0-9]+\.[0-9]+\.[0-9]+"', "version = `"$Version`""
Set-Content -Path "src-tauri/Cargo.toml" -Value $cargoToml

# Git operations
Write-Host "📝 Creating git commit and tag..." -ForegroundColor Yellow
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to v$Version"
git tag -a "v$Version" -m "Release v$Version"

Write-Host ""
Write-Host "✅ Version bumped to v$Version" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review the changes: git log -1 && git show v$Version"
Write-Host "  2. Push to GitHub:     git push origin main --tags"
Write-Host "  3. The GitHub Action will automatically build and create the release"
Write-Host ""



