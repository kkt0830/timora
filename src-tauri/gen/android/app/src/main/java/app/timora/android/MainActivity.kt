package app.timora.android

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

// Keep generated Tauri/Wry sources untouched. This Activity is the Android-only boundary.
class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    // Resize the WebView for bars/cutouts/IME, including Android's enforced edge-to-edge.
    // Wry calls this before setContentView; wait for attachment before accessing the parent.
    webView.post {
      val parent = webView.parent as? android.view.View ?: return@post
      ViewCompat.setOnApplyWindowInsetsListener(parent) { view, insets ->
        val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
        val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
        view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
        WindowInsetsCompat.CONSUMED
      }
      ViewCompat.requestApplyInsets(parent)
    }
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      private var pending = false
      override fun handleOnBackPressed() {
        if (pending) return
        pending = true
        webView.evaluateJavascript("Boolean(window.__TIMORA_BACK__ && window.__TIMORA_BACK__())") { handled ->
          pending = false
          if (handled != "true") {
            // No overlay/internal route: preserve Android's normal root/background behavior.
            isEnabled = false
            onBackPressedDispatcher.onBackPressed()
            isEnabled = true
          }
        }
      }
    })
  }
}
