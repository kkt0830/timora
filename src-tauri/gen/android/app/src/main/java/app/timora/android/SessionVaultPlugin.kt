package app.timora.android

import android.app.Activity
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import app.tauri.JSObject
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@InvokeArg
class VaultWrite { lateinit var value: String }

// Only called from Rust after local identity checks. No JS bridge/global permissions.
@TauriPlugin
class SessionVaultPlugin(private val activity: Activity): Plugin(activity) {
  private val alias = "timora.cloud.refresh.v1"
  private val preferences get() = activity.getSharedPreferences("timora_cloud_session", Activity.MODE_PRIVATE)
  private fun key(create: Boolean): SecretKey? {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(alias, null) as? SecretKey)?.let { return it }
    if (!create) return null
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setRandomizedEncryptionRequired(true).build())
    return generator.generateKey()
  }
  @Command fun read(invoke: Invoke) {
    try {
      val blob = preferences.getString("encrypted", null)
      val result = JSObject()
      if (blob == null) result.put("value", null)
      else {
        val bytes = Base64.decode(blob, Base64.NO_WRAP)
        require(bytes.size > 12)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(false) ?: error("Key unavailable"), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        result.put("value", cipher.doFinal(bytes.copyOfRange(12, bytes.size)).toString(Charsets.UTF_8))
      }
      invoke.resolve(result)
    } catch (_: Exception) { invoke.reject("보안 세션을 복원하지 못했습니다. 다시 Cloud 인증해 주세요. 로컬 기록은 보존됩니다.") }
  }
  @Command fun write(invoke: Invoke) {
    try {
      val value = invoke.parseArgs(VaultWrite::class.java).value
      require(value.length <= 4096)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, key(true))
      val encrypted = Base64.encodeToString(cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8)), Base64.NO_WRAP)
      check(preferences.edit().putString("encrypted", encrypted).commit())
      invoke.resolve()
    } catch (_: Exception) { invoke.reject("보안 세션을 저장하지 못했습니다. 로컬 기록은 보존됩니다.") }
  }
  @Command fun clear(invoke: Invoke) {
    if (preferences.edit().remove("encrypted").commit()) invoke.resolve()
    else invoke.reject("보안 세션 삭제 실패")
  }
}
