package com.amanah.child.services

import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.Calendar

/**
 * AppUsageTrackerService
 * =======================
 * Tracks per-app usage time using Android UsageStatsManager.
 * Reports daily usage summaries to Firestore for parent console.
 *
 * Features:
 * - Per-app usage time tracking
 * - App category classification
 * - Daily usage reports
 * - Screen time limit enforcement (warns child)
 */
class AppUsageTrackerService : Service() {

    companion object {
        private const val TAG = "AppUsageTracker"
        private const val REPORT_INTERVAL_MS = 15 * 60 * 1000L // 15 minutes
        private const val PREFS_NAME = "AmanahPrefs"
        private const val USAGE_COLLECTION = "appUsage"
        private const val CHILDREN_COLLECTION = "children"
    }

    private val scope = CoroutineScope(Dispatchers.IO)
    private val db = FirebaseFirestore.getInstance()

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "AppUsageTrackerService started")
        startTracking()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        Log.i(TAG, "AppUsageTrackerService destroyed")
        super.onDestroy()
    }

    // ─── Tracking ───────────────────────────────────────────────────────────

    private fun startTracking() {
        scope.launch {
            while (isActive) {
                try {
                    collectAndReportUsage()
                } catch (e: Exception) {
                    Log.e(TAG, "Error collecting usage data", e)
                }
                delay(REPORT_INTERVAL_MS)
            }
        }
    }

    private fun collectAndReportUsage() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val childId = prefs.getString("childDocumentId", null) ?: return
        val parentId = prefs.getString("parentId", null) ?: return
        val childName = prefs.getString("childName", "Child Device") ?: "Child Device"

        val usageStatsManager =
            getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager ?: return

        // Get today's usage
        val calendar = Calendar.getInstance()
        val endTime = calendar.timeInMillis
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        val startTime = calendar.timeInMillis

        val stats = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            startTime,
            endTime
        ) ?: return

        if (stats.isEmpty()) return

        val pm = packageManager
        val appUsageList = stats
            .filter { it.totalTimeInForeground > 60_000 } // At least 1 min
            .sortedByDescending { it.totalTimeInForeground }
            .take(30) // Top 30 apps
            .map { stat ->
                val appName = try {
                    val appInfo = pm.getApplicationInfo(stat.packageName, 0)
                    pm.getApplicationLabel(appInfo).toString()
                } catch (_: PackageManager.NameNotFoundException) {
                    stat.packageName
                }

                val category = classifyApp(stat.packageName, pm)

                hashMapOf(
                    "packageName" to stat.packageName,
                    "appName" to appName,
                    "category" to category,
                    "usageMinutes" to (stat.totalTimeInForeground / 60_000),
                    "lastUsed" to stat.lastTimeUsed
                )
            }

        val totalMinutes = stats.sumOf { it.totalTimeInForeground / 60_000 }
        val blockedTokens = prefs.getStringSet("blockedApps", emptySet())
            ?.map { it.lowercase() }
            ?.toSet()
            ?: emptySet()
        val childUsage = appUsageList.mapIndexed { index, row ->
            val packageName = row["packageName"]?.toString().orEmpty().lowercase()
            val appName = row["appName"]?.toString().orEmpty()
            val minutes = when (val value = row["usageMinutes"]) {
                is Long -> value.toInt()
                is Int -> value
                is Number -> value.toInt()
                else -> 0
            }
            val isBlocked = blockedTokens.any { token ->
                token.isNotBlank() &&
                    (packageName == token ||
                        packageName.contains(token) ||
                        appName.lowercase().contains(token))
            }
            hashMapOf(
                "id" to if (packageName.isNotBlank()) packageName else "app_$index",
                "appName" to appName,
                "icon" to "\uD83D\uDCF1",
                "minutesUsed" to minutes,
                "isBlocked" to isBlocked
            )
        }

        // Upload to Firestore
        val reportData = hashMapOf(
            "childId" to childId,
            "parentId" to parentId,
            "childName" to childName,
            "date" to java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date()),
            "totalScreenTimeMinutes" to totalMinutes,
            "appCount" to appUsageList.size,
            "topApps" to appUsageList,
            "reportedAt" to Timestamp.now(),
            "deviceModel" to Build.MODEL
        )

        val docId = "${childId}_${reportData["date"]}"
        db.collection(USAGE_COLLECTION).document(docId)
            .set(reportData)
            .addOnSuccessListener {
                Log.d(TAG, "Usage report uploaded: $totalMinutes min across ${appUsageList.size} apps")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Failed to upload usage report", e)
            }

        db.collection(CHILDREN_COLLECTION).document(childId)
            .update(
                hashMapOf<String, Any>(
                    "appUsage" to childUsage,
                    "currentScreenTime" to totalMinutes.toInt(),
                    "lastUsageReportedAt" to Timestamp.now()
                )
            )
            .addOnFailureListener { e ->
                Log.w(TAG, "Failed to sync usage summary to child profile: ${e.message}")
            }
    }

    // ─── App Classification ─────────────────────────────────────────────────

    private fun classifyApp(packageName: String, pm: PackageManager): String {
        // Known social media apps
        val socialApps = setOf(
            "com.instagram.android", "com.facebook.katana", "com.twitter.android",
            "com.snapchat.android", "com.zhiliaoapp.musically", "org.telegram.messenger",
            "com.whatsapp", "com.discord"
        )
        if (packageName in socialApps) return "SOCIAL"

        // Known gaming
        val gamingIndicators = listOf("game", "games", "play")
        if (gamingIndicators.any { packageName.contains(it, ignoreCase = true) }) return "GAMING"

        // Known education
        val eduApps = setOf(
            "com.google.android.apps.classroom", "com.duolingo",
            "com.khan.academy", "com.quizlet"
        )
        if (packageName in eduApps) return "EDUCATION"

        // Known video/streaming
        val videoApps = setOf(
            "com.google.android.youtube", "com.netflix.mediaclient",
            "com.amazon.avod.thirdpartyclient"
        )
        if (packageName in videoApps) return "VIDEO"

        // Use Android app category if available (API 26+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val appInfo = pm.getApplicationInfo(packageName, 0)
                return when (appInfo.category) {
                    ApplicationInfo.CATEGORY_GAME -> "GAMING"
                    ApplicationInfo.CATEGORY_AUDIO -> "MEDIA"
                    ApplicationInfo.CATEGORY_VIDEO -> "VIDEO"
                    ApplicationInfo.CATEGORY_IMAGE -> "MEDIA"
                    ApplicationInfo.CATEGORY_SOCIAL -> "SOCIAL"
                    ApplicationInfo.CATEGORY_NEWS -> "NEWS"
                    ApplicationInfo.CATEGORY_MAPS -> "UTILITY"
                    ApplicationInfo.CATEGORY_PRODUCTIVITY -> "PRODUCTIVITY"
                    else -> "OTHER"
                }
            } catch (_: Exception) {}
        }

        // System app check
        try {
            val appInfo = pm.getApplicationInfo(packageName, 0)
            if (appInfo.flags and ApplicationInfo.FLAG_SYSTEM != 0) return "SYSTEM"
        } catch (_: Exception) {}

        return "OTHER"
    }
}
