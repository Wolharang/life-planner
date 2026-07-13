package com.lifeplanner.lpalarm

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import java.util.Calendar

/**
 * The execution moment (PRD §7.1 R3), rendered NATIVELY so it runs fully OVER the lock screen without
 * unlocking (architecture §4). Handling it here — not by launching the RN app — sidesteps the
 * expo-dev-client launcher (one-React-context limit) and the keyguard entirely. Light surface (v0.5).
 *
 * Flow (v1, founder 2026-07-11 — delayed re-check): COMMIT ("…하기로 했잖아") → the app arms a ~5-min
 * follow-up and dismisses → 5 min later it re-opens at RECHECK ("진짜 했어?"): "응, 했어" → DONE;
 * "아직 안 했어" → LEAVE 5·4·3·2·1 → "지금 나가" → dismiss (outcome stays pending → no-guilt catch-up).
 * No in-flow "can't-today" escape (only 했어 / 아직 안 했어). DONE is recorded via PendingOutcomes (the RN
 * app drains it on next open). Provisional timings ([TBD]). The older COMMIT→COUNTDOWN→ACT→GO path is kept
 * below (currently unreached) in case we revert. Re-check alarm id = "<taskId>#recheck".
 *
 * NOTE: this is the canonical execution UI. app/app/execution.tsx is the design reference / in-app preview.
 */
class ExecutionActivity : Activity() {

  private var title = "실행"
  private var note = ""
  private var intended = 0L
  private var createdAt = 0L
  private var leadMinutes = 0
  private var taskId = ""
  private var alarmId = "" // the raw alarm/notification id ("<taskId>" or "<taskId>#recheck")
  private var mode = "commit" // "commit" (normal) | "recheck" (the ~5-min "진짜 했어?" follow-up)
  private var count = 5
  private var player: MediaPlayer? = null
  private var savedAlarmVolume = -1

  private val handler = Handler(Looper.getMainLooper())

  // v5 "Toss-form" tokens — the CONFIRMED skin (D39, 2026-07-11), mirroring app/tailwind.config.js.
  // The moment stays LIGHT (never a dark takeover); gold is reserved for the single DONE mark, and the
  // one action is a solid brand pill.
  private val bg = Color.parseColor("#FBFAF6") // exec ground (warm white)
  private val ink = Color.parseColor("#191F28")
  private val soft = Color.parseColor("#4E5968")
  private val brand = Color.parseColor("#3182F6")
  private val gold = Color.parseColor("#B0862A")
  private val faint = Color.parseColor("#8B95A1")
  private val line = Color.parseColor("#F2F4F6")

  private data class Item(
    val taskId: String,
    val title: String,
    val note: String,
    val intended: Long,
    val createdAt: Long,
    val leadMinutes: Int,
    val mode: String = "commit"
  )

  companion object {
    // Occurrences that fired while one was already showing (R2 sequential queue).
    private val queue = ArrayDeque<Item>()
    // Alarm ids already run in this process — so a stale notification / duplicate intent can't replay a
    // moment the user has already answered.
    private val handled = HashSet<String>()
    // ~5 min after COMMIT, re-open at "진짜 했어?" (founder 2026-07-11). [TBD] — could become a setting.
    private const val RECHECK_DELAY_MS = 5 * 60_000L
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    volumeControlStream = AudioManager.STREAM_ALARM // volume keys adjust the ALARM stream on this screen
    startItem(itemFrom(intent))
  }

  // Same effective time → sequential, never stacked over the lock screen (R2): a second occurrence that
  // fires while one is showing is queued (singleInstance → onNewIntent) and shown after this one ends.
  override fun onNewIntent(newIntent: Intent) {
    super.onNewIntent(newIntent)
    queue.addLast(itemFrom(newIntent))
  }

