package com.laundrypos.updater

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Process

/**
 * Khởi động lại app (kiểu ProcessPhoenix): activity này chạy ở tiến trình riêng ":restart",
 * tiến trình chính tự tắt → activity mở lại app → app khởi động mới và nạp bản OTA vừa tải.
 */
class RestartActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    Process.killProcess(intent.getIntExtra(EXTRA_PID, -1))
    @Suppress("DEPRECATION")
    val next: Intent? = intent.getParcelableExtra(EXTRA_NEXT)
    if (next != null) startActivity(next)
    finish()
    Runtime.getRuntime().exit(0)
  }

  companion object {
    private const val EXTRA_PID = "pid"
    private const val EXTRA_NEXT = "next"

    fun restart(ctx: Context, launch: Intent) {
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
      val i = Intent(ctx, RestartActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        .putExtra(EXTRA_PID, Process.myPid())
        .putExtra(EXTRA_NEXT, launch)
      ctx.startActivity(i)
    }
  }
}
