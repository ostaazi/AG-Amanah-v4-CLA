package com.amanah.child.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.util.Log
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.support.common.FileUtil
import org.tensorflow.lite.support.image.ImageProcessor
import org.tensorflow.lite.support.image.TensorImage
import org.tensorflow.lite.support.image.ops.ResizeOp
import java.text.Normalizer
import java.util.Locale
import kotlin.math.min

/**
 * Amanah Security Cortex (On-Device Engine) v3.0
 * - Hybrid policy engine for Arabic/English text threats (grooming, self-harm, violence, blackmail).
 * - Visual injury/blood cluster heuristic + NSFW model moderation.
 * - Tuned to reduce false positives from generic words (e.g. "secret") unless context is risky.
 */
object SecurityCortex {

    private const val MODEL_FILENAME = "nsfw_mobile.tflite"
    private var tflite: Interpreter? = null
    private var isAIReady = false

    private object AlertCategory {
        const val BULLYING = "تنمر إلكتروني"
        const val SELF_HARM = "إيذاء النفس"
        const val ADULT_CONTENT = "محتوى للبالغين"
        const val PREDATOR = "تواصل مشبوه"
        const val VIOLENCE = "تحريض على العنف"
        const val BLACKMAIL = "ابتزاز"
        const val SAFE = "آمن"
    }

    private fun normalizePatterns(values: List<String>): List<String> =
        values.map(::normalizeForMatch).filter { it.isNotBlank() }

    // Dynamic Threat Sets (Initialized with Factory Defaults)
    private val explicitPredatorPatterns = normalizePatterns(
        listOf(
            "send nudes", "show your body", "open camera now", "send private photo",
            "video call in bedroom", "ارسل صور عارية", "افتح الكاميرا الان",
            "صور خاصة", "صوري جسمك", "تعال خاص كاميرا"
        )
    ).toMutableSet()

    private val groomingAnchors = normalizePatterns(
        listOf(
            "secret", "dont tell", "home alone", "bedroom", "private room",
            "لا تقول لاحد", "سر بيننا", "لوحدك في البيت", "غرفتك", "بالسر"
        )
    ).toMutableSet()

    private val groomingActions = normalizePatterns(
        listOf(
            "send", "show", "photo", "pic", "camera", "video call", "meet",
            "address", "location", "ارسل", "ورني", "صورة", "صور", "كاميرا",
            "اتصال فيديو", "تعال", "مكانك", "عنوانك"
        )
    ).toMutableSet()

    private val selfHarmPatterns = normalizePatterns(
        listOf(
            "kill myself", "kill yourself", "i want to die", "suicide", "cut my skin",
            "cut yourself", "self harm", "انتحر", "ابي انتحر", "اقتل نفسي",
            "جرح نفسي", "اقطع جلدي", "اذبح نفسي"
        )
    ).toMutableSet()

    private val blackmailPatterns = normalizePatterns(
        listOf(
            "pay or leak", "send money or", "i will expose you", "i will leak your photos",
            "blackmail", "ابتزاز", "بفضحك", "بنشر صورك", "ادفع والا", "ارسل فلوس"
        )
    ).toMutableSet()

    private val violenceCriticalPatterns = normalizePatterns(
        listOf(
            "murder", "stab him", "shoot him", "kill now", "blood everywhere",
            "اذبح", "اطعن", "اقتله", "قتل", "دم كثير"
        )
    ).toMutableSet()

    private val violencePatterns = normalizePatterns(
        listOf(
            "kill", "blood", "weapon", "knife", "violent", "gore",
            "موت", "عنف", "سلاح", "سكين", "دم"
        )
    ).toMutableSet()

    private val adultPatterns = normalizePatterns(
        listOf(
            "porn", "xxx", "nude", "naked", "sex video",
            "سكس", "اباحي", "صور عارية", "محتوى اباحي"
        )
    ).toMutableSet()

    private val bullyingPatterns = normalizePatterns(
        listOf(
            "loser", "stupid", "hate you", "idiot",
            "غبي", "فاشل", "اكرهك", "حيوان"
        )
    ).toMutableSet()

    fun updateThreats(context: Context, category: String, newPatterns: List<String>) {
        val normalized = normalizePatterns(newPatterns)
        if (normalized.isEmpty()) return

        when (category) {
            AlertCategory.PREDATOR -> explicitPredatorPatterns.addAll(normalized)
            AlertCategory.SELF_HARM -> selfHarmPatterns.addAll(normalized)
            AlertCategory.BLACKMAIL -> blackmailPatterns.addAll(normalized)
            AlertCategory.VIOLENCE -> violenceCriticalPatterns.addAll(normalized)
            AlertCategory.ADULT_CONTENT -> adultPatterns.addAll(normalized)
            AlertCategory.BULLYING -> bullyingPatterns.addAll(normalized)
            "GROOMING_ANCHOR" -> groomingAnchors.addAll(normalized)
            else -> Log.w("SecurityCortex", "Unknown category update: $category")
        }
        // In real impl: Save to EncryptedSharedPreferences here to persist across reboots
        Log.i("SecurityCortex", "Updated threats for $category. Total: ${normalized.size}")
    }