  private fun itemFrom(i: Intent) = Item(
    taskId = i.getStringExtra(LpAlarmConstants.EXTRA_ID) ?: "",
    title = i.getStringExtra(LpAlarmConstants.EXTRA_TITLE) ?: "실행",
    note = i.getStringExtra(LpAlarmConstants.EXTRA_NOTE) ?: "",
    intended = i.getLongExtra(LpAlarmConstants.EXTRA_INTENDED, System.currentTimeMillis()),
    createdAt = i.getLongExtra(LpAlarmConstants.EXTRA_CREATED, 0L),
    leadMinutes = i.getIntExtra(LpAlarmConstants.EXTRA_LEAD, 0),
    mode = i.getStringExtra(LpAlarmConstants.EXTRA_MODE) ?: "commit"
  )

  private fun startItem(item: Item) {
    mode = item.mode
    alarmId = item.taskId // the raw alarm id ("<taskId>" or "<taskId>#recheck") — keys its notification
    // The re-check alarm's id is "<taskId>#recheck"; outcomes/markers must key the ORIGINAL task.
    taskId = item.taskId.removeSuffix("#recheck")
    title = item.title
    note = item.note
    intended = item.intended
    createdAt = item.createdAt
    leadMinutes = item.leadMinutes
    count = 5
    stopSound()

    // The moment is a ONE-SHOT. Kill the notification that brought us here, so it can't sit in the shade
    // and re-run the occurrence when tapped later (a second "진짜 했어?" after answering — and a stale
    // *commit* tap would arm a SECOND re-check). Guard the same occurrence twice within this process too.
    AlarmNotifications.cancel(this, alarmId)
    if (!handled.add(alarmId)) {
      // already ran in this process (a stale notification / duplicate intent) → do not run it again
      dismiss()
      return
    }

    vibrate(60) // FIRING pulse
    if (SoundSetting.isOn(this)) startSound() // audible only if enabled (default off = vibration-only)
    if (mode == "recheck") {
      render("recheck")
    } else {
      // Mark that the moment appeared (R6 catch-up net + S1 latency). Resolved later by a `done` outcome.
      PendingFires.record(this, taskId, title, occurrenceYmd(), intended, System.currentTimeMillis())
      scheduleRecheck() // arm the ~5-min "진짜 했어?" follow-up
      render("commit")
    }
  }

  /** Arm the transient ~5-min re-check follow-up (one-shot; not persisted across reboot). */
  private fun scheduleRecheck() {
    AlarmScheduler.schedule(
      this,
      AlarmItem(
        id = "$taskId#recheck",
        fireAt = System.currentTimeMillis() + RECHECK_DELAY_MS,
        title = title,
        recurrence = "none",
        note = note,
        createdAt = createdAt,
        leadMinutes = 0, // the re-check's "intended" is just now+5m — no lead offset
        mode = "recheck"
      ),
      persist = false
    )
  }

  /** End the current occurrence: show the next queued one, or finish if none (R2 sequential). */
  private fun dismiss() {
    AlarmNotifications.cancel(this, alarmId) // never leave a tappable ghost of a moment that is over
    val next = queue.removeFirstOrNull()
    if (next != null) startItem(next) else finish()
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    stopSound()
    super.onDestroy()
  }

  /**
   * **No in-flow escape** (PRD R7 · design-principle A2 · CLAUDE.md): once the moment is up, the only
   * ways out are the moment's own answers (응, 할게 / 응, 했어 / 아직 안 했어 → 나가) or its timeouts.
   * Back was a silent side door — it let the deliberating brain leave mid-countdown, which is exactly
   * what the countdown exists to prevent. It is deliberately a no-op. (The intentional skip is the
   * PRE-fire "오늘은 쉼" toggle; nothing here punishes leaving — an unanswered moment stays pending.)
   */
  @Suppress("DEPRECATION", "MissingSuperCall")
  override fun onBackPressed() {
    // no-op
  }

  private fun render(phase: String) {
    handler.removeCallbacksAndMessages(null)
    if (phase != "commit") stopSound() // the alarm tone rings during COMMIT, then hands off to haptics
    when (phase) {
      "commit" -> {
        setContentView(commitView())
        after(30_000) { dismiss() } // COMMIT idle → close (the re-check is already armed)
      }
      "recheck" -> {
        vibrate(60)
        setContentView(recheckView())
        after(90_000) { render("pending") } // ignored re-check → PENDING (no-guilt catch-up later)
      }
      "leave" -> {
        count = 5
        renderLeaveCountdown()
      }
      "leavego" -> {
        vibrate(40)
        setContentView(leaveGoView())
        after(3_500) { dismiss() } // pushed out; outcome stays pending (no guilt) — catch-up resolves it
      }
      "done" -> {
        recordDone()
        vibrate(90)
        setContentView(doneView())
      }
      "pending" -> dismiss()
    }
  }

