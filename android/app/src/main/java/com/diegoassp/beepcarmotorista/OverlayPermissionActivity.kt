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
    setContentView(R.layout.activity_overlay_permission)

    val btnCancel = findViewById<Button>(R.id.btnCancel)
    val btnAllow = findViewById<Button>(R.id.btnAllow)

    btnCancel.setOnClickListener {
      finish()
    }

    btnAllow.setOnClickListener {
      openOverlaySettings()
      finish()
    }
  }

  private fun openOverlaySettings() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return

    val intent = Intent(
      Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
      Uri.parse("package:$packageName")
    )
    startActivity(intent)
  }
}