    data class AnalysisResult(
        val isDanger: Boolean,
        val category: String,
        val severity: String,
        val score: Float
    )

    fun init(context: Context) {
        try {
            val fileList = context.assets.list("")
            if (fileList == null || !fileList.contains(MODEL_FILENAME)) {
                Log.w("SecurityCortex", "Model file '$MODEL_FILENAME' not found in assets.")
                return
            }

            val modelFile = FileUtil.loadMappedFile(context, MODEL_FILENAME)
            if (modelFile.capacity() < 1024) {
                Log.e(
                    "SecurityCortex",
                    "Placeholder model detected. Replace nsfw_mobile.tflite with a real model."
                )
                isAIReady = false
                return
            }

            tflite = Interpreter(modelFile, Interpreter.Options())
            isAIReady = true
            Log.i("SecurityCortex", "AI Vision Engine Loaded")
        } catch (e: Exception) {
            Log.e("SecurityCortex", "Failed to initialize AI Engine. Text-only mode active.", e)
            isAIReady = false
        }
    }

    fun analyzeText(text: String): AnalysisResult {
        val normalizedText = normalizeForMatch(text)
        if (normalizedText.isBlank()) {
            return AnalysisResult(false, AlertCategory.SAFE, "LOW", 0.0f)
        }

        if (containsAny(normalizedText, explicitPredatorPatterns)) {
            return AnalysisResult(true, AlertCategory.PREDATOR, "CRITICAL", 0.98f)
        }

        val hasGroomAnchor = containsAny(normalizedText, groomingAnchors)
        val hasGroomAction = containsAny(normalizedText, groomingActions)
        if (hasGroomAnchor && hasGroomAction) {
            return AnalysisResult(true, AlertCategory.PREDATOR, "CRITICAL", 0.94f)
        }

        if (containsAny(normalizedText, blackmailPatterns)) {
            return AnalysisResult(true, AlertCategory.BLACKMAIL, "CRITICAL", 0.96f)
        }

        if (containsAny(normalizedText, selfHarmPatterns)) {
            return AnalysisResult(true, AlertCategory.SELF_HARM, "CRITICAL", 0.97f)
        }

        if (containsAny(normalizedText, violenceCriticalPatterns)) {
            return AnalysisResult(true, AlertCategory.VIOLENCE, "CRITICAL", 0.95f)
        }

        if (containsAny(normalizedText, violencePatterns)) {
            return AnalysisResult(true, AlertCategory.VIOLENCE, "HIGH", 0.82f)
        }

        if (containsAny(normalizedText, adultPatterns)) {
            return AnalysisResult(true, AlertCategory.ADULT_CONTENT, "HIGH", 0.86f)
        }

        if (containsAny(normalizedText, bullyingPatterns)) {
            return AnalysisResult(true, AlertCategory.BULLYING, "MEDIUM", 0.75f)
        }

        return AnalysisResult(false, AlertCategory.SAFE, "LOW", 0.0f)
    }

    fun analyzeImage(bitmap: Bitmap): AnalysisResult {
        // 1. Zero-Latency Heuristic: Fast injury detection (CPU-based)
        detectInjuryClusters(bitmap)?.let { injury ->
            return injury
        }

        // 2. Zero-Latency AI: On-Device TFLite (GPU/NNAPI if available, else CPU)
        if (!isAIReady || tflite == null) {
            return AnalysisResult(false, AlertCategory.SAFE, "LOW", 0.0f)
        }

        try {
            val startTime = System.nanoTime()
            val imageProcessor = ImageProcessor.Builder()
                .add(ResizeOp(224, 224, ResizeOp.ResizeMethod.NEAREST_NEIGHBOR)) // Faster than BILINEAR
                .build()

            var tImage = TensorImage.fromBitmap(bitmap)
            tImage = imageProcessor.process(tImage)

            val probabilityBuffer = Array(1) { FloatArray(5) }
            tflite?.run(tImage.buffer, probabilityBuffer)

            // NSFWJS-compatible order: 0=Drawing, 1=Hentai, 2=Neutral, 3=Porn, 4=Sexy
            val hentaiScore = probabilityBuffer[0].getOrElse(1) { 0f }
            val neutralScore = probabilityBuffer[0].getOrElse(2) { 0f }
            val pornScore = probabilityBuffer[0].getOrElse(3) { 0f }
            val sexyScore = probabilityBuffer[0].getOrElse(4) { 0f }
            val explicitScore = maxOf(pornScore, hentaiScore)

            val elapsedMs = (System.nanoTime() - startTime) / 1_000_000
            Log.v("SecurityCortex", "Local AI Inference took ${elapsedMs}ms")

            // Stricter thresholds for zero-latency blocking to avoid false positives
            if (explicitScore >= 0.85f && explicitScore > neutralScore + 0.20f) {
                return AnalysisResult(true, AlertCategory.ADULT_CONTENT, "CRITICAL", explicitScore)
            }

            val strongSexyContext = sexyScore >= 0.96f && explicitScore >= 0.40f
            if (strongSexyContext && sexyScore > neutralScore + 0.15f) {
                val score = maxOf(sexyScore, explicitScore)
                return AnalysisResult(true, AlertCategory.ADULT_CONTENT, "HIGH", score)
            }
        } catch (e: Exception) {
            Log.e("SecurityCortex", "Local AI inference failed", e)
        }

        return AnalysisResult(false, AlertCategory.SAFE, "LOW", 0.0f)
    }

