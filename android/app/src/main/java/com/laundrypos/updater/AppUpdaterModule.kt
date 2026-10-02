package com.laundrypos.updater

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.laundrypos.BuildConfig
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream

/**
 * Tự cập nhật app:
 *  - APK: tải file .apk → mở màn hình cài đặt của Android (nhân viên bấm "Cài đặt").
 *  - OTA: tải gói JS (.zip) → áp dụng khi mở lại app, không cần cài APK.
 */
class AppUpdaterModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName() = "AppUpdater"

  @ReactMethod
  fun getInfo(promise: Promise) {
    val map = Arguments.createMap()
    map.putInt("versionCode", BuildConfig.VERSION_CODE)
    map.putString("versionName", BuildConfig.VERSION_NAME)
    map.putInt("bundleVersion", OtaBundle.loadedVersion)
    map.putInt("pendingBundleVersion", OtaBundle.pendingVersion(ctx))
    map.putInt("rolledBackVersion", OtaBundle.lastRolledBack(ctx))
    promise.resolve(map)
  }

  @ReactMethod
  fun markSuccess(promise: Promise) {
    OtaBundle.markSuccess(ctx)
    promise.resolve(null)
  }

  /** Tải + giải nén gói OTA, đặt làm bản chờ áp dụng. */
  @ReactMethod
  fun downloadBundle(url: String, version: Int, promise: Promise) {
    Thread {
      try {
        val root = OtaBundle.otaDir(ctx).apply { mkdirs() }
        val zip = File(root, "download.zip")
        download(url, zip, null)
        val dest = File(root, "v$version")
        dest.deleteRecursively()
        dest.mkdirs()
        unzip(zip, dest)
        zip.delete()
        val bundle = File(dest, OtaBundle.BUNDLE_FILE)
        if (!bundle.exists() || bundle.length() == 0L) throw IllegalStateException("Gói cập nhật thiếu ${OtaBundle.BUNDLE_FILE}")
        OtaBundle.setPending(ctx, bundle.absolutePath, version)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("OTA_DOWNLOAD", e.message ?: "Tải bản cập nhật thất bại", e)
      }
    }.start()
  }

  /** Tải APK về cache, báo tiến độ qua sự kiện "AppUpdaterProgress" {received,total}. */
  @ReactMethod
  fun downloadApk(url: String, promise: Promise) {
    Thread {
      try {
        val dir = File(ctx.cacheDir, "updates").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val apk = File(dir, "update.apk")
        download(url, apk) { received, total ->
          val m = Arguments.createMap()
          m.putDouble("received", received.toDouble())
          m.putDouble("total", total.toDouble())
          ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("AppUpdaterProgress", m)
        }
        promise.resolve(apk.absolutePath)
      } catch (e: Exception) {
        promise.reject("APK_DOWNLOAD", e.message ?: "Tải APK thất bại", e)
      }
    }.start()
  }

  /**
   * Mở trình cài APK. Android 8+ cần cho phép "Cài ứng dụng không rõ nguồn gốc" cho app này:
   * chưa cho phép → mở màn hình cài đặt quyền và reject "NEED_PERMISSION" (bật xong bấm lại).
   */
  @ReactMethod
  fun installApk(path: String, promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !ctx.packageManager.canRequestPackageInstalls()) {
        val i = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}"))
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(i)
        promise.reject("NEED_PERMISSION", "Cần cho phép cài ứng dụng từ app này")
        return
      }
      val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.updater.provider", File(path))
      val i = Intent(Intent.ACTION_VIEW)
      i.setDataAndType(uri, "application/vnd.android.package-archive")
      i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(i)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("APK_INSTALL", e.message ?: "Không mở được trình cài đặt", e)
    }
  }

  /** Khởi động lại app để chạy bản OTA vừa tải. */
  @ReactMethod
  fun restart() {
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return
    RestartActivity.restart(ctx, launch)
  }

  private fun download(url: String, out: File, onProgress: ((Long, Long) -> Unit)?) {
    val conn = URL(url).openConnection() as HttpURLConnection
    conn.connectTimeout = 15_000
    conn.readTimeout = 60_000
    conn.instanceFollowRedirects = true
    if (conn.responseCode !in 200..299) throw IllegalStateException("HTTP ${conn.responseCode}")
    val total = conn.contentLengthLong
    var received = 0L
    var lastEmit = 0L
    conn.inputStream.use { input ->
      FileOutputStream(out).use { output ->
        val buf = ByteArray(64 * 1024)
        while (true) {
          val n = input.read(buf)
          if (n < 0) break
          output.write(buf, 0, n)
          received += n
          val now = System.currentTimeMillis()
          if (onProgress != null && now - lastEmit > 250) {
            lastEmit = now
            onProgress(received, total)
          }
        }
      }
    }
    conn.disconnect()
    onProgress?.invoke(received, total)
    if (total > 0 && received != total) throw IllegalStateException("Tải chưa đủ dung lượng")
  }

  private fun unzip(zip: File, dest: File) {
    val root = dest.canonicalPath + File.separator
    ZipInputStream(zip.inputStream().buffered()).use { zis ->
      while (true) {
        val entry = zis.nextEntry ?: break
        val f = File(dest, entry.name)
        if (!f.canonicalPath.startsWith(root)) throw SecurityException("Đường dẫn không hợp lệ trong gói: ${entry.name}")
        if (entry.isDirectory) f.mkdirs()
        else {
          f.parentFile?.mkdirs()
          FileOutputStream(f).use { zis.copyTo(it) }
        }
      }
    }
  }

  // Bắt buộc cho NativeEventEmitter ở JS
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}
}
