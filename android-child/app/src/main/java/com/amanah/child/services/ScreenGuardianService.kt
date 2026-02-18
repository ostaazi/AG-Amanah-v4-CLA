package com.amanah.child.services

import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.util.Base64
import android.util.Log
import androidx.core.app.NotificationCompat
import com.amanah.child.MainActivity
import com.amanah.child.R
import com.amanah.child.utils.SecurityCortex
import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer

class ScreenGuardianService : Service() {
    companion object {
        @Volatile
        private var latestFrameData: String? = null

        fun peekLatestFrameData(): String? = latestFrameData
    }

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null

    private var width = 720
    private var height = 1280
    private var density = 300

    private val controlHandler = Handler(Looper.getMainLooper())
    private lateinit var workerThread: HandlerThread
    private lateinit var workerHandler: Handler

    private var isProcessing = false
    private val SCREEN_CHECK_INTERVAL = 3000L
    private val LIVE_FRAME_UPLOAD_INTERVAL = 3000L
    // Temporary kill-switch: disable on-device visual model to isolate lock root cause.
    // Web-side visualSentinel.ts remains available for controlled visual investigation.
    private val ON_DEVICE_VISUAL_MODEL_ENABLED = false
    private var visualModelDisableNoticeLogged = false
    private var lastLiveFrameUploadAt = 0L
    private var streamMode = false

    private val latinTextRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    // Relying only on the Latin recognizer which should handle multiple languages when default options are used.
    private val arabicTextRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private val db by lazy { FirebaseFirestore.getInstance() }

