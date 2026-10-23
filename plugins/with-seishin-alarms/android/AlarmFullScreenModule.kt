package com.seishin.app.alarm

import android.app.Activity
import android.content.Intent
import android.media.RingtoneManager
import android.net.Uri
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** JS side: `NativeModules.AlarmFullScreen` (src/services/notify-core.ts). */
class AlarmFullScreenModule(private val ctx: ReactApplicationContext) :
  ReactContextBaseJavaModule(ctx), LifecycleEventListener, ActivityEventListener {

  private var pickPromise: Promise? = null
  private val pickCode = 0x5e15

  init {
    ctx.addLifecycleEventListener(this)
    ctx.addActivityEventListener(this)
  }

  override fun getName() = "AlarmFullScreen"

  @ReactMethod
  fun scheduleAlarm(id: String, title: String, body: String, startTimeMs: Double, fireAtMs: Double, expoNotifId: String?, endTimeMs: Double, notes: String?) {
    AlarmScheduler.schedule(ctx, Alarm(id, title, body, startTimeMs.toLong(), fireAtMs.toLong(), endTimeMs.toLong(), notes ?: "", expoNotifId))
  }

  @ReactMethod fun cancelAlarms(prefix: String) = AlarmScheduler.cancelPrefix(ctx, prefix)

  @ReactMethod fun setAlarmSound(uri: String?) = AlarmStore.setSoundUri(ctx, uri)

  @ReactMethod fun startRinging() = Ringer.start(ctx)

  @ReactMethod fun stopRinging() = Ringer.stop()

  /** Keep Seishin running in the background (foreground service + boot start). */
  @ReactMethod
  fun setKeepAlive(on: Boolean) {
    AlarmStore.setKeepAlive(ctx, on)
    if (on) KeepAliveService.startIfEnabled(ctx) else KeepAliveService.stop(ctx)
  }

  @ReactMethod fun isKeepAliveEnabled(promise: Promise) = promise.resolve(AlarmStore.keepAlive(ctx))

  @ReactMethod
  fun pickRingtone(currentUri: String?, promise: Promise) {
    val activity = ctx.currentActivity ?: return promise.resolve(null)
    pickPromise?.resolve(null)
    pickPromise = promise
    val i = Intent(RingtoneManager.ACTION_RINGTONE_PICKER)
      .putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM or RingtoneManager.TYPE_RINGTONE)
      .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
      .putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
      .putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, currentUri?.let(Uri::parse))
    activity.startActivityForResult(i, pickCode)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != pickCode) return
    val p = pickPromise ?: return
    pickPromise = null
    if (resultCode != Activity.RESULT_OK) return p.resolve(null)
    @Suppress("DEPRECATION") val uri = data?.getParcelableExtra<Uri>(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
    val out = Arguments.createMap()
    out.putString("uri", uri?.toString())
    out.putString("name", uri?.let { RingtoneManager.getRingtone(ctx, it)?.getTitle(ctx) } ?: "Default")
    p.resolve(out)
  }

  override fun onNewIntent(intent: Intent) {}

  override fun onHostResume() {
    KeepAliveService.appInForeground = true
    KeepAliveService.startIfEnabled(ctx)
  }

  override fun onHostPause() { KeepAliveService.appInForeground = false }

  override fun onHostDestroy() { KeepAliveService.appInForeground = false }
}
