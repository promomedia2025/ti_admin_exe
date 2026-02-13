@echo off
REM Batch script to publish updates
REM Usage: publish-update.bat [version]
REM Example: publish-update.bat 1.0.1

setlocal enabledelayedexpansion

echo.
echo 🚀 Publishing Update for SpitikoExe
echo.

REM Check if GH_TOKEN is set
if "%GH_TOKEN%"=="" (
    echo ❌ ERROR: GH_TOKEN environment variable is not set!
    echo.
    echo Please set your GitHub token:
    echo   set GH_TOKEN=your_github_token_here
    echo.
    echo Get a token from: https://github.com/settings/tokens
    echo Make sure it has 'repo' permissions
    exit /b 1
)

echo ✅ GitHub token found
echo.

REM Check if version argument provided
if "%1"=="" (
    echo ⚠️  No version specified. Using current version from package.json
    echo    To specify a version, run: publish-update.bat 1.0.1
    echo.
    set /p confirm="Continue with current version? (y/n): "
    if /i not "!confirm!"=="y" (
        echo Cancelled.
        exit /b 0
    )
) else (
    echo 📝 Updating version to: %1
    REM Note: This requires a Node.js script or manual edit of package.json
    echo    Please manually update version in package.json to %1
    echo    Then press any key to continue...
    pause >nul
)

echo.
echo 🔨 Building and publishing...
echo.

REM Run electron-builder publish
call npm run publish

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Update published successfully!
    echo.
    echo Users will receive the update automatically:
    echo   - On app startup
    echo   - Every 4 hours (automatic check)
    echo.
) else (
    echo.
    echo ❌ Publishing failed. Check the error messages above.
    exit /b 1
)

endlocal
