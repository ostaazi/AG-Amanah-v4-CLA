package com.amanah.child.services

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.amanah.child.R
import com.amanah.child.utils.SecurityCortex
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class AmanahAccessibilityService : AccessibilityService() {

    private val db = FirebaseFirestore.getInstance()
    private val serviceScope = CoroutineScope(Dispatchers.IO)
    private var lastProcessedText: String = ""
    private var lastProcessTime: Long = 0
    private var lastBlockedActionAt: Long = 0L
    private var lastLockEnforceAt: Long = 0L
    private var lockOverlayView: View? = null
    private var lockOverlayShown = false
    private var lockStateReceiver: BroadcastReceiver? = null

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i("AmanahService", "Accessibility Service Connected")

        lockStateReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                syncLockOverlay()
            }
        }
        try {
            val filter = IntentFilter(RemoteCommandService.ACTION_LOCK_STATE_CHANGED)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(lockStateReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                registerReceiver(lockStateReceiver, filter)
            }
        } catch (e: Exception) {
            Log.w("AmanahService", "Failed to register lock-state receiver: ${e.message}")
        }
        syncLockOverlay()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        // Enforce parent lock/blackout even when the child app is not in foreground.
        if (syncLockOverlay()) return

        val packageName = event.packageName?.toString() ?: return
        if (packageName.contains("com.amanah.child")) return
        rememberForegroundApp(packageName)

        if (isCameraMicPolicyActive() && isCameraOrMicSensitiveApp(packageName)) {
            handleBlockedApp(packageName, "camera_mic_policy")
            return
        }

        if (isBlockedApp(packageName)) {
            handleBlockedApp(packageName, "blocked_app_list")
            return
        }

        val relevantEvent = event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED ||
            event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED ||
            event.eventType == AccessibilityEvent.TYPE_VIEW_FOCUSED
        if (!relevantEvent) return

        val text = extractEventText(event)
        if (text.length < 3) return

        val currentTime = System.currentTimeMillis()
        val isDuplicate = text == lastProcessedText && (currentTime - lastProcessTime) <= 10000
        if (isDuplicate) return

        lastProcessedText = text
        lastProcessTime = currentTime
        processContent(text, packageName)
    }

    private fun rememberForegroundApp(packageName: String) {
        try {
            getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
                .edit()
                .putString("lastForegroundPackage", packageName)
                .putLong("lastForegroundAt", System.currentTimeMillis())
                .apply()
        } catch (e: Exception) {
            Log.w("AmanahService", "Failed to persist foreground package: ${e.message}")
        }
    }

    private fun extractEventText(event: AccessibilityEvent): String {
        val direct = event.text?.joinToString(" ").orEmpty()
        val sourceText = event.source?.text?.toString().orEmpty()
        val desc = event.contentDescription?.toString().orEmpty()

        return listOf(direct, sourceText, desc)
            .filter { it.isNotBlank() }
            .joinToString(" ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun processContent(text: String, appName: String) {
        serviceScope.launch {
            val result = SecurityCortex.analyzeText(text)
            if (result.isDanger) {
                uploadAlert(text, appName, result)
                // Only auto-lock for high-confidence CRITICAL detections (>= 0.95).
                // Lower-confidence matches still generate alerts but won't lock the device,
                // reducing false positives from common words in games/news.
                if (result.severity == "CRITICAL" && result.score >= 0.95f) {
                    activateLocalEmergencyLock(result.category)
                }
            }
        }
    }

    private fun activateLocalEmergencyLock(category: String) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        if (prefs.getBoolean("preventDeviceLock", false)) {
            Log.i("AmanahService", "Emergency local lock skipped because preventDeviceLock is enabled.")
            return
        }

        val now = System.currentTimeMillis()
        if (now - lastLockEnforceAt < 30000) {
            syncLockOverlay()
            return
        }
        lastLockEnforceAt = now

        val message = when (category) {
            "إيذاء النفس" -> "تم تفعيل حماية فورية: تم رصد مؤشرات إيذاء النفس."
            "تواصل مشبوه" -> "تم تفعيل حماية فورية: تم رصد مؤشرات استدراج/تواصل مشبوه."
            "ابتزاز" -> "تم تفعيل حماية فورية: تم رصد مؤشرات ابتزاز."
            "تحريض على العنف" -> "تم تفعيل حماية فورية: تم رصد محتوى عنيف خطير."
            else -> "تم تفعيل وضع الأمان الفوري لحماية الطفل."
        }

        prefs.edit()
            .putBoolean("deviceLockActive", true)
            .putBoolean("blackoutActive", true)
            .putString("blackoutMessage", message)
            .apply()

        syncLockOverlay()
    }

    private fun isBlockedApp(packageName: String): Boolean {
        val blocked = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
            .getStringSet("blockedApps", emptySet())
            ?.map { it.lowercase() }
            ?.toSet()
            ?: emptySet()
        if (blocked.isEmpty()) return false

        val pkg = packageName.lowercase()
        return blocked.any { token -> token.isNotBlank() && (pkg == token || pkg.contains(token)) }
    }

    private fun handleBlockedApp(packageName: String, reason: String) {
        val now = System.currentTimeMillis()
        if (now - lastBlockedActionAt < 1200) return
        lastBlockedActionAt = now

        performGlobalAction(GLOBAL_ACTION_HOME)
        uploadPolicyAlert(packageName, reason)
    }

    private fun uploadPolicyAlert(packageName: String, reason: String) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childId = prefs.getString("childDocumentId", null) ?: return
        val childName = prefs.getString("childName", "My Child")

        val content = if (reason == "camera_mic_policy") {
            "Camera/microphone sensitive app launch blocked by child policy."
        } else {
            "Blocked app launch prevented by child policy."
        }

        val alert = hashMapOf(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to packageName,
            "content" to content,
            "category" to "TAMPER",
            "severity" to "MEDIUM",
            "aiAnalysis" to if (reason == "camera_mic_policy")
                "Package blocked by blockCameraAndMic policy."
            else
                "Package blocked by remote blockApp command.",
            "actionTaken" to "Forced return to Home screen",
            "timestamp" to Timestamp.now(),
            "status" to "NEW"
        )

        db.collection("alerts").add(alert)
            .addOnFailureListener { e ->
                Log.w("AmanahService", "Failed to upload blocked-app alert", e)
            }
    }

    private fun isCameraMicPolicyActive(): Boolean {
        return getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
            .getBoolean("blockCameraAndMic", false)
    }

    private fun isCameraOrMicSensitiveApp(packageName: String): Boolean {
        val pkg = packageName.lowercase()
        val exactOrContains = listOf(
            "com.android.camera",
            "com.google.android.googlecamera",
            "com.sec.android.app.camera",
            "com.oplus.camera",
            "org.codeaurora.snapcam",
            "com.android.soundrecorder",
            "com.google.android.apps.recorder"
        )
        if (exactOrContains.any { token -> pkg == token || pkg.contains(token) }) {
            return true
        }
        return pkg.contains("camera") || pkg.contains("recorder") || pkg.contains("voice")
    }

    private fun uploadAlert(content: String, platform: String, analysis: SecurityCortex.AnalysisResult) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null)
        val childName = prefs.getString("childName", "My Child")
        val childId = prefs.getString("childDocumentId", null)

        if (parentId == null || childId == null) {
            Log.w("AmanahService", "Device not paired yet. Skipping upload.")
            return
        }

        val alert = hashMapOf(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to platform,
            "content" to content,
            "category" to analysis.category,
            "severity" to analysis.severity,
            "aiAnalysis" to "Local text detection matched restricted patterns.",
            "actionTaken" to "Logged & Parent Notified",
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "suspectId" to "Unknown"
        )

        db.collection("alerts")
            .add(alert)
            .addOnSuccessListener {
                Log.i("AmanahService", "Alert uploaded: ${analysis.category}")
            }
            .addOnFailureListener { e ->
                Log.e("AmanahService", "Failed to upload alert", e)
            }
    }

    private fun syncLockOverlay(): Boolean {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val preventDeviceLock = prefs.getBoolean("preventDeviceLock", false)
        val lockActive = prefs.getBoolean("deviceLockActive", false)
        val blackoutActive = prefs.getBoolean("blackoutActive", false)
        val blackoutMessage = prefs.getString("blackoutMessage", "").orEmpty()

        if (preventDeviceLock) {
            if (lockActive || blackoutActive || blackoutMessage.isNotBlank()) {
                prefs.edit()
                    .putBoolean("deviceLockActive", false)
                    .putBoolean("blackoutActive", false)
                    .putString("blackoutMessage", "")
                    .apply()
            }
            hideLockOverlay()
            return false
        }

        val shouldShow = lockActive || blackoutActive
        if (!shouldShow) {
            hideLockOverlay()
            return false
        }

        val message = when {
            blackoutActive && blackoutMessage.isNotBlank() -> blackoutMessage
            lockActive -> "تم قفل الجهاز لدواعي الأمان. يرجى التواصل مع الوالدين."
            else -> "يرجى مراجعة الوالدين لإلغاء الحجب."
        }
        showLockOverlay(message)

        // Fallback for rare cases where overlay cannot be added (OEM restrictions).
        if (!lockOverlayShown) {
            val now = System.currentTimeMillis()
            if (now - lastLockEnforceAt > 1200) {
                lastLockEnforceAt = now
                performGlobalAction(GLOBAL_ACTION_HOME)
            }
        }
        return true
    }

    private fun showLockOverlay(message: String) {
        if (lockOverlayShown) {
            // Update message on existing view if needed.
            val msgView = lockOverlayView?.findViewWithTag<TextView>("lock_message")
            msgView?.text = message
            return
        }

        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        val view = buildLockOverlayView(message)

        val type = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP_MR1) {
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }

        try {
            wm.addView(view, params)
            lockOverlayView = view
            lockOverlayShown = true
        } catch (e: Exception) {
            Log.w("AmanahService", "Overlay add failed: ${e.message}")
            lockOverlayView = null
            lockOverlayShown = false
        }
    }

    private fun hideLockOverlay() {
        if (!lockOverlayShown) return
        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        try {
            lockOverlayView?.let { wm.removeView(it) }
        } catch (_: Exception) {
        } finally {
            lockOverlayView = null
            lockOverlayShown = false
        }
    }

    private fun buildLockOverlayView(message: String): View {
        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            isClickable = true
            isFocusable = true
            // Consume all touches to block interactions beneath.
            setOnTouchListener { _, _ -> true }
        }

        val center = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }

        val logo = ImageView(this).apply {
            setImageResource(R.drawable.ic_shield_logo)
            alpha = 0.4f
            layoutParams = LinearLayout.LayoutParams(240, 240)
        }

        val title = TextView(this).apply {
            text = "تم تفعيل الحجب بواسطة AMANAH"
            setTextColor(Color.WHITE)
            textSize = 18f
            setPadding(0, 40, 0, 0)
            gravity = Gravity.CENTER
        }

        val msg = TextView(this).apply {
            tag = "lock_message"
            text = message
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 12f
            setPadding(0, 18, 0, 0)
            gravity = Gravity.CENTER
        }

        center.addView(logo)
        center.addView(title)
        center.addView(msg)

        val rootParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.CENTER
        }
        root.addView(center, rootParams)
        return root
    }

    override fun onInterrupt() {
        Log.d("AmanahService", "Service Interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            lockStateReceiver?.let { unregisterReceiver(it) }
        } catch (_: Exception) {
        }
        lockStateReceiver = null
        hideLockOverlay()
        serviceScope.cancel()
    }
}
