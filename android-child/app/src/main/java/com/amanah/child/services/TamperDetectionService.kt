package com.amanah.child.services

import android.app.Service
import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import com.amanah.child.receivers.AmanahAdminReceiver
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * TamperDetectionService
 * =======================
 * Monitors the child device for tamper attempts:
 * - App uninstall attempts
 * - Accessibility service disabled
 * - Device admin deactivation
 * - Time/date manipulation
 * - Developer options enabled
 * - USB debugging enabled
 * - Mock locations enabled
 *
 * Alerts parent immediately on any detection.
 */
class TamperDetectionService : Service() {

    companion object {
        private const val TAG = "TamperDetection"
        private const val CHECK_INTERVAL_MS = 30_000L // 30 seconds
        private const val TAMPER_ALERTS_COLLECTION = "tamperAlerts"
    }

    private val scope = CoroutineScope(Dispatchers.IO)
    private val db = FirebaseFirestore.getInstance()
    private var uninstallReceiver: BroadcastReceiver? = null
    private var lastKnownTimeMs: Long = 0L
    private var previousAccessibilityState: Boolean? = null

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "TamperDetectionService started")
        registerUninstallWatcher()
        startPeriodicChecks()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        unregisterUninstallWatcher()
        Log.i(TAG, "TamperDetectionService destroyed")
        super.onDestroy()
    }

    // ─── Uninstall Detection ────────────────────────────────────────────────

    private fun registerUninstallWatcher() {
        uninstallReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                val packageName = intent?.data?.schemeSpecificPart
                if (packageName == applicationContext.packageName) {
                    Log.w(TAG, "⚠️ Uninstall attempt detected!")
                    reportTamper("UNINSTALL_ATTEMPT", "محاولة حذف تطبيق Amanah", "Amanah app uninstall attempted")
                }
            }
        }
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_REMOVED)
            addAction(Intent.ACTION_PACKAGE_FULLY_REMOVED)
            addDataScheme("package")
        }
        registerReceiver(uninstallReceiver, filter)
    }

    private fun unregisterUninstallWatcher() {
        uninstallReceiver?.let {
            try { unregisterReceiver(it) } catch (_: Exception) {}
        }
    }

    // ─── Periodic Checks ────────────────────────────────────────────────────

    private fun startPeriodicChecks() {
        scope.launch {
            while (isActive) {
                try {
                    checkAccessibilityService()
                    checkDeviceAdmin()
                    checkTimeManipulation()
                    checkDeveloperOptions()
                    checkUsbDebugging()
                    checkMockLocations()
                } catch (e: Exception) {
                    Log.e(TAG, "Error during tamper checks", e)
                }
                delay(CHECK_INTERVAL_MS)
            }
        }
    }

    // ─── Accessibility Service Check ────────────────────────────────────────

    private fun checkAccessibilityService() {
        val isEnabled = isAccessibilityServiceEnabled()
        if (previousAccessibilityState == true && !isEnabled) {
            Log.w(TAG, "⚠️ Accessibility service disabled!")
            reportTamper(
                "ACCESSIBILITY_DISABLED",
                "تم تعطيل خدمة إمكانية الوصول",
                "Accessibility service was disabled"
            )
        }
        previousAccessibilityState = isEnabled
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val serviceName = "${packageName}/${AmanahAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabledServices.contains(serviceName, ignoreCase = true)
    }

    // ─── Device Admin Check ─────────────────────────────────────────────────

    private fun checkDeviceAdmin() {
        val dpm = getSystemService(DEVICE_POLICY_SERVICE) as? DevicePolicyManager ?: return
        val adminComponent = ComponentName(this, AmanahAdminReceiver::class.java)
        val isAdmin = dpm.isAdminActive(adminComponent)
        if (!isAdmin) {
            Log.w(TAG, "⚠️ Device admin deactivated!")
            reportTamper(
                "ADMIN_DEACTIVATED",
                "تم إلغاء تفعيل مشرف الجهاز",
                "Device admin was deactivated"
            )
        }
    }

    // ─── Time Manipulation Check ────────────────────────────────────────────

    private fun checkTimeManipulation() {
        val currentTime = System.currentTimeMillis()
        if (lastKnownTimeMs > 0) {
            val drift = currentTime - lastKnownTimeMs
            // If time jumped backward or forward by more than 2 minutes
            // (beyond expected check interval)
            if (drift < -60_000L || drift > CHECK_INTERVAL_MS + 120_000L) {
                Log.w(TAG, "⚠️ Time manipulation detected! Drift: ${drift}ms")
                reportTamper(
                    "TIME_MANIPULATION",
                    "تم اكتشاف تلاعب بالوقت",
                    "System time manipulation detected (drift: ${drift / 1000}s)"
                )
            }
        }
        lastKnownTimeMs = currentTime
    }

    // ─── Developer Options Check ────────────────────────────────────────────

    private fun checkDeveloperOptions() {
        val devOptions = Settings.Secure.getInt(
            contentResolver,
            Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
            0
        )
        if (devOptions == 1) {
            Log.w(TAG, "⚠️ Developer options enabled!")
            reportTamper(
                "DEV_OPTIONS_ENABLED",
                "خيارات المطور مُفعّلة",
                "Developer options are enabled on child device"
            )
        }
    }

    // ─── USB Debugging Check ────────────────────────────────────────────────

    private fun checkUsbDebugging() {
        val adbEnabled = Settings.Secure.getInt(
            contentResolver,
            Settings.Global.ADB_ENABLED,
            0
        )
        if (adbEnabled == 1) {
            Log.w(TAG, "⚠️ USB debugging enabled!")
            reportTamper(
                "USB_DEBUGGING",
                "تصحيح USB مُفعّل",
                "USB debugging is enabled on child device"
            )
        }
    }

    // ─── Mock Locations Check ───────────────────────────────────────────────

    private fun checkMockLocations() {
        val mockEnabled = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // On Android M+, check for apps with MOCK_LOCATION permission
            false // This requires checking per-app, handled in location service
        } else {
            @Suppress("DEPRECATION")
            Settings.Secure.getInt(
                contentResolver,
                Settings.Secure.ALLOW_MOCK_LOCATION,
                0
            ) != 0
        }
        if (mockEnabled) {
            Log.w(TAG, "⚠️ Mock locations enabled!")
            reportTamper(
                "MOCK_LOCATION",
                "المواقع الوهمية مُفعّلة",
                "Mock locations are enabled on child device"
            )
        }
    }

    // ─── Alert Reporting ────────────────────────────────────────────────────

    private fun reportTamper(type: String, messageAr: String, messageEn: String) {
        val childId = getSharedPreferences("amanah_prefs", MODE_PRIVATE)
            .getString("child_id", null) ?: return

        val alertData = hashMapOf(
            "childId" to childId,
            "type" to type,
            "messageAr" to messageAr,
            "messageEn" to messageEn,
            "severity" to "CRITICAL",
            "resolved" to false,
            "detectedAt" to Timestamp.now(),
            "deviceModel" to Build.MODEL,
            "osVersion" to "Android ${Build.VERSION.RELEASE}"
        )

        db.collection(TAMPER_ALERTS_COLLECTION)
            .add(alertData)
            .addOnSuccessListener {
                Log.i(TAG, "Tamper alert reported: $type")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to report tamper alert", e)
            }

        // Also write to the child's main alerts collection
        val fullAlertData = hashMapOf(
            "childId" to childId,
            "platform" to "system",
            "content" to "$messageEn | $messageAr",
            "severity" to "CRITICAL",
            "category" to "TAMPER",
            "flagged" to true,
            "reviewed" to false,
            "timestamp" to Timestamp.now()
        )
        db.collection("children").document(childId)
            .collection("alerts").add(fullAlertData)
    }
}
