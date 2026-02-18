package com.amanah.child.services

import android.app.ActivityManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.IBinder
import android.os.StatFs
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import com.amanah.child.receivers.AmanahAdminReceiver
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * DeviceHealthReporterService
 * ============================
 * Periodically reports device health metrics to Firestore:
 * - Battery level and charging state
 * - Storage usage
 * - Memory usage
 * - Network connectivity
 * - Permission status
 * - Service running status
 * - Device info
 *
 * This data is consumed by the web console's systemHealthService.ts
 */
class DeviceHealthReporterService : Service() {

    companion object {
        private const val TAG = "HealthReporter"
        private const val HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000L // 5 minutes
        private const val HEALTH_COLLECTION = "deviceHealth"
        private const val HISTORY_SUBCOLLECTION = "history"
    }

    private val scope = CoroutineScope(Dispatchers.IO)
    private val db = FirebaseFirestore.getInstance()

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "DeviceHealthReporterService started")
        startReporting()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        Log.i(TAG, "DeviceHealthReporterService destroyed")
        super.onDestroy()
    }

    // ─── Reporting Loop ─────────────────────────────────────────────────────

    private fun startReporting() {
        scope.launch {
            while (isActive) {
                try {
                    reportHealth()
                } catch (e: Exception) {
                    Log.e(TAG, "Error reporting health", e)
                }
                delay(HEARTBEAT_INTERVAL_MS)
            }
        }
    }

    private fun reportHealth() {
        val prefs = getSharedPreferences("amanah_prefs", MODE_PRIVATE)
        val childId = prefs.getString("child_id", null) ?: return
        val parentId = prefs.getString("parent_id", null) ?: return

        val healthData = collectHealthData(childId, parentId)

        // Write to main health document
        db.collection(HEALTH_COLLECTION).document(childId)
            .set(healthData)
            .addOnSuccessListener {
                Log.d(TAG, "Health snapshot reported")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to report health", e)
            }

        // Write to history subcollection for trend tracking
        db.collection(HEALTH_COLLECTION).document(childId)
            .collection(HISTORY_SUBCOLLECTION)
            .add(hashMapOf(
                "timestamp" to Timestamp.now(),
                "batteryLevel" to healthData["batteryLevel"],
                "networkType" to healthData["networkType"],
                "storageUsedMB" to healthData["storageUsedMB"],
                "storageTotalMB" to healthData["storageTotalMB"],
                "score" to calculateScore(healthData)
            ))
    }

    // ─── Data Collection ────────────────────────────────────────────────────

    private fun collectHealthData(childId: String, parentId: String): HashMap<String, Any?> {
        return hashMapOf(
            "childId" to childId,
            "parentId" to parentId,
            "childName" to getSharedPreferences("amanah_prefs", MODE_PRIVATE)
                .getString("child_name", ""),

            // Battery
            "batteryLevel" to getBatteryLevel(),
            "batteryCharging" to isBatteryCharging(),

            // Storage
            "storageUsedMB" to getStorageUsedMB(),
            "storageTotalMB" to getStorageTotalMB(),

            // Memory
            "memoryUsedMB" to getMemoryUsedMB(),
            "memoryTotalMB" to getMemoryTotalMB(),

            // Network
            "networkType" to getNetworkType(),
            "networkStrength" to getNetworkStrength(),

            // Uptime
            "uptimeMinutes" to (SystemClock.elapsedRealtime() / 60_000),

            // Timestamps
            "lastHeartbeat" to Timestamp.now(),
            "reportedAt" to Timestamp.now(),

            // Permissions
            "permissionsGranted" to getPermissionStatuses(),

            // Service status
            "isAccessibilityEnabled" to isAccessibilityEnabled(),
            "isDeviceAdminEnabled" to isDeviceAdminEnabled(),
            "isRemoteServiceRunning" to true, // This service is running

            // Device info
            "appVersion" to getAppVersion(),
            "osVersion" to "Android ${Build.VERSION.RELEASE}",
            "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL}"
        )
    }

    // ─── Battery ────────────────────────────────────────────────────────────

    private fun getBatteryLevel(): Int {
        val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        return if (level >= 0 && scale > 0) (level * 100 / scale) else 0
    }

    private fun isBatteryCharging(): Boolean {
        val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        return status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL
    }

    // ─── Storage ────────────────────────────────────────────────────────────

    private fun getStorageUsedMB(): Long {
        val stat = StatFs(Environment.getDataDirectory().path)
        val totalBytes = stat.blockSizeLong * stat.blockCountLong
        val availBytes = stat.blockSizeLong * stat.availableBlocksLong
        return (totalBytes - availBytes) / (1024 * 1024)
    }

    private fun getStorageTotalMB(): Long {
        val stat = StatFs(Environment.getDataDirectory().path)
        return (stat.blockSizeLong * stat.blockCountLong) / (1024 * 1024)
    }

    // ─── Memory ─────────────────────────────────────────────────────────────

    private fun getMemoryUsedMB(): Long {
        val activityManager = getSystemService(ACTIVITY_SERVICE) as? ActivityManager ?: return 0
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)
        return (memInfo.totalMem - memInfo.availMem) / (1024 * 1024)
    }

    private fun getMemoryTotalMB(): Long {
        val activityManager = getSystemService(ACTIVITY_SERVICE) as? ActivityManager ?: return 0
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)
        return memInfo.totalMem / (1024 * 1024)
    }

    // ─── Network ────────────────────────────────────────────────────────────

    private fun getNetworkType(): String {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return "unknown"
        val network = cm.activeNetwork ?: return "none"
        val capabilities = cm.getNetworkCapabilities(network) ?: return "none"
        return when {
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "mobile"
            else -> "unknown"
        }
    }

    private fun getNetworkStrength(): Int {
        // Simplified: return based on network type
        return when (getNetworkType()) {
            "wifi" -> 80
            "mobile" -> 60
            "none" -> 0
            else -> 30
        }
    }

    // ─── Permissions ────────────────────────────────────────────────────────

    private fun getPermissionStatuses(): List<HashMap<String, Any>> {
        val requiredPermissions = listOf(
            "android.permission.ACCESS_FINE_LOCATION" to "Location",
            "android.permission.CAMERA" to "Camera",
            "android.permission.RECORD_AUDIO" to "Microphone",
            "android.permission.READ_PHONE_STATE" to "Phone State",
            "android.permission.POST_NOTIFICATIONS" to "Notifications"
        )

        return requiredPermissions.map { (permission, name) ->
            hashMapOf(
                "name" to name,
                "granted" to (checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED),
                "required" to true
            )
        }
    }

    // ─── Service Status ─────────────────────────────────────────────────────

    private fun isAccessibilityEnabled(): Boolean {
        val serviceName = "${packageName}/${AmanahAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabledServices.contains(serviceName, ignoreCase = true)
    }

    private fun isDeviceAdminEnabled(): Boolean {
        val dpm = getSystemService(DEVICE_POLICY_SERVICE) as? DevicePolicyManager ?: return false
        val adminComponent = ComponentName(this, AmanahAdminReceiver::class.java)
        return dpm.isAdminActive(adminComponent)
    }

    // ─── App Info ───────────────────────────────────────────────────────────

    private fun getAppVersion(): String {
        return try {
            val pInfo = packageManager.getPackageInfo(packageName, 0)
            pInfo.versionName ?: "unknown"
        } catch (_: Exception) {
            "unknown"
        }
    }

    // ─── Scoring ────────────────────────────────────────────────────────────

    private fun calculateScore(data: HashMap<String, Any?>): Int {
        var score = 0
        val battery = (data["batteryLevel"] as? Int) ?: 0
        score += if (battery > 20) 20 else battery

        val networkType = (data["networkType"] as? String) ?: "none"
        score += when (networkType) {
            "wifi" -> 20
            "mobile" -> 15
            else -> 0
        }

        val accessibility = (data["isAccessibilityEnabled"] as? Boolean) ?: false
        val admin = (data["isDeviceAdminEnabled"] as? Boolean) ?: false
        if (accessibility) score += 30
        if (admin) score += 15

        val storageMB = (data["storageUsedMB"] as? Long) ?: 0L
        val totalMB = (data["storageTotalMB"] as? Long) ?: 1L
        val storagePercent = if (totalMB > 0) (storageMB * 100 / totalMB) else 0
        score += if (storagePercent < 90) 15 else 5

        return score.coerceIn(0, 100)
    }
}
