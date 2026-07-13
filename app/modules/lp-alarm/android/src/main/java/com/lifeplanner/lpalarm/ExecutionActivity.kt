package com.lifeplanner.lpalarm

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
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
import android.provider.Settings
import android.view.WindowManager
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.FrameLayout
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
  private var occurrenceDate = "" // the day the OUTCOME belongs to; carried by the re-check (see below)
  private var wantSound = false
  private var wantVibrate = true // D65: 무음 blocks take the screen and say nothing at all // per-block (D43): this block asked for a tone. false = vibration only.
  private var phase = ""        // the phase currently on screen — so we can resume exactly where we froze
  private var visible = false   // the moment only advances (timers, tone) while it is actually on screen
  private var doneRecorded = false // recordDone() must be idempotent: re-rendering "done" must not re-record
  private var resummons = 0 // how many times we pulled ourselves back after being sent away (bounded)
  private var wm: WindowManager? = null
  private var overlayRoot: FrameLayout? = null // the moment lives in an overlay window so ad/lock-screen
                                              // overlays (캐시워크 …) cannot sit on top of it
  private var count = 5
  private var player: MediaPlayer? = null
  private var savedAlarmVolume = -1

  private val handler = Handler(Looper.getMainLooper())
  // The sound cap gets its own handler: render() clears `handler` on every phase change, which would
  // otherwise silently drop the safety timer that guarantees a tone can never ring forever.
  private val soundHandler = Handler(Looper.getMainLooper())
  private val topHandler = Handler(Looper.getMainLooper()) // re-asserts the moment as the topmost window

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
    val sound: Boolean = false,
    /** D65 — 무음: the moment takes the screen and says nothing. No tone, and **no buzz**. */
    val vibrate: Boolean = true,
    /** The day the OUTCOME belongs to. Empty on a commit (derivable); carried on a re-check (not). */
    val occurrenceDate: String = ""
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
    private const val PREF_SAVED_VOLUME = "savedAlarmVolume"
    // Pulling an unanswered moment back after home/power. Bounded: insist, never trap (R14).
    private const val RESUMMON_MAX = 3
    private const val RESUMMON_DELAY_MS = 700L
    // How often an unanswered moment re-claims the top of the overlay layer (another app can add a window
    // over ours at any time; the most recently added one wins).
    private const val TOP_REASSERT_MS = 2_000L
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
    val item = itemFrom(newIntent)
    // Our own re-summon (or a re-tap of this occurrence's notification) is not a NEW occurrence — it is
    // this one coming back. Only a genuinely different occurrence gets queued (R2 sequential).
    if (item.taskId == alarmId && !resolved.contains(alarmId)) return
    queue.addLast(item)
  }

  private fun itemFrom(i: Intent) = Item(
    taskId = i.getStringExtra(LpAlarmConstants.EXTRA_ID) ?: "",
    title = i.getStringExtra(LpAlarmConstants.EXTRA_TITLE) ?: "실행",
    note = i.getStringExtra(LpAlarmConstants.EXTRA_NOTE) ?: "",
    intended = i.getLongExtra(LpAlarmConstants.EXTRA_INTENDED, System.currentTimeMillis()),
    createdAt = i.getLongExtra(LpAlarmConstants.EXTRA_CREATED, 0L),
    leadMinutes = i.getIntExtra(LpAlarmConstants.EXTRA_LEAD, 0),
    mode = i.getStringExtra(LpAlarmConstants.EXTRA_MODE) ?: "commit",
    sound = i.getBooleanExtra(LpAlarmConstants.EXTRA_SOUND, false),
    vibrate = i.getBooleanExtra(LpAlarmConstants.EXTRA_VIBRATE, true),
    occurrenceDate = i.getStringExtra(LpAlarmConstants.EXTRA_DATE) ?: ""
  )

  private fun startItem(item: Item) {
    restoreStrandedVolume() // a previous moment may have been killed mid-tone with the phone left at MAX
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
    wantVibrate = item.vibrate // D65
    occurrenceDate = item.occurrenceDate
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

  /**
   * Arm the ~5-min "진짜 했어?" follow-up — and **persist it**.
   *
   * It used to be scheduled with `persist = false`, so it existed only as an OS alarm with no record behind
   * it. Android drops an app's alarms when the app is force-stopped (a Samsung "close all" does exactly
   * that), and a reboot drops them too — and with nothing in the mirror, **nothing could ever re-arm it**.
   * The moment never came back, and the occurrence fell to the catch-up net as a miss. The founder hit this:
   * he committed, closed the app, and the re-check never came.
   *
   * Mirrored, `BootReceiver` and `AlarmBackupWorker` re-arm it like any other alarm — and now that the mirror
   * carries `mode`, it comes back as the **re-check** it is, not as a fresh execution moment.
   */
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
        sound = wantSound,
        vibrate = wantVibrate,
        occurrenceDate = occurrenceYmd() // the block's day — NOT the day the re-check happens to land on
      ),
      persist = true
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
    resummons = 0 // we're back — the budget below is per *departure*, not per lifetime
    if (phase.isNotEmpty()) render(phase) // resume exactly where we were (re-arms this phase's timers)
    maybeStartSound()
  }

  /**
   * **Coming back is the app's job, not the user's.**
   *
   * Two layers, because they solve different halves:
   *  1. **Prevent** the screen going away by itself — `FLAG_KEEP_SCREEN_ON` (+ turnScreenOn/showWhenLocked).
   *     While the moment is up the screen does not time out. This is the layer we *want* to do the work.
   *  2. But a user pressing **power / home / recents** cannot be blocked by any app — Android reserves
   *     that, and an app that could trap you on a screen would be a worse product than this one is trying
   *     to be. For those, the moment **re-summons itself**: it was pre-committed, and leaving it is not one
   *     of its two answers (R7/A2 — the only intentional skip is the pre-fire "오늘은 쉼").
   *
   * The re-summon is what the **"다른 앱 위에 표시"** grant (D41) buys us: a background activity start.
   * It is **bounded** (`RESUMMON_MAX`) so it can never become a fight with the user — after that the
   * notification remains as the way back, and the outcome simply stays pending (no guilt, R14).
   */
  override fun onStop() {
    super.onStop()
    // The overlay window would happily outlive the activity — exactly the class of bug D44/D46 exist to
    // forbid (a moment that keeps existing where nothing can govern it). It goes when we go, and the
    // re-summon below is what brings the whole thing back.
    detachOverlay()
    val unanswered = alarmId.isNotEmpty() && !resolved.contains(alarmId)
    if (!unanswered || isFinishing) return
    if (resummons >= RESUMMON_MAX) return // don't trap the user — the notification is still the way back
    resummons++
    handler.postDelayed({
      if (!visible && !isFinishing) {
        try {
          startActivity(
            Intent(this, ExecutionActivity::class.java).apply {
              flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
              putExtra(LpAlarmConstants.EXTRA_ID, alarmId)
              putExtra(LpAlarmConstants.EXTRA_TITLE, title)
              putExtra(LpAlarmConstants.EXTRA_NOTE, note)
              putExtra(LpAlarmConstants.EXTRA_INTENDED, intended)
              putExtra(LpAlarmConstants.EXTRA_CREATED, createdAt)
              putExtra(LpAlarmConstants.EXTRA_LEAD, leadMinutes)
              putExtra(LpAlarmConstants.EXTRA_MODE, mode)
              putExtra(LpAlarmConstants.EXTRA_SOUND, wantSound)
            }
          )
        } catch (e: Exception) {
          // background start refused (no overlay grant) — the notification is still there to tap
        }
      }
    }, RESUMMON_DELAY_MS)
  }

  /** Ring only when: the user asked for sound on this block, we're visible, and the phase should ring. */
  private fun maybeStartSound() {
    if (!wantSound || !visible) return
    if ((phase == "commit" || phase == "recheck") && player == null) startSound()
  }

  // ── Staying on top of OTHER apps' overlays ────────────────────────────────────────────────────────
  //
  // A lock-screen/ad app (캐시워크 and friends) draws a `TYPE_APPLICATION_OVERLAY` window — and an overlay
  // is ALWAYS above every ordinary activity. So as long as the moment is only an Activity, it structurally
  // loses: our screen is up, but their ad is what the user sees. Android offers **no "always topmost"
  // grade** (if it did, ad apps would already own it): within the overlay layer, **the most recently added
  // window wins**.
  //
  // So the moment renders into an **overlay window of its own** (the Activity stays underneath to do what
  // only an Activity can: turn the screen on, show over the keyguard, own the lifecycle) — and, while it is
  // unanswered, it **re-asserts itself** on a slow tick: detach + re-attach puts it back on top of anything
  // that appeared over it. Bounded in effort, never a fight the user can't win: they can always answer.
  private fun setMomentView(view: View) {
    if (!canOverlay()) {
      setContentView(view) // no grant → plain activity content (an overlay app can still cover us)
      return
    }
    val manager = wm ?: (getSystemService(Context.WINDOW_SERVICE) as WindowManager).also { wm = it }
    detachOverlay()
    val root = FrameLayout(this).apply {
      setBackgroundColor(bg)
      addView(view, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
    }
    try {
      manager.addView(root, overlayParams())
      overlayRoot = root
      setContentView(View(this).apply { setBackgroundColor(bg) }) // the activity itself is just the ground
      scheduleTopReassert()
    } catch (e: Exception) {
      overlayRoot = null
      setContentView(view) // overlay refused → fall back to being a normal activity
    }
  }

  private fun overlayParams(): WindowManager.LayoutParams {
    val type =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
    @Suppress("DEPRECATION")
    return WindowManager.LayoutParams(
      MATCH_PARENT,
      MATCH_PARENT,
      type,
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.OPAQUE
    )
  }

  /** Re-attaching moves us back to the top of the overlay layer — the only lever Android actually gives. */
  private fun scheduleTopReassert() {
    topHandler.removeCallbacksAndMessages(null)
    topHandler.postDelayed(
      object : Runnable {
        override fun run() {
          val root = overlayRoot ?: return
          if (isFinishing || alarmId.isEmpty() || resolved.contains(alarmId)) return
          try {
            wm?.removeView(root)
            wm?.addView(root, overlayParams()) // last added = on top of any overlay that appeared over us
          } catch (e: Exception) {
            // window gone — nothing to re-assert
          }
          topHandler.postDelayed(this, TOP_REASSERT_MS)
        }
      },
      TOP_REASSERT_MS
    )
  }

  private fun detachOverlay() {
    topHandler.removeCallbacksAndMessages(null)
    overlayRoot?.let { root ->
      try {
        wm?.removeView(root)
      } catch (e: Exception) {
        // already gone
      }
    }
    overlayRoot = null
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    detachOverlay()
    stopSound()
    unregisterBackGuard() // it was registered in onCreate and never removed
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

  private fun canOverlay(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)

  /** Held so it can be unregistered — a callback that outlives its activity is a leak the next moment pays for. */
  private var backGuard: android.window.OnBackInvokedCallback? = null

  private fun registerBackGuard() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val cb = android.window.OnBackInvokedCallback {
        // consume: predictive back must not escape the moment either
      }
      onBackInvokedDispatcher.registerOnBackInvokedCallback(
        android.window.OnBackInvokedDispatcher.PRIORITY_OVERLAY,
        cb
      )
      backGuard = cb
    }
  }

  private fun unregisterBackGuard() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      backGuard?.let { onBackInvokedDispatcher.unregisterOnBackInvokedCallback(it) }
      backGuard = null
    }
  }

  private fun render(phase: String) {
    this.phase = phase
    handler.removeCallbacksAndMessages(null)
    // The tone rings while the moment is ASKING (commit / re-check); once answered it hands off to haptics.
    if (phase != "commit" && phase != "recheck") stopSound()
    when (phase) {
      "commit" -> {
        setMomentView(commitView())
        maybeStartSound()
        after(30_000) { dismiss() } // COMMIT idle → close (the re-check is already armed)
      }
      "recheck" -> {
        setMomentView(recheckView())
        maybeStartSound()
        after(90_000) { render("pending") } // ignored re-check → PENDING (no-guilt catch-up later)
      }
      "leave" -> {
        count = 5
        renderLeaveCountdown()
      }
      "leavego" -> {
        vibrate(40)
        setMomentView(leaveGoView())
        after(3_500) { dismiss() } // pushed out; outcome stays pending (no guilt) — catch-up resolves it
      }
      "done" -> {
        recordDone()
        vibrate(90)
        setMomentView(doneView())
      }
      "pending" -> dismiss()
    }
  }

  // --- views ---

  private fun commitView(): View = column().apply {
    addView(label("내가 정한 약속", 13, soft))
    addView(label(commitLine(), 23, ink, top = 12, bold = true, voice = true))
    // A2: ask for the 5-second FIRST MOVE, not the task. The micro-start note lost its screen when the
    // flow became commit → re-check, so it lives here now — the one thing to do in the next 5 seconds.
    if (note.isNotEmpty()) addView(label("딱 첫 동작 — $note", 17, soft, top = 14))
    // v1: commit only acknowledges — the "진짜 했어?" re-check comes ~5 min later (already armed).
    addView(brandButton("응, 할게") { dismiss() })
  }

  private fun recheckView(): View = column().apply {
    addView(label("아까 하기로 한 거", 13, soft))
    addView(label("진짜 했어?", 30, ink, top = 12, bold = true, voice = true))
    addView(brandButton("응, 했어") { render("done") })
    addView(textLink("아직 안 했어", top = 22) { render("leave") })
  }

  private fun renderLeaveCountdown() {
    setMomentView(countView(count))
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
    addView(label("안 하던 걸 해냈다.", 24, gold, top = 12, bold = true, voice = true))
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

  /**
   * **The execution voice.** `design-system.md §1` gives the moment its own typeface — a GowunBatang serif —
   * precisely because this screen must not feel like the rest of the app: it is yesterday's you speaking, not a
   * utility. The font was **loaded at app start and blocked the splash on it**, and then **used by nothing**:
   * the moment is native, and native never asked for it. We paid the cost and shipped the design centrepiece in
   * the wrong voice.
   *
   * Loaded from the module's own assets, so it works with no JS process alive — which is the normal case for
   * this screen.
   */
  private val serif: Typeface? by lazy {
    try {
      Typeface.createFromAsset(assets, "fonts/GowunBatang-Regular.ttf")
    } catch (e: Exception) {
      null // the moment must render in *some* font rather than not render
    }
  }

  private fun label(
    text: String,
    sizeSp: Int,
    color: Int,
    top: Int = 0,
    bold: Boolean = false,
    voice: Boolean = false // the serif — reserved for what the moment SAYS, never for buttons or numbers
  ): TextView =
    TextView(this).apply {
      this.text = text
      setTextColor(color)
      gravity = Gravity.CENTER
      setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp.toFloat())
      if (voice && serif != null) setTypeface(serif, if (bold) Typeface.BOLD else Typeface.NORMAL)
      else if (bold) setTypeface(typeface, Typeface.BOLD)
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

  /**
   * The day this occurrence belongs to.
   *
   * A **commit** derives it: `intended + lead` is the block's start. A **re-check** cannot — its `intended` is
   * merely "commit + 5 minutes", so a 23:58 block's re-check at 00:03 derived **tomorrow**. The DONE was then
   * filed against a day the block does not exist on, today's fire marker stayed unanswered, and seven days
   * later the catch-up net auto-archived it as a **miss the user had explicitly answered "했어" to**. The
   * re-check therefore carries the original day with it, and that always wins.
   */
  private fun occurrenceYmd(): String =
    if (occurrenceDate.isNotEmpty()) occurrenceDate else ymd(intended + leadMinutes * 60_000L)

  private fun ymd(ms: Long): String {
    val c = Calendar.getInstance().apply { timeInMillis = ms }
    return String.format("%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
  }

  private fun volumePrefs() = getSharedPreferences("lp_alarm_volume", Context.MODE_PRIVATE)

  /** If a previous moment was killed mid-tone, its saved level is still on disk — give it back. */
  private fun restoreStrandedVolume() {
    val stranded = volumePrefs().getInt(PREF_SAVED_VOLUME, -1)
    if (stranded < 0) return
    try {
      (getSystemService(Context.AUDIO_SERVICE) as AudioManager)
        .setStreamVolume(AudioManager.STREAM_ALARM, stranded, 0)
    } catch (e: Exception) {
      // policy refused — nothing else we can do, and it must not crash the moment
    }
    volumePrefs().edit().remove(PREF_SAVED_VOLUME).apply()
  }

  private fun startSound() {
    // Hard cap — a tone must never outlive the moment (see onPause: it also dies with the screen).
    soundHandler.removeCallbacksAndMessages(null)
    soundHandler.postDelayed({ stopSound() }, SOUND_MAX_MS)
    try {
      // The execution moment should be loud regardless of a low/locked alarm slider — max the ALARM
      // stream during the moment and restore it on dismiss.
      // **Save the user's level ONCE.** This used to overwrite `savedAlarmVolume` on every call — and
      // `maybeStartSound()` calls it again whenever `player == null`, which is exactly what happens if the
      // MediaPlayer below throws. So: volume goes to MAX, the player fails, the next render calls us again,
      // and we "save" MAX as the original. The user's alarm volume was then **permanently maxed**, with no way
      // back short of setting it by hand. A moment may be loud; it may not keep the phone loud forever.
      val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      if (savedAlarmVolume < 0) savedAlarmVolume = am.getStreamVolume(AudioManager.STREAM_ALARM)
      // Persist it: `onDestroy` never runs if the OEM kills the process mid-tone, and then the phone is
      // stranded at MAX with nothing left in memory that knows what it used to be. The next launch restores it.
      volumePrefs().edit().putInt(PREF_SAVED_VOLUME, savedAlarmVolume).apply()
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
      volumePrefs().edit().remove(PREF_SAVED_VOLUME).apply()
    }
  }

  /** Silent means silent: 무음 blocks do not buzz either (D65). The screen is the intervention. */
  private fun vibrate(ms: Long) {
    if (!wantVibrate) return
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
