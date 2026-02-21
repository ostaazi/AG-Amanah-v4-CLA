package com.amanah.child.utils

import android.content.Context
import android.content.SharedPreferences
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.Locale
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.math.pow

object OfflineUnlockManager {
    private const val PREFS_NAME = "AmanahPrefs"

    private const val PREF_SECRET = "offlineUnlockTotpSecret"
    private const val PREF_BACKUP_HASHES = "offlineUnlockBackupHashes"
    private const val PREF_VERSION = "offlineUnlockVersion"
    private const val PREF_DIGITS = "offlineUnlockDigits"
    private const val PREF_PERIOD_SEC = "offlineUnlockPeriodSec"
    private const val PREF_MAX_ATTEMPTS = "offlineUnlockMaxAttempts"
    private const val PREF_COOLDOWN_SEC = "offlineUnlockCooldownSec"

    private const val PREF_FAIL_COUNT = "offlineUnlockFailCount"
    private const val PREF_COOLDOWN_UNTIL = "offlineUnlockCooldownUntil"
    private const val PREF_LAST_USED_AT = "offlineUnlockLastUsedAt"
    private const val PREF_LAST_USED_METHOD = "offlineUnlockLastUsedMethod"
    private const val PREF_PENDING_SYNC = "offlineUnlockPendingSync"

    private const val DEFAULT_DIGITS = 8
    private const val DEFAULT_PERIOD_SEC = 30
    private const val DEFAULT_MAX_ATTEMPTS = 6
    private const val DEFAULT_COOLDOWN_SEC = 300

    data class VerificationResult(
        val success: Boolean,
        val code: String,
        val message: String,
        val cooldownRemainingSec: Long = 0L
    )

    fun applyConfig(context: Context, rawConfig: Any?): Boolean {
        val config = rawConfig as? Map<*, *> ?: return false
        val secret = sanitizeSecret(config["totpSecret"]?.toString().orEmpty())
        val version = config["version"]?.toString()?.trim().orEmpty()

        val backupHashes = parseBackupHashes(config["backupCodeHashes"])
        val digits = (config["digits"] as? Number)?.toInt()?.coerceIn(6, 10) ?: DEFAULT_DIGITS
        val periodSec = (config["periodSec"] as? Number)?.toInt()?.coerceIn(15, 90) ?: DEFAULT_PERIOD_SEC
        val maxAttempts = (config["maxAttempts"] as? Number)?.toInt()?.coerceIn(3, 12) ?: DEFAULT_MAX_ATTEMPTS
        val cooldownSec = (config["cooldownSec"] as? Number)?.toInt()?.coerceIn(30, 1800) ?: DEFAULT_COOLDOWN_SEC

        if (secret.isBlank() && backupHashes.isEmpty()) {
            return false
        }

        prefs(context).edit()
            .putString(PREF_SECRET, secret)
            .putString(PREF_VERSION, version)
            .putStringSet(PREF_BACKUP_HASHES, backupHashes)
            .putInt(PREF_DIGITS, digits)
            .putInt(PREF_PERIOD_SEC, periodSec)
            .putInt(PREF_MAX_ATTEMPTS, maxAttempts)
            .putInt(PREF_COOLDOWN_SEC, cooldownSec)
            .putInt(PREF_FAIL_COUNT, 0)
            .putLong(PREF_COOLDOWN_UNTIL, 0L)
            .putBoolean(PREF_PENDING_SYNC, true)
            .apply()
        return true
    }

    fun verifyCode(context: Context, rawInput: String, nowMs: Long = System.currentTimeMillis()): VerificationResult {
        val input = rawInput.trim().replace("\\s+".toRegex(), "")
        if (input.isBlank()) {
            return VerificationResult(
                success = false,
                code = "EMPTY_CODE",
                message = "Please enter the emergency unlock code."
            )
        }

        val prefs = prefs(context)
        val cooldownUntil = prefs.getLong(PREF_COOLDOWN_UNTIL, 0L)
        if (cooldownUntil > nowMs) {
            val remaining = ((cooldownUntil - nowMs) / 1000L).coerceAtLeast(1L)
            return VerificationResult(
                success = false,
                code = "COOLDOWN_ACTIVE",
                message = "Too many attempts. Try again after $remaining seconds.",
                cooldownRemainingSec = remaining
            )
        }

        val secret = prefs.getString(PREF_SECRET, "").orEmpty()
        val digits = prefs.getInt(PREF_DIGITS, DEFAULT_DIGITS).coerceIn(6, 10)
        val periodSec = prefs.getInt(PREF_PERIOD_SEC, DEFAULT_PERIOD_SEC).coerceIn(15, 90)

        if (secret.isNotBlank() && input.length == digits && input.all { it.isDigit() }) {
            val currentWindow = nowMs / 1000L / periodSec
            val windows = longArrayOf(currentWindow - 1, currentWindow, currentWindow + 1)
            for (window in windows) {
                val otp = generateOtp(secret, window, digits)
                if (otp != null && otp == input) {
                    onSuccess(prefs, method = "totp", nowMs = nowMs)
                    return VerificationResult(
                        success = true,
                        code = "UNLOCKED_TOTP",
                        message = "Emergency unlock code accepted."
                    )
                }
            }
        }

        val backupHashes = prefs.getStringSet(PREF_BACKUP_HASHES, emptySet())?.toMutableSet() ?: mutableSetOf()
        if (backupHashes.isNotEmpty()) {
            val normalizedBackupCode = input.lowercase(Locale.ROOT)
            val hash = sha256Hex(normalizedBackupCode)
            if (backupHashes.remove(hash)) {
                prefs.edit()
                    .putStringSet(PREF_BACKUP_HASHES, backupHashes)
                    .apply()
                onSuccess(prefs, method = "backup_code", nowMs = nowMs)
                return VerificationResult(
                    success = true,
                    code = "UNLOCKED_BACKUP",
                    message = "Backup emergency code accepted."
                )
            }
        }

        return onFailure(prefs, nowMs)
    }

