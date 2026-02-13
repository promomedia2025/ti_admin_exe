# PowerShell script to publish updates
# Usage: .\publish-update.ps1 [version]
# Example: .\publish-update.ps1 1.0.1

param(
    [string]$Version = ""
)

Write-Host "🚀 Publishing Update for SpitikoExe" -ForegroundColor Cyan
Write-Host ""

# Check if GH_TOKEN is set
if (-not $env:GH_TOKEN) {
    Write-Host "❌ ERROR: GH_TOKEN environment variable is not set!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please set your GitHub token:" -ForegroundColor Yellow
    Write-Host '  $env:GH_TOKEN="your_github_token_here"' -ForegroundColor White
    Write-Host ""
    Write-Host "Get a token from: https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "Make sure it has 'repo' permissions" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ GitHub token found" -ForegroundColor Green

# Read current version
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version

Write-Host "📦 Current version: $currentVersion" -ForegroundColor Cyan

# If version provided, update package.json
if ($Version -ne "") {
    Write-Host "📝 Updating version to: $Version" -ForegroundColor Yellow
    $packageJson.version = $Version
    $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
    Write-Host "✅ Version updated" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  No version specified. Using current version: $currentVersion" -ForegroundColor Yellow
    Write-Host "   To specify a version, run: .\publish-update.ps1 1.0.1" -ForegroundColor Gray
    Write-Host ""
    $confirm = Read-Host "Continue with current version? (y/n)"
    if ($confirm -ne "y") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "🔨 Building and publishing..." -ForegroundColor Cyan
Write-Host ""

# Run electron-builder publish
npm run publish

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Update published successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Users will receive the update automatically:" -ForegroundColor Cyan
    Write-Host "  - On app startup" -ForegroundColor White
    Write-Host "  - Every 4 hours (automatic check)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Publishing failed. Check the error messages above." -ForegroundColor Red
    exit 1
}
