package com.laundrypos.updater

import android.content.Context
import android.content.SharedPreferences
import com.laundrypos.BuildConfig
import java.io.File

/**
 * Chọn file JS bundle khi app khởi động (gọi từ MainApplication.getJSBundleFile).
 *
 *  - current: bản OTA đã chạy ổn (đã markSuccess)
 *  - pending: bản OTA vừa tải, chạy thử ở lần mở kế tiếp. Nếu lần chạy thử đó không gọi
 *    markSuccess (app crash khi mở) → lần mở sau tự bỏ bản pending, quay về current/bản gốc.
 *  - Bản OTA chỉ dùng cho đúng versionCode APK đã tải nó; cài APK mới → xoá hết, dùng bundle gốc.
 */
object OtaBundle {
  private const val PREFS = "app_updater"
  const val BUNDLE_FILE = "index.android.bundle"

  /** Phiên bản bundle đang chạy trong tiến trình này (0 = bundle gốc trong APK). */
  @Volatile var loadedVersion: Int = BuildConfig.BUNDLE_VERSION
    private set
  @Volatile var loadedIsPending: Boolean = false
    private set
  /** Bản OTA vừa bị bỏ vì crash khi chạy thử (để JS không tải lại nó). */
  @Volatile var rolledBackVersion: Int = 0
    private set

  fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun otaDir(ctx: Context): File = File(ctx.filesDir, "ota")

  fun resolve(ctx: Context): String? {
    val p = prefs(ctx)
    if (p.getInt("nativeCode", -1) != BuildConfig.VERSION_CODE) {
      // Lần đầu chạy sau khi cài APK mới: bỏ mọi bản OTA cũ
      otaDir(ctx).deleteRecursively()
      p.edit().clear().putInt("nativeCode", BuildConfig.VERSION_CODE).commit()
      return null
    }

    val pendingPath = p.getString("pendingPath", null)
    if (pendingPath != null) {
      val pendingVersion = p.getInt("pendingVersion", 0)
      if (!p.getBoolean("pendingTried", false) && File(pendingPath).exists()) {
        p.edit().putBoolean("pendingTried", true).commit()
        loadedVersion = pendingVersion
        loadedIsPending = true
        return pendingPath
      }
      // Lần chạy thử trước không xác nhận được → bản này lỗi, bỏ đi
      File(pendingPath).parentFile?.deleteRecursively()
      rolledBackVersion = pendingVersion
      p.edit()
        .remove("pendingPath").remove("pendingVersion").remove("pendingTried")
        .putInt("rolledBackVersion", pendingVersion)
        .commit()
    }

    val currentPath = p.getString("currentPath", null)
    if (currentPath != null && File(currentPath).exists()) {
      loadedVersion = p.getInt("currentVersion", BuildConfig.BUNDLE_VERSION)
      return currentPath
    }
    return null
  }

  /** JS đã mở lên bình thường → bản pending thành bản chính thức. */
  fun markSuccess(ctx: Context) {
    if (!loadedIsPending) return
    val p = prefs(ctx)
    val pendingPath = p.getString("pendingPath", null) ?: return
    val oldCurrent = p.getString("currentPath", null)
    p.edit()
      .putString("currentPath", pendingPath)
      .putInt("currentVersion", p.getInt("pendingVersion", 0))
      .remove("pendingPath").remove("pendingVersion").remove("pendingTried")
      .commit()
    loadedIsPending = false
    if (oldCurrent != null && oldCurrent != pendingPath) File(oldCurrent).parentFile?.deleteRecursively()
  }

  /** Đặt bản vừa tải làm pending — áp dụng ở lần mở app kế tiếp. */
  fun setPending(ctx: Context, bundlePath: String, version: Int) {
    val p = prefs(ctx)
    p.getString("pendingPath", null)?.let { old ->
      if (old != bundlePath) File(old).parentFile?.deleteRecursively()
    }
    p.edit()
      .putInt("nativeCode", BuildConfig.VERSION_CODE)
      .putString("pendingPath", bundlePath)
      .putInt("pendingVersion", version)
      .putBoolean("pendingTried", false)
      .commit()
  }

  fun pendingVersion(ctx: Context): Int =
    if (prefs(ctx).getString("pendingPath", null) != null) prefs(ctx).getInt("pendingVersion", 0) else 0

  fun lastRolledBack(ctx: Context): Int = prefs(ctx).getInt("rolledBackVersion", 0)
}