    fun clearLockState(context: Context, source: String) {
        prefs(context).edit()
            .putBoolean("deviceLockActive", false)
            .putBoolean("blackoutActive", false)
            .putString("blackoutMessage", "")
            .putBoolean(PREF_PENDING_SYNC, true)
            .putLong("offlineUnlockClearedAt", System.currentTimeMillis())
            .putString("offlineUnlockClearedBy", source)
            .apply()
    }

    fun hasPendingSync(context: Context): Boolean {
        return prefs(context).getBoolean(PREF_PENDING_SYNC, false)
    }

    fun markPendingSyncFlushed(context: Context) {
        prefs(context).edit().putBoolean(PREF_PENDING_SYNC, false).apply()
    }

    fun backupCodesRemaining(context: Context): Int {
        return prefs(context).getStringSet(PREF_BACKUP_HASHES, emptySet())?.size ?: 0
    }

    private fun onSuccess(prefs: SharedPreferences, method: String, nowMs: Long) {
        prefs.edit()
            .putInt(PREF_FAIL_COUNT, 0)
            .putLong(PREF_COOLDOWN_UNTIL, 0L)
            .putLong(PREF_LAST_USED_AT, nowMs)
            .putString(PREF_LAST_USED_METHOD, method)
            .putBoolean(PREF_PENDING_SYNC, true)
            .apply()
    }

    private fun onFailure(prefs: SharedPreferences, nowMs: Long): VerificationResult {
        val maxAttempts = prefs.getInt(PREF_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS).coerceIn(3, 12)
        val cooldownSec = prefs.getInt(PREF_COOLDOWN_SEC, DEFAULT_COOLDOWN_SEC).coerceIn(30, 1800)
        val failCount = prefs.getInt(PREF_FAIL_COUNT, 0) + 1

        var cooldownUntil = 0L
        if (failCount >= maxAttempts) {
            cooldownUntil = nowMs + cooldownSec * 1000L
        }
        prefs.edit()
            .putInt(PREF_FAIL_COUNT, if (cooldownUntil > 0L) 0 else failCount)
            .putLong(PREF_COOLDOWN_UNTIL, cooldownUntil)
            .apply()

        if (cooldownUntil > 0L) {
            return VerificationResult(
                success = false,
                code = "INVALID_LOCKED",
                message = "Invalid code. Emergency unlock is locked for $cooldownSec seconds.",
                cooldownRemainingSec = cooldownSec.toLong()
            )
        }
        val remaining = (maxAttempts - failCount).coerceAtLeast(0)
        return VerificationResult(
            success = false,
            code = "INVALID_CODE",
            message = "Invalid code. Remaining attempts: $remaining"
        )
    }

    private fun prefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private fun sanitizeSecret(raw: String): String {
        return raw.trim()
            .replace(" ", "")
            .replace("-", "")
            .uppercase(Locale.ROOT)
            .filter { it in "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" }
    }

    private fun parseBackupHashes(raw: Any?): Set<String> {
        val values = when (raw) {
            is List<*> -> raw.mapNotNull { it?.toString() }
            is Array<*> -> raw.mapNotNull { it?.toString() }
            is String -> raw.split(',', '\n', ';', '|')
            else -> emptyList()
        }
        return values.mapNotNull { token ->
            val normalized = token.trim().lowercase(Locale.ROOT)
            if (normalized.matches(Regex("^[a-f0-9]{64}$"))) normalized else null
        }.toSet()
    }

    private fun generateOtp(secretBase32: String, timeWindow: Long, digits: Int): String? {
        return try {
            val keyBytes = decodeBase32(secretBase32) ?: return null
            val data = ByteBuffer.allocate(8).putLong(timeWindow).array()
            val mac = Mac.getInstance("HmacSHA1")
            mac.init(SecretKeySpec(keyBytes, "HmacSHA1"))
            val hash = mac.doFinal(data)
            val offset = hash[hash.size - 1].toInt() and 0x0F
            val binary =
                ((hash[offset].toInt() and 0x7F) shl 24) or
                    ((hash[offset + 1].toInt() and 0xFF) shl 16) or
                    ((hash[offset + 2].toInt() and 0xFF) shl 8) or
                    (hash[offset + 3].toInt() and 0xFF)
            val mod = 10.0.pow(digits.toDouble()).toInt()
            val otp = binary % mod
            otp.toString().padStart(digits, '0')
        } catch (_: Exception) {
            null
        }
    }

    private fun decodeBase32(raw: String): ByteArray? {
        val alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        val cleaned = raw.uppercase(Locale.ROOT).filter { !it.isWhitespace() && it != '=' }
        if (cleaned.isBlank()) return null

        var buffer = 0
        var bitsLeft = 0
        val out = ArrayList<Byte>()
        for (char in cleaned) {
            val value = alphabet.indexOf(char)
            if (value < 0) return null
            buffer = (buffer shl 5) or value
            bitsLeft += 5
            if (bitsLeft >= 8) {
                bitsLeft -= 8
                val b = (buffer shr bitsLeft) and 0xFF
                out.add(b.toByte())
            }
        }
        return out.toByteArray()
    }

    private fun sha256Hex(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { b -> "%02x".format(b) }
    }
}
