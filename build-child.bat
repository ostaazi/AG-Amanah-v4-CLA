@echo off
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
set "PROJECT=d:\Projects\copy2-of-latest-copy-of-copy4-of-amanah_-parental-control-ai\android-child"
if not "%SKIP_RELEASE_GUARD%"=="1" (
    echo Running release guard (validate + zero quality gates)...
    call npm run release:guard
    if errorlevel 1 (
        echo Release guard failed. Child APK build aborted.
        exit /b %ERRORLEVEL%
    )
) else (
    echo SKIP_RELEASE_GUARD=1 detected. Bypassing release guard.
)
echo Starting Child APK Gradle build (JDK 21)...
echo JAVA_HOME=%JAVA_HOME%
call "%PROJECT%\gradlew.bat" -p "%PROJECT%" assembleDebug --no-daemon
echo.
echo Exit code: %ERRORLEVEL%
if exist "%PROJECT%\app\build\outputs\apk\debug\app-debug.apk" (
    echo SUCCESS: Child APK built!
    dir "%PROJECT%\app\build\outputs\apk\debug\app-debug.apk"
) else (
    echo FAILED: Child APK not found
)