  // --- views ---

  private fun commitView(): View = column().apply {
    addView(label("내가 정한 약속", 13, soft))
    addView(label(commitLine(), 23, ink, top = 12, bold = true))
    // A2: ask for the 5-second FIRST MOVE, not the task. The micro-start note lost its screen when the
    // flow became commit → re-check, so it lives here now — the one thing to do in the next 5 seconds.
    if (note.isNotEmpty()) addView(label("딱 첫 동작 — $note", 17, soft, top = 14))
    // v1: commit only acknowledges — the "진짜 했어?" re-check comes ~5 min later (already armed).
    addView(brandButton("응, 할게") { dismiss() })
  }

  private fun recheckView(): View = column().apply {
    addView(label("아까 하기로 한 거", 13, soft))
    addView(label("진짜 했어?", 30, ink, top = 12, bold = true))
    addView(brandButton("응, 했어") { render("done") })
    addView(textLink("아직 안 했어", top = 22) { render("leave") })
  }

  private fun renderLeaveCountdown() {
    setContentView(countView(count))
    vibrate(25)
    if (count <= 1) after(1_000) { render("leavego") }
    else after(1_000) { count -= 1; renderLeaveCountdown() }
  }

  private fun leaveGoView(): View = column().apply {
    addView(label("지금 나가.", 28, ink, bold = true))
    // B2: 어제의 나의 목소리 — 이기고 지는 경쟁 프레임이 아니라, 딱 첫 동작만 하면 된다는 사실.
    addView(label("딱 첫 동작만 하면 돼.", 16, soft, top = 12))
    addView(brandButton("나간다 →") { dismiss() })
  }

