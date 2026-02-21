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
import java.util.Locale
import java.util.UUID

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
    private val ALERT_UPLOAD_RETRY_INTERVAL_MS = 15_000L
    private val ALERT_TERMINAL_RETRY_INTERVAL_MS = 60_000L
    private val MAX_PENDING_ALERT_UPLOADS = 40
    private val MAX_ALERT_UPLOAD_ATTEMPTS = 6
    private val EVIDENCE_TELEMETRY_PREFS = "ScreenGuardianEvidenceTelemetry"
    private val EVIDENCE_COUNTER_BUNDLE_TOTAL = "bundle_total"
    private val EVIDENCE_COUNTER_BUNDLE_COMPLETE = "bundle_complete"
    private val EVIDENCE_COUNTER_BUNDLE_PARTIAL = "bundle_partial"
    private val EVIDENCE_COUNTER_MISSING_RAW_TEXT = "missing_raw_text"
    private val EVIDENCE_COUNTER_MISSING_NORMALIZED_TEXT = "missing_normalized_text"
    private val EVIDENCE_COUNTER_MISSING_MATCHED_SIGNALS = "missing_matched_signals"
    private val EVIDENCE_COUNTER_MISSING_SNAPSHOT = "missing_snapshot"
    private val EVIDENCE_COUNTER_UPLOAD_ATTEMPT = "upload_attempt"
    private val EVIDENCE_COUNTER_UPLOAD_SUCCESS = "upload_success"
    private val EVIDENCE_COUNTER_UPLOAD_RETRY_QUEUED = "upload_retry_queued"
    private val EVIDENCE_COUNTER_UPLOAD_TERMINAL_FAILED = "upload_terminal_failed"
    private val EVIDENCE_COUNTER_QUEUE_OVERFLOW_DROP = "upload_queue_overflow_drop"
    private val EVIDENCE_CORE_FIELDS = listOf(
        "triggerRawText",
        "triggerNormalizedText",
        "analysisReasonAr",
        "analysisReasonEn",
        "matchedSignals",
        "imageData"
    )
    // On-device visual stack: TFLite NSFW + violence scene model + injury heuristic
    private val ON_DEVICE_VISUAL_MODEL_ENABLED = true
    private var visualModelDisableNoticeLogged = false
    private var lastLiveFrameUploadAt = 0L
    private var streamMode = false
    private val pendingAlertLock = Any()
    private val pendingAlertUploads = mutableListOf<PendingAlertUpload>()

    private data class PendingAlertUpload(
        val correlationId: String,
        val payload: HashMap<String, Any>,
        var attempts: Int,
        var nextRetryAt: Long,
        var lastError: String,
        val queuedAt: Long,
        var terminalFailure: Boolean = false
    )

    private data class EvidenceBundleTelemetry(
        val sequence: Long,
        val missingFields: List<String>,
        val presentFields: Int,
        val completeness: Float
    )

    private val retryPendingAlertsRunnable = object : Runnable {
        override fun run() {
            try {
                flushPendingAlertUploads()
            } catch (error: Exception) {
                Log.w("ScreenGuardian", "Pending alert retry loop failed: ${error.message}")
            } finally {
                controlHandler.postDelayed(this, ALERT_UPLOAD_RETRY_INTERVAL_MS)
            }
        }
    }

    private val latinTextRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    // Relying only on the Latin recognizer which should handle multiple languages when default options are used.
    private val arabicTextRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private val db by lazy { FirebaseFirestore.getInstance() }
    private val selfPackagePrefixes = listOf(
        "com.amanah.child",
        "com.amanah.parent",
        "com.amanah"
    )
    private val systemUiMarkers = listOf(
        "systemui",
        "launcher",
        "oneui",
        "miui"
    )
    private val selfUiMarkers = listOf(
        "amanah",
        "amanah shield",
        "amanah security",
        "amanah ai",
        "v1 0 stable gold",
        "screen monitor",
        "security cortex",
        "turbo spectrum",
        "offline emergency unlock",
        "emergency code",
        "parental safety policy",
        "المحتوى المرصود",
        "تحليل الذكاء الاصطناعي",
        "سبب التصنيف غير اللائق",
        "إشارة عالية الخطورة",
        "تم قفل الجهاز",
        "parent protection policy"
    )

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
        SecurityCortex.init(this)
        val filter = android.content.IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_OFF)
            addAction(Intent.ACTION_SCREEN_ON)
        }
        registerReceiver(screenStateReceiver, filter)

        workerThread = HandlerThread("ScreenGuardianWorker")
        workerThread.start()
        workerHandler = Handler(workerThread.looper)
        controlHandler.postDelayed(retryPendingAlertsRunnable, ALERT_UPLOAD_RETRY_INTERVAL_MS)
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

            val frameData = captureFrameSnapshot(scaled)
            val foregroundPackage = getForegroundPackage()
            val visualAnalysis = if (ON_DEVICE_VISUAL_MODEL_ENABLED) {
                SecurityCortex.analyzeImage(scaled)
            } else {
                if (!visualModelDisableNoticeLogged) {
                    visualModelDisableNoticeLogged = true
                    Log.w(
                        "ScreenGuardian",
                        "On-device visual model is temporarily disabled; visual lock path is bypassed."
                    )
                }
                null
            }

            runTextOcrPipeline(scaled, frameData, foregroundPackage) { mergedText ->
                try {
                    val analysis = visualAnalysis
                    if (analysis != null && analysis.isDanger) {
                        val selfIgnoreReason = resolveSelfThreatIgnoreReason(foregroundPackage, mergedText)
                        if (selfIgnoreReason != null) {
                            Log.i(
                                "ScreenGuardian",
                                "Self-screen visual match ignored (pkg=$foregroundPackage, category=${analysis.category}, reason=$selfIgnoreReason)."
                            )
                        } else {
                            val normalizedText = if (mergedText.isNotBlank()) {
                                SecurityCortex.normalizeTextForAudit(mergedText)
                            } else {
                                null
                            }
                            val detector = when {
                                analysis.matchedSignals.any { it.contains("detector=nsfw_model", ignoreCase = true) } -> "nsfw_model"
                                analysis.matchedSignals.any { it.contains("detector=violence_scene_model", ignoreCase = true) } -> "violence_scene_model"
                                analysis.matchedSignals.any { it.contains("detector=injury_heuristic", ignoreCase = true) } -> "injury_heuristic"
                                else -> "unknown"
                            }
                            val detectorSummary = when (detector) {
                                "nsfw_model" -> "On-device NSFW model detection"
                                "violence_scene_model" -> "On-device violence-scene model detection"
                                "injury_heuristic" -> "On-device injury-cluster visual detection"
                                else -> "On-device visual detection"
                            }
                            Log.e("ScreenGuardian", "Visual threat: ${analysis.category} ${analysis.score}")
                            handleThreat(
                                analysis = analysis,
                                platform = "Screen Monitor",
                                content = "رصد بصري: ${analysis.category}",
                                aiAnalysis = "$detectorSummary | detector=$detector | confidence=${(analysis.score * 100).toInt()}% | severity=${analysis.severity}",
                                triggerType = "IMAGE",
                                triggerRawText = mergedText.takeIf { it.isNotBlank() },
                                triggerNormalizedText = normalizedText,
                                evidenceImageData = frameData
                            )
                        }
                    }
                } finally {
                    scaled.recycle()
                }
            }
        } catch (e: Exception) {
            Log.e("ScreenGuardian", "Error processing frame", e)
            scaled?.recycle()
        } finally {
            image.close()
            bitmap?.recycle()
        }
    }

    private fun runTextOcrPipeline(
        bitmap: Bitmap,
        frameData: String?,
        foregroundPackage: String,
        onComplete: (String) -> Unit
    ) {
        val inputImage = InputImage.fromBitmap(bitmap, 0)
        val latinTask = latinTextRecognizer.process(inputImage).continueWith { it.result?.text ?: "" }
        val arabicTask = arabicTextRecognizer.process(inputImage).continueWith { it.result?.text ?: "" }

        Tasks.whenAllSuccess<String>(latinTask, arabicTask)
            .addOnSuccessListener { texts ->
                val mergedText = texts.joinToString(" ").replace(Regex("\\s+"), " ").trim()
                if (mergedText.length >= 3) {
                    val selfIgnoreReason = resolveSelfThreatIgnoreReason(foregroundPackage, mergedText)
                    if (selfIgnoreReason != null) {
                        Log.i(
                            "ScreenGuardian",
                            "Self-screen OCR match ignored (pkg=$foregroundPackage, reason=$selfIgnoreReason)."
                        )
                        onComplete(mergedText)
                        return@addOnSuccessListener
                    }

                    val textAnalysis = SecurityCortex.analyzeText(mergedText)
                    if (textAnalysis.isDanger) {
                        Log.e("ScreenGuardian", "OCR text threat: ${textAnalysis.category}")
                        val normalizedText = SecurityCortex.normalizeTextForAudit(mergedText)
                        handleThreat(
                            analysis = textAnalysis,
                            platform = "Screen OCR",
                            content = mergedText.take(500),
                            aiAnalysis = "On-device OCR + text policy detection",
                            triggerType = "TEXT",
                            triggerRawText = mergedText,
                            triggerNormalizedText = normalizedText,
                            evidenceImageData = frameData
                        )
                    }
                }
                onComplete(mergedText)
            }
            .addOnFailureListener { e ->
                Log.e("ScreenGuardian", "OCR pipeline failed", e)
                onComplete("")
            }
    }

    private fun captureFrameSnapshot(bitmap: Bitmap): String? {
        val frameData = encodeBitmapToDataUrl(bitmap) ?: return null
        latestFrameData = frameData

        if (!streamMode) return frameData

        val now = System.currentTimeMillis()
        if (now - lastLiveFrameUploadAt < LIVE_FRAME_UPLOAD_INTERVAL) return frameData
        lastLiveFrameUploadAt = now
        uploadLiveFrame(frameData)
        return frameData
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

    private fun incrementEvidenceCounter(key: String, delta: Long = 1L): Long {
        val prefs = getSharedPreferences(EVIDENCE_TELEMETRY_PREFS, MODE_PRIVATE)
        val next = (prefs.getLong(key, 0L) + delta).coerceAtLeast(0L)
        prefs.edit().putLong(key, next).apply()
        return next
    }

    private fun computeEvidenceBundleTelemetry(
        rawText: String,
        normalizedText: String,
        reasonAr: String,
        reasonEn: String,
        matchedSignals: List<String>,
        hasSnapshot: Boolean
    ): EvidenceBundleTelemetry {
        val missingFields = mutableListOf<String>()
        val sequence = incrementEvidenceCounter(EVIDENCE_COUNTER_BUNDLE_TOTAL)

        if (rawText.isBlank()) {
            missingFields.add("triggerRawText")
            incrementEvidenceCounter(EVIDENCE_COUNTER_MISSING_RAW_TEXT)
        }
        if (normalizedText.isBlank()) {
            missingFields.add("triggerNormalizedText")
            incrementEvidenceCounter(EVIDENCE_COUNTER_MISSING_NORMALIZED_TEXT)
        }
        if (reasonAr.isBlank()) {
            missingFields.add("analysisReasonAr")
        }
        if (reasonEn.isBlank()) {
            missingFields.add("analysisReasonEn")
        }
        if (matchedSignals.isEmpty()) {
            missingFields.add("matchedSignals")
            incrementEvidenceCounter(EVIDENCE_COUNTER_MISSING_MATCHED_SIGNALS)
        }
        if (!hasSnapshot) {
            missingFields.add("imageData")
            incrementEvidenceCounter(EVIDENCE_COUNTER_MISSING_SNAPSHOT)
        }

        if (missingFields.isEmpty()) {
            incrementEvidenceCounter(EVIDENCE_COUNTER_BUNDLE_COMPLETE)
        } else {
            incrementEvidenceCounter(EVIDENCE_COUNTER_BUNDLE_PARTIAL)
        }

        val presentFields = (EVIDENCE_CORE_FIELDS.size - missingFields.size).coerceAtLeast(0)
        val completeness = if (EVIDENCE_CORE_FIELDS.isEmpty()) {
            1f
        } else {
            presentFields.toFloat() / EVIDENCE_CORE_FIELDS.size.toFloat()
        }

        return EvidenceBundleTelemetry(
            sequence = sequence,
            missingFields = missingFields,
            presentFields = presentFields,
            completeness = completeness
        )
    }

    private fun nextRetryDelayMs(attempts: Int): Long {
        val step = attempts.coerceAtLeast(1).coerceAtMost(5) - 1
        val factor = 1L shl step
        return ALERT_UPLOAD_RETRY_INTERVAL_MS * factor
    }

    private fun queueAlertRetry(
        correlationId: String,
        payload: HashMap<String, Any>,
        attempts: Int,
        error: String,
        terminalFailure: Boolean = false
    ) {
        val shouldMarkTerminal = terminalFailure || attempts >= MAX_ALERT_UPLOAD_ATTEMPTS
        val now = System.currentTimeMillis()
        val nextRetryAt = if (shouldMarkTerminal) {
            now + ALERT_TERMINAL_RETRY_INTERVAL_MS
        } else {
            now + nextRetryDelayMs(attempts)
        }
        if (shouldMarkTerminal) {
            payload["evidenceUploadStatus"] = "FAILED"
            payload["evidenceUploadRetryCount"] = attempts.coerceAtLeast(0)
            payload["evidenceUploadLastError"] = error.take(220)
        }
        synchronized(pendingAlertLock) {
            val existing = pendingAlertUploads.firstOrNull { it.correlationId == correlationId }
            if (existing != null) {
                existing.attempts = attempts
                existing.lastError = error
                existing.nextRetryAt = nextRetryAt
                existing.terminalFailure = shouldMarkTerminal
            } else {
                if (pendingAlertUploads.size >= MAX_PENDING_ALERT_UPLOADS) {
                    pendingAlertUploads.removeAt(0)
                    incrementEvidenceCounter(EVIDENCE_COUNTER_QUEUE_OVERFLOW_DROP)
                }
                pendingAlertUploads.add(
                    PendingAlertUpload(
                        correlationId = correlationId,
                        payload = payload,
                        attempts = attempts,
                        nextRetryAt = nextRetryAt,
                        lastError = error,
                        queuedAt = now,
                        terminalFailure = shouldMarkTerminal
                    )
                )
            }
        }
        if (shouldMarkTerminal) {
            incrementEvidenceCounter(EVIDENCE_COUNTER_UPLOAD_TERMINAL_FAILED)
            Log.e(
                "ScreenGuardian",
                "Alert moved to terminal-failure queue (correlationId=$correlationId, attempts=$attempts, retryInMs=${nextRetryAt - now}, error=$error)."
            )
        } else {
            incrementEvidenceCounter(EVIDENCE_COUNTER_UPLOAD_RETRY_QUEUED)
            Log.w(
                "ScreenGuardian",
                "Queued alert retry (correlationId=$correlationId, attempts=$attempts, retryInMs=${nextRetryAt - now}, error=$error)."
            )
        }
    }

    private fun removeQueuedAlert(correlationId: String) {
        synchronized(pendingAlertLock) {
            pendingAlertUploads.removeAll { it.correlationId == correlationId }
        }
    }

    private fun flushPendingAlertUploads() {
        val pending = synchronized(pendingAlertLock) {
            pendingAlertUploads.firstOrNull { it.nextRetryAt <= System.currentTimeMillis() }
        } ?: return

        val payload = HashMap(pending.payload)
        uploadAlertPayload(
            payload = payload,
            attempt = pending.attempts + 1,
            source = "retry_queue",
            correlationId = pending.correlationId,
            terminalFailure = pending.terminalFailure
        )
    }

    private fun uploadAlertPayload(
        payload: HashMap<String, Any>,
        attempt: Int,
        source: String,
        correlationId: String,
        terminalFailure: Boolean = false
    ) {
        incrementEvidenceCounter(EVIDENCE_COUNTER_UPLOAD_ATTEMPT)
        payload["evidenceUploadStatus"] = if (terminalFailure) "FAILED" else "UPLOADING"
        payload["evidenceUploadAttempt"] = attempt
        payload["evidenceUploadSource"] = source
        payload["evidenceUploadLastAttemptAt"] = Timestamp.now()
        payload["evidenceUploadCorrelationId"] = correlationId

        db.collection("alerts").add(payload)
            .addOnSuccessListener { ref ->
                removeQueuedAlert(correlationId)
                if (terminalFailure) {
                    val failedUpdate = hashMapOf<String, Any?>(
                        "evidenceUploadStatus" to "FAILED",
                        "evidenceUploadAckAt" to Timestamp.now(),
                        "evidenceUploadRetryCount" to attempt.coerceAtLeast(0),
                        "evidenceUploadLastError" to (payload["evidenceUploadLastError"] as? String ?: "upload_failed")
                    )
                    db.collection("alerts").document(ref.id).update(failedUpdate)
                        .addOnFailureListener { terminalAckError ->
                            Log.w(
                                "ScreenGuardian",
                                "Terminal failure alert uploaded but ACK patch failed (doc=${ref.id}, correlationId=$correlationId): ${terminalAckError.message}"
                            )
                        }
                    return@addOnSuccessListener
                }
                incrementEvidenceCounter(EVIDENCE_COUNTER_UPLOAD_SUCCESS)
                val ackUpdate = hashMapOf<String, Any?>(
                    "evidenceUploadStatus" to "UPLOADED",
                    "evidenceUploadAckAt" to Timestamp.now(),
                    "evidenceUploadRetryCount" to (attempt - 1).coerceAtLeast(0),
                    "evidenceUploadLastError" to null
                )
                db.collection("alerts").document(ref.id).update(ackUpdate)
                    .addOnFailureListener { ackError ->
                        Log.w(
                            "ScreenGuardian",
                            "Alert uploaded but ACK patch failed (doc=${ref.id}, correlationId=$correlationId): ${ackError.message}"
                        )
                    }
            }
            .addOnFailureListener { error ->
                payload["evidenceUploadStatus"] = "RETRY_QUEUED"
                payload["evidenceUploadAttempt"] = attempt
                payload["evidenceUploadLastError"] = (error.message ?: "upload_failed").take(220)
                queueAlertRetry(
                    correlationId = correlationId,
                    payload = payload,
                    attempts = attempt,
                    error = (error.message ?: "upload_failed"),
                    terminalFailure = terminalFailure
                )
            }
    }

    private fun handleThreat(
        analysis: SecurityCortex.AnalysisResult,
        platform: String,
        content: String,
        aiAnalysis: String,
        triggerType: String,
        triggerRawText: String? = null,
        triggerNormalizedText: String? = null,
        evidenceImageData: String? = null
    ) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childName = prefs.getString("childName", "My Child") ?: "My Child"
        val childId = prefs.getString("childDocumentId", null)
        val foregroundPackage = getForegroundPackage()
        val foregroundAt = prefs.getLong("lastForegroundAt", 0L)
        val selfIgnoreReason = resolveSelfThreatIgnoreReason(foregroundPackage, triggerRawText)
        if (selfIgnoreReason != null) {
            Log.i(
                "ScreenGuardian",
                "Threat dropped as self-content (pkg=$foregroundPackage, reason=$selfIgnoreReason)."
            )
            return
        }

        val rawText = triggerRawText?.replace(Regex("\\s+"), " ")?.trim().orEmpty()
        val normalizedText = when {
            !triggerNormalizedText.isNullOrBlank() -> triggerNormalizedText
            rawText.isNotBlank() -> SecurityCortex.normalizeTextForAudit(rawText)
            else -> ""
        }
        val obfuscationLikely = isLikelyObfuscated(rawText, normalizedText)
        val reasonAr = analysis.reasonAr.ifBlank {
            "تم رصد مؤشر خطورة ضمن فئة ${analysis.category} بدرجة ${analysis.severity}."
        }
        val reasonEn = analysis.reasonEn.ifBlank {
            "Risk indicator detected in category ${analysis.category} with severity ${analysis.severity}."
        }
        val matchedSignals = analysis.matchedSignals.take(8)
        val frame = if (!evidenceImageData.isNullOrBlank()) evidenceImageData else latestFrameData
        val hasSnapshot = !frame.isNullOrBlank()
        val bundleTelemetry = computeEvidenceBundleTelemetry(
            rawText = rawText,
            normalizedText = normalizedText,
            reasonAr = reasonAr,
            reasonEn = reasonEn,
            matchedSignals = matchedSignals,
            hasSnapshot = hasSnapshot
        )
        val localLockEligible = shouldAutoLockLocally(analysis, triggerType)
        val aiSummary = buildString {
            append(aiAnalysis)
            if (foregroundPackage.isNotBlank()) append(" | app=$foregroundPackage")
            append(" | AR: $reasonAr")
            append(" | EN: $reasonEn")
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
            "actionTaken" to if (localLockEligible) {
                "Evidence bundle attached (raw/normalized explanations + snapshot when available). Local emergency lock may be applied for CRITICAL risk."
            } else {
                "Evidence bundle attached (raw/normalized explanations + snapshot when available). Local auto-lock skipped pending stronger confirmation."
            },
            "triggerType" to triggerType,
            "analysisReasonAr" to reasonAr,
            "analysisReasonEn" to reasonEn,
            "matchedSignals" to matchedSignals,
            "triggerRawText" to rawText.take(2000),
            "triggerNormalizedText" to normalizedText.take(2000),
            "normalizationChanged" to (rawText.isNotBlank() && normalizedText.isNotBlank() && rawText != normalizedText),
            "obfuscationLikely" to obfuscationLikely,
            "evidencePayloadVersion" to "v1",
            "evidenceMissingFields" to bundleTelemetry.missingFields,
            "evidenceCoreFieldCount" to EVIDENCE_CORE_FIELDS.size,
            "evidencePresentFieldCount" to bundleTelemetry.presentFields,
            "evidenceCompleteness" to bundleTelemetry.completeness,
            "evidenceHasAllCoreFields" to bundleTelemetry.missingFields.isEmpty(),
            "evidenceBundleSequence" to bundleTelemetry.sequence,
            "evidenceUploadStatus" to "QUEUED",
            "evidenceUploadAttempt" to 0,
            "evidenceUploadQueuedAt" to Timestamp.now()
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
        if (triggerType == "IMAGE") {
            alert["visualEngineReady"] = SecurityCortex.isVisionEngineReady()
            val detector = when {
                matchedSignals.any { it.contains("detector=injury_heuristic", ignoreCase = true) } -> "injury_heuristic"
                matchedSignals.any { it.contains("detector=violence_scene_model", ignoreCase = true) } -> "violence_scene_model"
                matchedSignals.any { it.contains("detector=nsfw_model", ignoreCase = true) } -> "nsfw_model"
                else -> "unknown"
            }
            alert["visualDetector"] = detector
        }
        if (!frame.isNullOrBlank()) {
            alert["imageData"] = frame
        } else {
            alert["captureStatus"] = "NO_FRAME_AVAILABLE"
        }

        val correlationId = "sg-${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(8)}"
        alert["evidenceUploadCorrelationId"] = correlationId
        uploadAlertPayload(
            payload = alert,
            attempt = 1,
            source = "realtime",
            correlationId = correlationId
        )

        if (localLockEligible) {
            activateLocalEmergencyLock(analysis.category)
        }
    }

    private fun shouldAutoLockLocally(
        analysis: SecurityCortex.AnalysisResult,
        triggerType: String
    ): Boolean {
        if (analysis.severity != "CRITICAL") return false

        if (triggerType == "IMAGE" && analysis.category == "تحريض على العنف") {
            val isInjuryHeuristic = analysis.matchedSignals.any {
                it.contains("detector=injury_heuristic", ignoreCase = true)
            }
            if (isInjuryHeuristic) {
                // Avoid hard-lock on color-heuristic-only visual violence due high false-positive risk.
                return false
            }
        }
        return true
    }

    private fun getForegroundPackage(): String {
        return getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
            .getString("lastForegroundPackage", "")
            .orEmpty()
            .trim()
            .lowercase(Locale.ROOT)
    }

    private fun isLockOverlayActive(): Boolean {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val lockActive = prefs.getBoolean("deviceLockActive", false)
        val blackoutActive = prefs.getBoolean("blackoutActive", false)
        return lockActive || blackoutActive
    }

    private fun resolveSelfThreatIgnoreReason(
        foregroundPackageRaw: String,
        ocrText: String?
    ): String? {
        val foregroundPackage = foregroundPackageRaw.trim().lowercase(Locale.ROOT)
        val lockOverlay = isLockOverlayActive()

        if (selfPackagePrefixes.any { prefix -> foregroundPackage.startsWith(prefix) }) {
            return "self_package"
        }

        val isLikelySystemUi = systemUiMarkers.any { marker -> foregroundPackage.contains(marker) }
        if (lockOverlay && (foregroundPackage.isBlank() || isLikelySystemUi)) {
            return "lock_overlay_context"
        }

        if (ocrText.isNullOrBlank()) {
            return null
        }

        val normalized = SecurityCortex.normalizeTextForAudit(ocrText)
        val markerHits = selfUiMarkers.count { marker ->
            normalized.contains(SecurityCortex.normalizeTextForAudit(marker))
        }
        val hasAmanahBrand = normalized.contains("amanah") || normalized.contains("امانه")

        if (markerHits >= 2 || (markerHits >= 1 && hasAmanahBrand)) {
            return "self_ui_marker_match"
        }

        if (lockOverlay && (markerHits >= 1 || hasAmanahBrand)) {
            return "lock_overlay_marker_match"
        }

        if (isLikelySystemUi && hasAmanahBrand) {
            return "systemui_with_amanah_marker"
        }

        return null
    }

    private fun isLikelyObfuscated(rawText: String, normalizedText: String): Boolean {
        if (rawText.isBlank() || normalizedText.isBlank()) return false
        val rawCompact = rawText.lowercase(Locale.ROOT).replace(Regex("\\s+"), "")
        val normalizedCompact = normalizedText.lowercase(Locale.ROOT).replace(Regex("\\s+"), "")
        val hasMaskingChars = rawText.contains(Regex("[0-9@\\$\\*\\-_\\.]+"))
        val changed = rawCompact != normalizedCompact
        return hasMaskingChars || changed
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
        controlHandler.removeCallbacks(retryPendingAlertsRunnable)
        controlHandler.removeCallbacksAndMessages(null)

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
