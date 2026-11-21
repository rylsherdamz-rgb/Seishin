package com.seishin.app.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** An armed alarm went off: hand it to the foreground service, which rings. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val id = intent.getStringExtra(AlarmScheduler.EXTRA_ID) ?: return
    val alarm = AlarmStore.get(ctx, id) ?: return
    AlarmStore.remove(ctx, id)
    // Too late to be useful (phone was off for hours): skip rather than ring stale.
    if (System.currentTimeMillis() - alarm.fireAtMs > 30 * 60_000) return
    try {
      ContextCompat.startForegroundService(ctx, KeepAliveService.ringIntent(ctx, alarm))
    } catch (e: Exception) {
      // Android 12+ refuses a background service start unless the alarm was exact
      // (no "Alarms & reminders" access → inexact fallback). Ring from here instead
      // of losing the alarm: the notification's full-screen intent shows AlarmActivity.
      Ringer.start(ctx.applicationContext)
      KeepAliveService.postRing(ctx, alarm)
    }
  }
}
