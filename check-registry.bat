@echo off
echo Checking Registry for SpitikoExe domain configuration...
echo.

echo === Checking HKLM (Machine-wide) ===
reg query "HKLM\Software\SpitikoExe" /v AppDomain 2>nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Found in HKLM
) else (
    echo [NOT FOUND] Not found in HKLM
)
echo.

echo === Checking HKCU (User-specific) ===
reg query "HKCU\Software\SpitikoExe" /v AppDomain 2>nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Found in HKCU
) else (
    echo [NOT FOUND] Not found in HKCU
)
echo.

echo === Summary ===
echo If no values found, the app may not be installed or the installer didn't write to registry.
pause
