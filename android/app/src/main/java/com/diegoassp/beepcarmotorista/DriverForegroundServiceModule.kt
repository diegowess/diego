package com.diegoassp.beepcarmotorista

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DriverForegroundServiceModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "DriverForegroundService"

  private fun prefs() = reactContext.getSharedPreferences("driver_foreground_service", Context.MODE_PRIVATE)

  @ReactMethod
  fun startService(wsUrl: String?, promise: Promise) {
    try {
      if (!wsUrl.isNullOrBlank()) {
        prefs()
          .edit()
          .putString("ws_url", wsUrl)
          .apply()
      }

      prefs()
        .edit()
        .putBoolean("driver_online", true)
        .apply()

      val intent = DriverForegroundService.startIntent(reactContext)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(intent)
      } else {
        reactContext.startService(intent)
      }

      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("START_SERVICE_ERROR", t.message, t)
    }
  }

  @ReactMethod
  fun stopService(promise: Promise) {
    try {
      prefs()
        .edit()
        .putBoolean("driver_online", false)
        .apply()

      val intent = DriverForegroundService.stopIntent(reactContext)
      reactContext.startService(intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("STOP_SERVICE_ERROR", t.message, t)
    }
  }

  @ReactMethod
  fun showBubble(promise: Promise) {
    try {
      val intent = Intent(reactContext, DriverForegroundService::class.java).apply {
        action = DriverForegroundService.ACTION_SHOW_BUBBLE
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        reactContext.startForegroundService(intent)
      } else {
        reactContext.startService(intent)
      }
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("SHOW_BUBBLE_ERROR", t.message, t)
    }
  }

  @ReactMethod
  fun hideBubble(promise: Promise) {
    try {
      val intent = Intent(reactContext, DriverForegroundService::class.java).apply {
        action = DriverForegroundService.ACTION_HIDE_BUBBLE
      }
      reactContext.startService(intent)
      promise.resolve(true)
    } catch (t: Throwable) {
      promise.reject("HIDE_BUBBLE_ERROR", t.message, t)
    }
  }

  @ReactMethod
  fun hasOverlayPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(true)
        return
      }
      promise.resolve(Settings.canDrawOverlays(reactContext))
    } catch (t: Throwable) {
      promise.reject("CHECK_OVERLAY_PERMISSION_ERROR", t.message, t)
    }
  }

  @ReactMethod
  fun requestOverlayPermission(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
        promise.resolve(true)
        return
      }

      // Tenta abrir diretamente as configurações de overlay
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${reactContext.packageName}")
      ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
      
      // Tenta com currentActivity primeiro (mais confiável)
      val activity = reactApplicationContext.currentActivity
      if (activity != null) {
        try {
          activity.startActivity(intent)
          promise.resolve(true)
          return
        } catch (e: Exception) {
          // Se falhar, tenta com reactContext
          e.printStackTrace()
        }
      }
      
      // Tenta com reactContext
      try {
        reactContext.startActivity(intent)
        promise.resolve(true)
        return
      } catch (e: Exception) {
        // Se ainda falhar, tenta abrir configurações gerais
        e.printStackTrace()
        try {
          val settingsIntent = Intent(Settings.ACTION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          val currentActivity = reactApplicationContext.currentActivity
          if (currentActivity != null) {
            currentActivity.startActivity(settingsIntent)
          } else {
            reactContext.startActivity(settingsIntent)
          }
          promise.resolve(true)
        } catch (e2: Exception) {
          e2.printStackTrace()
          promise.reject("REQUEST_OVERLAY_PERMISSION_ERROR", "Não foi possível abrir as configurações: ${e2.message}", e2)
        }
      }
    } catch (t: Throwable) {
      promise.reject("REQUEST_OVERLAY_PERMISSION_ERROR", t.message ?: "Erro desconhecido ao solicitar permissão", t)
    }
  }

  @ReactMethod
  fun consumeOpenFromBubbleFlag(promise: Promise) {
    try {
      val key = "open_from_bubble"
      val was = prefs().getBoolean(key, false)
      if (was) {
        prefs().edit().putBoolean(key, false).apply()
      }
      promise.resolve(was)
    } catch (t: Throwable) {
      promise.reject("CONSUME_OPEN_FROM_BUBBLE_ERROR", t.message, t)
    }
  }

  @ReactMethod
  fun moveTaskToBack(promise: Promise) {
    try {
      val activity = reactApplicationContext.currentActivity
      if (activity == null) {
        promise.resolve(false)
        return
      }
      val moved = activity.moveTaskToBack(true)
      promise.resolve(moved)
    } catch (t: Throwable) {
      promise.reject("MOVE_TASK_TO_BACK_ERROR", t.message, t)
    }
  }
}
