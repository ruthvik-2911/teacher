@echo off
echo ========================================
echo ERP GOODSYNK - Android APK Build Script
echo ========================================
echo.

REM Check if EAS CLI is installed
where eas >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: EAS CLI is not installed!
    echo Please run: npm install -g eas-cli
    pause
    exit /b 1
)

echo Step 1: Checking Expo login status...
eas whoami
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo You are not logged in to Expo.
    echo Please login with your Expo account:
    echo.
    eas login
    if %ERRORLEVEL% NEQ 0 (
        echo Login failed!
        pause
        exit /b 1
    )
)

echo.
echo Step 2: Configuring EAS project...
eas build:configure
if %ERRORLEVEL% NEQ 0 (
    echo Configuration failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Starting Android APK build...
echo.
echo Choose build profile:
echo 1. Production (Recommended for release)
echo 2. Preview (For testing)
echo 3. Development (For development)
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo Building PRODUCTION APK...
    eas build --platform android --profile production
) else if "%choice%"=="2" (
    echo Building PREVIEW APK...
    eas build --platform android --profile preview
) else if "%choice%"=="3" (
    echo Building DEVELOPMENT APK...
    eas build --platform android --profile development
) else (
    echo Invalid choice! Building PRODUCTION by default...
    eas build --platform android --profile production
)

echo.
echo ========================================
echo Build process initiated!
echo ========================================
echo.
echo The build is now running on Expo's servers.
echo You will receive an email when it's complete.
echo.
echo You can also monitor the build at:
echo https://expo.dev
echo.
pause
