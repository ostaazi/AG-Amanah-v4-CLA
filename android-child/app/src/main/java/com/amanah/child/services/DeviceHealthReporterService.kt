package com.amanah.child.services

import android.Manifest
import android.app.ActivityManager
import android.app.Service
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.IBinder
import android.os.StatFs
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import com.amanah.child.receivers.AmanahAdminReceiver
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

class DeviceHealthReporterService : Service() {

    companion object {
        private const val TAG = "HealthReporter"
        private const val HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000L
        private const val PREFS_NAME = "AmanahPrefs"
        private const val HEALTH_COLLECTION = "deviceHealth"
        private const val HISTORY_SUBCOLLECTION = "history"
        private const val CHILDREN_COLLECTION = "children"
        private const val WIFI_RSSI_UNKNOWN = -127
    }

    private data class BatterySnapshot(
        val level: Int,
        val charging: Boolean
    )

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
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val childId = prefs.getString("childDocumentId", null)
        val parentId = prefs.getString("parentId", null)
        if (childId.isNullOrBlank() || parentId.isNullOrBlank()) {
            Log.d(TAG, "Skipping health report: pairing data is missing.")
            return
        }

        val healthData = collectHealthData(childId, parentId, prefs)

        db.collection(HEALTH_COLLECTION).document(childId)
            .set(healthData)
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to report health snapshot", e)
            }

        db.collection(HEALTH_COLLECTION).document(childId)
            .collection(HISTORY_SUBCOLLECTION)
            .add(
                hashMapOf(
                    "childId" to childId,
                    "parentId" to parentId,
                    "timestamp" to Timestamp.now(),
                    "batteryLevel" to healthData["batteryLevel"],
                    "networkType" to healthData["networkType"],
                    "networkStrength" to healthData["networkStrength"],
                    "storageUsedMB" to healthData["storageUsedMB"],
                    "storageTotalMB" to healthData["storageTotalMB"],
                    "locationAvailable" to healthData.containsKey("location"),
                    "score" to calculateScore(healthData)
                )
            )
            .addOnFailureListener { e ->
                Log.w(TAG, "Failed to append health history: ${e.message}")
            }

        syncChildLiveState(childId, healthData)
    }

    private fun collectHealthData(
        childId: String,
        parentId: String,
        prefs: SharedPreferences
    ): HashMap<String, Any?> {
        val now = Timestamp.now()
        val battery = getBatterySnapshot()
        val networkType = getNetworkType()
        val networkStrength = getNetworkStrength(networkType)
        val locationSnapshot = getLocationSnapshot()
        val accessibilityEnabled = isAccessibilityEnabled()
        val deviceAdminEnabled = isDeviceAdminEnabled()
        val cameraPermissionGranted = isPermissionGranted(Manifest.permission.CAMERA)
        val microphonePermissionGranted = isPermissionGranted(Manifest.permission.RECORD_AUDIO)
        val screenCaptureReady = ScreenCaptureSessionStore.hasSession()
        val controlReadiness = hashMapOf<String, Any?>(
            "accessibilityEnabled" to accessibilityEnabled,
            "deviceAdminEnabled" to deviceAdminEnabled,
            "remoteServiceRunning" to true,
            "cameraPermissionGranted" to cameraPermissionGranted,
            "microphonePermissionGranted" to microphonePermissionGranted,
            "screenCaptureReady" to screenCaptureReady,
            "appControlReady" to accessibilityEnabled,
            "liveCameraReady" to cameraPermissionGranted,
            "liveMicrophoneReady" to microphonePermissionGranted,
            "updatedAt" to now
        )

        val payload = hashMapOf<String, Any?>(
            "childId" to childId,
            "parentId" to parentId,
            "childName" to prefs.getString("childName", ""),
            "batteryLevel" to battery.level,
            "batteryCharging" to battery.charging,
            "storageUsedMB" to getStorageUsedMB(),
            "storageTotalMB" to getStorageTotalMB(),
            "memoryUsedMB" to getMemoryUsedMB(),
            "memoryTotalMB" to getMemoryTotalMB(),
            "networkType" to networkType,
            "networkStrength" to networkStrength,
            "uptimeMinutes" to (SystemClock.elapsedRealtime() / 60_000),
            "lastHeartbeat" to now,
            "reportedAt" to now,
            "permissionsGranted" to getPermissionStatuses(),
            "isAccessibilityEnabled" to accessibilityEnabled,
            "isDeviceAdminEnabled" to deviceAdminEnabled,
            "isRemoteServiceRunning" to true,
            "appVersion" to getAppVersion(),
            "osVersion" to "Android ${Build.VERSION.RELEASE}",
            "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL}",
            "locationPermissionGranted" to hasLocationPermission(),
            "cameraPermissionGranted" to cameraPermissionGranted,
            "microphonePermissionGranted" to microphonePermissionGranted,
            "screenCaptureReady" to screenCaptureReady,
            "controlReadiness" to controlReadiness
        )

        if (locationSnapshot != null) {
            payload["location"] = locationSnapshot
        }
        return payload
    }

    private fun getBatterySnapshot(): BatterySnapshot {
        val batteryIntent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val computedLevel = if (level >= 0 && scale > 0) (level * 100 / scale) else 0
        val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
            status == BatteryManager.BATTERY_STATUS_FULL
        return BatterySnapshot(computedLevel.coerceIn(0, 100), charging)
    }

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

    private fun getNetworkStrength(networkType: String): Int {
        if (networkType == "wifi") {
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val info = wifiManager?.connectionInfo
            val rssi = info?.rssi ?: WIFI_RSSI_UNKNOWN
            if (rssi != WIFI_RSSI_UNKNOWN) {
                @Suppress("DEPRECATION")
                return WifiManager.calculateSignalLevel(rssi, 101).coerceIn(0, 100)
            }
            return 75
        }
        if (networkType == "mobile") {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val active = cm?.activeNetwork ?: return 55
            val capabilities = cm.getNetworkCapabilities(active) ?: return 55
            val downKbps = capabilities.linkDownstreamBandwidthKbps
            return when {
                downKbps >= 50_000 -> 85
                downKbps >= 20_000 -> 70
                downKbps >= 5_000 -> 55
                downKbps > 0 -> 35
                else -> 50
            }
        }
        return if (networkType == "none") 0 else 30
    }

    private fun getLocationSnapshot(): HashMap<String, Any?>? {
        if (!hasLocationPermission()) return null
        val locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return null

        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        )
        var latestLocation: Location? = null

        for (provider in providers) {
            val candidate = try {
                locationManager.getLastKnownLocation(provider)
            } catch (_: SecurityException) {
                null
            } catch (_: Exception) {
                null
            }
            if (candidate != null && (latestLocation == null || candidate.time > latestLocation.time)) {
                latestLocation = candidate
            }
        }

        val best = latestLocation ?: return null
        val fixTimestampMs = if (best.time > 0L) best.time else System.currentTimeMillis()
        val lat = roundCoordinate(best.latitude)
        val lng = roundCoordinate(best.longitude)
        val address = resolveAddress(lat, lng)

        return hashMapOf(
            "lat" to lat,
            "lng" to lng,
            "address" to address,
            "provider" to (best.provider ?: "unknown"),
            "accuracyM" to best.accuracy.toDouble(),
            "fixAgeSec" to ((System.currentTimeMillis() - fixTimestampMs).coerceAtLeast(0L) / 1000L),
            "lastUpdated" to Timestamp(Date(fixTimestampMs))
        )
    }

    @Suppress("DEPRECATION")
    private fun resolveAddress(lat: Double, lng: Double): String {
        if (!Geocoder.isPresent()) return formatLatLng(lat, lng)
        return try {
            val geocoder = Geocoder(this, Locale.getDefault())
            val first = geocoder.getFromLocation(lat, lng, 1)?.firstOrNull()
            val pieces = listOfNotNull(
                first?.subLocality,
                first?.locality,
                first?.adminArea,
                first?.countryName
            ).map { it.trim() }
                .filter { it.isNotBlank() }
                .distinct()

            if (pieces.isNotEmpty()) pieces.joinToString(", ") else formatLatLng(lat, lng)
        } catch (_: Exception) {
            formatLatLng(lat, lng)
        }
    }

    private fun formatLatLng(lat: Double, lng: Double): String {
        return String.format(Locale.US, "%.5f, %.5f", lat, lng)
    }

    private fun roundCoordinate(value: Double): Double {
        return (value * 1_000_000.0).roundToInt() / 1_000_000.0
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun isPermissionGranted(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }

    private fun getPermissionStatuses(): List<HashMap<String, Any>> {
        val requiredPermissions = listOf(
            Manifest.permission.ACCESS_FINE_LOCATION to "Location (Fine)",
            Manifest.permission.ACCESS_COARSE_LOCATION to "Location (Coarse)",
            Manifest.permission.ACCESS_BACKGROUND_LOCATION to "Location (Background)",
            Manifest.permission.CAMERA to "Camera",
            Manifest.permission.RECORD_AUDIO to "Microphone",
            Manifest.permission.POST_NOTIFICATIONS to "Notifications"
        )

        return requiredPermissions.map { (permission, name) ->
            hashMapOf(
                "name" to name,
                "granted" to (
                    ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
                    ),
                "required" to true
            )
        }
    }

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

    private fun getAppVersion(): String {
        return try {
            val pInfo = packageManager.getPackageInfo(packageName, 0)
            pInfo.versionName ?: "unknown"
        } catch (_: Exception) {
            "unknown"
        }
    }

    private fun syncChildLiveState(childId: String, healthData: HashMap<String, Any?>) {
        val strength = (healthData["networkStrength"] as? Int) ?: 0
        val updates = hashMapOf<String, Any>(
            "batteryLevel" to ((healthData["batteryLevel"] as? Int) ?: 0),
            "signalStrength" to toSignalBars(strength),
            "status" to if ((healthData["networkType"] as? String) == "none") "offline" else "online",
            "lastSeenAt" to Timestamp.now(),
            "controlReadiness" to (
                (healthData["controlReadiness"] as? Map<*, *>)?.let { readiness ->
                    hashMapOf(
                        "accessibilityEnabled" to ((readiness["accessibilityEnabled"] as? Boolean) ?: false),
                        "deviceAdminEnabled" to ((readiness["deviceAdminEnabled"] as? Boolean) ?: false),
                        "remoteServiceRunning" to ((readiness["remoteServiceRunning"] as? Boolean) ?: false),
                        "cameraPermissionGranted" to ((readiness["cameraPermissionGranted"] as? Boolean) ?: false),
                        "microphonePermissionGranted" to ((readiness["microphonePermissionGranted"] as? Boolean) ?: false),
                        "screenCaptureReady" to ((readiness["screenCaptureReady"] as? Boolean) ?: false),
                        "appControlReady" to ((readiness["appControlReady"] as? Boolean) ?: false),
                        "liveCameraReady" to ((readiness["liveCameraReady"] as? Boolean) ?: false),
                        "liveMicrophoneReady" to ((readiness["liveMicrophoneReady"] as? Boolean) ?: false),
                        "updatedAt" to Timestamp.now()
                    )
                } ?: hashMapOf(
                    "accessibilityEnabled" to false,
                    "deviceAdminEnabled" to false,
                    "remoteServiceRunning" to true,
                    "cameraPermissionGranted" to false,
                    "microphonePermissionGranted" to false,
                    "screenCaptureReady" to false,
                    "appControlReady" to false,
                    "liveCameraReady" to false,
                    "liveMicrophoneReady" to false,
                    "updatedAt" to Timestamp.now()
                )
            )
        )

        val location = healthData["location"]
        if (location is Map<*, *>) {
            updates["location"] = location
        }

        db.collection(CHILDREN_COLLECTION).document(childId)
            .update(updates)
            .addOnFailureListener { e ->
                Log.w(TAG, "Failed to sync child live state: ${e.message}")
            }
    }

    private fun toSignalBars(networkStrength: Int): Int {
        return when {
            networkStrength >= 75 -> 4
            networkStrength >= 50 -> 3
            networkStrength >= 25 -> 2
            networkStrength > 0 -> 1
            else -> 0
        }
    }

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
