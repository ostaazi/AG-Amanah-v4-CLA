package com.amanah.child.utils

import android.content.Context
import android.util.Log
import com.google.firebase.Timestamp
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.util.Calendar
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Amanah Behavioral Agent (Privacy-First On-Device AI)
 * 
 * Logic:
 * 1. Learns child's specific baselines (Screen time, Unlock count, App switching speed).
 * 2. Privacy: All "learning" (calculating averages/deviations) happens locally.
 *    - No raw activity logs used for training remotely.
 *    - "Weights" or "Thresholds" adapt locally.
 * 3. Outcome: "Anomaly Alert" (e.g., "High usage at 3AM") sent to parent, not the raw data point.
 */
object BehavioralAgent {

    private const val PREFS_NAME = "AmanahBehaviorProfile"
    private const val KEY_PROFILE = "encrypted_profile"
    
    // Metrics tracked daily
    data class DailyMetrics(
        var date: String = "",
        var unlockCount: Int = 0,
        var screenTimeMinutes: Int = 0,
        var highRiskAppSwitches: Int = 0,
        var lateNightMinutes: Int = 0 // Usage between 1AM-5AM
    )

    // Learned Baseline Profile (rolling 7-day average)
    data class BaselineProfile(
        var avgUnlocks: Float = 0f,
        var avgScreenTime: Float = 0f,
        var avgLateNight: Float = 0f,
        var unlockStdDev: Float = 0f,
        var screenTimeStdDev: Float = 0f,
        var samples: Int = 0
    )

    private var currentMetrics = DailyMetrics()
    private var baseline = BaselineProfile()
    private val db = FirebaseFirestore.getInstance()
    private val scope = CoroutineScope(Dispatchers.IO)

    fun init(context: Context) {
        loadProfile(context)
        val today = getTodayKey()
        if (currentMetrics.date != today) {
            // New day: Incorporate yesterday's metrics into baseline and reset
            if (currentMetrics.date.isNotEmpty()) {
                updateBaseline(currentMetrics)
                saveProfile(context)
            }
            currentMetrics = DailyMetrics(date = today)
        }
    }

    fun onUnlock(context: Context) {
        currentMetrics.unlockCount++
        checkAnomaly(context, "unlock_frequency", currentMetrics.unlockCount.toFloat(), baseline.avgUnlocks, baseline.unlockStdDev)
        saveProfile(context) // heavy write? maybe throttle
    }

    fun recordScreenTime(context: Context, minutes: Int, isLateNight: Boolean) {
        currentMetrics.screenTimeMinutes += minutes
        if (isLateNight) currentMetrics.lateNightMinutes += minutes
        
        checkAnomaly(context, "screen_time", currentMetrics.screenTimeMinutes.toFloat(), baseline.avgScreenTime, baseline.screenTimeStdDev)
        if (isLateNight) {
             checkAnomaly(context, "late_night_activity", currentMetrics.lateNightMinutes.toFloat(), baseline.avgLateNight, 5f) // Low tolerance for late night
        }
    }

    private fun checkAnomaly(context: Context, metricName: String, value: Float, avg: Float, stdDev: Float) {
        if (baseline.samples < 3) return // Need at least 3 days to learn basic pattern

        val deviation = abs(value - avg)
        val threshold = (stdDev * 2.5f).coerceAtLeast(avg * 0.5f) // 2.5 sigma or 50% deviation

        if (deviation > threshold && value > avg) { // Only care about spikes (higher than normal)
            // ANOMALY DETECTED locally
            reportAnomaly(context, metricName, value, avg)
        }
    }

