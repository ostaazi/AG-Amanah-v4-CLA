package com.amanah.child.services

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.YuvImage
import android.media.Image
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import com.amanah.child.MainActivity
import com.amanah.child.R
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class LiveMediaStreamService : LifecycleService() {
    companion object {
        const val ACTION_START = "com.amanah.child.action.START_LIVE_MEDIA_STREAM"
        const val ACTION_STOP = "com.amanah.child.action.STOP_LIVE_MEDIA_STREAM"
        const val EXTRA_VIDEO_SOURCE = "extra_video_source"
        const val EXTRA_AUDIO_SOURCE = "extra_audio_source"

        private const val PREFS_NAME = "AmanahPrefs"
        private const val VIDEO_UPLOAD_INTERVAL_MS = 2500L
        private const val AUDIO_SEGMENT_MS = 4000L
        private const val NOTIFICATION_ID = 1402
        private const val CHANNEL_ID = "amanah_live_media_stream"
    }

    private val db by lazy { FirebaseFirestore.getInstance() }
    private val mainHandler = Handler(Looper.getMainLooper())
    private var cameraExecutor: ExecutorService? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var imageAnalysis: ImageAnalysis? = null
    private var mediaRecorder: MediaRecorder? = null
    private var currentAudioFile: File? = null
    private var lastVideoUploadAt = 0L
    private var parentId: String? = null
    private var childId: String? = null
    private var childName: String = "Child Device"
    private var videoSource: String = "camera_front"
    private var audioSource: String = "mic"
    private var systemAudioFallbackNotified = false

    private val audioSegmentRunnable = object : Runnable {
        override fun run() {
            finishAudioSegment(restart = true)
        }
    }

    override fun onCreate() {
        super.onCreate()
        cameraExecutor = Executors.newSingleThreadExecutor()
        startAsForeground()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        parentId = prefs.getString("parentId", null)
        childId = prefs.getString("childDocumentId", null)
        childName = prefs.getString("childName", "Child Device") ?: "Child Device"
        videoSource = intent?.getStringExtra(EXTRA_VIDEO_SOURCE)
            ?: prefs.getString("preferredVideoSource", "camera_front")
            ?: "camera_front"
        audioSource = intent?.getStringExtra(EXTRA_AUDIO_SOURCE)
            ?: prefs.getString("preferredAudioSource", "mic")
            ?: "mic"

        if (parentId.isNullOrBlank() || childId.isNullOrBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        startOrRefreshStreaming()
        return START_STICKY
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(audioSegmentRunnable)
        stopAudioCapture(deleteOnly = false)
        stopCameraCapture()
        cameraExecutor?.shutdownNow()
        cameraExecutor = null
        super.onDestroy()
    }

    private fun startAsForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Amanah Live Media Stream",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        val openIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = android.app.PendingIntent.getActivity(
            this,
            1402,
            openIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                android.app.PendingIntent.FLAG_UPDATE_CURRENT
            }
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Amanah Live Stream Active")
            .setContentText("Child camera and microphone stream is running")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun startOrRefreshStreaming() {
        stopAudioCapture(deleteOnly = false)
        stopCameraCapture()

        if (!hasPermission(Manifest.permission.CAMERA)) {
            uploadOperationalAlert("Live camera requested but camera permission is missing on the child device.", "MEDIUM")
            stopSelf()
            return
        }

        startCameraCapture()
        startAudioCaptureIfNeeded()
    }

    private fun startCameraCapture() {
        val providerFuture = ProcessCameraProvider.getInstance(this)
        providerFuture.addListener(
            {
                try {
                    val provider = providerFuture.get()
                    cameraProvider = provider
                    provider.unbindAll()

                    val selector = if (videoSource == "camera_back") {
                        CameraSelector.DEFAULT_BACK_CAMERA
                    } else {
                        CameraSelector.DEFAULT_FRONT_CAMERA
                    }

                    val analysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .build()

                    val executor = cameraExecutor ?: return@addListener
                    analysis.setAnalyzer(executor) { imageProxy ->
                        try {
                            handleVideoFrame(imageProxy)
                        } catch (error: Exception) {
                            Log.w("LiveMediaStream", "Video frame processing failed: ${error.message}")
                            imageProxy.close()
                        }
                    }

                    imageAnalysis = analysis
                    provider.bindToLifecycle(this, selector, analysis)
                } catch (error: Exception) {
                    Log.e("LiveMediaStream", "Camera stream start failed", error)
                    uploadOperationalAlert(
                        "Live camera stream could not start on the child device.",
                        "MEDIUM"
                    )
                    stopSelf()
                }
            },
            ContextCompat.getMainExecutor(this)
        )
    }

    private fun handleVideoFrame(imageProxy: ImageProxy) {
        val now = System.currentTimeMillis()
        if (now - lastVideoUploadAt < VIDEO_UPLOAD_INTERVAL_MS) {
            imageProxy.close()
            return
        }

        val encoded = imageProxyToDataUrl(imageProxy)
        imageProxy.close()
        if (encoded.isNullOrBlank()) return

        lastVideoUploadAt = now
        uploadVideoFrame(encoded)
    }

    private fun startAudioCaptureIfNeeded() {
        if (audioSource == "system" && !systemAudioFallbackNotified) {
            systemAudioFallbackNotified = true
            uploadOperationalAlert(
                "System audio is not supported yet; child stream is using microphone fallback when permission is available.",
                "LOW"
            )
        }

        if (!hasPermission(Manifest.permission.RECORD_AUDIO)) {
            uploadOperationalAlert(
                "Live microphone capture is unavailable because microphone permission is missing on the child device.",
                "MEDIUM"
            )
            return
        }

        beginAudioSegment()
    }

    private fun beginAudioSegment() {
        mainHandler.removeCallbacks(audioSegmentRunnable)
        val outputFile = File.createTempFile("amanah-live-", ".m4a", cacheDir)
        currentAudioFile = outputFile

        try {
            val recorder = buildMediaRecorder(outputFile)
            mediaRecorder = recorder
            recorder.prepare()
            recorder.start()
            mainHandler.postDelayed(audioSegmentRunnable, AUDIO_SEGMENT_MS)
        } catch (error: Exception) {
            Log.w("LiveMediaStream", "Audio capture start failed: ${error.message}")
            outputFile.delete()
            currentAudioFile = null
            mediaRecorder?.release()
            mediaRecorder = null
        }
    }

    private fun finishAudioSegment(restart: Boolean) {
        mainHandler.removeCallbacks(audioSegmentRunnable)
        val recorder = mediaRecorder
        val audioFile = currentAudioFile
        mediaRecorder = null
        currentAudioFile = null

        if (recorder != null) {
            try {
                recorder.stop()
            } catch (_: Exception) {
                // Ignore invalid stop states when the service is being torn down.
            }
            try {
                recorder.reset()
            } catch (_: Exception) {
            }
            recorder.release()
        }

        if (audioFile != null && audioFile.exists() && audioFile.length() > 0L) {
            uploadAudioClip(audioFile)
        }
        audioFile?.delete()

        if (restart && hasPermission(Manifest.permission.RECORD_AUDIO)) {
            beginAudioSegment()
        }
    }

    private fun stopAudioCapture(deleteOnly: Boolean) {
        mainHandler.removeCallbacks(audioSegmentRunnable)
        val recorder = mediaRecorder
        val audioFile = currentAudioFile
        mediaRecorder = null
        currentAudioFile = null

        if (recorder != null) {
            try {
                if (!deleteOnly) {
                    recorder.stop()
                }
            } catch (_: Exception) {
            }
            try {
                recorder.reset()
            } catch (_: Exception) {
            }
            recorder.release()
        }

        if (deleteOnly) {
            audioFile?.delete()
            return
        }

        if (audioFile != null && audioFile.exists() && audioFile.length() > 0L) {
            uploadAudioClip(audioFile)
        }
        audioFile?.delete()
    }

    private fun stopCameraCapture() {
        try {
            imageAnalysis?.clearAnalyzer()
        } catch (_: Exception) {
        }
        imageAnalysis = null
        try {
            cameraProvider?.unbindAll()
        } catch (_: Exception) {
        }
        cameraProvider = null
    }

    @Suppress("DEPRECATION")
    private fun buildMediaRecorder(outputFile: File): MediaRecorder {
        val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(this)
        } else {
            MediaRecorder()
        }
        recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
        recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        recorder.setAudioSamplingRate(16_000)
        recorder.setAudioEncodingBitRate(32_000)
        recorder.setOutputFile(outputFile.absolutePath)
        return recorder
    }

    private fun imageProxyToDataUrl(imageProxy: ImageProxy): String? {
        val image = imageProxy.image ?: return null
        val nv21 = imageToNv21(image)
        val yuvImage = YuvImage(nv21, ImageFormat.NV21, image.width, image.height, null)
        val firstPass = ByteArrayOutputStream()
        if (!yuvImage.compressToJpeg(Rect(0, 0, image.width, image.height), 65, firstPass)) {
            return null
        }

        var bitmap = BitmapFactory.decodeByteArray(firstPass.toByteArray(), 0, firstPass.size()) ?: return null
        val rotation = imageProxy.imageInfo.rotationDegrees.toFloat()
        if (rotation != 0f) {
            val rotated = Bitmap.createBitmap(
                bitmap,
                0,
                0,
                bitmap.width,
                bitmap.height,
                Matrix().apply { postRotate(rotation) },
                true
            )
            if (rotated != bitmap) {
                bitmap.recycle()
                bitmap = rotated
            }
        }

        val resized = resizeBitmap(bitmap, 640)
        if (resized != bitmap) {
            bitmap.recycle()
        }

        val output = ByteArrayOutputStream()
        resized.compress(Bitmap.CompressFormat.JPEG, 45, output)
        resized.recycle()
        val encoded = Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
        return "data:image/jpeg;base64,$encoded"
    }

    private fun imageToNv21(image: Image): ByteArray {
        val yBuffer = image.planes[0].buffer
        val uBuffer = image.planes[1].buffer
        val vBuffer = image.planes[2].buffer

        val ySize = yBuffer.remaining()
        val uSize = uBuffer.remaining()
        val vSize = vBuffer.remaining()

        val nv21 = ByteArray(ySize + uSize + vSize)
        yBuffer.get(nv21, 0, ySize)
        vBuffer.get(nv21, ySize, vSize)
        uBuffer.get(nv21, ySize + vSize, uSize)
        return nv21
    }

    private fun resizeBitmap(bitmap: Bitmap, maxSide: Int): Bitmap {
        val width = bitmap.width
        val height = bitmap.height
        if (width <= maxSide && height <= maxSide) return bitmap

        val ratio = minOf(maxSide.toFloat() / width.toFloat(), maxSide.toFloat() / height.toFloat())
        val targetWidth = (width * ratio).toInt().coerceAtLeast(1)
        val targetHeight = (height * ratio).toInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
    }

    private fun uploadVideoFrame(imageData: String) {
        val currentParentId = parentId ?: return
        val currentChildId = childId ?: return
        val alert = hashMapOf(
            "parentId" to currentParentId,
            "childId" to currentChildId,
            "childName" to childName,
            "platform" to "Live Stream",
            "content" to "Live camera frame from child device.",
            "category" to "SAFE",
            "severity" to "LOW",
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "aiAnalysis" to "Live camera frame uploaded from LiveMediaStreamService.",
            "imageData" to imageData,
            "streamKind" to "video",
            "streamSource" to videoSource
        )

        db.collection("alerts").add(alert)
            .addOnFailureListener { error ->
                Log.w("LiveMediaStream", "Video frame upload failed: ${error.message}")
            }
    }

    private fun uploadAudioClip(audioFile: File) {
        val currentParentId = parentId ?: return
        val currentChildId = childId ?: return
        val bytes = audioFile.readBytes()
        if (bytes.isEmpty()) return

        val mimeType = "audio/mp4"
        val dataUrl = "data:$mimeType;base64,${Base64.encodeToString(bytes, Base64.NO_WRAP)}"
        val effectiveSource = if (audioSource == "system") "mic_fallback" else "mic"
        val alert = hashMapOf(
            "parentId" to currentParentId,
            "childId" to currentChildId,
            "childName" to childName,
            "platform" to "Live Stream",
            "content" to "Live microphone clip from child device.",
            "category" to "SAFE",
            "severity" to "LOW",
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "aiAnalysis" to "Live audio clip uploaded from LiveMediaStreamService.",
            "audioData" to dataUrl,
            "audioMimeType" to mimeType,
            "streamKind" to "audio",
            "streamSource" to effectiveSource
        )

        db.collection("alerts").add(alert)
            .addOnFailureListener { error ->
                Log.w("LiveMediaStream", "Audio clip upload failed: ${error.message}")
            }
    }

    private fun uploadOperationalAlert(content: String, severity: String) {
        val currentParentId = parentId ?: return
        val currentChildId = childId ?: return
        val alert = hashMapOf(
            "parentId" to currentParentId,
            "childId" to currentChildId,
            "childName" to childName,
            "platform" to "Live Stream",
            "content" to content,
            "category" to "SAFE",
            "severity" to severity,
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "aiAnalysis" to "Live media stream operational event."
        )
        db.collection("alerts").add(alert)
            .addOnFailureListener { error ->
                Log.w("LiveMediaStream", "Operational alert upload failed: ${error.message}")
            }
    }

    private fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }
}
