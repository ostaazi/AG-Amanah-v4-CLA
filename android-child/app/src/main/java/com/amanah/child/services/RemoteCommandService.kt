package com.amanah.child.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.VpnService
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Base64
import android.provider.Settings
import android.util.Log
import com.amanah.child.services.ScreenCaptureSessionStore
import androidx.core.app.NotificationCompat
import com.amanah.child.MainActivity
import com.amanah.child.R
import com.amanah.child.receivers.AmanahAdminReceiver
import com.amanah.child.utils.AlertFilterPolicyManager
import com.amanah.child.utils.OfflineUnlockManager
import com.amanah.child.utils.SecurityCortex
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import java.io.File
import java.io.FileOutputStream
import java.util.Date
import java.util.Locale

class RemoteCommandService : Service() {
    companion object {
        // In-app broadcast to notify AccessibilityService to refresh overlay state.
        const val ACTION_LOCK_STATE_CHANGED = "com.amanah.child.ACTION_LOCK_STATE_CHANGED"
        private const val NETWORK_PULSE_INTERVAL_MS = 30_000L
        private const val WIFI_ENABLE_BACKOFF_MS = 60_000L
        private const val NETWORK_RECOVERY_BACKOFF_MS = 30_000L
        private const val PREFS_NAME = "AmanahPrefs"
        private const val PREF_BLOCKED_APPS = "blockedApps"
        private const val PREF_PARTIAL_POLICIES = "blockedPartialPolicies"
        private const val PARTIAL_POLICY_DELIM = "||"
        private const val PARTIAL_PATTERN_DELIM = "@@"
    }

    private data class BlockAppCommandResult(
        val applied: Boolean,
        val blocked: Boolean = false,
        val scope: String = "app",
        val targetCount: Int = 0
    )

