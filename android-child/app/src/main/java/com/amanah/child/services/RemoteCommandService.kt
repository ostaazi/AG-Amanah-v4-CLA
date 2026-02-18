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
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Base64
import android.util.Log
import com.amanah.child.services.ScreenCaptureSessionStore
import androidx.core.app.NotificationCompat
import com.amanah.child.MainActivity
import com.amanah.child.R
import com.amanah.child.receivers.AmanahAdminReceiver
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
    }

    private val db by lazy { FirebaseFirestore.getInstance() }
    private val auth by lazy { FirebaseAuth.getInstance() }
    private var commandListener: ListenerRegistration? = null
    private val lastCommandTimestamps = mutableMapOf<String, Long>()
    private var lastLockRequested = false
    private var lastScreenshotRequested = false
    private var lastSirenRequested = false

    override fun onCreate() {
        super.onCreate()
        startAsForeground()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureAuthAndListen()
        return START_STICKY
    }

    override fun onDestroy() {
        commandListener?.remove()
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
        if (auth.currentUser != null) {
            startListeningIfPaired()
            return
        }

        auth.signInAnonymously()
            .addOnSuccessListener { startListeningIfPaired() }
            .addOnFailureListener { e ->
                Log.e("AmanahRemoteService", "Anonymous auth failed: ${e.message}")
            }
    }

    private fun startListeningIfPaired() {
        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val childId = prefs.getString("childDocumentId", null)
        if (childId.isNullOrBlank()) {
            Log.d("AmanahRemoteService", "No paired child id found, service is idle")
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
        commandListener = db.collection("children").document(childId)
            .addSnapshotListener { snapshot, e ->
                if (e != null) {
                    Log.e("AmanahRemoteService", "Listener error: ${e.message}")
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
                    val cfg = blockAppCmd?.get("value") as? Map<*, *>
                    val applied = handleBlockAppCommand(cfg)
                    if (applied) {
                        markCommandStatus(childId, "blockApp", "EXECUTED")
                    } else {
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
        // Do not open MainActivity while locking.
        // The accessibility overlay is the only lock surface so the child app UI never appears.
        broadcastLockStateChanged()
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

    private fun handleBlockAppCommand(config: Map<*, *>?): Boolean {
        if (config == null) return false
        val blocked = when (val flag = config["blocked"] ?: config["isBlocked"]) {
            is Boolean -> flag
            is String -> flag.equals("true", ignoreCase = true)
            else -> false
        }
        val appIdRaw = config["appId"]?.toString()?.trim()?.lowercase(Locale.getDefault()) ?: ""
        val appNameRaw = config["appName"]?.toString()?.trim()?.lowercase(Locale.getDefault()) ?: ""
        val packageAliases = mapOf(
            "tiktok" to "com.zhiliaoapp.musically",
            "discord" to "com.discord",
            "instagram" to "com.instagram.android",
            "snapchat" to "com.snapchat.android",
            "telegram" to "org.telegram.messenger",
            "youtube" to "com.google.android.youtube",
            "whatsapp" to "com.whatsapp",
            "facebook" to "com.facebook.katana",
            "roblox" to "com.roblox.client"
        )
        val token = when {
            appIdRaw.contains(".") -> appIdRaw
            appNameRaw.isNotEmpty() && packageAliases.containsKey(appNameRaw) -> packageAliases[appNameRaw].orEmpty()
            appNameRaw.isNotEmpty() -> appNameRaw
            else -> appIdRaw
        }
        if (token.isEmpty()) return false

        val prefs = getSharedPreferences("AmanahPrefs", MODE_PRIVATE)
        val currentSet = prefs.getStringSet("blockedApps", emptySet())?.toMutableSet() ?: mutableSetOf()
        if (blocked) currentSet.add(token) else currentSet.remove(token)
        prefs.edit().putStringSet("blockedApps", currentSet).apply()
        return true
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
