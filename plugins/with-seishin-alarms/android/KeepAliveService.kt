package com.seishin.app.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.seishin.app.R

/**
 * Keeps Seishin's process alive so reminders, alarms and background sync run
 * without opening the app (Android skins like HiOS kill idle apps), and rings
 * alarms when they go off.
 */
class KeepAliveService : Service() {
  companion object {
    private const val KEEP_CHANNEL = "seishin-keepalive"
    private const val RING_CHANNEL = "seishin-alarm-ring"
    private const val KEEP_ID = 4401
    const val ACTION_RING = "com.seishin.app.alarm.RING"
    const val ACTION_SNOOZE = "com.seishin.app.alarm.SNOOZE"
    const val ACTION_DISMISS = "com.seishin.app.alarm.DISMISS"
    const val SNOOZE_MS = 60_000L

    /** Set by the React module: when the app is on screen, its own overlay rings instead. */
    @Volatile var appInForeground = false
    @Volatile private var running = false

    fun ringIntent(ctx: Context, a: Alarm): Intent =
      Intent(ctx, KeepAliveService::class.java).setAction(ACTION_RING).putExtra("alarm", a.toJson().toString())

    fun actionIntent(ctx: Context, action: String, a: Alarm): Intent =
      Intent(ctx, KeepAliveService::class.java).setAction(action).putExtra("alarm", a.toJson().toString())

    fun startIfEnabled(ctx: Context) {
      if (!AlarmStore.keepAlive(ctx)) return
      try { ContextCompat.startForegroundService(ctx, Intent(ctx, KeepAliveService::class.java)) } catch (e: Exception) { /* background start not allowed right now */ }
    }

    fun stop(ctx: Context) { ctx.stopService(Intent(ctx, KeepAliveService::class.java)) }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    val nm = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      nm.createNotificationChannel(NotificationChannel(KEEP_CHANNEL, "Background reminders", NotificationManager.IMPORTANCE_MIN).apply {
        description = "Keeps reminders and sync on time while Seishin is closed"
        setShowBadge(false)
      })
      nm.createNotificationChannel(NotificationChannel(RING_CHANNEL, "Ringing alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      })
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    goForeground()
    val alarm = intent?.getStringExtra("alarm")?.let { Alarm.fromJson(org.json.JSONObject(it)) }
    when (intent?.action) {
      ACTION_RING -> if (alarm != null) ring(alarm)
      ACTION_DISMISS -> if (alarm != null) finishRing(alarm)
      ACTION_SNOOZE -> if (alarm != null) {
        finishRing(alarm)
        val base = alarm.id.substringBefore(":snooze")
        AlarmScheduler.schedule(this, alarm.copy(id = "$base:snooze", fireAtMs = System.currentTimeMillis() + SNOOZE_MS))
      }
    }
    if (!AlarmStore.keepAlive(this) && intent?.action != ACTION_RING) {
      stopSelf()
      return START_NOT_STICKY
    }
    return START_STICKY
  }

  private fun goForeground() {
    if (running) return
    val open = PendingIntent.getActivity(
      this, 0, packageManager.getLaunchIntentForPackage(packageName) ?: Intent(),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val n = NotificationCompat.Builder(this, KEEP_CHANNEL)
      .setSmallIcon(R.drawable.notification_icon)
      .setContentTitle("Seishin is on")
      .setContentText("Keeping your reminders and alarms on time")
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setContentIntent(open)
      .build()
    val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
    ServiceCompat.startForeground(this, KEEP_ID, n, type)
    running = true
  }

  private fun ring(a: Alarm) {
    // Drop the plain expo notification for the same alarm; this one replaces it.
    a.expoNotifId?.let { tag ->
      val nm = getSystemService(NotificationManager::class.java)
      nm.activeNotifications.filter { it.tag == tag }.forEach { nm.cancel(it.tag, it.id) }
    }
    if (appInForeground) return
    Ringer.start(this)
    val full = PendingIntent.getActivity(
      this, a.id.hashCode(), AlarmActivity.intent(this, a),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    fun svc(action: String, code: Int) = PendingIntent.getService(
      this, a.id.hashCode() + code, actionIntent(this, action, a),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val n = NotificationCompat.Builder(this, RING_CHANNEL)
      .setSmallIcon(R.drawable.notification_icon)
      .setContentTitle(a.title)
      .setContentText(a.body)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setFullScreenIntent(full, true)
      .setContentIntent(full)
      .addAction(0, "Snooze 1 min", svc(ACTION_SNOOZE, 1))
      .addAction(0, "Dismiss", svc(ACTION_DISMISS, 2))
      .build()
    getSystemService(NotificationManager::class.java).notify(a.id.hashCode(), n)
  }

  private fun finishRing(a: Alarm) {
    Ringer.stop()
    getSystemService(NotificationManager::class.java).cancel(a.id.hashCode())
    sendBroadcast(Intent(AlarmActivity.ACTION_CLOSE).setPackage(packageName))
  }

  override fun onDestroy() {
    running = false
    super.onDestroy()
  }
}
