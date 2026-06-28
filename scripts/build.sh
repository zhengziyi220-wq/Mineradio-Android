#!/bin/bash
# Mineradio Android 一键构建脚本
# 用法: bash scripts/build.sh [debug|release]

set -e

MODE=${1:-debug}
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔨 Mineradio Android Build ($MODE)"
echo "=================================="

cd "$PROJECT_DIR"

# 1. 检查原始前端
if [ ! -d "../Mineradio/public" ]; then
    echo "❌ ../Mineradio/public not found"
    echo "   请先克隆: git clone https://github.com/XxHuberrr/Mineradio.git ../Mineradio"
    exit 1
fi

# 2. 安装依赖
echo "📦 Installing dependencies..."
npm install

# 3. 移植前端
echo "📱 Patching frontend..."
node scripts/patch-index.js

# 4. Sync Capacitor
echo "🔄 Syncing Capacitor..."
npx cap sync android

# 5. Build APK
echo "🏗️  Building APK ($MODE)..."
cd android

if [ "$MODE" = "release" ]; then
    ./gradlew assembleRelease
    APK_PATH="app/build/outputs/apk/release/app-release-unsigned.apk"
else
    ./gradlew assembleDebug
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
fi

if [ -f "$APK_PATH" ]; then
    echo ""
    echo "✅ Build successful!"
    echo "📱 APK: android/$APK_PATH"
    echo "   Size: $(du -h "$APK_PATH" | cut -f1)"
    echo ""
    echo "安装到设备: adb install $APK_PATH"
else
    echo "❌ Build failed - APK not found"
    exit 1
fi
