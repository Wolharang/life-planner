package com.lifeplanner.lpalarm

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri

/**
 * Plays a short preview of an alarm tone in the SETTINGS screen, so the user can hear a tone before
 * choosing it. Nothing to do with the execution moment itself (that reads SoundSetting at fire time).
 * Best-effort: a tone that won't play simply doesn't — it never throws into JS.
 */
object TonePreview {
  private var player: MediaPlayer? = null

  fun play(context: Context, uri: String) {
    stop()
    val u = runCatching { Uri.parse(uri) }.getOrNull() ?: return
    runCatching {
      player = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        setDataSource(context, u)
        isLooping = false
        setOnCompletionListener { stop() }
        prepare()
        start()
      }
    }.onFailure { stop() }
  }

  fun stop() {
    runCatching {
      player?.let {
        if (it.isPlaying) it.stop()
        it.release()
      }
    }
    player = null
  }
}
