package com.amanah.child.utils

import android.content.Context
import android.content.SharedPreferences
import java.util.Locale

object AlertFilterPolicyManager {
    private const val PREFS_NAME = "AmanahPrefs"

    private const val PREF_ENABLED = "alertFilter.enabled"
    private const val PREF_VERSION = "alertFilter.version"
    private const val PREF_UPDATED_AT = "alertFilter.updatedAtMs"
    private const val PREF_MIN_CONFIDENCE_DEFAULT = "alertFilter.minConfidence.default"
    private const val PREF_MIN_CONFIDENCE_IMAGE = "alertFilter.minConfidence.image"
    private const val PREF_MIN_CONFIDENCE_TEXT = "alertFilter.minConfidence.text"
    private const val PREF_MIN_SEVERITY_IMAGE = "alertFilter.minSeverity.image"
    private const val PREF_MIN_SEVERITY_TEXT = "alertFilter.minSeverity.text"
    private const val PREF_REQUIRE_SNAPSHOT_IMAGE = "alertFilter.requireSnapshot.image"
    private const val PREF_MAX_ALERTS_PER_MINUTE = "alertFilter.maxAlertsPerMinute"
    private const val PREF_DEDUPE_WINDOW_MS = "alertFilter.dedupeWindowMs"
    private const val PREF_SUPPRESS_INJURY_HEURISTIC = "alertFilter.injury.suppressHeuristic"
    private const val PREF_INJURY_MIN_DARK_SHARE = "alertFilter.injury.minDarkShare"
    private const val PREF_INJURY_MIN_EDGE_SHARE = "alertFilter.injury.minEdgeShare"
    private const val PREF_INJURY_MAX_TOP_SHARE = "alertFilter.injury.maxTopShare"
    private const val PREF_INJURY_MIN_DANGER_RATIO = "alertFilter.injury.minDangerRatio"

    private const val DEFAULT_ENABLED = true
    private const val DEFAULT_VERSION = "default-v1"
    private const val DEFAULT_MIN_CONFIDENCE_DEFAULT = 72
    private const val DEFAULT_MIN_CONFIDENCE_IMAGE = 78
    private const val DEFAULT_MIN_CONFIDENCE_TEXT = 70
    private const val DEFAULT_MIN_SEVERITY_IMAGE = 2
    private const val DEFAULT_MIN_SEVERITY_TEXT = 2
    private const val DEFAULT_REQUIRE_SNAPSHOT_IMAGE = false
    private const val DEFAULT_MAX_ALERTS_PER_MINUTE = 12
    private const val DEFAULT_DEDUPE_WINDOW_MS = 18_000L
    private const val DEFAULT_SUPPRESS_INJURY_HEURISTIC = true
    private const val DEFAULT_INJURY_MIN_DARK_SHARE = 0.14f
    private const val DEFAULT_INJURY_MIN_EDGE_SHARE = 0.30f
    private const val DEFAULT_INJURY_MAX_TOP_SHARE = 0.80f
    private const val DEFAULT_INJURY_MIN_DANGER_RATIO = 0.08f

    data class Policy(
        val enabled: Boolean,
        val version: String,
        val updatedAtMs: Long,
        val minConfidenceDefault: Int,
        val minConfidenceImage: Int,
        val minConfidenceText: Int,
        val minSeverityImage: Int,
        val minSeverityText: Int,
        val requireSnapshotImage: Boolean,
        val maxAlertsPerMinute: Int,
        val dedupeWindowMs: Long,
        val suppressInjuryHeuristic: Boolean,
        val injuryMinDarkShare: Float,
        val injuryMinEdgeShare: Float,
        val injuryMaxTopShare: Float,
        val injuryMinDangerRatio: Float
    )