    private val db by lazy { FirebaseFirestore.getInstance() }
    private val auth by lazy { FirebaseAuth.getInstance() }
    private var commandListener: ListenerRegistration? = null
    private var listeningChildId: String? = null
    private val lastCommandTimestamps = mutableMapOf<String, Long>()
    private var lastLockRequested = false
    private var lastScreenshotRequested = false
    private var lastSirenRequested = false
    private val retryHandler = Handler(Looper.getMainLooper())
    private val pulseHandler = Handler(Looper.getMainLooper())
    private var authRetryCount = 0
    private var authInProgress = false
    private var lastWifiEnableAttemptAt = 0L
    private var lastNetworkRecoveryAt = 0L
    private var offlineUnlockSyncInFlight = false
    private val MAX_AUTH_RETRIES = 20
    private val networkPulseRunnable = object : Runnable {
        override fun run() {
            runNetworkPulse()
            pulseHandler.postDelayed(this, NETWORK_PULSE_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        startAsForeground()
        enforceSavedDnsPolicy()
        pulseHandler.post(networkPulseRunnable)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureAuthAndListen()
        return START_STICKY
    }

    override fun onDestroy() {
        pulseHandler.removeCallbacks(networkPulseRunnable)
        retryHandler.removeCallbacksAndMessages(null)
        commandListener?.remove()
        commandListener = null
        listeningChildId = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startAsForeground() {
        val channelId = "amanah_remote_commands"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Amanah Remote Commands",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }

        val openIntent = Intent(this, MainActivity::class.java)
        val pending = android.app.PendingIntent.getActivity(
            this,
            1201,
            openIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
            else android.app.PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Amanah Child Agent")
            .setContentText("Remote command channel is active")
            .setContentIntent(pending)
            .setOngoing(true)
            .build()

        startForeground(1201, notification)
    }

    private fun ensureAuthAndListen() {
        // Always enforce lock state from SharedPreferences (works offline)
        enforceSavedLockState()

        if (auth.currentUser != null) {
            authRetryCount = 0
            startListeningIfPaired()
            return
        }

        if (authInProgress) {
            return
        }
        authInProgress = true

        auth.signInAnonymously()
            .addOnSuccessListener {
                authInProgress = false
                authRetryCount = 0
                startListeningIfPaired()
            }
            .addOnFailureListener { e ->
                authInProgress = false
                Log.e("AmanahRemoteService", "Anonymous auth failed: ${e.message}")
                // Retry auth with exponential backoff (30s, 60s, 120s... max 5min)
                if (authRetryCount < MAX_AUTH_RETRIES) {
                    val delayMs = minOf(30_000L * (1L shl authRetryCount.coerceAtMost(3)), 300_000L)
                    authRetryCount++
                    Log.i("AmanahRemoteService", "Retrying auth in ${delayMs / 1000}s (attempt $authRetryCount)")
                    retryHandler.postDelayed({ ensureAuthAndListen() }, delayMs)
                }
            }
    }

    private fun enforceSavedLockState() {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val lockActive = prefs.getBoolean("deviceLockActive", false)
        val blackoutActive = prefs.getBoolean("blackoutActive", false)
        if (lockActive || blackoutActive) {
            broadcastLockStateChanged()
            bringLockOverlayToFront()
        }
    }

    private fun enforceSavedDnsPolicy() {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val enabled = prefs.getBoolean(DnsFilterVpnService.PREF_KEY_ENABLED, false)
        if (!enabled) {
            stopDnsFilteringService()
            return
        }
        if (VpnService.prepare(this) == null) {
            startDnsFilteringService(DnsFilterVpnService.ACTION_APPLY_POLICY)
        } else {
            requestDnsVpnPermission()
        }
    }

    private fun startListeningIfPaired() {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val childId = prefs.getString("childDocumentId", null)
        if (childId.isNullOrBlank()) {
            commandListener?.remove()
            commandListener = null
            listeningChildId = null
            Log.d("AmanahRemoteService", "No paired child id found, service is idle")
            return
        }

        if (commandListener != null && listeningChildId == childId) {
            return
        }
        claimDeviceOwnership(childId)
        startListeningForCommands(childId)
    }

    private fun claimDeviceOwnership(childId: String) {
        val uid = auth.currentUser?.uid ?: return
        db.collection("children").document(childId)
            .update("deviceOwnerUid", uid)
            .addOnFailureListener { e ->
                Log.w("AmanahRemoteService", "Ownership claim failed: ${e.message}")
            }
    }

    private fun startListeningForCommands(childId: String) {
        commandListener?.remove()
        listeningChildId = childId
        commandListener = db.collection("children").document(childId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.e("AmanahRemoteService", "Listener error: ${e.message}")
                    commandListener?.remove()
                    commandListener = null
                    listeningChildId = null
                    return@addSnapshotListener
                }
                if (snapshot == null || !snapshot.exists()) return@addSnapshotListener

                val preventDeviceLock = snapshot.getBoolean("preventDeviceLock") ?: false
                val commands = snapshot.get("commands") as? Map<*, *> ?: emptyMap<String, Any>()
                val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)

                val lockCmd = commands["lockDevice"] as? Map<*, *>
                val blackoutCmd = commands["lockscreenBlackout"] as? Map<*, *>
                val isLockRequested = lockCmd?.get("value") == true
                val blackoutCfg = blackoutCmd?.get("value") as? Map<*, *>
                val requestedBlackoutEnabled = blackoutCfg?.get("enabled") as? Boolean ?: false
                val requestedBlackoutMessage = blackoutCfg?.get("message")?.toString()?.take(240) ?: ""
                val effectiveLockRequested = if (preventDeviceLock) false else isLockRequested
                val effectiveBlackoutEnabled = if (preventDeviceLock) false else requestedBlackoutEnabled
                val effectiveBlackoutMessage = if (effectiveBlackoutEnabled) requestedBlackoutMessage else ""

                val previousPreventFlag = prefs.getBoolean("preventDeviceLock", false)
                val previousLockActive = prefs.getBoolean("deviceLockActive", false)
                val previousBlackoutActive = prefs.getBoolean("blackoutActive", false)
                val previousBlackoutMessage = prefs.getString("blackoutMessage", "").orEmpty()
                val shouldPersistEffectiveState =
                    previousPreventFlag != preventDeviceLock ||
                        previousLockActive != effectiveLockRequested ||
                        previousBlackoutActive != effectiveBlackoutEnabled ||
                        previousBlackoutMessage != effectiveBlackoutMessage

                if (shouldPersistEffectiveState) {
                    prefs.edit()
                        .putBoolean("preventDeviceLock", preventDeviceLock)
                        .putBoolean("deviceLockActive", effectiveLockRequested)
                        .putBoolean("blackoutActive", effectiveBlackoutEnabled)
                        .putString("blackoutMessage", effectiveBlackoutMessage)
                        .apply()
                    broadcastLockStateChanged()
                    syncChildLockState(childId)
                }

                if (shouldHandleCommand(lockCmd, "lockDevice")) {

                    if (effectiveLockRequested) {
                        triggerSystemLockIfPossible()
                    }
                    if (effectiveLockRequested) {
                        bringLockOverlayToFront()
                    }
                    markCommandStatus(childId, "lockDevice", "EXECUTED")
                }
                lastLockRequested = effectiveLockRequested

                val screenshotCmd = commands["takeScreenshot"] as? Map<*, *>
                val screenshotRequested = screenshotCmd?.get("value") == true
                if (screenshotRequested && !lastScreenshotRequested) {
                    performCaptureAndUpload(childId)
                }
                lastScreenshotRequested = screenshotRequested

                val sirenCmd = commands["playSiren"] as? Map<*, *>
                val sirenRequested = sirenCmd?.get("value") == true
                if (sirenRequested && !lastSirenRequested) {
                    playEmergencySiren(childId)
                }
                lastSirenRequested = sirenRequested

                if (shouldHandleCommand(blackoutCmd, "lockscreenBlackout")) {
                    if (effectiveBlackoutEnabled) {
                        bringLockOverlayToFront()
                    }
                    markCommandStatus(childId, "lockscreenBlackout", "EXECUTED")
                }

                val videoCmd = commands["setVideoSource"] as? Map<*, *>
                if (shouldHandleCommand(videoCmd, "setVideoSource")) {
                    val source = videoCmd?.get("value")?.toString() ?: "screen"
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putString("preferredVideoSource", source)
                        .apply()
                    markCommandStatus(childId, "setVideoSource", "EXECUTED")
                }

                val audioCmd = commands["setAudioSource"] as? Map<*, *>
                if (shouldHandleCommand(audioCmd, "setAudioSource")) {
                    val source = audioCmd?.get("value")?.toString() ?: "mic"
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putString("preferredAudioSource", source)
                        .apply()
                    markCommandStatus(childId, "setAudioSource", "EXECUTED")
                }

                val startStreamCmd = commands["startLiveStream"] as? Map<*, *>
                val startStreamValue = startStreamCmd?.get("value")
                val shouldStartStream = when (startStreamValue) {
                    is Boolean -> startStreamValue
                    is Map<*, *> -> true
                    else -> false
                }
                if (shouldStartStream && shouldHandleCommand(startStreamCmd, "startLiveStream")) {
                    val cfg = startStreamCmd?.get("value") as? Map<*, *>
                    val requestedVideoSource = cfg?.get("videoSource")?.toString() ?: "screen"
                    val requestedAudioSource = cfg?.get("audioSource")?.toString() ?: "mic"
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putString("preferredVideoSource", requestedVideoSource)
                        .putString("preferredAudioSource", requestedAudioSource)
                        .apply()

                    val serviceIntent = ScreenCaptureSessionStore.buildServiceIntent(this, streamMode = true)
                    if (serviceIntent != null) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(serviceIntent)
                        else startService(serviceIntent)
                        markCommandStatus(childId, "startLiveStream", "EXECUTED", clearValue = true)
                    } else {
                        writeOperationalAlert(
                            platform = "Remote Command",
                            content = "Live stream requested but screen permission is missing. Open child app and enable visual protection to grant capture permission.",
                            severity = "MEDIUM"
                        )
                        markCommandStatus(childId, "startLiveStream", "REQUESTED", clearValue = true)
                    }
                }

                val stopStreamCmd = commands["stopLiveStream"] as? Map<*, *>
                val shouldStopStream = stopStreamCmd?.get("value") == true
                if (shouldStopStream && shouldHandleCommand(stopStreamCmd, "stopLiveStream")) {
                    stopService(Intent(this, ScreenGuardianService::class.java))
                    markCommandStatus(childId, "stopLiveStream", "EXECUTED", clearValue = true)
                }

                val walkieCmd = commands["walkieTalkieEnable"] as? Map<*, *>
                if (shouldHandleCommand(walkieCmd, "walkieTalkieEnable")) {
                    val cfg = walkieCmd?.get("value") as? Map<*, *>
                    val enabled = cfg?.get("enabled") as? Boolean ?: false
                    val source = cfg?.get("source")?.toString() ?: "mic"
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putBoolean("walkieEnabled", enabled)
                        .putString("walkieSource", source)
                        .apply()
                    markCommandStatus(childId, "walkieTalkieEnable", "EXECUTED")
                }

                val pttCmd = commands["pushToTalk"] as? Map<*, *>
                if (shouldHandleCommand(pttCmd, "pushToTalk")) {
                    val cfg = pttCmd?.get("value") as? Map<*, *>
                    val active = cfg?.get("active") as? Boolean ?: false
                    if (active) playShortBeep()
                    val audioData = cfg?.get("audioData")?.toString()
                    val mimeType = cfg?.get("mimeType")?.toString() ?: "audio/webm"
                    if (!audioData.isNullOrBlank() && audioData.startsWith("data:")) {
                        try {
                            playIncomingVoiceNote(audioData, mimeType)
                        } catch (e: Exception) {
                            Log.w("AmanahRemoteService", "Voice note playback failed: ${e.message}")
                            writeOperationalAlert(
                                platform = "Walkie",
                                content = "Incoming voice note received but could not be played on this device.",
                                severity = "LOW"
                            )
                        }
                    }
                    markCommandStatus(childId, "pushToTalk", "EXECUTED")
                }

                val blockAppCmd = commands["blockApp"] as? Map<*, *>
                if (shouldHandleCommand(blockAppCmd, "blockApp")) {
                    val outcome = handleBlockAppCommand(blockAppCmd?.get("value"))
                    if (outcome.applied) {
                        val actionText = if (outcome.blocked) "enabled" else "disabled"
                        val scopeText = if (outcome.scope == "app") "full app block" else "partial isolation (${outcome.scope})"
                        writeOperationalAlert(
                            platform = "App Shield",
                            content = "Parent command $actionText for $scopeText on ${outcome.targetCount} target(s).",
                            severity = "LOW"
                        )
                        markCommandStatus(childId, "blockApp", "EXECUTED")
                    } else {
                        writeOperationalAlert(
                            platform = "Remote Command",
                            content = "blockApp command received but no valid package/scope target could be resolved.",
                            severity = "LOW"
                        )
                        markCommandStatus(childId, "blockApp", "FAILED")
                    }
                }

                val cutInternetCmd = commands["cutInternet"] as? Map<*, *>
                if (shouldHandleCommand(cutInternetCmd, "cutInternet")) {
                    val shouldCutInternet = cutInternetCmd?.get("value") == true
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putBoolean("internetCutRequested", shouldCutInternet)
                        .apply()
                    writeOperationalAlert(
                        platform = "Remote Command",
                        content = if (shouldCutInternet)
                            "Internet cut requested and acknowledged by child app."
                        else
                            "Internet cut policy cleared by parent command.",
                        severity = "MEDIUM"
                    )
                    markCommandStatus(childId, "cutInternet", "EXECUTED")
                }

                val dnsFilteringCmd = commands["dnsFiltering"] as? Map<*, *>
                if (shouldHandleCommand(dnsFilteringCmd, "dnsFiltering")) {
                    val cfg = dnsFilteringCmd?.get("value") as? Map<*, *>
                    val status = handleDnsFilteringCommand(cfg)
                    markCommandStatus(childId, "dnsFiltering", status)
                }

                val offlineUnlockCmd = commands["syncOfflineUnlockConfig"] as? Map<*, *>
                if (shouldHandleCommand(offlineUnlockCmd, "syncOfflineUnlockConfig")) {
                    val status = handleOfflineUnlockConfigCommand(offlineUnlockCmd?.get("value"))
                    markCommandStatus(childId, "syncOfflineUnlockConfig", status, clearValue = status == "EXECUTED")
                }

                val vulnerabilityScanCmd = commands["runVulnerabilityScan"] as? Map<*, *>
                if (shouldHandleCommand(vulnerabilityScanCmd, "runVulnerabilityScan")) {
                    val status = handleRunVulnerabilityScanCommand(vulnerabilityScanCmd?.get("value"))
                    markCommandStatus(childId, "runVulnerabilityScan", status, clearValue = status == "EXECUTED")
                }

                val visualThresholdCmd = commands["setVisualThresholds"] as? Map<*, *>
                if (shouldHandleCommand(visualThresholdCmd, "setVisualThresholds")) {
                    val status = handleVisualThresholdsCommand(visualThresholdCmd?.get("value"))
                    markCommandStatus(childId, "setVisualThresholds", status, clearValue = status == "EXECUTED")
                }

                val textThresholdCmd = commands["setTextRuleThresholds"] as? Map<*, *>
                if (shouldHandleCommand(textThresholdCmd, "setTextRuleThresholds")) {
                    val status = handleTextRuleThresholdsCommand(textThresholdCmd?.get("value"))
                    markCommandStatus(childId, "setTextRuleThresholds", status, clearValue = status == "EXECUTED")
                }

                val alertFilterCmd = commands["setAlertFilterPolicy"] as? Map<*, *>
                if (shouldHandleCommand(alertFilterCmd, "setAlertFilterPolicy")) {
                    val status = handleAlertFilterPolicyCommand(alertFilterCmd?.get("value"))
                    markCommandStatus(childId, "setAlertFilterPolicy", status, clearValue = status == "EXECUTED")
                }

                val blockCamMicCmd = commands["blockCameraAndMic"] as? Map<*, *>
                if (shouldHandleCommand(blockCamMicCmd, "blockCameraAndMic")) {
                    val shouldBlockCamMic = blockCamMicCmd?.get("value") == true
                    getSharedPreferences("AmanahPrefs", MODE_PRIVATE).edit()
                        .putBoolean("blockCameraAndMic", shouldBlockCamMic)
                        .apply()
                    writeOperationalAlert(
                        platform = "Remote Command",
                        content = if (shouldBlockCamMic)
                            "Camera/mic block policy flag applied on child app."
                        else
                            "Camera/mic block policy flag cleared on child app.",
                        severity = "LOW"
                    )
                    markCommandStatus(childId, "blockCameraAndMic", "EXECUTED")
                }

                val notifyParentCmd = commands["notifyParent"] as? Map<*, *>
                val shouldNotifyParent = notifyParentCmd?.get("value") == true
                if (shouldNotifyParent && shouldHandleCommand(notifyParentCmd, "notifyParent")) {
                    writeOperationalAlert(
                        platform = "Child Device",
                        content = "Child app acknowledged notifyParent command.",
                        severity = "LOW"
                    )
                    markCommandStatus(childId, "notifyParent", "EXECUTED", clearValue = true)
                }
            }
    }

    private fun runNetworkPulse() {
        ensureWifiAvailability()

        if (!hasValidatedInternetConnection()) {
            val now = System.currentTimeMillis()
            if (now - lastNetworkRecoveryAt >= NETWORK_RECOVERY_BACKOFF_MS) {
                lastNetworkRecoveryAt = now
                ensureAuthAndListen()
            }
            return
        }

        flushPendingOfflineUnlockState()

        if (auth.currentUser == null) {
            ensureAuthAndListen()
            return
        }

        startListeningIfPaired()
    }

    private fun ensureWifiAvailability() {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        if (prefs.getBoolean("internetCutRequested", false)) {
            return
        }

        val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager ?: return
        if (wifiManager.isWifiEnabled) {
            return
        }

        val now = System.currentTimeMillis()
        if (now - lastWifiEnableAttemptAt < WIFI_ENABLE_BACKOFF_MS) {
            return
        }
        lastWifiEnableAttemptAt = now

        try {
            @Suppress("DEPRECATION")
            val requestAccepted = wifiManager.setWifiEnabled(true)
            if (requestAccepted) {
                Log.i("AmanahRemoteService", "Wi-Fi enable request accepted.")
            } else {
                Log.w("AmanahRemoteService", "Wi-Fi enable request rejected by OS policy.")
            }
        } catch (se: SecurityException) {
            Log.w("AmanahRemoteService", "Wi-Fi enable blocked by permissions/policy: ${se.message}")
        } catch (e: Exception) {
            Log.w("AmanahRemoteService", "Wi-Fi enable attempt failed: ${e.message}")
        }
    }

    private fun hasValidatedInternetConnection(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val activeNetwork = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun flushPendingOfflineUnlockState() {
        if (offlineUnlockSyncInFlight) return
        if (!OfflineUnlockManager.hasPendingSync(this)) return

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val childId = prefs.getString("childDocumentId", null) ?: return
        val now = Timestamp.now()

        val updates = hashMapOf<String, Any>(
            "deviceLocked" to false,
            "commands.lockDevice.value" to false,
            "commands.lockDevice.status" to "OFFLINE_UNLOCKED",
            "commands.lockDevice.handledAt" to now,
            "commands.lockscreenBlackout.value" to mapOf(
                "enabled" to false,
                "message" to "",
                "source" to "offline_emergency_unlock"
            ),
            "commands.lockscreenBlackout.status" to "OFFLINE_UNLOCKED",
            "commands.lockscreenBlackout.handledAt" to now
        )

        offlineUnlockSyncInFlight = true
        db.collection("children").document(childId)
            .update(updates)
            .addOnSuccessListener {
                offlineUnlockSyncInFlight = false
                OfflineUnlockManager.markPendingSyncFlushed(this)
                writeOperationalAlert(
                    platform = "Offline Unlock",
                    content = "Offline emergency unlock state has been synchronized to cloud.",
                    severity = "LOW"
                )
            }
            .addOnFailureListener { e ->
                offlineUnlockSyncInFlight = false
                Log.w("AmanahRemoteService", "Pending offline unlock sync failed: ${e.message}")
            }
    }

    private fun handleDnsFilteringCommand(config: Map<*, *>?): String {
        if (config == null) return "FAILED"

        val enabled = config["enabled"] as? Boolean ?: false
        val mode = config["mode"]?.toString()?.lowercase(Locale.getDefault()) ?: "family"
        val domains = parseDnsDomains(config["domains"])

        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        prefs.edit()
            .putBoolean(DnsFilterVpnService.PREF_KEY_ENABLED, enabled)
            .putString(
                DnsFilterVpnService.PREF_KEY_MODE,
                when (mode) {
                    "strict" -> "strict"
                    "custom" -> "custom"
                    "sandbox" -> "sandbox"
                    else -> "family"
                }
            )
            .putStringSet(DnsFilterVpnService.PREF_KEY_DOMAINS, domains)
            .apply()

        if (!enabled) {
            stopDnsFilteringService()
            writeOperationalAlert(
                platform = "DNS Filter",
                content = "DNS-level filtering has been disabled by parent command.",
                severity = "LOW"
            )
            return "EXECUTED"
        }

        if (VpnService.prepare(this) == null) {
            startDnsFilteringService(DnsFilterVpnService.ACTION_APPLY_POLICY)
            writeOperationalAlert(
                platform = "DNS Filter",
                content = if (mode == "sandbox")
                    "DNS sandbox AI has been enabled (automatic domain decisions without waiting for parent approval)."
                else
                    "DNS-level filtering has been enabled and activated on child device.",
                severity = "LOW"
            )
            return "EXECUTED"
        }

        requestDnsVpnPermission()
        writeOperationalAlert(
            platform = "DNS Filter",
            content = "DNS filtering requested, but one-time VPN approval is required on child device.",
            severity = "MEDIUM"
        )
        return "REQUESTED"
    }

    private fun handleOfflineUnlockConfigCommand(rawConfig: Any?): String {
        val applied = OfflineUnlockManager.applyConfig(this, rawConfig)
        if (!applied) {
            writeOperationalAlert(
                platform = "Offline Unlock",
                content = "Offline unlock sync command failed due to invalid payload.",
                severity = "MEDIUM"
            )
            return "FAILED"
        }

        val remaining = OfflineUnlockManager.backupCodesRemaining(this)
        writeOperationalAlert(
            platform = "Offline Unlock",
            content = "Offline emergency unlock has been provisioned on child device (backup codes: $remaining).",
            severity = "LOW"
        )
        return "EXECUTED"
    }

    private fun handleRunVulnerabilityScanCommand(rawConfig: Any?): String {
        val shouldRun = when (rawConfig) {
            is Boolean -> rawConfig
            is Map<*, *> -> rawConfig["enabled"] as? Boolean ?: true
            null -> true
            else -> true
        }
        if (!shouldRun) return "EXECUTED"

        return try {
            val intent = Intent(this, VulnerabilityScannerService::class.java).apply {
                action = VulnerabilityScannerService.ACTION_SCAN_NOW
            }
            startService(intent)
            writeOperationalAlert(
                platform = "Vulnerability Scanner",
                content = "On-device vulnerability scan triggered by parent command.",
                severity = "LOW"
            )
            "EXECUTED"
        } catch (e: Exception) {
            Log.w("AmanahRemoteService", "Vulnerability scan trigger failed: ${e.message}")
            writeOperationalAlert(
                platform = "Vulnerability Scanner",
                content = "Failed to start on-device vulnerability scanner.",
                severity = "MEDIUM"
            )
            "FAILED"
        }
    }

    private fun handleVisualThresholdsCommand(rawConfig: Any?): String {
        return try {
            val applied = SecurityCortex.applyVisualThresholdOverrides(this, rawConfig)
            if (!applied) {
                writeOperationalAlert(
                    platform = "Visual Engine",
                    content = "Visual threshold command failed due to invalid payload format.",
                    severity = "MEDIUM"
                )
                "FAILED"
            } else {
                val resetMode = (rawConfig as? Map<*, *>)?.get("resetToDefault") == true
                writeOperationalAlert(
                    platform = "Visual Engine",
                    content = if (resetMode) {
                        "Visual model thresholds were reset to secure defaults."
                    } else {
                        "Visual model thresholds were updated and applied on child device."
                    },
                    severity = "LOW"
                )
                "EXECUTED"
            }
        } catch (e: Exception) {
            Log.w("AmanahRemoteService", "Visual threshold command failed: ${e.message}")
            writeOperationalAlert(
                platform = "Visual Engine",
                content = "Failed to apply visual threshold command on child device.",
                severity = "MEDIUM"
            )
            "FAILED"
        }
    }

    private fun handleTextRuleThresholdsCommand(rawConfig: Any?): String {
        return try {
            val applied = SecurityCortex.applyTextRuleThresholdOverrides(this, rawConfig)
            if (!applied) {
                writeOperationalAlert(
                    platform = "Text Rule Engine",
                    content = "Text rule-engine threshold command failed due to invalid payload format.",
                    severity = "MEDIUM"
                )
                "FAILED"
            } else {
                val resetMode = (rawConfig as? Map<*, *>)?.get("resetToDefault") == true
                writeOperationalAlert(
                    platform = "Text Rule Engine",
                    content = if (resetMode) {
                        "Text rule-engine thresholds were reset to secure defaults."
                    } else {
                        "Text rule-engine thresholds were updated and applied on child device."
                    },
                    severity = "LOW"
                )
                "EXECUTED"
            }
        } catch (e: Exception) {
            Log.w("AmanahRemoteService", "Text threshold command failed: ${e.message}")
            writeOperationalAlert(
                platform = "Text Rule Engine",
                content = "Failed to apply text threshold command on child device.",
                severity = "MEDIUM"
            )
            "FAILED"
        }
    }

    private fun handleAlertFilterPolicyCommand(rawConfig: Any?): String {
        return try {
            val applied = AlertFilterPolicyManager.applyConfig(this, rawConfig)
            if (!applied) {
                writeOperationalAlert(
                    platform = "Alert Filter Policy",
                    content = "Alert filter policy command failed due to invalid payload format.",
                    severity = "MEDIUM"
                )
                "FAILED"
            } else {
                val resetMode = (rawConfig as? Map<*, *>)?.get("resetToDefault") == true
                writeOperationalAlert(
                    platform = "Alert Filter Policy",
                    content = if (resetMode) {
                        "Alert filter policy was reset to secure defaults."
                    } else {
                        "Alert filter policy was updated and applied before alert dispatch."
                    },
                    severity = "LOW"
                )
                "EXECUTED"
            }
        } catch (e: Exception) {
            Log.w("AmanahRemoteService", "Alert filter policy command failed: ${e.message}")
            writeOperationalAlert(
                platform = "Alert Filter Policy",
                content = "Failed to apply alert filter policy command on child device.",
                severity = "MEDIUM"
            )
            "FAILED"
        }
    }

    private fun parseDnsDomains(raw: Any?): Set<String> {
        val tokens = when (raw) {
            is List<*> -> raw.mapNotNull { it?.toString() }
            is Array<*> -> raw.mapNotNull { it?.toString() }
            is String -> raw.split(',', '\n', ';').map { it.trim() }
            else -> emptyList()
        }

        return tokens.mapNotNull { token ->
            val normalized = token.trim()
                .lowercase(Locale.getDefault())
                .removePrefix("https://")
                .removePrefix("http://")
                .removePrefix("www.")
                .substringBefore('/')
                .removePrefix("*.")
                .trim('.')
            if (normalized.isBlank()) null
            else if (!normalized.matches(Regex("^[a-z0-9.-]+\$"))) null
            else normalized
        }.take(200).toSet()
    }

    private fun startDnsFilteringService(action: String) {
        val intent = Intent(this, DnsFilterVpnService::class.java).apply { this.action = action }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun stopDnsFilteringService() {
        try {
            val stopIntent = Intent(this, DnsFilterVpnService::class.java).apply {
                action = DnsFilterVpnService.ACTION_STOP_POLICY
            }
            startService(stopIntent)
        } catch (_: Exception) {
        }
        stopService(Intent(this, DnsFilterVpnService::class.java))
    }

    private fun requestDnsVpnPermission() {
        try {
            val intent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                putExtra("REQUEST_DNS_VPN_PERMISSION", true)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.w("AmanahRemoteService", "Failed to request DNS VPN permission UI: ${e.message}")
        }
    }

    private fun shouldHandleCommand(cmd: Map<*, *>?, key: String): Boolean {
        if (cmd == null) return false
        val ts = cmd["timestamp"]
        val value = when (ts) {
            is Timestamp -> ts.seconds * 1000L + (ts.nanoseconds / 1_000_000L)
            is Date -> ts.time
            is Number -> ts.toLong()
            else -> System.currentTimeMillis()
        }
        val prev = lastCommandTimestamps[key]
        if (prev != null && prev == value) return false
        lastCommandTimestamps[key] = value
        return true
    }

    private fun markCommandStatus(childId: String, command: String, status: String, clearValue: Boolean = false) {
        val updates = hashMapOf<String, Any>(
            "commands.$command.status" to status,
            "commands.$command.handledAt" to Timestamp.now()
        )
        if (clearValue) {
            updates["commands.$command.value"] = false
        }
        db.collection("children").document(childId).update(updates)
            .addOnFailureListener { e ->
                Log.w("AmanahRemoteService", "Failed to update status for $command: ${e.message}")
            }
    }

    private fun triggerSystemLockIfPossible() {
        // Intentionally no-op:
        // Using OS-level lockNow() makes remote unlock impossible.
        // Amanah lock should stay overlay/policy-based so parent unlock commands can always clear it.
        Log.i("AmanahRemoteService", "System lockNow() skipped by design; using overlay lock state only.")
    }

    private fun playEmergencySiren(childId: String) {
        markCommandStatus(childId, "playSiren", "EXECUTED", clearValue = true)
        try {
            val notification = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            val ringtone = RingtoneManager.getRingtone(applicationContext, notification)
            ringtone.play()
            Handler(Looper.getMainLooper()).postDelayed({
                if (ringtone.isPlaying) ringtone.stop()
            }, 5000)
        } catch (e: Exception) {
            Log.e("AmanahRemoteService", "Failed to play siren", e)
        }
    }

    private fun broadcastLockStateChanged() {
        try {
            sendBroadcast(Intent(ACTION_LOCK_STATE_CHANGED))
        } catch (e: Exception) {
            Log.w("AmanahRemoteService", "Lock-state broadcast failed: ${e.message}")
        }
    }

    private fun bringLockOverlayToFront() {
        broadcastLockStateChanged()
        // If accessibility service isn't active, launch MainActivity with FORCE_LOCK as fallback
        if (!isAccessibilityServiceEnabled()) {
            try {
                val intent = Intent(this, MainActivity::class.java).apply {
                    // singleTask + SINGLE_TOP ensures onNewIntent() is called, no recreation
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    putExtra("FORCE_LOCK", true)
                }
                startActivity(intent)
            } catch (e: Exception) {
                Log.w("AmanahRemoteService", "Failed to launch lock overlay activity: ${e.message}")
            }
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        return try {
            val enabledServices = Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: ""
            enabledServices.contains("com.amanah.child/.services.AmanahAccessibilityService")
        } catch (e: Exception) {
            false
        }
    }

    private fun syncChildLockState(childId: String) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val lockActive = prefs.getBoolean("deviceLockActive", false)
        val blackoutActive = prefs.getBoolean("blackoutActive", false)
        val isLocked = lockActive || blackoutActive
        db.collection("children").document(childId)
            .update("deviceLocked", isLocked)
            .addOnFailureListener { e ->
                Log.w("AmanahRemoteService", "Failed to sync deviceLocked flag: ${e.message}")
            }
    }

    private fun playShortBeep() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(applicationContext, uri)
            ringtone.play()
            Handler(Looper.getMainLooper()).postDelayed({
                if (ringtone.isPlaying) ringtone.stop()
            }, 1200)
        } catch (e: Exception) {
            Log.w("AmanahRemoteService", "Could not play short beep: ${e.message}")
        }
    }

    private fun playIncomingVoiceNote(dataUrl: String, mimeType: String) {
        val comma = dataUrl.indexOf(',')
        if (comma <= 0) throw IllegalArgumentException("Invalid data URL")
        val b64 = dataUrl.substring(comma + 1)
        val bytes = Base64.decode(b64, Base64.DEFAULT)

        val ext = when {
            mimeType.contains("webm") -> ".webm"
            mimeType.contains("ogg") -> ".ogg"
            mimeType.contains("wav") -> ".wav"
            else -> ".bin"
        }

        val outFile = File(cacheDir, "ptt_voice_note$ext")
        FileOutputStream(outFile).use { it.write(bytes) }

        val mp = MediaPlayer()
        mp.setDataSource(outFile.absolutePath)
        mp.setOnCompletionListener { player ->
            try {
                player.release()
            } catch (_: Exception) {
            }
        }
        mp.setOnErrorListener { player, _, _ ->
            try {
                player.release()
            } catch (_: Exception) {
            }
            true
        }
        mp.prepare()
        mp.start()
    }

    private fun performCaptureAndUpload(childId: String) {
        markCommandStatus(childId, "takeScreenshot", "EXECUTED", clearValue = true)

        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childName = prefs.getString("childName", "Child Device") ?: "Child Device"
        val latestFrame = ScreenGuardianService.peekLatestFrameData()

        val alert = hashMapOf<String, Any>(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to "System Screen",
            "content" to "Screenshot evidence requested by parent command.",
            "category" to "SAFE",
            "severity" to "LOW",
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "aiAnalysis" to if (latestFrame != null)
                "Remote command screenshot captured successfully."
            else
                "Screenshot requested but no current frame is available on the child device.",
            "actionTaken" to "takeScreenshot command executed."
        )
        if (latestFrame != null) {
            alert["imageData"] = latestFrame
        } else {
            alert["captureStatus"] = "NO_FRAME_AVAILABLE"
        }
        db.collection("alerts").add(alert)
            .addOnFailureListener { e -> Log.w("AmanahRemoteService", "Failed to upload screenshot alert: ${e.message}") }
    }

    private fun handleBlockAppCommand(rawValue: Any?): BlockAppCommandResult {
        val locale = Locale.getDefault()
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

        var blocked = false
        var appIdRaw = ""
        var appNameRaw = ""
        var scope = "app"
        var patterns = emptySet<String>()

        when (rawValue) {
            is Map<*, *> -> {
                blocked = when (val flag = rawValue["blocked"] ?: rawValue["isBlocked"]) {
                    is Boolean -> flag
                    is String -> flag.equals("true", ignoreCase = true)
                    else -> false
                }
                appIdRaw = rawValue["appId"]?.toString()?.trim()?.lowercase(locale) ?: ""
                appNameRaw = rawValue["appName"]?.toString()?.trim()?.lowercase(locale) ?: ""
                scope = normalizeBlockScope(rawValue["scope"]?.toString())
                patterns = parsePolicyPatterns(
                    rawValue["patterns"] ?: rawValue["keywords"] ?: rawValue["surfaceHints"]
                )
            }
            is Boolean -> {
                blocked = rawValue
                appIdRaw = prefs.getString("lastForegroundPackage", "")?.trim()?.lowercase(locale) ?: ""
            }
            is String -> {
                blocked = true
                appIdRaw = rawValue.trim().lowercase(locale)
            }
            else -> return BlockAppCommandResult(applied = false)
        }

        val tokens = resolveBlockedTokens(appIdRaw, appNameRaw)
        if (tokens.isEmpty()) {
            return BlockAppCommandResult(applied = false)
        }

        val blockedApps = prefs.getStringSet(PREF_BLOCKED_APPS, emptySet())?.toMutableSet() ?: mutableSetOf()
        val partialPolicies = prefs.getStringSet(PREF_PARTIAL_POLICIES, emptySet())?.toMutableSet() ?: mutableSetOf()

        if (scope == "app") {
            if (blocked) {
                blockedApps.addAll(tokens)
            } else {
                blockedApps.removeAll(tokens)
                removePartialPolicies(partialPolicies, tokens, null)
            }
        } else {
            upsertPartialPolicies(partialPolicies, tokens, scope, patterns, blocked)
        }

        prefs.edit()
            .putStringSet(PREF_BLOCKED_APPS, blockedApps)
            .putStringSet(PREF_PARTIAL_POLICIES, partialPolicies)
            .apply()

        return BlockAppCommandResult(
            applied = true,
            blocked = blocked,
            scope = scope,
            targetCount = tokens.size
        )
    }

    private fun normalizeBlockScope(rawScope: String?): String {
        val scope = rawScope?.trim()?.lowercase(Locale.getDefault()).orEmpty()
        return when (scope) {
            "", "app", "full", "global", "all" -> "app"
            "messaging", "chat", "messages", "dm", "direct_messages" -> "messaging"
            "private", "private_chat", "private_messages", "inbox" -> "private_chat"
            "rooms", "room", "groups", "group", "channels", "voice_rooms" -> "rooms"
            "comments", "comment", "replies", "reply" -> "comments"
            else -> "app"
        }
    }

    private fun parsePolicyPatterns(raw: Any?): Set<String> {
        val tokens = when (raw) {
            is List<*> -> raw.mapNotNull { it?.toString() }
            is Array<*> -> raw.mapNotNull { it?.toString() }
            is String -> raw.split(',', '\n', ';', '|')
            else -> emptyList()
        }
        return tokens.mapNotNull { token ->
            val normalized = token
                .trim()
                .lowercase(Locale.getDefault())
                .replace(PARTIAL_POLICY_DELIM, " ")
                .replace(PARTIAL_PATTERN_DELIM, " ")
                .replace(Regex("\\s+"), " ")
            if (normalized.length < 2 || normalized.length > 64) null else normalized
        }.take(24).toSet()
    }

    private fun upsertPartialPolicies(
        store: MutableSet<String>,
        tokens: Set<String>,
        scope: String,
        patterns: Set<String>,
        blocked: Boolean
    ) {
        removePartialPolicies(store, tokens, scope)
        if (!blocked) return
        for (token in tokens) {
            store.add(encodePartialPolicy(token, scope, patterns))
        }
    }

    private fun removePartialPolicies(
        store: MutableSet<String>,
        tokens: Set<String>,
        scope: String?
    ) {
        val normalizedTokens = tokens.map { it.lowercase(Locale.getDefault()) }.toSet()
        val iterator = store.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            val parsed = decodePartialPolicy(entry) ?: continue
            if (parsed.first !in normalizedTokens) continue
            if (scope == null || parsed.second == scope) {
                iterator.remove()
            }
        }
    }

