package app.timora.android

import android.app.Activity
import android.net.Uri
import android.os.Build
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import android.provider.OpenableColumns
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
class SelectedFile { lateinit var uri: String }

// Rust calls this only with the URI returned by the system file picker.
@InvokeArg
class InstallFile { lateinit var path: String }

@TauriPlugin
class FilesPlugin(private val activity: Activity): Plugin(activity) {
  @Command
  fun install(invoke: Invoke) {
    try {
      val file = File(invoke.parseArgs(InstallFile::class.java).path).canonicalFile
      val directory = File(activity.cacheDir, "updates").canonicalFile
      if (!file.path.startsWith(directory.path + File.separator) || file.extension != "apk") { invoke.resolve(JSObject().put("error", "설치 파일 위치가 올바르지 않습니다.")); return }
      val pm = activity.packageManager
      val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
      val candidate = pm.getPackageArchiveInfo(file.path, flags)
      val installed = pm.getPackageInfo(activity.packageName, flags)
      val candidateVersion = if (Build.VERSION.SDK_INT >= 28) candidate?.longVersionCode else candidate?.versionCode?.toLong()
      val installedVersion = if (Build.VERSION.SDK_INT >= 28) installed.longVersionCode else installed.versionCode.toLong()
      if (candidate == null || candidate.packageName != activity.packageName || candidateVersion == null || candidateVersion <= installedVersion) { invoke.resolve(JSObject().put("error", "이 앱의 새 버전 APK가 아닙니다.")); return }
      val current = (if (Build.VERSION.SDK_INT >= 28) installed.signingInfo?.apkContentsSigners else installed.signatures) ?: emptyArray()
      val next = (if (Build.VERSION.SDK_INT >= 28) candidate.signingInfo?.let { if (it.hasMultipleSigners()) it.apkContentsSigners else it.signingCertificateHistory } else candidate.signatures) ?: emptyArray()
      if (current.isEmpty() || !current.all { old -> next.any { it == old } }) { invoke.resolve(JSObject().put("error", "기존 앱과 APK 서명이 다릅니다. 데이터를 보존하기 위해 설치를 중단했습니다. 기존 앱을 삭제하지 마세요.")); return }
      if (Build.VERSION.SDK_INT >= 26 && !pm.canRequestPackageInstalls()) {
        activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.packageName)))
        invoke.resolve(JSObject().put("error", "설정에서 Timora의 앱 설치를 허용한 뒤 다시 설치를 선택하세요.")); return
      }
      val uri = FileProvider.getUriForFile(activity, activity.packageName + ".fileprovider", file)
      activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
      invoke.resolve(JSObject().put("ok", true))
    } catch (_: Exception) { invoke.resolve(JSObject().put("error", "Android 설치 화면을 열지 못했습니다. 기존 앱과 데이터는 보존됩니다.")) }
  }
  @Command
  fun filename(invoke: Invoke) {
    try {
      val uri = Uri.parse(invoke.parseArgs(SelectedFile::class.java).uri)
      if (uri.scheme != "content") { invoke.reject("Unsupported selected URI"); return }
      activity.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          val name = cursor.getString(cursor.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME))
          invoke.resolve(JSObject().put("name", name)); return
        }
      }
      invoke.reject("Selected file name unavailable")
    } catch (_: Exception) { invoke.reject("Could not read selected file name") }
  }
}
