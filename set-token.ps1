# PowerShell script to set GitHub token securely
# Usage: .\set-token.ps1

Write-Host "🔐 GitHub Token Setup" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will set your GitHub token as a user environment variable." -ForegroundColor Yellow
Write-Host ""

# Get token from user (hidden input)
$token = Read-Host "Enter your GitHub token" -AsSecureString
$plainToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))

if ([string]::IsNullOrWhiteSpace($plainToken)) {
    Write-Host "❌ Token cannot be empty!" -ForegroundColor Red
    exit 1
}

# Set environment variable for current user
try {
    [System.Environment]::SetEnvironmentVariable('GH_TOKEN', $plainToken, 'User')
    Write-Host ""
    Write-Host "✅ Token saved successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Restart your terminal/IDE for changes to take effect." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To verify, restart terminal and run:" -ForegroundColor Cyan
    Write-Host '  echo $env:GH_TOKEN' -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "❌ Failed to save token: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running PowerShell as Administrator." -ForegroundColor Yellow
    exit 1
}
