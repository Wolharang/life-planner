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
  private var wantSound = false // per-block (D43): this block asked for a tone. false = vibration only.
  private var phase = ""        // the phase currently on screen — so we can resume exactly where we froze
  private var visible = false   // the moment only advances (timers, tone) while it is actually on screen
  private var doneRecorded = false // recordDone() must be idempotent: re-rendering "done" must not re-record
  private var count = 5
  private var player: MediaPlayer? = null
  private var savedAlarmVolume = -1

  private val handler = Handler(Looper.getMainLooper())
  // The sound cap gets its own handler: render() clears `handler` on every phase change, which would
  // otherwise silently drop the safety timer that guarantees a tone can never ring forever.
  private val soundHandler = Handler(Looper.getMainLooper())

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
    val mode: String = "commit",
    val sound: Boolean = false
  )

  companion object {
    // Occurrences that fired while one was already showing (R2 sequential queue).
    private val queue = ArrayDeque<Item>()
    // Alarm ids the user has already ANSWERED in this process — a stale notification must not replay them.
    private val resolved = HashSet<String>()
    // A tone may never ring longer than this, no matter what (safety net for the "sound with no screen" bug).
    private const val SOUND_MAX_MS = 60_000L
    // ~5 min after COMMIT, re-open at "진짜 했어?" (founder 2026-07-11). [TBD] — could become a setting.
    private const val RECHECK_DELAY_MS = 5 * 60_000L
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    registerBackGuard()
    // The screen may not sleep under the moment — a countdown that dozes off is a countdown that lost.
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
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
    mode = i.getStringExtra(LpAlarmConstants.EXTRA_MODE) ?: "commit",
    sound = i.getBooleanExtra(LpAlarmConstants.EXTRA_SOUND, false)
  )

  private fun startItem(item: Item) {
    // Already ANSWERED in this process → a stale notification / duplicate intent must not replay it
    // (the founder saw "진짜 했어?" a second time after answering; a stale *commit* would even arm a
    // second re-check). Note the guard is on *resolution*, not on start: an unanswered moment that got
    // backgrounded must still be re-openable from its notification — that is the user's way back.
    if (resolved.contains(item.taskId)) {
      AlarmNotifications.cancel(this, item.taskId)
      dismiss()
      return
    }

    mode = item.mode
    alarmId = item.taskId // the raw alarm id ("<taskId>" or "<taskId>#recheck") — keys its notification
    // The re-check alarm's id is "<taskId>#recheck"; outcomes/markers must key the ORIGINAL task.
    taskId = item.taskId.removeSuffix("#recheck")
    title = item.title
    note = item.note
    intended = item.intended
    createdAt = item.createdAt
    leadMinutes = item.leadMinutes
    wantSound = item.sound // per-block (D43); the TONE is the global setting
    count = 5
    doneRecorded = false
    stopSound()

    vibrate(60) // FIRING pulse
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
        mode = "recheck",
        sound = wantSound
      ),
      persist = false
    )
  }

  /** End the current occurrence: show the next queued one, or finish if none (R2 sequential). */
  private fun dismiss() {
    stopSound()
    if (alarmId.isNotEmpty()) {
      resolved.add(alarmId) // answered → any stale notification for it must never replay it
      AlarmNotifications.cancel(this, alarmId) // and never leave a tappable ghost of a finished moment
    }
    val next = queue.removeFirstOrNull()
    if (next != null) startItem(next) else finish()
  }

  /**
   * ── The moment exists ONLY on screen ───────────────────────────────────────────────────────────────
   *
   * Two founder-reported bugs were the same bug: **the moment kept living after it stopped being
   * visible.** Once as a tone that rang on with no window and no notification; once as a countdown that
   * ran on in the background and quietly ended the moment (the user pressed something mid-5·4·3 and
   * landed back on the app's main screen).
   *
   * So: **nothing about the moment advances while it isn't in the foreground.** All timers freeze, the
   * tone stops, and both resume from the same phase when it comes back. Losing the foreground can no
   * longer *finish* the moment — only an answer (or a timeout it was actually awake for) can. An
   * unanswered moment therefore always still exists, and its notification is still there to return to.
   */
  override fun onPause() {
    visible = false
    handler.removeCallbacksAndMessages(null) // freeze the phase timers — never run unseen
    stopSound()
    super.onPause()
  }

  override fun onResume() {
    super.onResume()
    visible = true
    if (phase.isNotEmpty()) render(phase) // resume exactly where we were (re-arms this phase's timers)
    maybeStartSound()
  }

  /** Ring only when: the user asked for sound on this block, we're visible, and the phase should ring. */
  private fun maybeStartSound() {
    if (!wantSound || !visible) return
    if ((phase == "commit" || phase == "recheck") && player == null) startSound()
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
   * what the countdown exists to prevent. It is deliberately a no-op.
   *
   * Both back mechanisms are covered: the legacy `onBackPressed` **and** Android 13+'s predictive back,
   * which **ignores that override entirely** when the app opts in — a silent hole that would reopen the
   * escape the moment the app (or a future Expo template) enables it.
   */
  @Suppress("DEPRECATION", "MissingSuperCall")
  override fun onBackPressed() {
    // no-op
  }

  private fun registerBackGuard() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      onBackInvokedDispatcher.registerOnBackInvokedCallback(
        android.window.OnBackInvokedDispatcher.PRIORITY_OVERLAY
      ) {
        // consume: predictive back must not escape the moment either
      }
    }
  }

  private fun render(phase: String) {
    this.phase = phase
    handler.removeCallbacksAndMessages(null)
    // The tone rings while the moment is ASKING (commit / re-check); once answered it hands off to haptics.
    if (phase != "commit" && phase != "recheck") stopSound()
    when (phase) {
      "commit" -> {
        setContentView(commitView())
        maybeStartSound()
        after(30_000) { dismiss() } // COMMIT idle → close (the re-check is already armed)
      }
      "recheck" -> {
        setContentView(recheckView())
        maybeStartSound()
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

  /** Idempotent: the "done" phase can be re-rendered when the moment resumes, and a DONE must be one DONE. */
  private fun recordDone() {
    if (doneRecorded) return
    doneRecorded = true
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
    // Hard cap — a tone must never outlive the moment (see onPause: it also dies with the screen).
    soundHandler.removeCallbacksAndMessages(null)
    soundHandler.postDelayed({ stopSound() }, SOUND_MAX_MS)
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
    soundHandler.removeCallbacksAndMessages(null)
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
