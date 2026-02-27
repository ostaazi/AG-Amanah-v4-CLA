@echo off
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot"
set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
set "PROJECT=d:\Projects\copy2-of-latest-copy-of-copy4-of-amanah_-parental-control-ai\android"
echo Starting Gradle build...
echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%
call "%PROJECT%\gradlew.bat" -p "%PROJECT%" assembleDebug --no-daemon
echo.
echo Exit code: %ERRORLEVEL%
if exist "%PROJECT%\app\build\outputs\apk\debug\app-debug.apk" (
    echo SUCCESS: APK built!
    dir "%PROJECT%\app\build\outputs\apk\debug\app-debug.apk"
) else (
    echo FAILED: APK not found
)
