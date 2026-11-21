#!/usr/bin/env bash
# Play Store capture helpers over adb (phone on USB, debugging on).
#
#   scripts/store/capture.sh demo-on              clean status bar (9:41, full battery/signal)
#   scripts/store/capture.sh demo-off
#   scripts/store/capture.sh shot <name>          store/screenshots/<name>.png, Play-ready
#   scripts/store/capture.sh record <name> [sec]  store/video/raw/<name>.mp4 (stop early: Ctrl+C)
#
# Screenshots drop the status and navigation bars and are padded to exactly
# 2:1 (Play rejects a long side more than twice the short side; this phone is 2.28:1).
set -euo pipefail
cd "$(dirname "$0")/../.."

STATUS_PX=${STATUS_PX:-108}
NAV_PX=${NAV_PX:-120}

demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }

case "${1:-}" in
  demo-on)
    adb shell settings put global sysui_demo_allowed 1
    demo enter
    demo clock -e hhmm 0941
    demo battery -e level 100 -e plugged false
    demo network -e wifi show -e level 4
    demo network -e mobile show -e datatype none -e level 4
    demo notifications -e visible false
    ;;
  demo-off)
    demo exit
    ;;
  shot)
    name=${2:?name}
    raw=$(mktemp --suffix=.png)
    adb exec-out screencap -p > "$raw"
    read -r w h < <(magick identify -format "%w %h\n" "$raw")
    ch=$((h - STATUS_PX - NAV_PX))
    pw=$(( (ch + 1) / 2 )); [ "$pw" -lt "$w" ] && pw=$w
    bg=$(magick "$raw" -format "%[pixel:p{2,$((STATUS_PX + 4))}]" info:)
    magick "$raw" -crop "${w}x${ch}+0+${STATUS_PX}" +repage \
      -background "$bg" -gravity center -extent "${pw}x${ch}" "store/screenshots/${name}.png"
    rm -f "$raw"
    echo "store/screenshots/${name}.png (${pw}x${ch})"
    ;;
  record)
    name=${2:?name}; secs=${3:-30}
    adb shell screenrecord --bit-rate 16000000 --time-limit "$secs" "/sdcard/${name}.mp4" || true
    sleep 1
    adb pull "/sdcard/${name}.mp4" "store/video/raw/${name}.mp4" >/dev/null
    adb shell rm "/sdcard/${name}.mp4"
    echo "store/video/raw/${name}.mp4"
    ;;
  *)
    sed -n '2,11p' "$0"; exit 1 ;;
esac
