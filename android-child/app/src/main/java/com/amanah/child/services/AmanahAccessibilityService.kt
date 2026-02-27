package com.amanah.child.services

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.amanah.child.R
import com.amanah.child.utils.OfflineUnlockManager
import com.amanah.child.utils.SecurityCortex
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.Locale

class AmanahAccessibilityService : AccessibilityService() {
    companion object {
        private const val PREFS_NAME = "AmanahPrefs"
        private const val PREF_BLOCKED_APPS = "blockedApps"
        private const val PREF_PARTIAL_POLICIES = "blockedPartialPolicies"
        private const val PARTIAL_POLICY_DELIM = "||"
        private const val PARTIAL_PATTERN_DELIM = "@@"
        private const val TEXT_AGG_WINDOW_MS = 12_000L
        private const val TEXT_AGG_MAX_SNIPPETS = 18
        private const val SIGNAL_EVENT_COOLDOWN_MS = 20_000L
    }

    private data class PartialBlockPolicy(
        val token: String,
        val scope: String,
        val patterns: Set<String>
    )

    private val db = FirebaseFirestore.getInstance()
    private val serviceScope = CoroutineScope(Dispatchers.IO)
    private var lastProcessedText: String = ""
    private var lastProcessTime: Long = 0
    private var lastBlockedActionAt: Long = 0L
    private var lastLockEnforceAt: Long = 0L
    private var lockOverlayView: View? = null
    private var lockOverlayShown = false
    private var lockStateReceiver: BroadcastReceiver? = null
    private val recentTextByPackage = mutableMapOf<String, ArrayDeque<Pair<Long, String>>>()
    private val recentSignalFingerprintAt = LinkedHashMap<String, Long>()

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
        
        // D2: Initialize Behavioral AI
        com.amanah.child.utils.BehavioralAgent.init(this)
        
        // D3: Start Encrypted Threat Sync
        com.amanah.child.utils.ThreatSyncManager.startSync(this)
        
