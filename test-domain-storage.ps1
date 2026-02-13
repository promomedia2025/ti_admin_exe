# Test script to verify domain storage after installation

Write-Host "=== Checking Domain Storage ===" -ForegroundColor Cyan
Write-Host ""

# Check Registry
Write-Host "1. Registry Check:" -ForegroundColor Yellow
try {
    $regValue = reg query "HKLM\Software\SpitikoExe" /v AppDomain 2>$null
    if ($regValue) {
        Write-Host "   ✓ Found in Registry:" -ForegroundColor Green
        Write-Host "   $regValue" -ForegroundColor White
    } else {
        Write-Host "   ✗ Not found in Registry" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Error reading Registry: $_" -ForegroundColor Red
}

Write-Host ""

# Check Config File (common installation paths)
Write-Host "2. Config File Check:" -ForegroundColor Yellow
$possiblePaths = @(
    "C:\Program Files\SpitikoExe\resources\config.url",
    "C:\Program Files (x86)\SpitikoExe\resources\config.url",
    "$env:LOCALAPPDATA\Programs\SpitikoExe\resources\config.url",
    "$env:ProgramFiles\SpitikoExe\resources\config.url"
)

$found = $false
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        Write-Host "   ✓ Found config file at:" -ForegroundColor Green
        Write-Host "   $path" -ForegroundColor White
        Write-Host "   Content:" -ForegroundColor Cyan
        $content = Get-Content $path -Raw
        Write-Host "   '$($content.Trim())'" -ForegroundColor White
        $found = $true
        break
    }
}

if (-not $found) {
    Write-Host "   ✗ Config file not found in common locations" -ForegroundColor Red
    Write-Host "   Check your installation directory manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
