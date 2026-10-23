package com.seishin.app.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/** Plays the alarm sound on the alarm stream and vibrates, for at most a minute. */
object Ringer {
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private val handler = Handler(Looper.getMainLooper())
  private val autoStop = Runnable { stop() }

  @Synchronized fun start(ctx: Context) {
    stop()
    val uri = AlarmStore.soundUri(ctx)?.let(Uri::parse)
      ?: RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    try {
      player = MediaPlayer().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
        setDataSource(ctx, uri)
        isLooping = true
        prepare()
        start()
      }
    } catch (e: Exception) {
      player = null
    }
    vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION") ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
    val pattern = longArrayOf(0, 800, 600)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
    else @Suppress("DEPRECATION") vibrator?.vibrate(pattern, 0)
    handler.postDelayed(autoStop, 60_000)
  }

  @Synchronized fun stop() {
    handler.removeCallbacks(autoStop)
    try { player?.stop() } catch (e: Exception) {}
    player?.release()
    player = null
    vibrator?.cancel()
    vibrator = null
  }
}