        // Track Unlocks for Behavioral Baseline
        val unlockFilter = IntentFilter(Intent.ACTION_USER_PRESENT)
        registerReceiver(object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                com.amanah.child.utils.BehavioralAgent.onUnlock(context!!)
            }
        }, unlockFilter)

        syncLockOverlay()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        // Enforce parent lock/blackout even when the child app is not in foreground.
        if (syncLockOverlay()) return

        val packageName = event.packageName?.toString() ?: return
        if (packageName.contains("com.amanah.child")) return
        rememberForegroundApp(packageName)

        if (isCameraPolicyActive() && isCameraSensitiveApp(packageName)) {
            handleBlockedApp(packageName, "camera_policy")
            return
        }

        if (isMicrophonePolicyActive() && isMicrophoneSensitiveApp(packageName)) {
            handleBlockedApp(packageName, "microphone_policy")
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
        val partialReason = resolvePartialIsolationReason(packageName, event, text)
        if (partialReason != null) {
            handleBlockedApp(packageName, partialReason)
            return
        }

        val currentTime = System.currentTimeMillis()
        val aggregatedText = aggregateRecentText(packageName, text, currentTime)
        if (aggregatedText.length < 3) return

        // D2: Record Screen Time (approximate based on event intervals)
        if (lastProcessTime > 0) {
            val diff = currentTime - lastProcessTime
            if (diff < 60000) { // Only count if active within last minute
                val minutes = (diff / 60000.0).toInt().coerceAtLeast(1)
                val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
                val isLateNight = hour in 1..5
                com.amanah.child.utils.BehavioralAgent.recordScreenTime(this, minutes, isLateNight)
            }
        }

        val isDuplicate = aggregatedText == lastProcessedText && (currentTime - lastProcessTime) <= 10000
        if (isDuplicate) return

        lastProcessedText = aggregatedText
        lastProcessTime = currentTime
        processContent(aggregatedText, packageName)
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

    private fun aggregateRecentText(packageName: String, freshText: String, now: Long): String {
        val normalizedFresh = freshText
            .replace(Regex("\\s+"), " ")
            .trim()

        val queue = recentTextByPackage.getOrPut(packageName) { ArrayDeque() }
        if (normalizedFresh.length >= 2) {
            val previous = queue.lastOrNull()?.second
            if (!normalizedFresh.equals(previous, ignoreCase = true)) {
                queue.addLast(now to normalizedFresh)
            }
        }

        while (queue.isNotEmpty() && now - queue.first().first > TEXT_AGG_WINDOW_MS) {
            queue.removeFirst()
        }
        while (queue.size > TEXT_AGG_MAX_SNIPPETS) {
            queue.removeFirst()
        }

        return queue
            .map { it.second }
            .joinToString(" ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }

    private fun processContent(text: String, appName: String) {
        serviceScope.launch {
            val result = SecurityCortex.analyzeText(text)
            maybeUploadSignalEvent(text, appName, result)
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

    private fun maybeUploadSignalEvent(
        rawText: String,
        platform: String,
        analysis: SecurityCortex.AnalysisResult
    ) {
        val normalized = SecurityCortex.normalizeTextForAudit(rawText).trim()
        if (normalized.length < 8) return

        val eventType = resolveSignalEventType(platform, normalized, analysis)
        if (eventType == null) return

        val fingerprint = "$eventType|${platform.lowercase(Locale.ROOT)}|${normalized.take(90)}"
        val now = System.currentTimeMillis()
        synchronized(recentSignalFingerprintAt) {
            val last = recentSignalFingerprintAt[fingerprint]
            if (last != null && now - last < SIGNAL_EVENT_COOLDOWN_MS) {
                return
            }
            recentSignalFingerprintAt[fingerprint] = now
            if (recentSignalFingerprintAt.size > 320) {
                val iterator = recentSignalFingerprintAt.entries.iterator()
                repeat(80) {
                    if (iterator.hasNext()) {
                        iterator.next()
                        iterator.remove()
                    }
                }
            }
        }

        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childId = prefs.getString("childDocumentId", null) ?: return
        val childName = prefs.getString("childName", "My Child") ?: "My Child"
        val scenarioHints = inferSignalScenarioHints(eventType, analysis)
        val payload = hashMapOf<String, Any>(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "eventType" to eventType,
            "source" to "accessibility_text",
            "platform" to platform,
            "content" to rawText.take(2000),
            "normalizedContent" to normalized.take(2000),
            "confidence" to ((analysis.score * 100f).toInt()).coerceIn(0, 100),
            "timestamp" to Timestamp.now(),
            "scenarioHints" to scenarioHints,
            "context" to hashMapOf(
                "category" to analysis.category,
                "severity" to analysis.severity,
                "isDanger" to analysis.isDanger,
                "matchedSignals" to analysis.matchedSignals.take(8)
            )
        )
        if (analysis.isDanger) {
            payload["severity"] = analysis.severity
        }
        db.collection("childSignalEvents")
            .add(payload)
            .addOnFailureListener { e ->
                Log.w("AmanahService", "Signal event upload failed: ${e.message}")
            }
    }

    private fun resolveSignalEventType(
        platform: String,
        normalizedText: String,
        analysis: SecurityCortex.AnalysisResult
    ): String? {
        val pkg = platform.lowercase(Locale.ROOT)
        val browserLike = pkg.contains("chrome") ||
            pkg.contains("browser") ||
            pkg.contains("firefox") ||
            pkg.contains("opera") ||
            pkg.contains("edge")
        val watchLike = pkg.contains("youtube") ||
            pkg.contains("tiktok") ||
            pkg.contains("instagram") ||
            pkg.contains("snapchat") ||
            pkg.contains("netflix") ||
            pkg.contains("facebook")
        val audioLike = pkg.contains("recorder") ||
            pkg.contains("voice") ||
            pkg.contains("audio")
        val hasUrl = normalizedText.contains("http://") ||
            normalizedText.contains("https://") ||
            normalizedText.contains("www.") ||
            Regex("\\b[a-z0-9.-]+\\.(com|net|org|io|me|app|ai|co)\\b").containsMatchIn(normalizedText)
        val hasSearchIntent = normalizedText.contains("search") ||
            normalizedText.contains("query") ||
            normalizedText.contains("ابحث") ||
            normalizedText.contains("بحث") ||
            normalizedText.contains("نتائج")
        val hasAudioTranscriptCue = normalizedText.contains("voice message") ||
            normalizedText.contains("audio message") ||
            normalizedText.contains("speech to text") ||
            normalizedText.contains("رسالة صوتية") ||
            normalizedText.contains("مذكرة صوتية")

        if (audioLike || hasAudioTranscriptCue) return "audio_transcript"
        if (hasUrl) return "link_intent"
        if (browserLike && hasSearchIntent) return "search_intent"
        if (watchLike) return "watch_intent"
        if (analysis.isDanger) return "conversation_pattern"
        return null
    }

    private fun inferSignalScenarioHints(
        eventType: String,
        analysis: SecurityCortex.AnalysisResult
    ): List<String> {
        val hints = mutableListOf<String>()
        when (eventType) {
            "search_intent" -> hints += listOf("phishing_links", "inappropriate_content")
            "watch_intent" -> hints += listOf("inappropriate_content", "harmful_challenges")
            "audio_transcript" -> hints += listOf("bullying", "threat_exposure")
            "link_intent" -> hints += listOf("phishing_links", "account_theft_fraud")
            "conversation_pattern" -> hints += listOf("threat_exposure", "sexual_exploitation")
        }
        when (analysis.category) {
            "تحريض على العنف" -> hints += "harmful_challenges"
            "ابتزاز" -> hints += "threat_exposure"
            "تواصل مشبوه" -> hints += "sexual_exploitation"
            "إيذاء النفس" -> hints += "self_harm"
            "محتوى للبالغين" -> hints += "inappropriate_content"
            "تنمر إلكتروني" -> hints += "bullying"
        }
        return hints.distinct().take(8)
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
        val blocked = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .getStringSet(PREF_BLOCKED_APPS, emptySet())
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

        val scope = if (reason.startsWith("partial_isolation:")) {
            reason.substringAfter("partial_isolation:").ifBlank { "messaging" }
        } else {
            ""
        }

        val content = when {
            reason == "camera_policy" ->
                "Camera-capable app launch blocked by child policy."
            reason == "microphone_policy" ->
                "Microphone-capable app launch blocked by child policy."
            reason.startsWith("partial_isolation:") ->
                "Partial app isolation blocked risky $scope surface inside the monitored app."
            else ->
                "Blocked app launch prevented by child policy."
        }

        val aiAnalysis = when {
            reason == "camera_policy" ->
                "Package blocked by blockCamera policy."
            reason == "microphone_policy" ->
                "Package blocked by blockMicrophone policy."
            reason.startsWith("partial_isolation:") ->
                "Partial isolation policy blocked scope=$scope in this app session."
            else ->
                "Package blocked by remote blockApp command."
        }

        val alert = hashMapOf(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to packageName,
            "content" to content,
            "category" to "TAMPER",
            "severity" to "MEDIUM",
            "aiAnalysis" to aiAnalysis,
            "actionTaken" to "Forced return to Home screen",
            "timestamp" to Timestamp.now(),
            "status" to "NEW"
        )
        if (scope.isNotBlank()) {
            alert["policyScope"] = scope
        }

        db.collection("alerts").add(alert)
            .addOnFailureListener { e ->
                Log.w("AmanahService", "Failed to upload blocked-app alert", e)
            }
    }

    private fun resolvePartialIsolationReason(
        packageName: String,
        event: AccessibilityEvent,
        text: String
    ): String? {
        val policies = loadPartialPoliciesForPackage(packageName)
        if (policies.isEmpty()) return null

        val signal = buildUiSignalText(event, text)
        if (signal.isBlank()) return null

        for (policy in policies) {
            val scopeMatched = matchesScopeSignal(policy.scope, signal)
            val patternMatched = policy.patterns.any { signal.contains(it) }
            if (scopeMatched || patternMatched) {
                return "partial_isolation:${policy.scope}"
            }
        }
        return null
    }

    private fun loadPartialPoliciesForPackage(packageName: String): List<PartialBlockPolicy> {
        val raw = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .getStringSet(PREF_PARTIAL_POLICIES, emptySet())
            ?: emptySet()
        if (raw.isEmpty()) return emptyList()

        val pkg = packageName.lowercase(Locale.getDefault())
        return raw.mapNotNull { decodePartialPolicy(it) }
            .filter { policy ->
                pkg == policy.token || pkg.contains(policy.token) || policy.token.contains(pkg)
            }
    }

    private fun decodePartialPolicy(raw: String): PartialBlockPolicy? {
        val parts = raw.split(PARTIAL_POLICY_DELIM)
        if (parts.size < 2) return null
        val token = parts[0].trim().lowercase(Locale.getDefault())
        val scope = parts[1].trim().lowercase(Locale.getDefault())
        if (token.isBlank() || scope.isBlank()) return null

        val patterns = if (parts.size >= 3) {
            parts[2].split(PARTIAL_PATTERN_DELIM)
                .map { normalizePolicyText(it) }
                .filter { it.isNotBlank() }
                .toSet()
        } else {
            emptySet()
        }
        return PartialBlockPolicy(token = token, scope = scope, patterns = patterns)
    }

    private fun buildUiSignalText(event: AccessibilityEvent, text: String): String {
        val sourceId = try {
            event.source?.viewIdResourceName.orEmpty()
        } catch (_: Exception) {
            ""
        }
        val className = event.className?.toString().orEmpty()
        val contentDescription = event.contentDescription?.toString().orEmpty()
        val combined = listOf(text, sourceId, className, contentDescription)
            .filter { it.isNotBlank() }
            .joinToString(" ")
        return normalizePolicyText(combined)
    }

    private fun normalizePolicyText(value: String): String {
        return value
            .trim()
            .lowercase(Locale.getDefault())
            .replace(Regex("[^\\p{L}\\p{N}\\s:_-]"), " ")
            .replace(Regex("\\s+"), " ")
    }

    private fun matchesScopeSignal(scope: String, signal: String): Boolean {
        val keywords = when (scope) {
            "messaging" -> setOf(
                "message", "messages", "chat", "chats", "inbox", "typing",
                "رسالة", "رسائل", "مراسلة", "دردشة", "محادثة", "اكتب"
            )
            "private_chat" -> setOf(
                "private", "secret", "dm", "direct message", "inbox", "1:1",
                "خاص", "رسالة خاصة", "محادثة خاصة", "دايركت"
            )
            "rooms" -> setOf(
                "room", "rooms", "group", "groups", "channel", "channels", "server", "lobby",
                "غرفة", "غرف", "روم", "مجموعة", "مجموعات", "قناة", "قنوات", "سيرفر"
            )
            "comments" -> setOf(
                "comment", "comments", "reply", "replies", "thread",
                "تعليق", "تعليقات", "رد", "ردود", "سلسلة"
            )
            else -> emptySet()
        }
        return keywords.any { keyword -> signal.contains(keyword) }
    }

    private fun isCameraPolicyActive(): Boolean {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        return prefs.getBoolean("blockCamera", false) || prefs.getBoolean("blockCameraAndMic", false)
    }

    private fun isMicrophonePolicyActive(): Boolean {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        return prefs.getBoolean("blockMicrophone", false) || prefs.getBoolean("blockCameraAndMic", false)
    }

    private fun isCameraSensitiveApp(packageName: String): Boolean {
        val pkg = packageName.lowercase(Locale.getDefault())
        val exactOrContains = listOf(
            "com.android.camera",
            "com.google.android.googlecamera",
            "com.sec.android.app.camera",
            "com.oplus.camera",
            "org.codeaurora.snapcam",
            "com.snapchat.android",
            "com.instagram.android",
            "com.whatsapp",
            "org.telegram.messenger",
            "com.facebook.orca",
            "com.google.android.apps.meetings",
            "us.zoom.videomeetings",
            "com.google.android.apps.photos",
            "com.microsoft.teams",
            "com.discord",
            "com.zhiliaoapp.musically",
            "com.ss.android.ugc.trill",
            "com.bereal.ft",
            "com.google.android.apps.chromecast.app",
        )
        if (exactOrContains.any { token -> pkg == token || pkg.contains(token) }) {
            return true
        }
        return pkg.contains("camera") || pkg.contains("photo") || pkg.contains("scanner") || pkg.contains("video")
    }

    private fun isMicrophoneSensitiveApp(packageName: String): Boolean {
        val pkg = packageName.lowercase(Locale.getDefault())
        val exactOrContains = listOf(
            "com.android.soundrecorder",
            "com.google.android.apps.recorder",
            "com.google.android.dialer",
            "com.android.dialer",
            "com.whatsapp",
            "org.telegram.messenger",
            "com.facebook.orca",
            "com.instagram.android",
            "com.snapchat.android",
            "com.google.android.apps.meetings",
            "us.zoom.videomeetings",
            "com.microsoft.teams",
            "com.discord"
        )
        if (exactOrContains.any { token -> pkg == token || pkg.contains(token) }) {
            return true
        }
        return pkg.contains("recorder") || pkg.contains("voice") || pkg.contains("call") || pkg.contains("dialer") || pkg.contains("audio")
    }

    private fun uploadAlert(content: String, platform: String, analysis: SecurityCortex.AnalysisResult) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null)
        val childName = prefs.getString("childName", "My Child") ?: "My Child"
        val childId = prefs.getString("childDocumentId", null)

        if (parentId == null || childId == null) {
            Log.w("AmanahService", "Device not paired yet. Skipping upload.")
            return
        }

        val normalizedText = analysis.normalizedExcerpt.ifBlank {
            SecurityCortex.normalizeTextForAudit(content)
        }
        val obfuscationLikely = isLikelyObfuscated(content, normalizedText)
        val reasonAr = analysis.reasonAr.ifBlank {
            "تم رصد مؤشر نصي ضمن فئة ${analysis.category}."
        }
        val reasonEn = analysis.reasonEn.ifBlank {
            "Text risk indicator detected for category ${analysis.category}."
        }
        val aiSummary = buildString {
            append("Local text detection matched policy rules.")
            append(" | AR: $reasonAr")
            append(" | EN: $reasonEn")
        }

        val alert = hashMapOf<String, Any>(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to platform,
            "content" to content,
            "category" to analysis.category,
            "severity" to analysis.severity,
            "aiAnalysis" to aiSummary,
            "actionTaken" to "Normalized bilingual explanation attached.",
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "suspectId" to "Unknown",
            "triggerType" to "TEXT",
            "analysisReasonAr" to reasonAr,
            "analysisReasonEn" to reasonEn,
            "triggerRawText" to content.take(2000),
            "triggerNormalizedText" to normalizedText.take(2000),
            "normalizationChanged" to (content != normalizedText),
            "obfuscationLikely" to obfuscationLikely
        )
        if (analysis.matchedSignals.isNotEmpty()) {
            alert["matchedSignals"] = analysis.matchedSignals.take(8)
        }
        val frame = ScreenGuardianService.peekLatestFrameData()
        if (!frame.isNullOrBlank()) {
            alert["imageData"] = frame
        }

        db.collection("alerts")
            .add(alert)
            .addOnSuccessListener {
                Log.i("AmanahService", "Alert uploaded: ${analysis.category}")
            }
            .addOnFailureListener { e ->
                Log.e("AmanahService", "Failed to upload alert", e)
            }
    }

    private fun isLikelyObfuscated(rawText: String, normalizedText: String): Boolean {
        if (rawText.isBlank() || normalizedText.isBlank()) return false
        val rawCompact = rawText.lowercase(Locale.ROOT).replace(Regex("\\s+"), "")
        val normalizedCompact = normalizedText.lowercase(Locale.ROOT).replace(Regex("\\s+"), "")
        val hasMaskingChars = rawText.contains(Regex("[0-9@\\$\\*\\-_\\.]+"))
        return hasMaskingChars || rawCompact != normalizedCompact
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
            lockOverlayView?.let { applyOfflineUnlockVisibility(it) }
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
            setBackgroundColor(Color.parseColor("#E6000000"))
            isClickable = true
            isFocusable = true
            // Consume all touches to block interactions beneath.
            setOnTouchListener { _, _ -> true }
        }

        val center = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(
                    Color.parseColor("#8A1538"),
                    Color.parseColor("#3A0715")
                )
            ).apply {
                cornerRadius = dp(24).toFloat()
                setStroke(dp(2), Color.parseColor("#D1A23D"))
            }
            setPadding(dp(28), dp(28), dp(28), dp(24))
        }

        val logo = ImageView(this).apply {
            setImageResource(R.drawable.ic_shield_logo)
            layoutParams = LinearLayout.LayoutParams(dp(128), dp(128))
        }

        val title = TextView(this).apply {
            text = "Amanah Shield"
            setTextColor(Color.parseColor("#FFF6DA"))
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(16), 0, 0)
            gravity = Gravity.CENTER
        }

        val msg = TextView(this).apply {
            tag = "lock_message"
            text = message
            setTextColor(Color.parseColor("#E8D8B0"))
            textSize = 14f
            setPadding(0, dp(12), 0, 0)
            gravity = Gravity.CENTER
            maxWidth = dp(260)
        }

        val codeInput = EditText(this).apply {
            tag = "offline_unlock_input"
            hint = "Emergency code"
            setTextColor(Color.parseColor("#FFF6DA"))
            setHintTextColor(Color.parseColor("#D7C89B"))
            textSize = 16f
            gravity = Gravity.CENTER
            maxLines = 1
            inputType = android.text.InputType.TYPE_CLASS_TEXT or
                android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
            filters = arrayOf(android.text.InputFilter.LengthFilter(16))
            setPadding(dp(12), dp(10), dp(12), dp(10))
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(12).toFloat()
                setStroke(dp(1), Color.parseColor("#D1A23D"))
                setColor(Color.parseColor("#33121212"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(14)
            }
        }

        val unlockButton = Button(this).apply {
            tag = "offline_unlock_button"
            text = "Offline Emergency Unlock"
            setTextColor(Color.parseColor("#2A1603"))
            textSize = 13f
            isAllCaps = false
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(
                    Color.parseColor("#F7DE8D"),
                    Color.parseColor("#D1A23D")
                )
            ).apply {
                cornerRadius = dp(12).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(10)
            }
        }

        val offlineStatus = TextView(this).apply {
            tag = "offline_unlock_status"
            val remaining = OfflineUnlockManager.backupCodesRemaining(this@AmanahAccessibilityService)
            text = if (remaining > 0) "Emergency backup codes remaining: $remaining" else ""
            setTextColor(Color.parseColor("#F8DFA9"))
            textSize = 11f
            setPadding(0, dp(8), 0, 0)
            gravity = Gravity.CENTER
            maxWidth = dp(280)
        }

        unlockButton.setOnClickListener {
            if (isDeviceOnline()) {
                codeInput.setText("")
                offlineStatus.text = ""
                applyOfflineUnlockVisibility(root)
                return@setOnClickListener
            }
            val code = codeInput.text?.toString().orEmpty()
            val result = OfflineUnlockManager.verifyCode(this, code)
            if (!result.success) {
                offlineStatus.setTextColor(Color.parseColor("#FCA5A5"))
                offlineStatus.text = result.message
                return@setOnClickListener
            }
            OfflineUnlockManager.clearLockState(this, "accessibility_overlay")
            codeInput.setText("")
            offlineStatus.setTextColor(Color.parseColor("#86EFAC"))
            offlineStatus.text = result.message
            syncLockOverlay()
            try {
                sendBroadcast(Intent(RemoteCommandService.ACTION_LOCK_STATE_CHANGED))
            } catch (_: Exception) {
            }
        }

        center.addView(logo)
        center.addView(title)
        center.addView(msg)
        center.addView(codeInput)
        center.addView(unlockButton)
        center.addView(offlineStatus)
        applyOfflineUnlockVisibility(root)

        val rootParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.CENTER
            marginStart = dp(24)
            marginEnd = dp(24)
        }
        root.addView(center, rootParams)
        return root
    }

    private fun applyOfflineUnlockVisibility(root: View) {
        val codeInput = root.findViewWithTag<EditText>("offline_unlock_input") ?: return
        val unlockButton = root.findViewWithTag<Button>("offline_unlock_button") ?: return
        val statusView = root.findViewWithTag<TextView>("offline_unlock_status") ?: return

        if (isDeviceOnline()) {
            // Online lock screen keeps the legacy policy view (no offline emergency controls).
            codeInput.visibility = View.GONE
            unlockButton.visibility = View.GONE
            statusView.visibility = View.GONE
            codeInput.setText("")
            statusView.text = ""
            return
        }

        codeInput.visibility = View.VISIBLE
        unlockButton.visibility = View.VISIBLE
        statusView.visibility = View.VISIBLE
        if (statusView.text.isNullOrBlank()) {
            val remaining = OfflineUnlockManager.backupCodesRemaining(this)
            if (remaining > 0) {
                statusView.text = "Emergency backup codes remaining: $remaining"
                statusView.setTextColor(Color.parseColor("#F8DFA9"))
            }
        }
    }

    private fun isDeviceOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
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
        recentTextByPackage.clear()
        serviceScope.cancel()
    }
}