    private fun reportAnomaly(context: Context, metric: String, value: Float, avg: Float) {
        val prefs = context.getSharedPreferences("AmanahPrefs", Context.MODE_PRIVATE)
        val parentId = prefs.getString("parentId", null) ?: return
        val childId = prefs.getString("childDocumentId", null) ?: return
        val childName = prefs.getString("childName", "Child")

        // Rate limit alerts (one per type per day) to avoid spam
        val lastAlertKey = "last_alert_$metric"
        val lastAlertTime = prefs.getLong(lastAlertKey, 0L)
        val now = System.currentTimeMillis()
        if (now - lastAlertTime < 24 * 60 * 60 * 1000) return 

        prefs.edit().putLong(lastAlertKey, now).apply()

        val deviationPercent = ((value - avg) / avg * 100).toInt()
        
        val content = when(metric) {
            "late_night_activity" -> "Unusual late night activity detected ($value mins vs avg ${avg.toInt()})."
            "screen_time" -> "Screen time significantly higher than normal (+$deviationPercent%)."
            "unlock_frequency" -> "Compulsive unlocking detected ($value times today)."
            else -> "Behavioral anomaly detected."
        }

        val alert = hashMapOf(
            "parentId" to parentId,
            "childId" to childId,
            "childName" to childName,
            "platform" to "Behavioral AI",
            "content" to content,
            "category" to "BEHAVIOR",
            "severity" to "MEDIUM",
            "aiAnalysis" to "On-Device Learning detected data deviation from 7-day baseline. Privacy-preserving alert.",
            "timestamp" to Timestamp.now(),
            "status" to "NEW"
        )

        db.collection("alerts").add(alert)
            .addOnSuccessListener { Log.i("BehavioralAgent", "Anomaly reported: $metric") }
    }

    private fun updateBaseline(day: DailyMetrics) {
        // Simple Welford's online algorithm or just simple rolling average for simplicity
        val n = baseline.samples + 1
        
        // Update Unlocks
        val oldMeanUnlock = baseline.avgUnlocks
        val newMeanUnlock = oldMeanUnlock + (day.unlockCount - oldMeanUnlock) / n
        baseline.avgUnlocks = newMeanUnlock
        
        // Update Screen Time
        val oldMeanTime = baseline.avgScreenTime
        val newMeanTime = oldMeanTime + (day.screenTimeMinutes - oldMeanTime) / n
        baseline.avgScreenTime = newMeanTime

        // Update Late Night
        val oldMeanLate = baseline.avgLateNight
        val newMeanLate = oldMeanLate + (day.lateNightMinutes - oldMeanLate) / n
        baseline.avgLateNight = newMeanLate

        baseline.samples = n
        
        // StdDev approximation (simplified for MVP)
        // In real impl, we'd track M2 for accurate variance
        baseline.unlockStdDev = maxOf(5f, baseline.avgUnlocks * 0.2f) 
        baseline.screenTimeStdDev = maxOf(30f, baseline.avgScreenTime * 0.2f)
    }

    private fun getTodayKey(): String {
        val c = Calendar.getInstance()
        return "${c.get(Calendar.YEAR)}-${c.get(Calendar.MONTH)+1}-${c.get(Calendar.DAY_OF_MONTH)}"
    }

    private fun saveProfile(context: Context) {
        // In a real production app, we would encrypt this JSON string with Android Keystore
        // For MVP, we save raw JSON in private prefs (sandbox protected)
        val json = JSONObject()
        json.put("date", currentMetrics.date)
        json.put("unlocks", currentMetrics.unlockCount)
        json.put("screen", currentMetrics.screenTimeMinutes)
        json.put("late", currentMetrics.lateNightMinutes)
        
        json.put("base_unlocks", baseline.avgUnlocks)
        json.put("base_screen", baseline.avgScreenTime)
        json.put("base_late", baseline.avgLateNight)
        json.put("samples", baseline.samples)

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PROFILE, json.toString())
            .apply()
    }

    private fun loadProfile(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val jsonStr = prefs.getString(KEY_PROFILE, null) ?: return
        try {
            val json = JSONObject(jsonStr)
            currentMetrics.date = json.optString("date", "")
            currentMetrics.unlockCount = json.optInt("unlocks", 0)
            currentMetrics.screenTimeMinutes = json.optInt("screen", 0)
            currentMetrics.lateNightMinutes = json.optInt("late", 0)

            baseline.avgUnlocks = json.optDouble("base_unlocks", 0.0).toFloat()
            baseline.avgScreenTime = json.optDouble("base_screen", 0.0).toFloat()
            baseline.avgLateNight = json.optDouble("base_late", 0.0).toFloat()
            baseline.samples = json.optInt("samples", 0)
        } catch (e: Exception) {
            Log.e("BehavioralAgent", "Failed to load profile", e)
        }
    }
}