    private fun detectInjuryClusters(bitmap: Bitmap): AnalysisResult? {
        try {
            val width = bitmap.width.coerceAtLeast(1)
            val height = bitmap.height.coerceAtLeast(1)
            // Lower resolution for speed (96px instead of 128px) -> <50ms processing
            val targetWidth = 96
            val targetHeight = ((height.toFloat() / width.toFloat()) * targetWidth)
                .toInt()
                .coerceAtLeast(64)
                .coerceAtMost(192)

            val scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, false) // Fast scale
            val scaledWidth = scaled.width
            val scaledHeight = scaled.height
            val pixels = IntArray(scaledWidth * scaledHeight)
            scaled.getPixels(pixels, 0, scaledWidth, 0, 0, scaledWidth, scaledHeight)

            val hsv = FloatArray(3)
            var dangerPixels = 0
            val gridSize = 8
            val rows = scaledHeight / gridSize
            val cols = scaledWidth / gridSize
            var clusters = 0

            for (row in 0 until rows) {
                for (col in 0 until cols) {
                    var cellDanger = 0
                    for (y in 0 until gridSize) {
                        for (x in 0 until gridSize) {
                            val px = (row * gridSize + y) * scaledWidth + (col * gridSize + x)
                            if (px >= pixels.size) continue
                            val c = pixels[px]
                            
                            // Optimized HSV conversion and check
                            val r = (c shr 16) and 0xFF
                            val g = (c shr 8) and 0xFF
                            val b = c and 0xFF
                            
                            // Quick pre-filter: Skip if not reddish (R must be dominant)
                            if (r < g + 20 || r < b + 20) continue

                            Color.colorToHSV(c, hsv)
                            val hue = hsv[0]
                            val sat = hsv[1]
                            val value = hsv[2]

                            // Tuned Blood/Injury ranges
                            val freshBlood = (hue <= 18f || hue >= 345f) && sat >= 0.45f && value >= 0.25f
                            val deepInjury = (hue <= 25f || hue >= 330f) && sat >= 0.35f && value in 0.15f..0.55f
                            
                            if (freshBlood || deepInjury) {
                                dangerPixels++
                                cellDanger++
                            }
                        }
                    }
                    val cellArea = gridSize * gridSize
                    if (cellDanger >= (cellArea * 0.35f)) { // 35% of block is blood -> Cluster found
                        clusters++
                    }
                }
            }

            val totalPixels = (scaledWidth * scaledHeight).toFloat().coerceAtLeast(1f)
            val dangerRatio = dangerPixels / totalPixels

            if (scaled !== bitmap) {
                scaled.recycle()
            }

            // Zero-Latency strict thresholds
            if (clusters >= 3 && dangerRatio >= 0.05f) {
                val score = min(0.99f, 0.60f + (clusters * 0.10f))
                return AnalysisResult(true, AlertCategory.VIOLENCE, "CRITICAL", score)
            }
            if (clusters >= 2 && dangerRatio >= 0.08f) {
                return AnalysisResult(true, AlertCategory.VIOLENCE, "HIGH", 0.90f)
            }
        } catch (e: Exception) {
            Log.w("SecurityCortex", "Injury heuristc failed: ${e.message}")
        }
        return null
    }

    private fun containsAny(normalizedText: String, patterns: Collection<String>): Boolean {
        for (pattern in patterns) {
            if (normalizedText.contains(pattern)) {
                return true
            }
        }
        return false
    }

    private fun normalizeForMatch(input: String): String {
        val base = Normalizer.normalize(input, Normalizer.Form.NFKC)
            .lowercase(Locale.getDefault())
            .replace(Regex("[\\u064B-\\u065F\\u0670]"), "")
            .replace('أ', 'ا')
            .replace('إ', 'ا')
            .replace('آ', 'ا')
            .replace('ة', 'ه')
            .replace('ى', 'ي')

        return base
            .replace(Regex("[^\\p{L}\\p{N}\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
