# Android Setup Requirements for Appium

This guide covers the additional requirements needed for Android automation with Appium.

## ✅ What's Already Done

- ✅ Appium Server installed (v3.1.1)
- ✅ UiAutomator2 Driver installed (v6.2.1)

## ⚠️ What You Still Need

### 1. Android SDK

**Option A: Install via Android Studio (Recommended)**

1. Download Android Studio from https://developer.android.com/studio
2. Install Android Studio
3. Open Android Studio → Settings → Appearance & Behavior → System Settings → Android SDK
4. Install:
   - **Android SDK Platform** (choose API level, e.g., API 30, 31, 33)
   - **Android SDK Platform-Tools**
5. Note the SDK location (usually `C:\Users\<YourName>\AppData\Local\Android\Sdk` on Windows)

**Option B: Install via Command Line**

1. Download Android command-line tools from https://developer.android.com/studio#command-tools
2. Extract to a directory (e.g., `C:\Android\cmdline-tools`)
3. Use `sdkmanager` to install:
   ```bash
   sdkmanager "platform-tools" "platforms;android-33"
   ```

**Set ANDROID_HOME Environment Variable**

Windows (PowerShell as Administrator):
```powershell
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', 'C:\Users\<YourName>\AppData\Local\Android\Sdk', 'User')
```

Or manually:
1. Open System Properties → Environment Variables
2. Add new User variable:
   - Name: `ANDROID_HOME`
   - Value: `C:\Users\<YourName>\AppData\Local\Android\Sdk` (your SDK path)
3. Add to PATH: `%ANDROID_HOME%\platform-tools`

### 2. Java JDK

**Download and Install**

1. Download JDK 8 or 9+ from:
   - Oracle: https://www.oracle.com/java/technologies/downloads/
   - Adoptium (recommended): https://adoptium.net/
2. Install JDK
3. Note the installation path (e.g., `C:\Program Files\Java\jdk-17`)

**Set JAVA_HOME Environment Variable**

Windows (PowerShell as Administrator):
```powershell
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Java\jdk-17', 'User')
```

Or manually:
1. Open System Properties → Environment Variables
2. Add new User variable:
   - Name: `JAVA_HOME`
   - Value: `C:\Program Files\Java\jdk-17` (your JDK path)
3. Add to PATH: `%JAVA_HOME%\bin`

**Verify Installation**

```bash
java -version
javac -version
```

### 3. Android Device or Emulator

**Option A: Android Emulator (AVD)**

1. Open Android Studio
2. Tools → Device Manager
3. Create Virtual Device
4. Select device (e.g., Pixel 5)
5. Download system image (e.g., API 33)
6. Finish and start emulator

**Option B: Physical Android Device**

1. Enable Developer Options on your Android device:
   - Settings → About Phone → Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging
3. Connect device via USB
4. Accept USB debugging prompt on device

**Verify Device Connection**

```bash
adb devices
```

Should show:
```
List of devices attached
emulator-5554    device
```

Or for physical device:
```
List of devices attached
ABC123XYZ        device
```

## 🔍 Verify Complete Setup

Run these commands to verify everything is set up:

```bash
# Check Appium
appium --version
# Should show: 3.1.1

# Check driver
appium driver list
# Should show: uiautomator2@6.2.1 [installed]

# Check Android SDK
echo $env:ANDROID_HOME
# Should show your SDK path

# Check adb
adb version
# Should show Android Debug Bridge version

# Check Java
java -version
# Should show Java version

# Check devices
adb devices
# Should list connected devices/emulators
```

## 🚀 Next Steps

Once everything is set up:

1. **Start Appium Server**:
   ```bash
   appium
   ```

2. **Verify driver is available**:
   Look for this in Appium output:
   ```
   [Appium] Available drivers:
   [Appium]   - uiautomator2@6.2.1 (automationName 'UiAutomator2')
   ```

3. **Test connection**:
   ```bash
   curl http://localhost:4723/status
   ```

4. **Update worker code** to use real Appium instead of mocked implementation

## 📚 Resources

- **Android Studio**: https://developer.android.com/studio
- **Android SDK**: https://developer.android.com/studio/intro/update
- **UiAutomator2 Driver Docs**: https://github.com/appium/appium-uiautomator2-driver
- **Appium Android Setup**: https://appium.io/docs/en/latest/quickstart/android/

## ⚠️ Troubleshooting

### ANDROID_HOME not found
- Verify Android SDK is installed
- Check environment variable is set correctly
- Restart terminal/IDE after setting environment variables

### adb not found
- Ensure `platform-tools` is installed in Android SDK
- Add `%ANDROID_HOME%\platform-tools` to PATH
- Restart terminal

### JAVA_HOME not found
- Verify Java JDK is installed (not just JRE)
- Check environment variable points to JDK directory (not bin subdirectory)
- Restart terminal after setting

### No devices found
- For emulator: Start AVD from Android Studio
- For physical device: Enable USB debugging and accept prompt
- Check USB connection
- Run `adb devices` to verify

---

**Status**: ✅ Appium and UiAutomator2 driver are ready. You need to set up Android SDK and Java JDK to complete Android automation setup.

