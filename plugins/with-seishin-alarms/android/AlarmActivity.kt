package com.seishin.app.alarm

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.text.format.DateFormat
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.seishin.app.R
import org.json.JSONObject
import java.util.Date

/** Full-screen ringing alarm, shown over the lock screen and other apps. */
class AlarmActivity : Activity() {
  companion object {
    const val ACTION_CLOSE = "com.seishin.app.alarm.CLOSE"
    fun intent(ctx: Context, a: Alarm): Intent = Intent(ctx, AlarmActivity::class.java)
      .putExtra("alarm", a.toJson().toString())
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
  }

  private lateinit var alarm: Alarm
  private val closer = object : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) = finish()
  }

  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) { setShowWhenLocked(true); setTurnScreenOn(true) }
    else @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    alarm = intent.getStringExtra("alarm")?.let { Alarm.fromJson(JSONObject(it)) } ?: run { finish(); return }

    val fmt = DateFormat.getTimeFormat(this)
    val range = if (alarm.endMs > alarm.startMs) "${fmt.format(Date(alarm.startMs))} – ${fmt.format(Date(alarm.endMs))}" else fmt.format(Date(alarm.startMs))
    val day = DateFormat.format("EEEE, MMMM d", alarm.startMs).toString()

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setBackgroundColor(Color.parseColor("#0F0F11"))
      setPadding(dp(28), dp(96), dp(28), dp(48))
    }
    val icon = ImageView(this).apply {
      setImageResource(R.mipmap.ic_launcher)
      background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.parseColor("#222227")) }
      setPadding(dp(22), dp(22), dp(22), dp(22))
    }
    root.addView(icon, LinearLayout.LayoutParams(dp(132), dp(132)))
    fun text(s: String, size: Float, color: String, bold: Boolean, top: Int) = TextView(this).apply {
      text = s; textSize = size; setTextColor(Color.parseColor(color)); gravity = Gravity.CENTER
      if (bold) typeface = Typeface.DEFAULT_BOLD
      layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(top) }
    }
    root.addView(text(alarm.title, 34f, "#FFFFFF", true, 40))
    root.addView(text(range, 22f, "#E6E6E6", false, 10))
    root.addView(text(day, 14f, "#8A8A8A", false, 6))
    if (alarm.notes.isNotBlank()) root.addView(text(alarm.notes, 15f, "#B5B5B5", false, 18))
    root.addView(android.view.View(this), LinearLayout.LayoutParams(1, 0, 1f))

    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    fun button(label: String, filled: Boolean, onTap: () -> Unit) = Button(this).apply {
      text = label; isAllCaps = false; textSize = 17f; typeface = Typeface.DEFAULT_BOLD
      setTextColor(Color.parseColor(if (filled) "#111111" else "#FFFFFF"))
      background = GradientDrawable().apply {
        cornerRadius = dp(20).toFloat()
        if (filled) setColor(Color.WHITE) else { setColor(Color.TRANSPARENT); setStroke(dp(1), Color.parseColor("#3A3A40")) }
      }
      setOnClickListener { onTap() }
    }
    val lp = { LinearLayout.LayoutParams(0, dp(64), 1f) }
    row.addView(button("Snooze", false) { send(KeepAliveService.ACTION_SNOOZE) }, lp().apply { marginEnd = dp(8) })
    row.addView(button("Dismiss", true) { send(KeepAliveService.ACTION_DISMISS) }, lp().apply { marginStart = dp(8) })
    root.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    setContentView(root)

    ContextCompat.registerReceiver(this, closer, IntentFilter(ACTION_CLOSE), ContextCompat.RECEIVER_NOT_EXPORTED)
  }

  private fun send(action: String) {
    ContextCompat.startForegroundService(this, KeepAliveService.actionIntent(this, action, alarm))
    finish()
  }

  @Deprecated("Back = snooze, like a stock alarm")
  override fun onBackPressed() = send(KeepAliveService.ACTION_SNOOZE)

  override fun onDestroy() {
    try { unregisterReceiver(closer) } catch (e: Exception) {}
    super.onDestroy()
  }
}
