/**
 * Native alarms + keep-alive for Seishin (Android). Installs the Kotlin
 * sources in ./android, registers AlarmPackage, and declares the receivers,
 * service and activity. Lives here (not in the gitignored android/ folder)
 * so `expo prebuild --clean` can't delete it.
 */
const fs = require("fs");
const path = require("path");
const { withDangerousMod, withMainApplication, withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

const PKG_DIR = "com/seishin/app/alarm";
const PERMISSIONS = [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
  "android.permission.USE_FULL_SCREEN_INTENT",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.WAKE_LOCK",
  "android.permission.VIBRATE",
  "android.permission.POST_NOTIFICATIONS",
];
// Pulled in by dev tooling; a store build has no use for them.
const RELEASE_REMOVED = ["android.permission.SYSTEM_ALERT_WINDOW", "android.permission.DUMP"];

function withSources(config) {
  return withDangerousMod(config, ["android", (cfg) => {
    const root = cfg.modRequest.platformProjectRoot;
    const dest = path.join(root, "app/src/main/java", PKG_DIR);
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(path.join(__dirname, "android"))) {
      fs.copyFileSync(path.join(__dirname, "android", f), path.join(dest, f));
    }
    const rel = path.join(root, "app/src/release");
    fs.mkdirSync(rel, { recursive: true });
    fs.writeFileSync(path.join(rel, "AndroidManifest.xml"),
      `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">\n` +
      RELEASE_REMOVED.map((p) => `  <uses-permission android:name="${p}" tools:node="remove"/>`).join("\n") +
      `\n</manifest>\n`);
    return cfg;
  }]);
}

function withPackage(config) {
  return withMainApplication(config, (cfg) => {
    const line = "add(com.seishin.app.alarm.AlarmPackage())";
    if (!cfg.modResults.contents.includes(line)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /(PackageList\(this\)\.packages\.apply \{\n)/,
        `$1          ${line}\n`,
      );
    }
    return cfg;
  });
}

function withManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    for (const name of PERMISSIONS) {
      if (!manifest["uses-permission"].some((p) => p.$["android:name"] === name)) {
        manifest["uses-permission"].push({ $: { "android:name": name } });
      }
    }
    const add = (kind, item) => {
      app[kind] = (app[kind] || []).filter((x) => x.$["android:name"] !== item.$["android:name"]);
      app[kind].push(item);
    };
    add("receiver", { $: { "android:name": ".alarm.AlarmReceiver", "android:exported": "false" } });
    add("receiver", {
      $: { "android:name": ".alarm.BootReceiver", "android:exported": "true" },
      "intent-filter": [{
        action: [
          "android.intent.action.BOOT_COMPLETED",
          "android.intent.action.MY_PACKAGE_REPLACED",
          "android.intent.action.QUICKBOOT_POWERON",
          "com.htc.intent.action.QUICKBOOT_POWERON",
          "android.intent.action.TIME_SET",
          "android.intent.action.TIMEZONE_CHANGED",
        ].map((n) => ({ $: { "android:name": n } })),
      }],
    });
    add("service", {
      $: { "android:name": ".alarm.KeepAliveService", "android:exported": "false", "android:foregroundServiceType": "specialUse" },
      property: [{ $: {
        "android:name": "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
        "android:value": "Keeps calendar reminders and user-set alarms ringing on time while the app is closed",
      } }],
    });
    add("activity", {
      $: {
        "android:name": ".alarm.AlarmActivity",
        "android:exported": "false",
        "android:showWhenLocked": "true",
        "android:turnScreenOn": "true",
        "android:excludeFromRecents": "true",
        "android:launchMode": "singleInstance",
        "android:taskAffinity": "",
        "android:theme": "@style/Theme.AppCompat.NoActionBar",
      },
    });
    return cfg;
  });
}

module.exports = (config) => withManifest(withPackage(withSources(config)));
