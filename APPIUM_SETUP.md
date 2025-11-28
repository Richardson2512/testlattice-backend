# Appium Setup Guide

This guide covers Appium installation and configuration for mobile testing.

## ✅ Installation Complete

Appium and UiAutomator2 driver have been installed.

### Verify Installation

```bash
appium --version
# Should show: 3.1.1 (or similar)

appium driver list
# Should show: uiautomator2@6.2.1 [installed]
```

### Installed Components
- ✅ **Appium Server**: v3.1.1 (installed globally)
- ✅ **UiAutomator2 Driver**: v6.2.1 (for Android automation)

## 📱 Next Steps: Install Drivers

Appium requires drivers to interact with mobile devices. Install the drivers you need:

### For Android Testing

✅ **UiAutomator2 Driver**: Already installed (v6.2.1)

**Requirements** (Need to be set up separately):
- **Android SDK** - Install via Android Studio or command-line tools
  - Set `ANDROID_HOME` environment variable
  - Install Android SDK Platform and Platform-Tools
- **Java JDK** - JDK 8 or 9+ required
  - Set `JAVA_HOME` environment variable
- **Android Device/Emulator** - Physical device or AVD (Android Virtual Device)
  - Verify connection: `adb devices`

### For iOS Testing (macOS only)

```bash
appium driver install xcuitest
```

This installs the XCUITest driver for iOS automation.

**Requirements**:
- macOS (iOS testing only works on Mac)
- Xcode installed
- iOS Simulator or physical device
- `xcrun simctl` available

## 🚀 Starting Appium Server

Start the Appium server:

```bash
appium
```

You should see output like:
```
[Appium] Welcome to Appium v3.1.1
[Appium] Available drivers:
[Appium]   - uiautomator2@6.2.1 (automationName 'UiAutomator2')
[Appium] Appium REST http interface listener started on 0.0.0.0:4723
```

The server will run on `http://localhost:4723` by default.

## 🔧 Configuration

### Environment Variables

Update `worker/.env`:

```env
APPIUM_URL=http://localhost:4723
```

### Update Worker Code

The Appium runner in `worker/src/runners/appium.ts` is currently mocked. To use real Appium:

1. Install Appium client library (if not already):
   ```bash
   cd worker
   npm install webdriverio @wdio/appium-service
   ```

2. Update `worker/src/runners/appium.ts` to use real Appium WebDriver protocol

## 📋 Available Drivers

List installed drivers:
```bash
appium driver list
```

**Currently Installed**:
- ✅ `uiautomator2@6.2.1` - Android (installed)

**Additional Drivers** (can be installed if needed):
```bash
appium driver install <driver-name>
```

Common drivers:
- `uiautomator2` - Android (✅ installed)
- `xcuitest` - iOS (macOS only)
- `espresso` - Android (alternative)
- `youiengine` - Cross-platform

## 🧪 Testing the Setup

### Test Android Connection

1. Start Android emulator or connect device
2. Verify device is connected:
   ```bash
   adb devices
   ```
3. Start Appium server:
   ```bash
   appium
   ```
4. Test connection (in another terminal):
   ```bash
   curl http://localhost:4723/status
   ```

### Test iOS Connection (macOS only)

1. Start iOS Simulator:
   ```bash
   xcrun simctl boot <device-id>
   ```
2. Start Appium server:
   ```bash
   appium
   ```
3. Test connection:
   ```bash
   curl http://localhost:4723/status
   ```

## 🔗 Integration with Worker

Once Appium is configured:

1. **Start Appium Server** (in a separate terminal):
   ```bash
   appium
   ```

2. **Start Worker Service**:
   ```bash
   cd worker
   npm run dev
   ```

3. **Create Test Run** with mobile build type:
   - `BuildType.ANDROID` for Android apps
   - `BuildType.IOS` for iOS apps

## 📚 Resources

- **Appium Documentation**: https://appium.io/docs/en/latest/
- **UiAutomator2 Driver**: https://github.com/appium/appium-uiautomator2-driver
- **XCUITest Driver**: https://github.com/appium/appium-xcuitest-driver
- **Appium Inspector**: https://github.com/appium/appium-inspector (GUI tool for testing)

## ⚠️ Troubleshooting

### Appium Server Won't Start
- Check if port 4723 is already in use
- Verify Node.js and npm are installed correctly
- Check Appium installation: `appium --version`

### Android Driver Issues
- ✅ UiAutomator2 driver is installed
- Ensure Android SDK is installed and `ANDROID_HOME` is set
- Verify `adb` is in PATH: `adb version` (should be in `$ANDROID_HOME/platform-tools/`)
- Check device connection: `adb devices`
- Ensure Java JDK is installed and `JAVA_HOME` is set

### iOS Driver Issues (macOS only)
- Verify Xcode is installed: `xcodebuild -version`
- Check iOS Simulator: `xcrun simctl list devices`
- Install iOS driver: `appium driver install xcuitest`

### Connection Timeout
- Ensure Appium server is running
- Check `APPIUM_URL` in `worker/.env` matches server URL
- Verify firewall isn't blocking port 4723

## 📝 Current Status

- ✅ **Appium Server**: Installed globally (v3.1.1)
- ✅ **UiAutomator2 Driver**: Installed (v6.2.1) for Android
- ⚠️ **Android SDK Setup**: Need to install Android SDK and set `ANDROID_HOME`
- ⚠️ **Java JDK Setup**: Need to install Java JDK and set `JAVA_HOME`
- ⚠️ **Worker Integration**: Code needs to be updated to use real Appium

---

**Next Step**: Install the driver for your target platform (Android or iOS), then update the worker code to use real Appium instead of mocked implementation.