    private val screenStateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                Intent.ACTION_SCREEN_OFF -> {
                    controlHandler.removeCallbacksAndMessages(null)
                    Log.d("ScreenGuardian", "Screen OFF - pausing analysis")
                }
                Intent.ACTION_SCREEN_ON -> {
                    isProcessing = false
                    Log.d("ScreenGuardian", "Screen ON - resuming analysis")
                }
            }
        }
    }

    override fun onBind(intent: Intent): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val filter = android.content.IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
        }
        registerReceiver(screenStateReceiver, filter)

        workerThread = HandlerThread("ScreenGuardianWorker")
        workerThread.start()
        workerHandler = Handler(workerThread.looper)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_NOT_STICKY

        val resultCode = intent.getIntExtra("RESULT_CODE", Activity.RESULT_CANCELED)
        val data = intent.getParcelableExtra<Intent>("DATA")
        streamMode = intent.getBooleanExtra("STREAM_MODE", false)

        if (resultCode == Activity.RESULT_OK && data != null) {
            startForegroundService()
            setupMediaProjection(resultCode, data)
        } else {
            stopSelf()
        }

        return START_STICKY
    }

    private fun startForegroundService() {
        val channelId = "AmanahScreenService"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Amanah Protection",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Amanah Shield Active")
            .setContentText(
                if (streamMode) {
                    "يتم بث لقطات شاشة مباشرة للوالد."
                } else {
                    "يتم فحص الشاشة لاكتشاف المحتوى الضار."
                }
            )
            .setSmallIcon(R.mipmap.ic_launcher)
            .build()

        startForeground(1001, notification)
    }

    private fun setupMediaProjection(code: Int, data: Intent) {
        virtualDisplay?.release()
        imageReader?.close()

        val mpm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        mediaProjection = mpm.getMediaProjection(code, data)

        val metrics = resources.displayMetrics
        width = metrics.widthPixels
        height = metrics.heightPixels
        density = metrics.densityDpi

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 3)
        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "AmanahScreen",
            width,
            height,
            density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface,
            null,
            workerHandler
        )

        imageReader?.setOnImageAvailableListener({ reader ->
            if (isProcessing) {
                reader.acquireLatestImage()?.close()
                return@setOnImageAvailableListener
            }

            isProcessing = true
            try {
                processImage(reader)
            } catch (t: Throwable) {
                Log.e("ScreenGuardian", "Fatal frame pipeline error", t)
            } finally {
                controlHandler.postDelayed({ isProcessing = false }, SCREEN_CHECK_INTERVAL)
            }
        }, workerHandler)
    }

    private fun processImage(reader: ImageReader) {
        val image = reader.acquireLatestImage() ?: return
        var bitmap: Bitmap? = null
        var scaled: Bitmap? = null

        try {
            val planes = image.planes
            val buffer: ByteBuffer = planes[0].buffer
            val pixelStride = planes[0].pixelStride
            val rowStride = planes[0].rowStride
            val rowPadding = rowStride - pixelStride * width

            bitmap = Bitmap.createBitmap(
                width + rowPadding / pixelStride,
                height,
                Bitmap.Config.ARGB_8888
            )
            bitmap.copyPixelsFromBuffer(buffer)

            val cropped = Bitmap.createBitmap(bitmap, 0, 0, width, height)
            val maxSide = 960
            val needScale = width > maxSide || height > maxSide
            scaled = if (needScale) {
                val ratio = minOf(maxSide.toFloat() / width.toFloat(), maxSide.toFloat() / height.toFloat())
                val targetW = (width * ratio).toInt().coerceAtLeast(1)
                val targetH = (height * ratio).toInt().coerceAtLeast(1)
                Bitmap.createScaledBitmap(cropped, targetW, targetH, true)
            } else {
                cropped
            }

            captureFrameSnapshot(scaled)
            if (ON_DEVICE_VISUAL_MODEL_ENABLED) {
                val visualAnalysis = SecurityCortex.analyzeImage(scaled)
                if (visualAnalysis.isDanger) {
                    Log.e("ScreenGuardian", "Visual threat: ${visualAnalysis.category} ${visualAnalysis.score}")
                    handleThreat(
                        analysis = visualAnalysis,
                        platform = "Screen Monitor",
                        content = "رصد محتوى بصري غير لائق (${visualAnalysis.category})",
                        aiAnalysis = "On-device visual detection | confidence=${(visualAnalysis.score * 100).toInt()}% | severity=${visualAnalysis.severity}"
                    )
                }
            } else if (!visualModelDisableNoticeLogged) {
                visualModelDisableNoticeLogged = true
                Log.w(
                    "ScreenGuardian",
                    "On-device visual model is temporarily disabled; visual lock path is bypassed."
                )
            }

            runTextOcrPipeline(scaled)
        } catch (e: Exception) {
            Log.e("ScreenGuardian", "Error processing frame", e)
            scaled?.recycle()
        } finally {
            image.close()
            bitmap?.recycle()
        }
    }

    private fun runTextOcrPipeline(bitmap: Bitmap) {
        val inputImage = InputImage.fromBitmap(bitmap, 0)
        val latinTask = latinTextRecognizer.process(inputImage).continueWith { it.result?.text ?: "" }
        val arabicTask = arabicTextRecognizer.process(inputImage).continueWith { it.result?.text ?: "" }

        Tasks.whenAllSuccess<String>(latinTask, arabicTask)
            .addOnSuccessListener { texts ->
                val mergedText = texts.joinToString(" ").replace(Regex("\\s+"), " ").trim()
                if (mergedText.length >= 3) {
                    val textAnalysis = SecurityCortex.analyzeText(mergedText)
                    if (textAnalysis.isDanger) {
                        Log.e("ScreenGuardian", "OCR text threat: ${textAnalysis.category}")
                        handleThreat(
                            analysis = textAnalysis,
                            platform = "Screen OCR",
                            content = mergedText.take(400),
                            aiAnalysis = "On-device OCR + text policy detection"
                        )
                    }
                }
                bitmap.recycle()
            }
            .addOnFailureListener { e ->
                Log.e("ScreenGuardian", "OCR pipeline failed", e)
                bitmap.recycle()
            }
    }

    private fun captureFrameSnapshot(bitmap: Bitmap) {
        val frameData = encodeBitmapToDataUrl(bitmap) ?: return
        latestFrameData = frameData

        if (!streamMode) return

        val now = System.currentTimeMillis()
        if (now - lastLiveFrameUploadAt < LIVE_FRAME_UPLOAD_INTERVAL) return
        lastLiveFrameUploadAt = now
        uploadLiveFrame(frameData)
    }

    private fun encodeBitmapToDataUrl(bitmap: Bitmap): String? {
        return try {
            val targetMaxSide = 480
            val w = bitmap.width
            val h = bitmap.height
            val ratio = if (w > targetMaxSide || h > targetMaxSide) {
                minOf(targetMaxSide.toFloat() / w.toFloat(), targetMaxSide.toFloat() / h.toFloat())
            } else {
                1f
            }
            val targetW = (w * ratio).toInt().coerceAtLeast(1)
            val targetH = (h * ratio).toInt().coerceAtLeast(1)
            val resized = if (ratio < 1f) {
                Bitmap.createScaledBitmap(bitmap, targetW, targetH, true)
            } else {
                bitmap
            }

            val out = ByteArrayOutputStream()
            resized.compress(Bitmap.CompressFormat.JPEG, 45, out)
            if (resized !== bitmap) {
                resized.recycle()
            }
            val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            "data:image/jpeg;base64,$b64"
        } catch (e: Exception) {
            Log.w("ScreenGuardian", "Frame encode failed: ${e.message}")
            null
        }
    }

    private fun uploadLiveFrame(imageData: String) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childName = prefs.getString("childName", "Child Device")
        val childId = prefs.getString("childDocumentId", null)

        val alert = hashMapOf(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to "Live Stream",
            "content" to "Live screenshot frame from child device.",
            "category" to "SAFE",
            "severity" to "LOW",
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "aiAnalysis" to "Live stream frame uploaded from ScreenGuardianService.",
            "imageData" to imageData
        )

        db.collection("alerts").add(alert)
            .addOnFailureListener { e ->
                Log.w("ScreenGuardian", "Live frame upload failed: ${e.message}")
            }
    }

    private fun handleThreat(
        analysis: SecurityCortex.AnalysisResult,
        platform: String,
        content: String,
        aiAnalysis: String
    ) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childName = prefs.getString("childName", "My Child") ?: "My Child"
        val childId = prefs.getString("childDocumentId", null)
        val foregroundPackage = prefs.getString("lastForegroundPackage", null)?.trim().orEmpty()
        val foregroundAt = prefs.getLong("lastForegroundAt", 0L)
        val aiSummary = if (foregroundPackage.isNotBlank()) {
            "$aiAnalysis | app=$foregroundPackage"
        } else {
            aiAnalysis
        }

        val alert = hashMapOf<String, Any>(
            "parentId" to parentId,
            "childName" to childName,
            "platform" to platform,
            "content" to content,
            "category" to analysis.category,
            "severity" to analysis.severity,
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "aiAnalysis" to aiSummary,
            "confidence" to (analysis.score * 100).toInt(),
            "actionTaken" to "Evidence snapshot attached when available."
        )
        if (!childId.isNullOrBlank()) {
            alert["childId"] = childId
        }
        if (foregroundPackage.isNotBlank()) {
            alert["sourceLocation"] = foregroundPackage
            alert["locationAddress"] = foregroundPackage
            if (foregroundAt > 0L) {
                alert["sourceLocationAt"] = foregroundAt
            }
        }
        val frame = latestFrameData
        if (!frame.isNullOrBlank()) {
            alert["imageData"] = frame
        } else {
            alert["captureStatus"] = "NO_FRAME_AVAILABLE"
        }

        FirebaseFirestore.getInstance().collection("alerts").add(alert)
            .addOnFailureListener { e -> Log.e("ScreenGuardian", "Alert upload failed", e) }

        if (analysis.severity == "CRITICAL") {
            activateLocalEmergencyLock(analysis.category)
        }
    }

    private fun activateLocalEmergencyLock(category: String) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        if (prefs.getBoolean("preventDeviceLock", false)) {
            Log.i("ScreenGuardian", "Local emergency lock skipped because preventDeviceLock is enabled.")
            return
        }

        val message = when (category) {
            "إيذاء النفس" -> "تم تفعيل حماية فورية: تم رصد مؤشرات إيذاء النفس."
            "تواصل مشبوه" -> "تم تفعيل حماية فورية: تم رصد مؤشرات استدراج/تواصل مشبوه."
            "ابتزاز" -> "تم تفعيل حماية فورية: تم رصد مؤشرات ابتزاز."
            "تحريض على العنف" -> "تم تفعيل حماية فورية: تم رصد محتوى عنيف خطير."
            "محتوى للبالغين" -> "تم تفعيل حماية فورية: تم رصد محتوى بالغين غير مناسب."
            else -> "تم تفعيل وضع الأمان الفوري لحماية الطفل."
        }

        prefs.edit()
            .putBoolean("deviceLockActive", true)
            .putBoolean("blackoutActive", true)
            .putString("blackoutMessage", message)
            .apply()

        try {
            sendBroadcast(Intent(RemoteCommandService.ACTION_LOCK_STATE_CHANGED))
        } catch (e: Exception) {
            Log.w("ScreenGuardian", "Lock-state broadcast failed: ${e.message}")
        }

        try {
            val intent = Intent(this, MainActivity::class.java)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            intent.putExtra("FORCE_LOCK", true)
            startActivity(intent)
        } catch (e: Exception) {
            Log.w("ScreenGuardian", "Emergency lock activity launch failed: ${e.message}")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(screenStateReceiver)
        } catch (_: Exception) {
        }

        virtualDisplay?.release()
        mediaProjection?.stop()
        imageReader?.close()

        latinTextRecognizer.close()
        arabicTextRecognizer.close()

        if (this::workerThread.isInitialized) {
            workerThread.quitSafely()
        }
    }
}