    fun load(context: Context): Policy {
        val prefs = prefs(context)
        return Policy(
            enabled = prefs.getBoolean(PREF_ENABLED, DEFAULT_ENABLED),
            version = prefs.getString(PREF_VERSION, DEFAULT_VERSION).orEmpty().ifBlank { DEFAULT_VERSION },
            updatedAtMs = prefs.getLong(PREF_UPDATED_AT, 0L),
            minConfidenceDefault = prefs.getInt(PREF_MIN_CONFIDENCE_DEFAULT, DEFAULT_MIN_CONFIDENCE_DEFAULT).coerceIn(0, 100),
            minConfidenceImage = prefs.getInt(PREF_MIN_CONFIDENCE_IMAGE, DEFAULT_MIN_CONFIDENCE_IMAGE).coerceIn(0, 100),
            minConfidenceText = prefs.getInt(PREF_MIN_CONFIDENCE_TEXT, DEFAULT_MIN_CONFIDENCE_TEXT).coerceIn(0, 100),
            minSeverityImage = prefs.getInt(PREF_MIN_SEVERITY_IMAGE, DEFAULT_MIN_SEVERITY_IMAGE).coerceIn(1, 4),
            minSeverityText = prefs.getInt(PREF_MIN_SEVERITY_TEXT, DEFAULT_MIN_SEVERITY_TEXT).coerceIn(1, 4),
            requireSnapshotImage = prefs.getBoolean(PREF_REQUIRE_SNAPSHOT_IMAGE, DEFAULT_REQUIRE_SNAPSHOT_IMAGE),
            maxAlertsPerMinute = prefs.getInt(PREF_MAX_ALERTS_PER_MINUTE, DEFAULT_MAX_ALERTS_PER_MINUTE).coerceIn(1, 120),
            dedupeWindowMs = prefs.getLong(PREF_DEDUPE_WINDOW_MS, DEFAULT_DEDUPE_WINDOW_MS).coerceIn(0L, 300_000L),
            suppressInjuryHeuristic = prefs.getBoolean(PREF_SUPPRESS_INJURY_HEURISTIC, DEFAULT_SUPPRESS_INJURY_HEURISTIC),
            injuryMinDarkShare = prefs.getFloat(PREF_INJURY_MIN_DARK_SHARE, DEFAULT_INJURY_MIN_DARK_SHARE).coerceIn(0f, 1f),
            injuryMinEdgeShare = prefs.getFloat(PREF_INJURY_MIN_EDGE_SHARE, DEFAULT_INJURY_MIN_EDGE_SHARE).coerceIn(0f, 1f),
            injuryMaxTopShare = prefs.getFloat(PREF_INJURY_MAX_TOP_SHARE, DEFAULT_INJURY_MAX_TOP_SHARE).coerceIn(0f, 1f),
            injuryMinDangerRatio = prefs.getFloat(PREF_INJURY_MIN_DANGER_RATIO, DEFAULT_INJURY_MIN_DANGER_RATIO).coerceIn(0f, 1f)
        )
    }

    fun applyConfig(context: Context, rawConfig: Any?): Boolean {
        val config = rawConfig as? Map<*, *> ?: return false
        val resetToDefault = (config["resetToDefault"] as? Boolean) == true
        if (resetToDefault) {
            clear(context)
            return true
        }

        val current = load(context)
        val injuryCfg = config["injuryHeuristic"] as? Map<*, *>

        val enabled = parseBoolean(config["enabled"], current.enabled)
        val version = config["version"]?.toString()?.trim()?.ifBlank { current.version } ?: current.version
        val updatedAtMs = parseLong(config["updatedAtMs"], System.currentTimeMillis())

        val minConfidenceDefault = parseInt(config["minConfidenceDefault"], current.minConfidenceDefault, 0, 100)
        val minConfidenceImage = parseInt(config["minConfidenceImage"], current.minConfidenceImage, 0, 100)
        val minConfidenceText = parseInt(config["minConfidenceText"], current.minConfidenceText, 0, 100)
        val minSeverityImage = parseSeverityRank(config["minSeverityImage"], current.minSeverityImage)
        val minSeverityText = parseSeverityRank(config["minSeverityText"], current.minSeverityText)
        val requireSnapshotImage = parseBoolean(config["requireSnapshotImage"], current.requireSnapshotImage)
        val maxAlertsPerMinute = parseInt(config["maxAlertsPerMinute"], current.maxAlertsPerMinute, 1, 120)
        val dedupeWindowMs = parseLong(config["dedupeWindowMs"], current.dedupeWindowMs).coerceIn(0L, 300_000L)

        val suppressInjuryHeuristic =
            parseBoolean(
                config["suppressInjuryHeuristic"] ?: injuryCfg?.get("enabled")?.let { !(it as? Boolean ?: true) },
                current.suppressInjuryHeuristic
            )
        val injuryMinDarkShare = parseFloat(
            config["injuryMinDarkShare"] ?: injuryCfg?.get("minDarkShare"),
            current.injuryMinDarkShare,
            0f,
            1f
        )
        val injuryMinEdgeShare = parseFloat(
            config["injuryMinEdgeShare"] ?: injuryCfg?.get("minEdgeShare"),
            current.injuryMinEdgeShare,
            0f,
            1f
        )
        val injuryMaxTopShare = parseFloat(
            config["injuryMaxTopShare"] ?: injuryCfg?.get("maxTopShare"),
            current.injuryMaxTopShare,
            0f,
            1f
        )
        val injuryMinDangerRatio = parseFloat(
            config["injuryMinDangerRatio"] ?: injuryCfg?.get("minDangerRatio"),
            current.injuryMinDangerRatio,
            0f,
            1f
        )

        prefs(context).edit()
            .putBoolean(PREF_ENABLED, enabled)
            .putString(PREF_VERSION, version)
            .putLong(PREF_UPDATED_AT, updatedAtMs)
            .putInt(PREF_MIN_CONFIDENCE_DEFAULT, minConfidenceDefault)
            .putInt(PREF_MIN_CONFIDENCE_IMAGE, minConfidenceImage)
            .putInt(PREF_MIN_CONFIDENCE_TEXT, minConfidenceText)
            .putInt(PREF_MIN_SEVERITY_IMAGE, minSeverityImage)
            .putInt(PREF_MIN_SEVERITY_TEXT, minSeverityText)
            .putBoolean(PREF_REQUIRE_SNAPSHOT_IMAGE, requireSnapshotImage)
            .putInt(PREF_MAX_ALERTS_PER_MINUTE, maxAlertsPerMinute)
            .putLong(PREF_DEDUPE_WINDOW_MS, dedupeWindowMs)
            .putBoolean(PREF_SUPPRESS_INJURY_HEURISTIC, suppressInjuryHeuristic)
            .putFloat(PREF_INJURY_MIN_DARK_SHARE, injuryMinDarkShare)
            .putFloat(PREF_INJURY_MIN_EDGE_SHARE, injuryMinEdgeShare)
            .putFloat(PREF_INJURY_MAX_TOP_SHARE, injuryMaxTopShare)
            .putFloat(PREF_INJURY_MIN_DANGER_RATIO, injuryMinDangerRatio)
            .apply()

        return true
    }

