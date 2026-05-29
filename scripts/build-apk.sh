#!/usr/bin/env bash
# Build APK script — chạy từ thư mục root của project
set -e

cd "$(dirname "$0")/.."

# Check Android SDK
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  elif [ -d "/opt/homebrew/share/android-commandlinetools" ]; then
    export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
  elif [ -d "/usr/local/share/android-commandlinetools" ]; then
    export ANDROID_HOME="/usr/local/share/android-commandlinetools"
  else
    echo "❌ Không tìm thấy Android SDK. Cài bằng:"
    echo "   brew install --cask android-commandlinetools"
    exit 1
  fi
fi

echo "✅ ANDROID_HOME = $ANDROID_HOME"

# Default: debug build
BUILD_TYPE="${1:-debug}"

if [ "$BUILD_TYPE" = "release" ]; then
  echo "🔨 Building release APK..."
  cd android
  ./gradlew assembleRelease
  APK_PATH="app/build/outputs/apk/release/app-release.apk"
else
  echo "🔨 Building debug APK..."
  cd android
  ./gradlew assembleDebug
  APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
fi

if [ -f "$APK_PATH" ]; then
  FULL_PATH="$(pwd)/$APK_PATH"
  SIZE=$(du -h "$APK_PATH" | cut -f1)
  echo ""
  echo "🎉 APK đã build xong!"
  echo "   Đường dẫn: $FULL_PATH"
  echo "   Kích thước: $SIZE"
  echo ""
  echo "📲 Cài lên Sunmi T2:"
  echo "   adb install \"$FULL_PATH\""
fi
