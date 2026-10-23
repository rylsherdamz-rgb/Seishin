package com.seishin.app.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Phone restarted or Seishin was updated: re-arm alarms and start the keep-alive service. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED,
      "android.intent.action.QUICKBOOT_POWERON", "com.htc.intent.action.QUICKBOOT_POWERON",
      Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> {
        AlarmScheduler.rescheduleAll(ctx)
        KeepAliveService.startIfEnabled(ctx)
      }
    }
  }
}
