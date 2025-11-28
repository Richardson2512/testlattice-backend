# Android Setup Status for Appium

## Current Status

### ✅ Appium Server
- **Status**: Installed globally (v3.1.1)
- **Location**: Global npm installation
- **Command**: `appium`

### ✅ UiAutomator2 Driver
- **Status**: Installed globally (v6.2.1)
- **Location**: Global npm installation
- **Command**: `appium driver list` shows `uiautomator2@6.2.1 [installed (npm)]`

### ❌ Android SDK
- **Status**: Not installed
- **Required**: For Android automation
- **Environment Variable**: `ANDROID_HOME` not set
- **Tools**: `adb` not found in PATH

### ❌ Java JDK
- **Status**: Not installed
- **Required**: For Android automation
- **Environment Variable**: `JAVA_HOME` not set
- **Command**: `java` not found in PATH

### ❌ Android Device/Emulator
- **Status**: No devices connected
- **Required**: Physical device or emulator for testing
- **Command**: `adb devices` not available (SDK not installed)

---

## Installation Steps

### 1. Install UiAutomator2 Driver Globally

Since Appium is installed globally, install the driver globally:

```bash
appium driver install uiautomator2
```

If that fails, try:
```bash
npm install -g appium-uiautomator2-driver
```

### 2. Install Android SDK

**Option A: Using Android Studio (Recommended)**

1. Download Android Studio from: https://developer.android.com/studio
2. Install Android Studio
3. Open Android Studio → Settings → Appearance & Behavior → System Settings → Android SDK
4. Install:
   - **Android SDK Platform** (e.g., API level 30 or 31)
   - **Android SDK Platform-Tools**
5. Note the SDK location (usually `C:\Users\<YourUser>\AppData\Local\Android\Sdk`)

**Option B: Using Command-Line Tools**

1. Download Android Command-Line Tools: https://developer.android.com/studio#command-line-tools
2. Extract to a directory (e.g., `C:\Android\cmdline-tools`)
3. Run:
   ```bash
   sdkmanager "platforms;android-30" "platform-tools"
   ```

**Set ANDROID_HOME Environment Variable:**

Windows:
1. Search "Environment Variables" in Windows
2. Click "Edit the system environment variables"
3. Click "Environment Variables..."
4. Under "System variables", click "New..."
5. Variable name: `ANDROID_HOME`
6. Variable value: Path to your Android SDK (e.g., `C:\Users\<YourUser>\AppData\Local\Android\Sdk`)
7. Click "OK"
8. Edit "Path" variable, add: `%ANDROID_HOME%\platform-tools`
9. Restart terminal/PowerShell

### 3. Install Java JDK

1. Download JDK from:
   - **Adoptium** (recommended): https://adoptium.net/
   - **Oracle**: https://www.oracle.com/java/technologies/downloads/
2. Install JDK (JDK 9+ for recent Android API levels, JDK 8 for older)
3. Note the installation path (e.g., `C:\Program Files\Java\jdk-11`)

**Set JAVA_HOME Environment Variable:**

Windows:
1. Search "Environment Variables" in Windows
2. Click "Edit the system environment variables"
3. Click "Environment Variables..."
4. Under "System variables", click "New..."
5. Variable name: `JAVA_HOME`
6. Variable value: Path to your JDK (e.g., `C:\Program Files\Java\jdk-11`)
7. Click "OK"
8. Edit "Path" variable, add: `%JAVA_HOME%\bin`
9. Restart terminal/PowerShell

### 4. Verify Installation

After setting environment variables, restart your terminal and run:

```bash
# Verify Android SDK
echo $env:ANDROID_HOME  # PowerShell
adb version

# Verify Java JDK
echo $env:JAVA_HOME  # PowerShell
java -version

# Verify Appium driver
appium driver list
# Should show: uiautomator2@[version] [installed]
```

### 5. Prepare Android Device/Emulator

**Option A: Android Emulator (AVD)**

1. Open Android Studio
2. Go to Tools → Device Manager (or AVD Manager)
3. Click "Create Device"
4. Select a device (e.g., Pixel 5)
5. Select a system image (e.g., API 30)
6. Click "Finish"
7. Click "Play" button to start emulator

**Option B: Physical Android Device**

1. On your Android device:
   - Go to Settings → About phone
   - Tap "Build number" 7 times to enable Developer options
   - Go to Settings → System → Developer options
   - Enable "USB debugging"
2. Connect device via USB
3. Accept "Allow USB debugging?" prompt on device

**Verify Device Connection:**

```bash
adb devices
# Should show your device/emulator listed
```

---

## Quick Setup Checklist

- [ ] Install UiAutomator2 driver globally
- [ ] Install Android SDK (via Android Studio or command-line tools)
- [ ] Set `ANDROID_HOME` environment variable
- [ ] Add `%ANDROID_HOME%\platform-tools` to PATH
- [ ] Install Java JDK
- [ ] Set `JAVA_HOME` environment variable
- [ ] Add `%JAVA_HOME%\bin` to PATH
- [ ] Restart terminal/PowerShell
- [ ] Verify `adb version` works
- [ ] Verify `java -version` works
- [ ] Create Android emulator or connect physical device
- [ ] Verify `adb devices` shows your device
- [ ] Start Appium server: `appium`
- [ ] Verify driver is listed: `appium driver list`

---

## Troubleshooting

### Driver Installation Fails
- **Issue**: Version conflict
- **Solution**: Install driver globally to match global Appium version
- **Alternative**: Use `--legacy-peer-deps` flag if needed

### ANDROID_HOME Not Found
- **Issue**: Environment variable not set or not in PATH
- **Solution**: Set `ANDROID_HOME` and add `platform-tools` to PATH, restart terminal

### JAVA_HOME Not Found
- **Issue**: Environment variable not set or not in PATH
- **Solution**: Set `JAVA_HOME` and add `bin` to PATH, restart terminal

### No Devices Found
- **Issue**: Device/emulator not connected or not recognized
- **Solution**: 
  - For emulator: Start AVD in Android Studio
  - For physical device: Enable USB debugging, accept prompt
  - Run `adb devices` to verify

---

## Next Steps After Setup

1. **Start Appium Server**:
   ```bash
   appium
   ```

2. **Verify Driver**:
   ```bash
   appium driver list
   # Should show: uiautomator2@[version] [installed]
   ```

3. **Create Test Run**:
   - Build type: `android`
   - Device profile: `android-emulator`
   - The worker will use real Appium with UiAutomator2 driver

---

**Note**: The Appium runner code is already updated to use real Appium. Once you complete the Android SDK and Java JDK setup, everything will work with real device automation!