    private fun encodePartialPolicy(token: String, scope: String, patterns: Set<String>): String {
        val normalizedPatterns = patterns
            .map { it.replace(PARTIAL_PATTERN_DELIM, " ").trim() }
            .filter { it.isNotBlank() }
        return listOf(
            token.lowercase(Locale.getDefault()),
            scope.lowercase(Locale.getDefault()),
            normalizedPatterns.joinToString(PARTIAL_PATTERN_DELIM)
        ).joinToString(PARTIAL_POLICY_DELIM)
    }

    private fun decodePartialPolicy(entry: String): Triple<String, String, Set<String>>? {
        val parts = entry.split(PARTIAL_POLICY_DELIM)
        if (parts.size < 2) return null
        val token = parts[0].trim().lowercase(Locale.getDefault())
        val scope = parts[1].trim().lowercase(Locale.getDefault())
        if (token.isBlank() || scope.isBlank()) return null
        val patterns = if (parts.size >= 3) {
            parts[2].split(PARTIAL_PATTERN_DELIM)
                .map { it.trim().lowercase(Locale.getDefault()) }
                .filter { it.isNotBlank() }
                .toSet()
        } else {
            emptySet()
        }
        return Triple(token, scope, patterns)
    }

    private fun resolveBlockedTokens(appIdRaw: String, appNameRaw: String): Set<String> {
        val aliases = mapOf(
            "tiktok" to "com.zhiliaoapp.musically",
            "tik tok" to "com.zhiliaoapp.musically",
            "instagram" to "com.instagram.android",
            "youtube" to "com.google.android.youtube",
            "whatsapp" to "com.whatsapp",
            "telegram" to "org.telegram.messenger",
            "discord" to "com.discord",
            "snapchat" to "com.snapchat.android",
            "facebook" to "com.facebook.katana",
            "roblox" to "com.roblox.client"
        )
        val tokens = mutableSetOf<String>()
        if (appIdRaw.isNotBlank()) tokens.add(appIdRaw)
        if (appNameRaw.isNotBlank()) tokens.add(appNameRaw)
        aliases[appIdRaw]?.let { tokens.add(it) }
        aliases[appNameRaw]?.let { tokens.add(it) }
        resolvePackageFromInstalledApps(appNameRaw)?.let { tokens.add(it) }
        if (!appIdRaw.contains('.')) {
            resolvePackageFromInstalledApps(appIdRaw)?.let { tokens.add(it) }
        }
        return tokens.map { it.trim().lowercase(Locale.getDefault()) }
            .filter { it.isNotBlank() }
            .toSet()
    }