  private fun countView(n: Int): View = column(Gravity.CENTER).apply {
    addView(label(n.toString(), 92, ink, bold = true))
    val row = LinearLayout(this@ExecutionActivity).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      layoutParams = lp(top = 8)
    }
    for (k in 5 downTo 1) {
      row.addView(TextView(this@ExecutionActivity).apply {
        text = k.toString()
        setTextColor(if (k == n) gold else faint)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        setPadding(dp(8), 0, dp(8), 0)
        setTypeface(typeface, if (k == n) Typeface.BOLD else Typeface.NORMAL)
      })
    }
    addView(row)
  }

  private fun doneView(): View = column(Gravity.CENTER).apply {
    addView(label("✓", 44, gold, bold = true))
    addView(label("안 하던 걸 해냈다.", 24, gold, top = 12, bold = true))
    addView(textLink("닫기", top = 40) { dismiss() })
  }

  // --- helpers ---

  private fun recordDone() {
    PendingOutcomes.record(this, taskId, title, occurrenceYmd(), "done", System.currentTimeMillis())
  }

  private fun column(gravity: Int = Gravity.CENTER): LinearLayout =
    LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      this.gravity = gravity
      setBackgroundColor(bg)
      setPadding(dp(32), dp(32), dp(32), dp(32))
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.MATCH_PARENT
      )
    }

  private fun brandButton(text: String, onClick: () -> Unit): TextView =
    TextView(this).apply {
      this.text = text
      setTextColor(Color.WHITE)
      // Rounded-full pill (design-system §1.5/§3/§4.2: the one solid-brand action is a pill), not a flat
      // square fill — matches the RN reference (execution.tsx `bg-brand rounded-full`).
      background = android.graphics.drawable.GradientDrawable().apply {
        setColor(brand)
        cornerRadius = dp(999).toFloat()
      }
      gravity = Gravity.CENTER
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
      setTypeface(typeface, Typeface.BOLD)
      setPadding(dp(44), dp(15), dp(44), dp(15))
      setOnClickListener { onClick() }
      layoutParams = lp(top = 40)
    }

  private fun textLink(text: String, top: Int, onClick: () -> Unit): TextView =
    TextView(this).apply {
      this.text = text
      setTextColor(soft)
      gravity = Gravity.CENTER
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
      setPadding(dp(16), dp(8), dp(16), dp(8))
      setOnClickListener { onClick() }
      layoutParams = lp(top = top)
    }

  private fun label(text: String, sizeSp: Int, color: Int, top: Int = 0, bold: Boolean = false): TextView =
    TextView(this).apply {
      this.text = text
      setTextColor(color)
      gravity = Gravity.CENTER
      setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp.toFloat())
      if (bold) setTypeface(typeface, Typeface.BOLD)
      layoutParams = lp(top = top)
    }

  private fun lp(top: Int = 0) = LinearLayout.LayoutParams(
    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
  ).apply { topMargin = dp(top); gravity = Gravity.CENTER }

  private fun after(ms: Long, r: () -> Unit) {
    handler.postDelayed(r, ms)
  }

  private fun commitLine(): String {
    // Show the occurrence's SET time (= effective fire time + lead), never the effective time — PRD R3
    // requires the commit line to quote the user's actual promise ("21:00 헬스"), not set−lead ("20:30").
    val labelText = "${clock(intended + leadMinutes * 60_000L)} $title"
    if (createdAt <= 0L) return "네가 [$labelText] 하기로 정해뒀잖아"
    return when (val d = dayDiff(createdAt, System.currentTimeMillis())) {
      0 -> "아까 네가 [$labelText]라고 정했잖아"
      1 -> "어제 네가 [$labelText]라고 정했잖아"
      in 2..13 -> "${d}일 전에 네가 [$labelText] 하기로 정했잖아"
      else -> "네가 [$labelText] 하기로 정해뒀잖아"
    }
  }

  private fun dayDiff(from: Long, to: Long): Int {
    fun midnight(ms: Long) = Calendar.getInstance().apply {
      timeInMillis = ms
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    return ((midnight(to) - midnight(from)) / 86_400_000L).toInt()
  }

  private fun clock(ms: Long): String {
    val c = Calendar.getInstance().apply { timeInMillis = ms }
    return String.format("%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE))
  }

  private fun occurrenceYmd(): String = ymd(intended + leadMinutes * 60_000L)

  private fun ymd(ms: Long): String {
    val c = Calendar.getInstance().apply { timeInMillis = ms }
    return String.format("%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
  }

  private fun startSound() {
    try {
      // The execution moment should be loud regardless of a low/locked alarm slider — max the ALARM
      // stream during the moment and restore it on dismiss.
      val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      savedAlarmVolume = am.getStreamVolume(AudioManager.STREAM_ALARM)
      am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)
    } catch (e: Exception) {
      // couldn't adjust the alarm volume (policy) — proceed at the current level
    }
    try {
      // The tone the user picked in 설정, else the device's default alarm tone (SoundSetting).
      val uri = SoundSetting.resolvedTone(this)
        ?: android.provider.Settings.System.DEFAULT_ALARM_ALERT_URI
        ?: return
      player = MediaPlayer().apply {
        // ALARM stream → sounds even in silent/vibrate mode (governed by the ALARM volume).
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        setDataSource(this@ExecutionActivity, uri)
        isLooping = true
        prepare()
        start()
      }
    } catch (e: Exception) {
      // no alarm sound available / blocked — haptics still carry the cue
    }
  }

  private fun stopSound() {
    try {
      player?.stop()
      player?.release()
    } catch (e: Exception) {
    }
    player = null
    if (savedAlarmVolume >= 0) {
      try {
        (getSystemService(Context.AUDIO_SERVICE) as AudioManager)
          .setStreamVolume(AudioManager.STREAM_ALARM, savedAlarmVolume, 0)
      } catch (e: Exception) {
      }
      savedAlarmVolume = -1
    }
  }

  private fun vibrate(ms: Long) {
    val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE))
    } else {
      @Suppress("DEPRECATION") v.vibrate(ms)
    }
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
