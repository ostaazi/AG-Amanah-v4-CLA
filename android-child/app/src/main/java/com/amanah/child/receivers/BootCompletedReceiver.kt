package com.amanah.child.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import com.amanah.child.services.AppUsageTrackerService
import com.amanah.child.services.DeviceHealthReporterService
import com.amanah.child.services.RemoteCommandService
import com.amanah.child.services.TamperDetectionService
import com.amanah.child.services.VulnerabilityScannerService

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        val shouldStart = action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED
        if (!shouldStart) return

        val prefs = context.getSharedPreferences("AmanahPrefs", Context.MODE_PRIVATE)
        val childId = prefs.getString("childDocumentId", null)
        if (childId.isNullOrBlank()) return

        // Start foreground remote command service
        val serviceIntent = Intent(context, RemoteCommandService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }

        // Start local monitoring services (do not require network)
        try { context.startService(Intent(context, AppUsageTrackerService::class.java)) } catch (e: Exception) {
            Log.w("AmanahBoot", "AppUsageTracker start failed: ${e.message}")
        }
        try { context.startService(Intent(context, TamperDetectionService::class.java)) } catch (e: Exception) {
            Log.w("AmanahBoot", "TamperDetection start failed: ${e.message}")
        }
        try { context.startService(Intent(context, DeviceHealthReporterService::class.java)) } catch (e: Exception) {
            Log.w("AmanahBoot", "DeviceHealthReporter start failed: ${e.message}")
        }
        try { context.startService(Intent(context, VulnerabilityScannerService::class.java)) } catch (e: Exception) {
            Log.w("AmanahBoot", "VulnerabilityScanner start failed: ${e.message}")
        }
    }
}
