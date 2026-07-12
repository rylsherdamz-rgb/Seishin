#!/bin/bash
# Fix known Expo prebuild bugs for the android/ directory
set -e

cd "$(dirname "$0")/.."

# 1. Fix namespace/applicationId in build.gradle
sed -i 's/namespace "com.seishin"/namespace "com.seishin.app"/' android/app/build.gradle
sed -i 's/applicationId "com.seishin"/applicationId "com.seishin.app"/' android/app/build.gradle

# 2. Add iconBackground color resource if missing
if ! grep -q "iconBackground" android/app/src/main/res/values/colors.xml 2>/dev/null; then
  sed -i 's|</resources>|  <color name="iconBackground">#FFFFFF</color>\n</resources>|' android/app/src/main/res/values/colors.xml
fi

echo "✓ Android prebuild patches applied"