    fun clear(context: Context) {
        prefs(context).edit()
            .remove(PREF_ENABLED)
            .remove(PREF_VERSION)
            .remove(PREF_UPDATED_AT)
            .remove(PREF_MIN_CONFIDENCE_DEFAULT)
            .remove(PREF_MIN_CONFIDENCE_IMAGE)
            .remove(PREF_MIN_CONFIDENCE_TEXT)
            .remove(PREF_MIN_SEVERITY_IMAGE)
            .remove(PREF_MIN_SEVERITY_TEXT)
            .remove(PREF_REQUIRE_SNAPSHOT_IMAGE)
            .remove(PREF_MAX_ALERTS_PER_MINUTE)
            .remove(PREF_DEDUPE_WINDOW_MS)
            .remove(PREF_SUPPRESS_INJURY_HEURISTIC)
            .remove(PREF_INJURY_MIN_DARK_SHARE)
            .remove(PREF_INJURY_MIN_EDGE_SHARE)
            .remove(PREF_INJURY_MAX_TOP_SHARE)
            .remove(PREF_INJURY_MIN_DANGER_RATIO)
            .apply()
    }

    fun severityToRank(severityRaw: String): Int {
        return when (severityRaw.trim().uppercase(Locale.ROOT)) {
            "CRITICAL" -> 4
            "HIGH" -> 3
            "MEDIUM" -> 2
            "LOW" -> 1
            else -> 0
        }
    }

    private fun parseSeverityRank(raw: Any?, fallback: Int): Int {
        val fromNumber = (raw as? Number)?.toInt()
        if (fromNumber != null) return fromNumber.coerceIn(1, 4)
        val fromString = raw?.toString()?.trim().orEmpty()
        if (fromString.isBlank()) return fallback
        return when (fromString.uppercase(Locale.ROOT)) {
            "LOW" -> 1
            "MEDIUM" -> 2
            "HIGH" -> 3
            "CRITICAL" -> 4
            else -> fallback
        }
    }

    private fun parseBoolean(raw: Any?, fallback: Boolean): Boolean {
        return when (raw) {
            is Boolean -> raw
            is String -> raw.equals("true", ignoreCase = true)
            is Number -> raw.toInt() != 0
            else -> fallback
        }
    }

    private fun parseInt(raw: Any?, fallback: Int, min: Int, max: Int): Int {
        val value = when (raw) {
            is Number -> raw.toInt()
            is String -> raw.toIntOrNull()
            else -> null
        } ?: return fallback
        return value.coerceIn(min, max)
    }

    private fun parseLong(raw: Any?, fallback: Long): Long {
        return when (raw) {
            is Number -> raw.toLong()
            is String -> raw.toLongOrNull() ?: fallback
            else -> fallback
        }
    }

    private fun parseFloat(raw: Any?, fallback: Float, min: Float, max: Float): Float {
        val value = when (raw) {
            is Number -> raw.toFloat()
            is String -> raw.toFloatOrNull()
            else -> null
        } ?: return fallback
        return value.coerceIn(min, max)
    }

    private fun prefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
}
