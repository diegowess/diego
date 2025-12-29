package com.diegoassp.beepcarmotorista

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity

class OverlayPermissionActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      setContentView(R.layout.activity_overlay_permission)

      val btnCancel = findViewById<Button>(R.id.btnCancel)
      val btnAllow = findViewById<Button>(R.id.btnAllow)

      btnCancel?.setOnClickListener {
        finish()
      }

      btnAllow?.setOnClickListener {
        try {
          openOverlaySettings()
        } catch (e: Exception) {
          // Se falhar, apenas fecha a activity
          e.printStackTrace()
        } finally {
          finish()
        }
      }
    } catch (e: Exception) {
      e.printStackTrace()
      finish()
    }
  }

  private fun openOverlaySettings() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return

    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:$packageName")
      ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      startActivity(intent)
    } catch (e: Exception) {
      e.printStackTrace()
      // Tenta abrir configurações gerais como fallback
      try {
        val intent = Intent(Settings.ACTION_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
      } catch (e2: Exception) {
        e2.printStackTrace()
      }
    }
  }
}