    private fun resolvePackageFromInstalledApps(rawName: String): String? {
        val normalized = rawName.trim().lowercase(Locale.getDefault())
        if (normalized.isBlank()) return null
        if (normalized.contains('.')) return normalized
        return try {
            packageManager.getInstalledApplications(0)
                .firstOrNull { app ->
                    val label = try {
                        packageManager.getApplicationLabel(app)
                            .toString()
                            .trim()
                            .lowercase(Locale.getDefault())
                    } catch (_: Exception) {
                        ""
                    }
                    label == normalized || label.contains(normalized)
                }
                ?.packageName
                ?.lowercase(Locale.getDefault())
        } catch (_: Exception) {
            null
        }
    }

    private fun writeOperationalAlert(platform: String, content: String, severity: String) {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childId = prefs.getString("childDocumentId", null)
        val childName = prefs.getString("childName", "Child Device")

        val alert = hashMapOf(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to platform,
            "content" to content,
            "category" to "TAMPER",
            "severity" to severity,
            "timestamp" to Timestamp.now(),
            "status" to "NEW",
            "aiAnalysis" to "Remote command acknowledged by child service."
        )
        db.collection("alerts").add(alert)
            .addOnFailureListener { e ->
                Log.w("AmanahRemoteService", "Operational alert upload failed: ${e.message}")
            }
    }
}

