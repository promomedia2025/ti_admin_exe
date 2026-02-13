# Script to check Registry for SpitikoExe domain configuration
Write-Host "Checking Registry for SpitikoExe domain configuration..." -ForegroundColor Cyan
Write-Host ""

# Check HKLM (Machine-wide)
Write-Host "=== Checking HKLM (Machine-wide) ===" -ForegroundColor Yellow
try {
    $hklmPath = "HKLM:\Software\SpitikoExe"
    $hklmValue = Get-ItemProperty -Path $hklmPath -Name "AppDomain" -ErrorAction Stop
    Write-Host "✓ Found in HKLM:" -ForegroundColor Green
    Write-Host "  Path: $hklmPath" -ForegroundColor White
    Write-Host "  AppDomain: $($hklmValue.AppDomain)" -ForegroundColor White
} catch {
    Write-Host "✗ Not found in HKLM" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""

# Check HKCU (User-specific)
Write-Host "=== Checking HKCU (User-specific) ===" -ForegroundColor Yellow
try {
    $hkcuPath = "HKCU:\Software\SpitikoExe"
    $hkcuValue = Get-ItemProperty -Path $hkcuPath -Name "AppDomain" -ErrorAction Stop
    Write-Host "✓ Found in HKCU:" -ForegroundColor Green
    Write-Host "  Path: $hkcuPath" -ForegroundColor White
    Write-Host "  AppDomain: $($hkcuValue.AppDomain)" -ForegroundColor White
} catch {
    Write-Host "✗ Not found in HKCU" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "If no values found, the app may not be installed or the installer didn't write to registry." -ForegroundColor Yellow
