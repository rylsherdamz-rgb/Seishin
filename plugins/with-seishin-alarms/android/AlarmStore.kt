package com.seishin.app.alarm

import android.content.Context
import org.json.JSONObject

/** One armed alarm. Persisted so a reboot or app update can re-arm it. */
data class Alarm(
  val id: String,
  val title: String,
  val body: String,
  val startMs: Long,
  val fireAtMs: Long,
  val endMs: Long,
  val notes: String,
  val expoNotifId: String?,
) {
  fun toJson(): JSONObject = JSONObject()
    .put("id", id).put("title", title).put("body", body).put("startMs", startMs)
    .put("fireAtMs", fireAtMs).put("endMs", endMs).put("notes", notes).put("expoNotifId", expoNotifId ?: "")

  companion object {
    fun fromJson(o: JSONObject) = Alarm(
      o.optString("id"), o.optString("title"), o.optString("body"), o.optLong("startMs"),
      o.optLong("fireAtMs"), o.optLong("endMs"), o.optString("notes"),
      o.optString("expoNotifId").ifEmpty { null },
    )
  }
}

object AlarmStore {
  private const val PREFS = "seishin_alarms"
  private const val KEY = "alarms"
  private const val SOUND = "alarm_sound_uri"
  private const val KEEP_ALIVE = "keep_alive"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun readAll(ctx: Context): JSONObject =
    try { JSONObject(prefs(ctx).getString(KEY, "{}") ?: "{}") } catch (e: Exception) { JSONObject() }

  @Synchronized fun put(ctx: Context, a: Alarm) {
    val all = readAll(ctx); all.put(a.id, a.toJson()); prefs(ctx).edit().putString(KEY, all.toString()).apply()
  }

  @Synchronized fun get(ctx: Context, id: String): Alarm? = readAll(ctx).optJSONObject(id)?.let { Alarm.fromJson(it) }

  @Synchronized fun remove(ctx: Context, id: String) {
    val all = readAll(ctx); all.remove(id); prefs(ctx).edit().putString(KEY, all.toString()).apply()
  }

  /** Removes and returns every alarm whose id is [prefix] or starts with "[prefix]:". */
  @Synchronized fun removePrefix(ctx: Context, prefix: String): List<Alarm> {
    val all = readAll(ctx)
    val gone = all.keys().asSequence().toList().filter { it == prefix || it.startsWith("$prefix:") }
    val out = gone.mapNotNull { all.optJSONObject(it)?.let(Alarm::fromJson) }
    gone.forEach { all.remove(it) }
    prefs(ctx).edit().putString(KEY, all.toString()).apply()
    return out
  }

  @Synchronized fun all(ctx: Context): List<Alarm> {
    val all = readAll(ctx)
    return all.keys().asSequence().toList().mapNotNull { all.optJSONObject(it)?.let(Alarm::fromJson) }
  }

  fun soundUri(ctx: Context): String? = prefs(ctx).getString(SOUND, null)
  fun setSoundUri(ctx: Context, uri: String?) = prefs(ctx).edit().putString(SOUND, uri).apply()

  /** On by default: the user expects reminders to work without opening the app. */
  fun keepAlive(ctx: Context): Boolean = prefs(ctx).getBoolean(KEEP_ALIVE, true)
  fun setKeepAlive(ctx: Context, on: Boolean) = prefs(ctx).edit().putBoolean(KEEP_ALIVE, on).apply()
}
