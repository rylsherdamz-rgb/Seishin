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



# 3. Release builds sign with the Play upload key when it's configured in
#    ~/.gradle/gradle.properties (SEISHIN_UPLOAD_*); otherwise they stay on the
#    debug key so local release builds still work. The key never lives in the repo.
python3 - android/app/build.gradle <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
if "SEISHIN_UPLOAD_STORE_FILE" not in s:
    s = s.replace("""    signingConfigs {
        debug {""", """    signingConfigs {
        if (project.hasProperty('SEISHIN_UPLOAD_STORE_FILE')) {
            upload {
                storeFile file(SEISHIN_UPLOAD_STORE_FILE)
                storePassword SEISHIN_UPLOAD_STORE_PASSWORD
                keyAlias SEISHIN_UPLOAD_KEY_ALIAS
                keyPassword SEISHIN_UPLOAD_KEY_PASSWORD
            }
        }
        debug {""", 1)
    s = s.replace("""            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug""", """            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig project.hasProperty('SEISHIN_UPLOAD_STORE_FILE') ? signingConfigs.upload : signingConfigs.debug""", 1)
    open(p, "w").write(s)
PY
echo "✓ Release signing wired to the upload key (if configured)"
echo "✓ Android prebuild patches applied"
