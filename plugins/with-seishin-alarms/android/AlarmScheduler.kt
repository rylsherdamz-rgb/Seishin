package com.seishin.app.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object AlarmScheduler {
  const val EXTRA_ID = "alarm_id"

  private fun pending(ctx: Context, id: String, flags: Int): PendingIntent? {
    val intent = Intent(ctx, AlarmReceiver::class.java).setAction("com.seishin.app.ALARM").putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(ctx, id.hashCode(), intent, flags or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Arms [a] as an alarm clock: exact, survives Doze, shown in the status bar clock. */
  fun schedule(ctx: Context, a: Alarm) {
    AlarmStore.put(ctx, a)
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pi = pending(ctx, a.id, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
    val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
    if (canExact) {
      val show = PendingIntent.getActivity(
        ctx, 0, ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent(),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
      am.setAlarmClock(AlarmManager.AlarmClockInfo(a.fireAtMs, show), pi)
    } else {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, a.fireAtMs, pi)
    }
  }

  fun cancel(ctx: Context, id: String) {
    val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    pending(ctx, id, PendingIntent.FLAG_NO_CREATE)?.let { am.cancel(it); it.cancel() }
  }

  fun cancelPrefix(ctx: Context, prefix: String) {
    AlarmStore.removePrefix(ctx, prefix).forEach { cancel(ctx, it.id) }
  }

  /** After boot/update: re-arm everything still ahead; drop what has passed. */
  fun rescheduleAll(ctx: Context) {
    val now = System.currentTimeMillis()
    for (a in AlarmStore.all(ctx)) {
      if (a.fireAtMs > now - 60_000) schedule(ctx, a) else AlarmStore.remove(ctx, a.id)
    }
  }
}
