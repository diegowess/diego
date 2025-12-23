package com.diegoassp.beepcarmotorista

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class DriverForegroundService : Service() {
  companion object {
    private const val SERVICE_CHANNEL_ID = "driver_foreground_service"
    private const val SERVICE_CHANNEL_NAME = "Serviço do motorista"
    private const val SERVICE_NOTIFICATION_ID = 2001

    private const val ALERT_CHANNEL_ID = "driver_corridas_alert"
    private const val ALERT_CHANNEL_NAME = "Alertas de corrida"
    private const val ALERT_NOTIFICATION_ID = 2002

    const val ACTION_START = "com.diegoassp.beepcarmotorista.action.START_DRIVER_FOREGROUND"
    const val ACTION_STOP = "com.diegoassp.beepcarmotorista.action.STOP_DRIVER_FOREGROUND"
    const val ACTION_SHOW_BUBBLE = "com.diegoassp.beepcarmotorista.action.SHOW_BUBBLE"
    const val ACTION_HIDE_BUBBLE = "com.diegoassp.beepcarmotorista.action.HIDE_BUBBLE"

    private const val DEFAULT_WS_URL = "wss://example.com"

    private const val PREFS_NAME = "driver_foreground_service"
    private const val PREF_WS_URL = "ws_url"
    private const val PREF_DRIVER_ONLINE = "driver_online"
    private const val PREF_OPEN_FROM_BUBBLE = "open_from_bubble"

    fun startIntent(context: Context): Intent {
      return Intent(context, DriverForegroundService::class.java).apply {
        action = ACTION_START
      }
    }

    fun stopIntent(context: Context): Intent {
      return Intent(context, DriverForegroundService::class.java).apply {
        action = ACTION_STOP
      }
    }
  }

  private var webSocket: WebSocket? = null
  private var wakeLock: PowerManager.WakeLock? = null

  private var windowManager: WindowManager? = null
  private var bubbleView: View? = null
  private var bubbleParams: WindowManager.LayoutParams? = null
  private var initialX: Int = 0
  private var initialY: Int = 0
  private var initialTouchX: Float = 0f
  private var initialTouchY: Float = 0f
  private var isMoving: Boolean = false

  override fun onCreate() {
    super.onCreate()
    createNotificationChannels()
    acquireWakeLock()
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopInternal()
        return START_NOT_STICKY
      }
      ACTION_SHOW_BUBBLE -> {
        try {
          startForeground(SERVICE_NOTIFICATION_ID, buildServiceNotification())
        } catch (_: Throwable) {
          stopSelf()
          return START_NOT_STICKY
        }
        ensureWebSocketConnected()
        showBubbleInternal()
      }
      ACTION_HIDE_BUBBLE -> {
        try {
          startForeground(SERVICE_NOTIFICATION_ID, buildServiceNotification())
        } catch (_: Throwable) {
          stopSelf()
          return START_NOT_STICKY
        }
        ensureWebSocketConnected()
        hideBubbleInternal()
      }
      ACTION_START, null -> {
        try {
          startForeground(SERVICE_NOTIFICATION_ID, buildServiceNotification())
        } catch (_: Throwable) {
          stopSelf()
          return START_NOT_STICKY
        }
        ensureWebSocketConnected()
        hideBubbleInternal()
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    stopInternal()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun stopInternal() {
    hideBubbleInternal()
    try {
      webSocket?.close(1000, "stopped")
    } catch (_: Throwable) {
    }
    webSocket = null

    try {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (_: Throwable) {
    }

    releaseWakeLock()
    stopSelf()
  }

  private fun ensureWebSocketConnected() {
    if (webSocket != null) return

    val wsUrl = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
      .getString(PREF_WS_URL, DEFAULT_WS_URL) ?: DEFAULT_WS_URL

    val client = OkHttpClient.Builder()
      .pingInterval(30, TimeUnit.SECONDS)
      .retryOnConnectionFailure(true)
      .build()

    val request = Request.Builder().url(wsUrl).build()

    webSocket = client.newWebSocket(request, object : WebSocketListener() {
      override fun onMessage(webSocket: WebSocket, text: String) {
        handleWsMessage(text)
      }

      override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
        this@DriverForegroundService.webSocket = null
      }

      override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
        this@DriverForegroundService.webSocket = null
      }
    })
  }

  private fun handleWsMessage(text: String) {
    val json = try {
      JSONObject(text)
    } catch (_: Throwable) {
      return
    }

    val type = json.optString("type", "")
    if (type != "nova_corrida") return

    triggerAlert(json)
  }

  private fun triggerAlert(payload: JSONObject) {
    vibrate()

    val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    try {
      val ringtone = RingtoneManager.getRingtone(applicationContext, soundUri)
      ringtone?.audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      ringtone?.play()
    } catch (_: Throwable) {
    }

    val corridaObj = payload.optJSONObject("corrida")
    val corridaId = corridaObj?.optString("id") ?: ""

    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val pi = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0) or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val notification = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("Nova corrida")
      .setContentText(if (corridaId.isNotBlank()) "Corrida #$corridaId" else "Você recebeu uma corrida")
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setContentIntent(pi)
      .setAutoCancel(true)
      .setSound(soundUri)
      .setVibrate(longArrayOf(0, 500, 200, 500))
      .build()

    nm.notify(ALERT_NOTIFICATION_ID, notification)
  }

  private fun vibrate() {
    val pattern = longArrayOf(0, 500, 200, 500)

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val vm = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
        val vib = vm.defaultVibrator
        vib.vibrate(VibrationEffect.createWaveform(pattern, -1))
      } else {
        @Suppress("DEPRECATION")
        val vib = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vib.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
          @Suppress("DEPRECATION")
          vib.vibrate(pattern, -1)
        }
      }
    } catch (_: Throwable) {
    }
  }

  private fun buildServiceNotification(): Notification {
    val pi = PendingIntent.getActivity(
      this,
      0,
      Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0) or PendingIntent.FLAG_UPDATE_CURRENT
    )

    return NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("Beep Motorista")
      .setContentText("App ativo aguardando corridas")
      .setOngoing(true)
      .setContentIntent(pi)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    val serviceChannel = NotificationChannel(
      SERVICE_CHANNEL_ID,
      SERVICE_CHANNEL_NAME,
      NotificationManager.IMPORTANCE_LOW
    )
    nm.createNotificationChannel(serviceChannel)

    val alertChannel = NotificationChannel(
      ALERT_CHANNEL_ID,
      ALERT_CHANNEL_NAME,
      NotificationManager.IMPORTANCE_HIGH
    )
    alertChannel.enableVibration(true)
    alertChannel.vibrationPattern = longArrayOf(0, 500, 200, 500)
    nm.createNotificationChannel(alertChannel)
  }

  private fun acquireWakeLock() {
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BeepMotorista:DriverFgService").apply {
        setReferenceCounted(false)
        acquire()
      }
    } catch (_: Throwable) {
    }
  }

  private fun releaseWakeLock() {
    try {
      if (wakeLock?.isHeld == true) wakeLock?.release()
    } catch (_: Throwable) {
    }
    wakeLock = null
  }

  private fun showBubbleInternal() {
    if (bubbleView != null) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return

    val wm = windowManager ?: return

    val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      layoutFlag,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT
    )

    params.gravity = Gravity.TOP or Gravity.START
    params.x = 20
    params.y = 200

    val inflater = LayoutInflater.from(this)
    val view = inflater.inflate(R.layout.floating_bubble, null)

    view.setOnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          initialX = params.x
          initialY = params.y
          initialTouchX = event.rawX
          initialTouchY = event.rawY
          isMoving = false
          true
        }
        MotionEvent.ACTION_MOVE -> {
          params.x = initialX + (event.rawX - initialTouchX).toInt()
          params.y = initialY + (event.rawY - initialTouchY).toInt()
          try {
            wm.updateViewLayout(view, params)
          } catch (_: Throwable) {
          }

          if (kotlin.math.abs(event.rawX - initialTouchX) > 10 || kotlin.math.abs(event.rawY - initialTouchY) > 10) {
            isMoving = true
          }
          true
        }
        MotionEvent.ACTION_UP -> {
          if (!isMoving) {
            openAppFromBubble()
          }
          true
        }
        else -> false
      }
    }

    bubbleParams = params
    bubbleView = view
    try {
      wm.addView(view, params)
    } catch (_: Throwable) {
      bubbleView = null
      bubbleParams = null
    }
  }

  private fun hideBubbleInternal() {
    val wm = windowManager
    val view = bubbleView
    if (wm != null && view != null) {
      try {
        wm.removeView(view)
      } catch (_: Throwable) {
      }
    }
    bubbleView = null
    bubbleParams = null
  }

  private fun openAppFromBubble() {
    try {
      getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        .edit()
        .putBoolean(PREF_OPEN_FROM_BUBBLE, true)
        .apply()
    } catch (_: Throwable) {
    }

    val intent = Intent(this, MainActivity::class.java)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    startActivity(intent)
  }
}
