package com.amanah.child.utils

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.util.Log
import org.tensorflow.lite.DataType
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.support.common.FileUtil
import org.tensorflow.lite.support.common.ops.NormalizeOp
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

    private const val NSFW_MODEL_FILENAME = "nsfw_mobile.tflite"
    private val VIOLENCE_MODEL_FILENAMES = listOf(
        "violence_scene_mobile.tflite",
        "violence_scene.tflite",
        "violence_mobile.tflite"
    )
    // Keep Android visual behavior aligned with legacy visualSentinel profile.
    private const val LEGACY_VISUAL_SENTINEL_PROFILE = true

    private const val PREFS_NAME = "AmanahPrefs"
    private const val PREF_NSFW_EXPLICIT_CRITICAL = "visualThreshold.nsfw.explicitCritical"
    private const val PREF_NSFW_SEXY_MEDIUM = "visualThreshold.nsfw.sexyMedium"
    private const val PREF_VIOLENCE_SCENE_MEDIUM = "visualThreshold.violenceScene.medium"
    private const val PREF_VIOLENCE_SCENE_HIGH = "visualThreshold.violenceScene.high"
    private const val PREF_VIOLENCE_SCENE_CRITICAL = "visualThreshold.violenceScene.critical"
    private const val PREF_VIOLENCE_SCENE_SAFE_SUPPRESSION = "visualThreshold.violenceScene.safeSuppression"
    private const val PREF_VIOLENCE_SCENE_MARGIN_GUARD = "visualThreshold.violenceScene.marginGuard"
    private const val PREF_INJURY_FAST_PATH = "visualThreshold.injury.fastPathScore"
    private const val PREF_INJURY_CLUSTER_CELL_RATIO = "visualThreshold.injury.clusterCellRatio"
    private const val PREF_INJURY_DANGER_RATIO = "visualThreshold.injury.minDangerRatio"
    private const val PREF_INJURY_VARIANCE_GUARD = "visualThreshold.injury.varianceGuard"
    private const val PREF_TEXT_SEVERITY_MEDIUM = "textThreshold.severity.medium"
    private const val PREF_TEXT_SEVERITY_HIGH = "textThreshold.severity.high"
    private const val PREF_TEXT_SEVERITY_CRITICAL = "textThreshold.severity.critical"
    private const val PREF_TEXT_GATE_PREDATOR = "textThreshold.category.predator"
    private const val PREF_TEXT_GATE_SELF_HARM = "textThreshold.category.selfHarm"
    private const val PREF_TEXT_GATE_BLACKMAIL = "textThreshold.category.blackmail"
    private const val PREF_TEXT_GATE_VIOLENCE = "textThreshold.category.violence"
    private const val PREF_TEXT_GATE_ADULT = "textThreshold.category.adultContent"
    private const val PREF_TEXT_GATE_BULLYING = "textThreshold.category.bullying"

    // Defaults
    private const val DEFAULT_NSFW_EXPLICIT_CRITICAL = 0.50f
    private const val DEFAULT_NSFW_SEXY_MEDIUM = 0.75f
    private const val DEFAULT_VIOLENCE_SCENE_MEDIUM = 0.64f
    private const val DEFAULT_VIOLENCE_SCENE_HIGH = 0.78f
    private const val DEFAULT_VIOLENCE_SCENE_CRITICAL = 0.90f
    private const val DEFAULT_VIOLENCE_SCENE_SAFE_SUPPRESSION = 0.57f
    private const val DEFAULT_VIOLENCE_SCENE_MARGIN_GUARD = 0.10f
    private const val DEFAULT_INJURY_FAST_PATH_SCORE = 0.90f
    private const val DEFAULT_INJURY_CLUSTER_CELL_RATIO = 0.35f
    private const val DEFAULT_INJURY_DANGER_RATIO = 0.05f
    private const val DEFAULT_INJURY_VARIANCE_GUARD = 95f
    private const val DEFAULT_TEXT_SEVERITY_MEDIUM = 0.70f
    private const val DEFAULT_TEXT_SEVERITY_HIGH = 0.82f
    private const val DEFAULT_TEXT_SEVERITY_CRITICAL = 0.94f
    private const val DEFAULT_TEXT_GATE_PREDATOR = 0.90f
    private const val DEFAULT_TEXT_GATE_SELF_HARM = 0.84f
    private const val DEFAULT_TEXT_GATE_BLACKMAIL = 0.90f
    private const val DEFAULT_TEXT_GATE_VIOLENCE = 0.80f
    private const val DEFAULT_TEXT_GATE_ADULT = 0.82f
    private const val DEFAULT_TEXT_GATE_BULLYING = 0.72f

    // Runtime thresholds (overridable by parent command).
    @Volatile private var nsfwExplicitCriticalThreshold = DEFAULT_NSFW_EXPLICIT_CRITICAL
    @Volatile private var nsfwSexyMediumThreshold = DEFAULT_NSFW_SEXY_MEDIUM
    @Volatile private var violenceSceneMediumThreshold = DEFAULT_VIOLENCE_SCENE_MEDIUM
    @Volatile private var violenceSceneHighThreshold = DEFAULT_VIOLENCE_SCENE_HIGH
    @Volatile private var violenceSceneCriticalThreshold = DEFAULT_VIOLENCE_SCENE_CRITICAL
    @Volatile private var violenceSceneSafeSuppressionThreshold = DEFAULT_VIOLENCE_SCENE_SAFE_SUPPRESSION
    @Volatile private var violenceSceneMarginGuardThreshold = DEFAULT_VIOLENCE_SCENE_MARGIN_GUARD
    @Volatile private var injuryFastPathScoreThreshold = DEFAULT_INJURY_FAST_PATH_SCORE
    @Volatile private var injuryClusterCellRatioThreshold = DEFAULT_INJURY_CLUSTER_CELL_RATIO
    @Volatile private var injuryDangerRatioThreshold = DEFAULT_INJURY_DANGER_RATIO
    @Volatile private var injuryVarianceGuardThreshold = DEFAULT_INJURY_VARIANCE_GUARD
    @Volatile private var textSeverityMediumThreshold = DEFAULT_TEXT_SEVERITY_MEDIUM
    @Volatile private var textSeverityHighThreshold = DEFAULT_TEXT_SEVERITY_HIGH
    @Volatile private var textSeverityCriticalThreshold = DEFAULT_TEXT_SEVERITY_CRITICAL
    @Volatile private var textGatePredatorThreshold = DEFAULT_TEXT_GATE_PREDATOR
    @Volatile private var textGateSelfHarmThreshold = DEFAULT_TEXT_GATE_SELF_HARM
    @Volatile private var textGateBlackmailThreshold = DEFAULT_TEXT_GATE_BLACKMAIL
    @Volatile private var textGateViolenceThreshold = DEFAULT_TEXT_GATE_VIOLENCE
    @Volatile private var textGateAdultThreshold = DEFAULT_TEXT_GATE_ADULT
    @Volatile private var textGateBullyingThreshold = DEFAULT_TEXT_GATE_BULLYING
    private var nsfwTflite: Interpreter? = null
    private var violenceTflite: Interpreter? = null
    private var isNsfwReady = false
    private var isViolenceSceneReady = false
    private var violenceModelFile: String = "none"

    private object AlertCategory {
        const val BULLYING = "تنمر إلكتروني"
        const val SELF_HARM = "إيذاء النفس"
        const val ADULT_CONTENT = "محتوى للبالغين"
        const val PREDATOR = "تواصل مشبوه"
        const val VIOLENCE = "تحريض على العنف"
        const val BLACKMAIL = "ابتزاز"
        const val SAFE = "آمن"
    }

    private enum class InputNormalizationMode {
        ZERO_TO_ONE,
        MINUS_ONE_TO_ONE
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

    private val groomingImageRequestPatterns = normalizePatterns(
        listOf(
            "send pic now", "send photo now", "send me your photo", "show body now",
            "turn on camera now", "open cam now", "lets do private video",
            "snap me now", "drop pic", "dm me pic",
            "ارسل صورتك الان", "ارسل صورة الان", "ابعت صورتك الان", "صور نفسك الان",
            "ورني جسمك", "افتح الكاميرا الان", "تعال خاص فيديو", "كلمنا فيديو بالسر",
            "ارسل صورة بدون ملابس", "صور خاصة الان", "صور جسمك"
        )
    ).toMutableSet()

    private val predatorContextSecrecyPatterns = normalizePatterns(
        listOf(
            "secret", "dont tell", "keep it between us", "between us only", "delete this chat",
            "hide this", "no one should know", "لا تقول لاحد", "سر بيننا", "بالسر",
            "لا تعلم احد", "احذف المحادثه", "امسح الرسائل"
        )
    ).toMutableSet()

    private val predatorContextIsolationPatterns = normalizePatterns(
        listOf(
            "are you alone", "home alone", "go to your room", "close the door", "private room",
            "come alone", "alone now", "لوحدك", "لحالك", "غرفتك", "قفل الباب", "تعال لوحدك"
        )
    ).toMutableSet()

    private val predatorContextPlatformShiftPatterns = normalizePatterns(
        listOf(
            "snapchat", "snap", "whatsapp", "telegram", "kik", "skype", "discord",
            "private chat", "dm me", "username", "share your number", "خاص", "سناب",
            "واتس", "تليجرام", "يوزر", "رقمك", "رقمي", "تعال خاص"
        )
    ).toMutableSet()

    private val predatorContextMediaRequestPatterns = normalizePatterns(
        listOf(
            "send pic", "send photo", "send video", "open camera", "video call", "show me",
            "turn camera on", "share image", "drop a pic", "ارسل صوره", "ابعت صوره",
            "افتح الكاميرا", "اتصال فيديو", "ورني", "صور نفسك"
        )
    ).toMutableSet()

    private val predatorContextMeetupPatterns = normalizePatterns(
        listOf(
            "meet me", "meet now", "send location", "drop pin", "address", "where do you live",
            "pick you up", "come to", "location now", "نلتقي", "عنوانك", "مكانك",
            "ارسل موقعك", "تعال", "وين ساكن"
        )
    ).toMutableSet()

    private val predatorContextPressurePatterns = normalizePatterns(
        listOf(
            "now", "right now", "hurry", "urgent", "dont ignore", "or else", "if you dont",
            "last chance", "within an hour", "الان", "بسرعه", "مستعجل", "لا تتجاهل",
            "والا", "خلال ساعه", "لازم"
        )
    ).toMutableSet()

    private val predatorContextCoercionPatterns = normalizePatterns(
        listOf(
            "i will expose you", "i will leak", "i will post", "we will expose you",
            "send or leak", "pay or leak", "بفضحك", "بنشر", "بكشف", "ارسل والا"
        )
    ).toMutableSet()

    private val selfHarmPatterns = normalizePatterns(
        listOf(
            "kill myself", "kill yourself", "i want to die", "suicide", "cut my skin",
            "cut yourself", "self harm", "انتحر", "ابي انتحر", "اقتل نفسي",
            "جرح نفسي", "اقطع جلدي", "اذبح نفسي"
        )
    ).toMutableSet()

    private val selfHarmActionPatterns = normalizePatterns(
        listOf(
            "hurt myself", "harm myself", "i will cut", "i will swallow", "i will drink poison",
            "touch electric wire", "electrocute myself", "hang myself",
            "اوذي نفسي", "احط السلاح على نفسي", "ابتلع", "اشرب سم", "اصعق نفسي",
            "امسك سلك كهربا", "المس سلك كهرباء", "اشنق نفسي", "اطلق على نفسي"
        )
    ).toMutableSet()

    private val selfHarmMeansPatterns = normalizePatterns(
        listOf(
            "knife", "blade", "gun", "pistol", "rope", "poison", "pills overdose",
            "electric wire", "live wire", "battery acid", "chlorine",
            "سكين", "شفرة", "سلاح", "مسدس", "حبل", "سم", "حبوب كثيرة",
            "سلك كهرباء", "اسلاك كهربائية", "كلور", "مادة حارقة"
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

    private val violenceIncitementPatterns = normalizePatterns(
        listOf(
            "go kill him", "burn him", "beat him badly", "attack them now", "shoot the class",
            "روح اقتله", "اضربه بقوة", "احرقه", "هاجمهم الان", "نفذ الطعنه", "فجر المكان"
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
            "porn", "xxx", "nude", "naked", "sex video", "sexy", "sexy pic", "hot pic", "nsfw",
            "سكس", "اباحي", "صور عارية", "محتوى اباحي", "سكسي"
        )
    ).toMutableSet()

    private val bullyingPatterns = normalizePatterns(
        listOf(
            "loser", "stupid", "hate you", "idiot",
            "غبي", "فاشل", "اكرهك", "حيوان"
        )
    ).toMutableSet()

    private val bullyingSeverePatterns = normalizePatterns(
        listOf(
            "everyone hates you", "nobody wants you", "you should disappear",
            "we will expose you", "we will ruin your life", "go die",
            "الكل يكرهك", "ماحد يبغاك", "اختف من الدنيا", "بنفضحك",
            "بنخرب حياتك", "انقلع ومت", "محد يبيك"
        )
    ).toMutableSet()

    private data class SkeletonDangerGroupRaw(
        val words: List<String>,
        val category: String,
        val baseSeverity: String,
        val baseScore: Float
    )

    private data class SkeletonDangerGroupIndexed(
        val category: String,
        val baseSeverity: String,
        val baseScore: Float,
        val skeletons: List<String>
    )

    private val skeletonDangerGroupsRaw = listOf(
        SkeletonDangerGroupRaw(
            words = listOf(
                "صوره", "فيديو", "مقاطع", "عاري", "صور", "فضيحه", "اباحي",
                "porn", "sex", "naked", "nude", "xxx", "bitch", "fck", "shit",
                "dick", "pussy", "f*ck"
            ),
            category = AlertCategory.ADULT_CONTENT,
            baseSeverity = "MEDIUM",
            baseScore = 0.76f
        ),
        SkeletonDangerGroupRaw(
            words = listOf(
                "خاص", "سناب", "رقمك", "رقمي", "اتصال", "كاميرا", "واتس", "يوزر",
                "تليجرام", "snapchat", "whatsapp", "meet", "kik", "skype", "address"
            ),
            category = AlertCategory.PREDATOR,
            baseSeverity = "HIGH",
            baseScore = 0.88f
        ),
        SkeletonDangerGroupRaw(
            words = listOf(
                "انتحار", "اقتل", "موت", "نفسي", "اذبح", "kill", "suicide",
                "die", "hurt", "blood", "cut"
            ),
            category = AlertCategory.SELF_HARM,
            baseSeverity = "CRITICAL",
            baseScore = 0.97f
        ),
        SkeletonDangerGroupRaw(
            words = listOf(
                "غبي", "حيوان", "حقير", "كلب", "فاشل", "stupid", "hate", "loser", "idiot", "bitch"
            ),
            category = AlertCategory.BULLYING,
            baseSeverity = "MEDIUM",
            baseScore = 0.75f
        ),
        SkeletonDangerGroupRaw(
            words = listOf(
                "ابتزاز", "بفضحك", "بنشر", "صورك", "بفضح", "blackmail", "leak", "shame"
            ),
            category = AlertCategory.BLACKMAIL,
            baseSeverity = "CRITICAL",
            baseScore = 0.96f
        )
    )

    private val skeletonActionMarkers = listOf(
        "ارسل", "عطني", "ورني", "هات", "send", "show", "give", "pic", "video", "add"
    )
        .map(::purifyToSkeleton)
        .filter { it.length >= 2 }
        .distinct()

    private val skeletonDangerGroupsIndexed = skeletonDangerGroupsRaw.map { raw ->
        SkeletonDangerGroupIndexed(
            category = raw.category,
            baseSeverity = raw.baseSeverity,
            baseScore = raw.baseScore,
            skeletons = raw.words.map(::purifyToSkeleton).filter { it.length >= 2 }.distinct()
        )
    }

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
            "GROOMING_ACTION" -> groomingActions.addAll(normalized)
            "GROOMING_IMAGE_REQUEST" -> groomingImageRequestPatterns.addAll(normalized)
            "SELF_HARM_ACTION" -> selfHarmActionPatterns.addAll(normalized)
            "SELF_HARM_MEANS" -> selfHarmMeansPatterns.addAll(normalized)
            "VIOLENCE_INCITEMENT" -> violenceIncitementPatterns.addAll(normalized)
            "BULLYING_SEVERE" -> bullyingSeverePatterns.addAll(normalized)
            else -> Log.w("SecurityCortex", "Unknown category update: $category")
        }
        // In real impl: Save to EncryptedSharedPreferences here to persist across reboots
        Log.i("SecurityCortex", "Updated threats for $category. Total: ${normalized.size}")
    }

    data class AnalysisResult(
        val isDanger: Boolean,
        val category: String,
        val severity: String,
        val score: Float,
        val reasonAr: String = "",
        val reasonEn: String = "",
        val normalizedExcerpt: String = "",
        val matchedSignals: List<String> = emptyList()
    )

    fun normalizeTextForAudit(input: String): String = normalizeForMatch(input)
    fun isVisionEngineReady(): Boolean = isNsfwReady || isViolenceSceneReady

    fun init(context: Context) {
        try {
            val fileList = context.assets.list("")?.toSet().orEmpty()

            nsfwTflite?.close()
            nsfwTflite = null
            isNsfwReady = false

            if (fileList.contains(NSFW_MODEL_FILENAME)) {
                nsfwTflite = loadInterpreterFromAsset(context, NSFW_MODEL_FILENAME)
                isNsfwReady = nsfwTflite != null
                if (!isNsfwReady) {
                    Log.w("SecurityCortex", "NSFW model failed to initialize: $NSFW_MODEL_FILENAME")
                }
            } else {
                Log.w("SecurityCortex", "NSFW model missing: $NSFW_MODEL_FILENAME")
            }

            violenceTflite?.close()
            violenceTflite = null
            isViolenceSceneReady = false
            violenceModelFile = "none"

            val matchedViolenceModel = VIOLENCE_MODEL_FILENAMES.firstOrNull { fileList.contains(it) }
            if (matchedViolenceModel != null) {
                violenceTflite = loadInterpreterFromAsset(context, matchedViolenceModel)
                isViolenceSceneReady = violenceTflite != null
                if (isViolenceSceneReady) {
                    violenceModelFile = matchedViolenceModel
                    Log.i("SecurityCortex", "Violence scene model loaded: $matchedViolenceModel")
                } else {
                    Log.w("SecurityCortex", "Violence scene model failed: $matchedViolenceModel")
                }
            } else {
                Log.w(
                    "SecurityCortex",
                    "Violence scene model not found. Expected one of: ${VIOLENCE_MODEL_FILENAMES.joinToString()}"
                )
            }

            if (isVisionEngineReady()) {
                loadVisualThresholdOverrides(context)
                loadTextRuleThresholdOverrides(context)
                Log.i(
                    "SecurityCortex",
                    "AI vision engines ready. nsfw=$isNsfwReady violenceScene=$isViolenceSceneReady"
                )
            } else {
                loadVisualThresholdOverrides(context)
                loadTextRuleThresholdOverrides(context)
                Log.w("SecurityCortex", "No visual models are ready. Text-only mode active.")
            }
        } catch (e: Exception) {
            Log.e("SecurityCortex", "Failed to initialize AI engines. Text-only mode active.", e)
            isNsfwReady = false
            isViolenceSceneReady = false
            nsfwTflite = null
            violenceTflite = null
            violenceModelFile = "none"
            loadTextRuleThresholdOverrides(context)
        }
    }

    fun applyVisualThresholdOverrides(context: Context, rawConfig: Any?): Boolean {
        val config = rawConfig as? Map<*, *> ?: return false
        val resetToDefault = (config["resetToDefault"] as? Boolean) == true

        if (resetToDefault) {
            resetVisualThresholdsToDefault()
            clearVisualThresholdOverridesFromPrefs(context)
            Log.i("SecurityCortex", "Visual threshold overrides cleared; defaults restored.")
            return true
        }

        val nsfwCfg = config["nsfw"] as? Map<*, *>
        val violenceCfg = config["violenceScene"] as? Map<*, *>
        val injuryCfg = config["injury"] as? Map<*, *>

        nsfwExplicitCriticalThreshold = parseThresholdFloat(
            nsfwCfg?.get("explicitCritical"),
            min = 0.30f,
            max = 0.95f,
            fallback = nsfwExplicitCriticalThreshold
        )
        nsfwSexyMediumThreshold = parseThresholdFloat(
            nsfwCfg?.get("sexyMedium"),
            min = 0.40f,
            max = 0.98f,
            fallback = nsfwSexyMediumThreshold
        )

        violenceSceneMediumThreshold = parseThresholdFloat(
            violenceCfg?.get("medium"),
            min = 0.45f,
            max = 0.90f,
            fallback = violenceSceneMediumThreshold
        )
        violenceSceneHighThreshold = parseThresholdFloat(
            violenceCfg?.get("high"),
            min = 0.55f,
            max = 0.96f,
            fallback = violenceSceneHighThreshold
        )
        violenceSceneCriticalThreshold = parseThresholdFloat(
            violenceCfg?.get("critical"),
            min = 0.65f,
            max = 0.99f,
            fallback = violenceSceneCriticalThreshold
        )
        violenceSceneSafeSuppressionThreshold = parseThresholdFloat(
            violenceCfg?.get("safeSuppression"),
            min = 0.20f,
            max = 0.90f,
            fallback = violenceSceneSafeSuppressionThreshold
        )
        violenceSceneMarginGuardThreshold = parseThresholdFloat(
            violenceCfg?.get("marginGuard"),
            min = 0.02f,
            max = 0.30f,
            fallback = violenceSceneMarginGuardThreshold
        )

        injuryFastPathScoreThreshold = parseThresholdFloat(
            injuryCfg?.get("fastPathScore"),
            min = 0.60f,
            max = 0.99f,
            fallback = injuryFastPathScoreThreshold
        )
        injuryClusterCellRatioThreshold = parseThresholdFloat(
            injuryCfg?.get("clusterCellRatio"),
            min = 0.20f,
            max = 0.70f,
            fallback = injuryClusterCellRatioThreshold
        )
        injuryDangerRatioThreshold = parseThresholdFloat(
            injuryCfg?.get("minDangerRatio"),
            min = 0.01f,
            max = 0.20f,
            fallback = injuryDangerRatioThreshold
        )
        injuryVarianceGuardThreshold = parseThresholdFloat(
            injuryCfg?.get("varianceGuard"),
            min = 20f,
            max = 300f,
            fallback = injuryVarianceGuardThreshold
        )

        enforceThresholdConsistency()
        persistVisualThresholdOverrides(context)

        Log.i(
            "SecurityCortex",
            "Visual thresholds updated: nsfw(exp=${"%.2f".format(Locale.US, nsfwExplicitCriticalThreshold)}, sexy=${"%.2f".format(Locale.US, nsfwSexyMediumThreshold)}) " +
                "violence(m=${"%.2f".format(Locale.US, violenceSceneMediumThreshold)}, h=${"%.2f".format(Locale.US, violenceSceneHighThreshold)}, c=${"%.2f".format(Locale.US, violenceSceneCriticalThreshold)}) " +
                "injury(fast=${"%.2f".format(Locale.US, injuryFastPathScoreThreshold)}, cell=${"%.2f".format(Locale.US, injuryClusterCellRatioThreshold)}, ratio=${"%.3f".format(Locale.US, injuryDangerRatioThreshold)}, var=${"%.1f".format(Locale.US, injuryVarianceGuardThreshold)})"
        )
        return true
    }

    private fun parseThresholdFloat(value: Any?, min: Float, max: Float, fallback: Float): Float {
        val parsed = when (value) {
            is Number -> value.toFloat()
            is String -> value.trim().toFloatOrNull()
            else -> null
        }
        return parsed?.coerceIn(min, max) ?: fallback.coerceIn(min, max)
    }

    private fun resetVisualThresholdsToDefault() {
        nsfwExplicitCriticalThreshold = DEFAULT_NSFW_EXPLICIT_CRITICAL
        nsfwSexyMediumThreshold = DEFAULT_NSFW_SEXY_MEDIUM
        violenceSceneMediumThreshold = DEFAULT_VIOLENCE_SCENE_MEDIUM
        violenceSceneHighThreshold = DEFAULT_VIOLENCE_SCENE_HIGH
        violenceSceneCriticalThreshold = DEFAULT_VIOLENCE_SCENE_CRITICAL
        violenceSceneSafeSuppressionThreshold = DEFAULT_VIOLENCE_SCENE_SAFE_SUPPRESSION
        violenceSceneMarginGuardThreshold = DEFAULT_VIOLENCE_SCENE_MARGIN_GUARD
        injuryFastPathScoreThreshold = DEFAULT_INJURY_FAST_PATH_SCORE
        injuryClusterCellRatioThreshold = DEFAULT_INJURY_CLUSTER_CELL_RATIO
        injuryDangerRatioThreshold = DEFAULT_INJURY_DANGER_RATIO
        injuryVarianceGuardThreshold = DEFAULT_INJURY_VARIANCE_GUARD
        enforceThresholdConsistency()
    }

    private fun enforceThresholdConsistency() {
        val minGap = 0.02f
        if (violenceSceneHighThreshold <= violenceSceneMediumThreshold + minGap) {
            violenceSceneHighThreshold = (violenceSceneMediumThreshold + minGap).coerceAtMost(0.98f)
        }
        if (violenceSceneCriticalThreshold <= violenceSceneHighThreshold + minGap) {
            violenceSceneCriticalThreshold = (violenceSceneHighThreshold + minGap).coerceAtMost(0.99f)
        }
    }

    private fun loadVisualThresholdOverrides(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        nsfwExplicitCriticalThreshold = prefs.getFloat(PREF_NSFW_EXPLICIT_CRITICAL, DEFAULT_NSFW_EXPLICIT_CRITICAL)
        nsfwSexyMediumThreshold = prefs.getFloat(PREF_NSFW_SEXY_MEDIUM, DEFAULT_NSFW_SEXY_MEDIUM)
        violenceSceneMediumThreshold = prefs.getFloat(PREF_VIOLENCE_SCENE_MEDIUM, DEFAULT_VIOLENCE_SCENE_MEDIUM)
        violenceSceneHighThreshold = prefs.getFloat(PREF_VIOLENCE_SCENE_HIGH, DEFAULT_VIOLENCE_SCENE_HIGH)
        violenceSceneCriticalThreshold = prefs.getFloat(PREF_VIOLENCE_SCENE_CRITICAL, DEFAULT_VIOLENCE_SCENE_CRITICAL)
        violenceSceneSafeSuppressionThreshold = prefs.getFloat(PREF_VIOLENCE_SCENE_SAFE_SUPPRESSION, DEFAULT_VIOLENCE_SCENE_SAFE_SUPPRESSION)
        violenceSceneMarginGuardThreshold = prefs.getFloat(PREF_VIOLENCE_SCENE_MARGIN_GUARD, DEFAULT_VIOLENCE_SCENE_MARGIN_GUARD)
        injuryFastPathScoreThreshold = prefs.getFloat(PREF_INJURY_FAST_PATH, DEFAULT_INJURY_FAST_PATH_SCORE)
        injuryClusterCellRatioThreshold = prefs.getFloat(PREF_INJURY_CLUSTER_CELL_RATIO, DEFAULT_INJURY_CLUSTER_CELL_RATIO)
        injuryDangerRatioThreshold = prefs.getFloat(PREF_INJURY_DANGER_RATIO, DEFAULT_INJURY_DANGER_RATIO)
        injuryVarianceGuardThreshold = prefs.getFloat(PREF_INJURY_VARIANCE_GUARD, DEFAULT_INJURY_VARIANCE_GUARD)
        enforceThresholdConsistency()
    }

    private fun persistVisualThresholdOverrides(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putFloat(PREF_NSFW_EXPLICIT_CRITICAL, nsfwExplicitCriticalThreshold)
            .putFloat(PREF_NSFW_SEXY_MEDIUM, nsfwSexyMediumThreshold)
            .putFloat(PREF_VIOLENCE_SCENE_MEDIUM, violenceSceneMediumThreshold)
            .putFloat(PREF_VIOLENCE_SCENE_HIGH, violenceSceneHighThreshold)
            .putFloat(PREF_VIOLENCE_SCENE_CRITICAL, violenceSceneCriticalThreshold)
            .putFloat(PREF_VIOLENCE_SCENE_SAFE_SUPPRESSION, violenceSceneSafeSuppressionThreshold)
            .putFloat(PREF_VIOLENCE_SCENE_MARGIN_GUARD, violenceSceneMarginGuardThreshold)
            .putFloat(PREF_INJURY_FAST_PATH, injuryFastPathScoreThreshold)
            .putFloat(PREF_INJURY_CLUSTER_CELL_RATIO, injuryClusterCellRatioThreshold)
            .putFloat(PREF_INJURY_DANGER_RATIO, injuryDangerRatioThreshold)
            .putFloat(PREF_INJURY_VARIANCE_GUARD, injuryVarianceGuardThreshold)
            .apply()
    }

    private fun clearVisualThresholdOverridesFromPrefs(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .remove(PREF_NSFW_EXPLICIT_CRITICAL)
            .remove(PREF_NSFW_SEXY_MEDIUM)
            .remove(PREF_VIOLENCE_SCENE_MEDIUM)
            .remove(PREF_VIOLENCE_SCENE_HIGH)
            .remove(PREF_VIOLENCE_SCENE_CRITICAL)
            .remove(PREF_VIOLENCE_SCENE_SAFE_SUPPRESSION)
            .remove(PREF_VIOLENCE_SCENE_MARGIN_GUARD)
            .remove(PREF_INJURY_FAST_PATH)
            .remove(PREF_INJURY_CLUSTER_CELL_RATIO)
            .remove(PREF_INJURY_DANGER_RATIO)
            .remove(PREF_INJURY_VARIANCE_GUARD)
            .apply()
    }

    fun applyTextRuleThresholdOverrides(context: Context, rawConfig: Any?): Boolean {
        val config = rawConfig as? Map<*, *> ?: return false
        val resetToDefault = (config["resetToDefault"] as? Boolean) == true

        if (resetToDefault) {
            resetTextRuleThresholdsToDefault()
            clearTextRuleThresholdOverridesFromPrefs(context)
            Log.i("SecurityCortex", "Text rule-engine threshold overrides cleared; defaults restored.")
            return true
        }

        val severityCfg = config["severity"] as? Map<*, *>
        val categoryCfg = config["category"] as? Map<*, *>

        textSeverityMediumThreshold = parseThresholdFloat(
            severityCfg?.get("medium"),
            min = 0.45f,
            max = 0.90f,
            fallback = textSeverityMediumThreshold
        )
        textSeverityHighThreshold = parseThresholdFloat(
            severityCfg?.get("high"),
            min = 0.55f,
            max = 0.97f,
            fallback = textSeverityHighThreshold
        )
        textSeverityCriticalThreshold = parseThresholdFloat(
            severityCfg?.get("critical"),
            min = 0.70f,
            max = 0.99f,
            fallback = textSeverityCriticalThreshold
        )

        textGatePredatorThreshold = parseThresholdFloat(
            categoryCfg?.get("predator"),
            min = 0.45f,
            max = 0.99f,
            fallback = textGatePredatorThreshold
        )
        textGateSelfHarmThreshold = parseThresholdFloat(
            categoryCfg?.get("selfHarm"),
            min = 0.45f,
            max = 0.99f,
            fallback = textGateSelfHarmThreshold
        )
        textGateBlackmailThreshold = parseThresholdFloat(
            categoryCfg?.get("blackmail"),
            min = 0.45f,
            max = 0.99f,
            fallback = textGateBlackmailThreshold
        )
        textGateViolenceThreshold = parseThresholdFloat(
            categoryCfg?.get("violence"),
            min = 0.45f,
            max = 0.99f,
            fallback = textGateViolenceThreshold
        )
        textGateAdultThreshold = parseThresholdFloat(
            categoryCfg?.get("adultContent"),
            min = 0.45f,
            max = 0.99f,
            fallback = textGateAdultThreshold
        )
        textGateBullyingThreshold = parseThresholdFloat(
            categoryCfg?.get("bullying"),
            min = 0.45f,
            max = 0.99f,
            fallback = textGateBullyingThreshold
        )

        enforceTextThresholdConsistency()
        persistTextRuleThresholdOverrides(context)

        Log.i(
            "SecurityCortex",
            "Text thresholds updated: severity(m=${"%.2f".format(Locale.US, textSeverityMediumThreshold)}, h=${"%.2f".format(Locale.US, textSeverityHighThreshold)}, c=${"%.2f".format(Locale.US, textSeverityCriticalThreshold)}) " +
                "gate(pred=${"%.2f".format(Locale.US, textGatePredatorThreshold)}, self=${"%.2f".format(Locale.US, textGateSelfHarmThreshold)}, blackmail=${"%.2f".format(Locale.US, textGateBlackmailThreshold)}, violence=${"%.2f".format(Locale.US, textGateViolenceThreshold)}, adult=${"%.2f".format(Locale.US, textGateAdultThreshold)}, bullying=${"%.2f".format(Locale.US, textGateBullyingThreshold)})"
        )
        return true
    }

    private fun resetTextRuleThresholdsToDefault() {
        textSeverityMediumThreshold = DEFAULT_TEXT_SEVERITY_MEDIUM
        textSeverityHighThreshold = DEFAULT_TEXT_SEVERITY_HIGH
        textSeverityCriticalThreshold = DEFAULT_TEXT_SEVERITY_CRITICAL
        textGatePredatorThreshold = DEFAULT_TEXT_GATE_PREDATOR
        textGateSelfHarmThreshold = DEFAULT_TEXT_GATE_SELF_HARM
        textGateBlackmailThreshold = DEFAULT_TEXT_GATE_BLACKMAIL
        textGateViolenceThreshold = DEFAULT_TEXT_GATE_VIOLENCE
        textGateAdultThreshold = DEFAULT_TEXT_GATE_ADULT
        textGateBullyingThreshold = DEFAULT_TEXT_GATE_BULLYING
        enforceTextThresholdConsistency()
    }

    private fun enforceTextThresholdConsistency() {
        val minGap = 0.02f
        if (textSeverityHighThreshold <= textSeverityMediumThreshold + minGap) {
            textSeverityHighThreshold = (textSeverityMediumThreshold + minGap).coerceAtMost(0.97f)
        }
        if (textSeverityCriticalThreshold <= textSeverityHighThreshold + minGap) {
            textSeverityCriticalThreshold = (textSeverityHighThreshold + minGap).coerceAtMost(0.99f)
        }
    }

    private fun loadTextRuleThresholdOverrides(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        textSeverityMediumThreshold = prefs.getFloat(PREF_TEXT_SEVERITY_MEDIUM, DEFAULT_TEXT_SEVERITY_MEDIUM)
        textSeverityHighThreshold = prefs.getFloat(PREF_TEXT_SEVERITY_HIGH, DEFAULT_TEXT_SEVERITY_HIGH)
        textSeverityCriticalThreshold = prefs.getFloat(PREF_TEXT_SEVERITY_CRITICAL, DEFAULT_TEXT_SEVERITY_CRITICAL)
        textGatePredatorThreshold = prefs.getFloat(PREF_TEXT_GATE_PREDATOR, DEFAULT_TEXT_GATE_PREDATOR)
        textGateSelfHarmThreshold = prefs.getFloat(PREF_TEXT_GATE_SELF_HARM, DEFAULT_TEXT_GATE_SELF_HARM)
        textGateBlackmailThreshold = prefs.getFloat(PREF_TEXT_GATE_BLACKMAIL, DEFAULT_TEXT_GATE_BLACKMAIL)
        textGateViolenceThreshold = prefs.getFloat(PREF_TEXT_GATE_VIOLENCE, DEFAULT_TEXT_GATE_VIOLENCE)
        textGateAdultThreshold = prefs.getFloat(PREF_TEXT_GATE_ADULT, DEFAULT_TEXT_GATE_ADULT)
        textGateBullyingThreshold = prefs.getFloat(PREF_TEXT_GATE_BULLYING, DEFAULT_TEXT_GATE_BULLYING)
        enforceTextThresholdConsistency()
    }

    private fun persistTextRuleThresholdOverrides(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putFloat(PREF_TEXT_SEVERITY_MEDIUM, textSeverityMediumThreshold)
            .putFloat(PREF_TEXT_SEVERITY_HIGH, textSeverityHighThreshold)
            .putFloat(PREF_TEXT_SEVERITY_CRITICAL, textSeverityCriticalThreshold)
            .putFloat(PREF_TEXT_GATE_PREDATOR, textGatePredatorThreshold)
            .putFloat(PREF_TEXT_GATE_SELF_HARM, textGateSelfHarmThreshold)
            .putFloat(PREF_TEXT_GATE_BLACKMAIL, textGateBlackmailThreshold)
            .putFloat(PREF_TEXT_GATE_VIOLENCE, textGateViolenceThreshold)
            .putFloat(PREF_TEXT_GATE_ADULT, textGateAdultThreshold)
            .putFloat(PREF_TEXT_GATE_BULLYING, textGateBullyingThreshold)
            .apply()
    }

    private fun clearTextRuleThresholdOverridesFromPrefs(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .remove(PREF_TEXT_SEVERITY_MEDIUM)
            .remove(PREF_TEXT_SEVERITY_HIGH)
            .remove(PREF_TEXT_SEVERITY_CRITICAL)
            .remove(PREF_TEXT_GATE_PREDATOR)
            .remove(PREF_TEXT_GATE_SELF_HARM)
            .remove(PREF_TEXT_GATE_BLACKMAIL)
            .remove(PREF_TEXT_GATE_VIOLENCE)
            .remove(PREF_TEXT_GATE_ADULT)
            .remove(PREF_TEXT_GATE_BULLYING)
            .apply()
    }

    private fun loadInterpreterFromAsset(context: Context, filename: String): Interpreter? {
        return try {
            val modelFile = FileUtil.loadMappedFile(context, filename)
            if (modelFile.capacity() < 1024) {
                Log.e("SecurityCortex", "Model '$filename' seems placeholder/invalid (too small).")
                null
            } else {
                Interpreter(modelFile, Interpreter.Options())
            }
        } catch (e: Exception) {
            Log.e("SecurityCortex", "Unable to load model '$filename'", e)
            null
        }
    }

    private fun textCategoryGate(category: String): Float {
        return when (category) {
            AlertCategory.PREDATOR -> textGatePredatorThreshold
            AlertCategory.SELF_HARM -> textGateSelfHarmThreshold
            AlertCategory.BLACKMAIL -> textGateBlackmailThreshold
            AlertCategory.VIOLENCE -> textGateViolenceThreshold
            AlertCategory.ADULT_CONTENT -> textGateAdultThreshold
            AlertCategory.BULLYING -> textGateBullyingThreshold
            else -> textSeverityMediumThreshold
        }
    }

    private fun applyTextRuleThresholds(candidate: AnalysisResult): AnalysisResult? {
        if (!candidate.isDanger || candidate.category == AlertCategory.SAFE) return candidate

        val score = candidate.score.coerceIn(0f, 0.99f)
        val categoryGate = textCategoryGate(candidate.category)
        val minGate = maxOf(textSeverityMediumThreshold, categoryGate)
        if (score < minGate) {
            return null
        }

        val severity = when {
            score >= textSeverityCriticalThreshold -> "CRITICAL"
            score >= textSeverityHighThreshold -> "HIGH"
            else -> "MEDIUM"
        }

        val thresholdSignals = listOf(
            "textScore=${"%.3f".format(Locale.US, score)}",
            "textGate=${"%.3f".format(Locale.US, minGate)}",
            "textSeverity(m=${"%.2f".format(Locale.US, textSeverityMediumThreshold)},h=${"%.2f".format(Locale.US, textSeverityHighThreshold)},c=${"%.2f".format(Locale.US, textSeverityCriticalThreshold)})"
        )

        return candidate.copy(
            score = score,
            severity = severity,
            matchedSignals = mergeSignals(candidate.matchedSignals, thresholdSignals)
        )
    }

    private fun detectObfuscatedSkeletonThreat(
        rawText: String,
        excerpt: String,
        normalizationSignals: List<String>
    ): AnalysisResult? {
        val inputSkeleton = purifyToSkeleton(rawText)
        if (inputSkeleton.length < 2) {
            return null
        }

        for (group in skeletonDangerGroupsIndexed) {
            val matchedSkeletons = group.skeletons.filter { inputSkeleton.contains(it) }.take(5)
            if (matchedSkeletons.isEmpty()) {
                continue
            }
            val hasAction = skeletonActionMarkers.any { marker -> inputSkeleton.contains(marker) }
            val severity = if (hasAction) "CRITICAL" else group.baseSeverity
            val score = if (hasAction) 0.98f else group.baseScore
            val signals = mutableListOf(
                "detector=text_skeleton",
                "skeletonAction=${if (hasAction) 1 else 0}",
                "skeletonLen=${inputSkeleton.length}"
            )
            signals += matchedSkeletons.map { "skeletonMatch=$it" }

            val candidate = AnalysisResult(
                isDanger = true,
                category = group.category,
                severity = severity,
                score = score,
                reasonAr = "تم رصد نص مموّه عبر التطبيع الهيكلي للحروف والرموز (Skeleton normalization).",
                reasonEn = "Obfuscated text matched using skeleton normalization.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(signals, normalizationSignals + "norm=skeleton")
            )
            applyTextRuleThresholds(candidate)?.let { return it }
        }

        return null
    }

    private fun detectPredatorContextIntent(
        variants: List<String>,
        excerpt: String,
        normalizationSignals: List<String>
    ): AnalysisResult? {
        val secrecy = findMatchedPatterns(variants, predatorContextSecrecyPatterns, limit = 4)
        val isolation = findMatchedPatterns(variants, predatorContextIsolationPatterns, limit = 4)
        val shift = findMatchedPatterns(variants, predatorContextPlatformShiftPatterns, limit = 4)
        val media = findMatchedPatterns(variants, predatorContextMediaRequestPatterns, limit = 4)
        val meetup = findMatchedPatterns(variants, predatorContextMeetupPatterns, limit = 4)
        val pressure = findMatchedPatterns(variants, predatorContextPressurePatterns, limit = 4)
        val coercion = findMatchedPatterns(variants, predatorContextCoercionPatterns, limit = 4)

        val familyCount = listOf(secrecy, isolation, shift, media, meetup, pressure, coercion)
            .count { it.isNotEmpty() }
        val hasCoreLuringAction = media.isNotEmpty() || meetup.isNotEmpty() || shift.isNotEmpty()
        if (familyCount < 2 || !hasCoreLuringAction) {
            return null
        }

        var score = 0.38f
        if (secrecy.isNotEmpty()) score += 0.13f
        if (isolation.isNotEmpty()) score += 0.12f
        if (shift.isNotEmpty()) score += 0.10f
        if (media.isNotEmpty()) score += 0.14f
        if (meetup.isNotEmpty()) score += 0.14f
        if (pressure.isNotEmpty()) score += 0.08f
        if (coercion.isNotEmpty()) score += 0.14f

        if (secrecy.isNotEmpty() && media.isNotEmpty()) score += 0.10f
        if (secrecy.isNotEmpty() && shift.isNotEmpty()) score += 0.07f
        if (isolation.isNotEmpty() && media.isNotEmpty()) score += 0.08f
        if (meetup.isNotEmpty() && pressure.isNotEmpty()) score += 0.07f
        if (coercion.isNotEmpty() && (media.isNotEmpty() || meetup.isNotEmpty())) score += 0.08f

        score = score.coerceIn(0f, 0.99f)
        if (score < 0.80f) {
            return null
        }

        val intentAr = when {
            coercion.isNotEmpty() -> "ابتزاز/إكراه بعد جمع مؤشرات استدراج"
            media.isNotEmpty() && secrecy.isNotEmpty() -> "استدراج لطلب وسائط خاصة مع سرية"
            meetup.isNotEmpty() && isolation.isNotEmpty() -> "استدراج للقاء أو مشاركة موقع مع عزل"
            shift.isNotEmpty() && secrecy.isNotEmpty() -> "نقل المحادثة لمنصة خاصة بهدف الإخفاء"
            else -> "نمط استدراج متعدد الإشارات"
        }
        val intentEn = when {
            coercion.isNotEmpty() -> "Coercive/extortion intent after luring progression"
            media.isNotEmpty() && secrecy.isNotEmpty() -> "Private-media solicitation with secrecy framing"
            meetup.isNotEmpty() && isolation.isNotEmpty() -> "Luring toward meetup/location sharing with isolation cues"
            shift.isNotEmpty() && secrecy.isNotEmpty() -> "Private-channel migration with concealment intent"
            else -> "Multi-signal luring progression pattern"
        }

        val category = if (coercion.isNotEmpty()) AlertCategory.BLACKMAIL else AlertCategory.PREDATOR
        val severity = when {
            score >= 0.95f -> "CRITICAL"
            score >= 0.86f -> "HIGH"
            else -> "MEDIUM"
        }

        val signalTokens = mutableListOf<String>()
        if (secrecy.isNotEmpty()) signalTokens += "ctx=secrecy"
        if (isolation.isNotEmpty()) signalTokens += "ctx=isolation"
        if (shift.isNotEmpty()) signalTokens += "ctx=platform_shift"
        if (media.isNotEmpty()) signalTokens += "ctx=media_request"
        if (meetup.isNotEmpty()) signalTokens += "ctx=meetup_location"
        if (pressure.isNotEmpty()) signalTokens += "ctx=pressure"
        if (coercion.isNotEmpty()) signalTokens += "ctx=coercion"
        signalTokens += "detector=context_intent"
        signalTokens += "ctxFamilies=$familyCount"
        signalTokens += "ctxIntentScore=${"%.3f".format(Locale.US, score)}"
        signalTokens += (secrecy + isolation + shift + media + meetup + pressure + coercion)
            .distinct()
            .take(6)
            .map { "ctxMatch=$it" }

        val candidate = AnalysisResult(
            isDanger = true,
            category = category,
            severity = severity,
            score = score,
            reasonAr = "تحليل سياق الحوار يشير إلى $intentAr.",
            reasonEn = "Conversation-context analysis indicates $intentEn.",
            normalizedExcerpt = excerpt,
            matchedSignals = mergeSignals(signalTokens, normalizationSignals + "norm=contextual-intent")
        )
        return applyTextRuleThresholds(candidate)
    }

    fun analyzeText(text: String): AnalysisResult {
        val variantsBundle = buildTextVariants(text)
        val normalizedText = variantsBundle.primary
        val variants = variantsBundle.variants
        val normalizationSignals = variantsBundle.signals
        val excerpt = (normalizedText.ifBlank { variants.firstOrNull().orEmpty() }).take(600)
        if (variants.isEmpty()) {
            return AnalysisResult(
                isDanger = false,
                category = AlertCategory.SAFE,
                severity = "LOW",
                score = 0.0f,
                reasonAr = "لا يوجد نص قابل للتحليل بعد التطبيع.",
                reasonEn = "No analyzable text after normalization."
            )
        }

        detectObfuscatedSkeletonThreat(text, excerpt, normalizationSignals)?.let { return it }

        findMatchedPatterns(variants, groomingImageRequestPatterns).takeIf { it.isNotEmpty() }?.let { matched ->
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.PREDATOR,
                severity = "CRITICAL",
                score = 0.99f,
                reasonAr = "تم رصد طلب مباشر لصور/فيديو خاص مع مؤشرات استدراج.",
                reasonEn = "Direct private photo/video solicitation with grooming indicators detected.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(matched, normalizationSignals)
            ))?.let { return it }
        }

        findMatchedPatterns(variants, explicitPredatorPatterns).takeIf { it.isNotEmpty() }?.let { matched ->
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.PREDATOR,
                severity = "CRITICAL",
                score = 0.98f,
                reasonAr = "تطابق قوي مع عبارات استدراج/طلب محتوى خاص.",
                reasonEn = "Strong match with grooming or explicit private-content solicitation phrases.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(matched, normalizationSignals)
            ))?.let { return it }
        }

        detectPredatorContextIntent(variants, excerpt, normalizationSignals)?.let { return it }

        val matchedAnchors = findMatchedPatterns(variants, groomingAnchors)
        val matchedActions = findMatchedPatterns(variants, groomingActions)
        if (matchedAnchors.isNotEmpty() && matchedActions.isNotEmpty()) {
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.PREDATOR,
                severity = "CRITICAL",
                score = 0.94f,
                reasonAr = "نمط استدراج: مؤشرات سرية/عزل + طلب تفاعل مباشر.",
                reasonEn = "Grooming pattern: secrecy/isolation indicators combined with direct action request.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals((matchedAnchors + matchedActions), normalizationSignals)
            ))?.let { return it }
        }

        findMatchedPatterns(variants, blackmailPatterns).takeIf { it.isNotEmpty() }?.let { matched ->
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.BLACKMAIL,
                severity = "CRITICAL",
                score = 0.96f,
                reasonAr = "مطابقة مباشرة لعبارات ابتزاز أو تهديد بنشر/فضح.",
                reasonEn = "Direct match with extortion or exposure-threat language.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(matched, normalizationSignals)
            ))?.let { return it }
        }

        findMatchedPatterns(variants, selfHarmPatterns).takeIf { it.isNotEmpty() }?.let { matched ->
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.SELF_HARM,
                severity = "CRITICAL",
                score = 0.97f,
                reasonAr = "مطابقة لمؤشرات إيذاء النفس أو الانتحار.",
                reasonEn = "Matched self-harm or suicide intent indicators.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(matched, normalizationSignals)
            ))?.let { return it }
        }

        val selfHarmActions = findMatchedPatterns(variants, selfHarmActionPatterns)
        val selfHarmMeans = findMatchedPatterns(variants, selfHarmMeansPatterns)
        if (selfHarmActions.isNotEmpty() && selfHarmMeans.isNotEmpty()) {
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.SELF_HARM,
                severity = "CRITICAL",
                score = 0.95f,
                reasonAr = "تم رصد نية إيذاء النفس مع وسيلة خطرة (ابتلاع/سلاح/كهرباء).",
                reasonEn = "Detected self-harm intent with dangerous means (ingestion/weapon/electrical hazard).",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(selfHarmActions + selfHarmMeans, normalizationSignals)
            ))?.let { return it }
        }
        if (selfHarmMeans.isNotEmpty()) {
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.SELF_HARM,
                severity = "HIGH",
                score = 0.84f,
                reasonAr = "تم رصد إشارات وسائل مؤذية للنفس وتتطلب متابعة فورية.",
                reasonEn = "Detected risky self-harm means references requiring immediate follow-up.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(selfHarmMeans, normalizationSignals)
            ))?.let { return it }
        }

        findMatchedPatterns(variants, violenceIncitementPatterns).takeIf { it.isNotEmpty() }?.let { matched ->
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.VIOLENCE,
                severity = "CRITICAL",
                score = 0.95f,
                reasonAr = "تم رصد تحريض مباشر على العنف أو الهجوم.",
                reasonEn = "Direct violent incitement or attack instruction detected.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(matched, normalizationSignals)
            ))?.let { return it }
        }

        findMatchedPatterns(variants, violenceCriticalPatterns).takeIf { it.isNotEmpty() }?.let { matched ->
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.VIOLENCE,
                severity = "CRITICAL",
                score = 0.95f,
                reasonAr = "مطابقة قوية لعبارات عنف مباشر شديد الخطورة.",
                reasonEn = "Strong match with explicit high-risk violence expressions.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(matched, normalizationSignals)
            ))?.let { return it }
        }

        findMatchedPatterns(variants, violencePatterns).takeIf { it.isNotEmpty() }?.let { matched ->
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.VIOLENCE,
                severity = "HIGH",
                score = 0.82f,
                reasonAr = "مطابقة لمفردات عنف وتتطلب مراجعة عاجلة.",
                reasonEn = "Matched violence vocabulary requiring urgent review.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(matched, normalizationSignals)
            ))?.let { return it }
        }

        findMatchedPatterns(variants, adultPatterns).takeIf { it.isNotEmpty() }?.let { matched ->
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.ADULT_CONTENT,
                severity = "HIGH",
                score = 0.86f,
                reasonAr = "مطابقة لمفردات محتوى للبالغين.",
                reasonEn = "Matched adult-content vocabulary.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(matched, normalizationSignals)
            ))?.let { return it }
        }

        findMatchedPatterns(variants, bullyingSeverePatterns).takeIf { it.isNotEmpty() }?.let { matched ->
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.BULLYING,
                severity = "HIGH",
                score = 0.88f,
                reasonAr = "تم رصد تنمر شديد/إهانة جارحة أو دفع للضرر.",
                reasonEn = "Severe bullying or coercive humiliation content detected.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(matched, normalizationSignals)
            ))?.let { return it }
        }

        findMatchedPatterns(variants, bullyingPatterns).takeIf { it.isNotEmpty() }?.let { matched ->
            applyTextRuleThresholds(AnalysisResult(
                isDanger = true,
                category = AlertCategory.BULLYING,
                severity = "MEDIUM",
                score = 0.75f,
                reasonAr = "مطابقة لمفردات تنمر/إساءة لفظية.",
                reasonEn = "Matched bullying or verbal-abuse vocabulary.",
                normalizedExcerpt = excerpt,
                matchedSignals = mergeSignals(matched, normalizationSignals)
            ))?.let { return it }
        }

        return AnalysisResult(
            isDanger = false,
            category = AlertCategory.SAFE,
            severity = "LOW",
            score = 0.0f,
            reasonAr = "لم يتم العثور على مؤشرات خطورة ضمن سياسات النص.",
            reasonEn = "No risky indicators were matched by text policies.",
            normalizedExcerpt = excerpt
        )
    }

    fun analyzeImage(bitmap: Bitmap): AnalysisResult {
        // Legacy visualSentinel behavior: run injury cluster detector first.
        val injuryCandidate = detectInjuryClusters(bitmap)
        val strongLegacyInjury =
            injuryCandidate != null &&
                injuryCandidate.severity == "CRITICAL" &&
                injuryCandidate.score >= injuryFastPathScoreThreshold
        if (LEGACY_VISUAL_SENTINEL_PROFILE && strongLegacyInjury) {
            return injuryCandidate
        }

        val violenceSceneCandidate = if (isViolenceSceneReady) {
            runViolenceSceneModel(bitmap)
        } else {
            null
        }

        if (!isNsfwReady && !isViolenceSceneReady) {
            return AnalysisResult(
                isDanger = false,
                category = AlertCategory.SAFE,
                severity = "LOW",
                score = 0.0f,
                reasonAr = "محركات الرؤية غير جاهزة حالياً.",
                reasonEn = "Visual models are currently unavailable."
            )
        }

        var adultCandidate: AnalysisResult? = null
        try {
            val startTime = System.nanoTime()
            if (isNsfwReady) {
                val zeroToOneScores = runNsfwModel(bitmap, InputNormalizationMode.ZERO_TO_ONE)
                val selectedScores = when {
                    zeroToOneScores == null -> null
                    zeroToOneScores.explicit < 0.60f -> {
                        val minusOneScores = runNsfwModel(bitmap, InputNormalizationMode.MINUS_ONE_TO_ONE)
                        selectBestScoresCandidate(zeroToOneScores, minusOneScores)
                    }
                    else -> zeroToOneScores
                }

                if (selectedScores != null) {
                    val hentaiScore = selectedScores.hentai
                    val neutralScore = selectedScores.neutral
                    val pornScore = selectedScores.porn
                    val sexyScore = selectedScores.sexy
                    val explicitScore = maxOf(pornScore, hentaiScore)
                    val preprocessingTag = when (selectedScores.preprocessing) {
                        InputNormalizationMode.ZERO_TO_ONE -> "0_1"
                        InputNormalizationMode.MINUS_ONE_TO_ONE -> "-1_1"
                    }

                    val elapsedMs = (System.nanoTime() - startTime) / 1_000_000
                    Log.v(
                        "SecurityCortex",
                        "NSFW Inference ${elapsedMs}ms | preprocess=$preprocessingTag | porn=${"%.3f".format(Locale.US, pornScore)} hentai=${"%.3f".format(Locale.US, hentaiScore)} sexy=${"%.3f".format(Locale.US, sexyScore)} neutral=${"%.3f".format(Locale.US, neutralScore)}"
                    )

                    val baseSignals = listOf(
                        "detector=nsfw_model",
                        "profile=${if (LEGACY_VISUAL_SENTINEL_PROFILE) "legacy_visual_sentinel" else "current"}",
                        "preprocess=$preprocessingTag",
                        "porn=${"%.3f".format(Locale.US, pornScore)}",
                        "hentai=${"%.3f".format(Locale.US, hentaiScore)}",
                        "neutral=${"%.3f".format(Locale.US, neutralScore)}",
                        "sexy=${"%.3f".format(Locale.US, sexyScore)}"
                    )

                    if (LEGACY_VISUAL_SENTINEL_PROFILE) {
                        if (explicitScore > nsfwExplicitCriticalThreshold) {
                            adultCandidate = AnalysisResult(
                                isDanger = true,
                                category = AlertCategory.ADULT_CONTENT,
                                severity = "CRITICAL",
                                score = explicitScore,
                                reasonAr = "تم رصد محتوى بصري بالغ صريح (Porn/Hentai) وفق ملف Visual Sentinel.",
                                reasonEn = "NSFW explicit visual content detected by legacy Visual Sentinel profile (Porn/Hentai).",
                                matchedSignals = baseSignals
                            )
                        } else if (sexyScore > nsfwSexyMediumThreshold) {
                            adultCandidate = AnalysisResult(
                                isDanger = true,
                                category = AlertCategory.ADULT_CONTENT,
                                severity = "MEDIUM",
                                score = sexyScore,
                                reasonAr = "تم رصد سياق بصري إيحائي (Sexy) بدرجة مرتفعة.",
                                reasonEn = "NSFW suggestive visual context detected by legacy Visual Sentinel profile (Sexy).",
                                matchedSignals = baseSignals
                            )
                        }
                    } else {
                        if (explicitScore >= 0.72f && explicitScore > neutralScore + 0.03f) {
                            adultCandidate = AnalysisResult(
                                isDanger = true,
                                category = AlertCategory.ADULT_CONTENT,
                                severity = "CRITICAL",
                                score = explicitScore,
                                reasonAr = "مؤشر بصري قوي على محتوى بالغ (Porn/Hentai) بثقة مرتفعة.",
                                reasonEn = "Strong visual signal for adult content (Porn/Hentai) with high confidence.",
                                matchedSignals = baseSignals
                            )
                        } else if (explicitScore >= 0.58f && explicitScore > neutralScore - 0.02f) {
                            adultCandidate = AnalysisResult(
                                isDanger = true,
                                category = AlertCategory.ADULT_CONTENT,
                                severity = "HIGH",
                                score = explicitScore,
                                reasonAr = "تم رصد مؤشر بصري محتمل لمحتوى بالغ ويتطلب مراجعة فورية.",
                                reasonEn = "Potential visual adult-content signal detected and requires immediate review.",
                                matchedSignals = baseSignals
                            )
                        } else {
                            val strongSexyContext = sexyScore >= 0.88f && explicitScore >= 0.28f
                            if (strongSexyContext && sexyScore > neutralScore + 0.06f) {
                                val score = maxOf(sexyScore, explicitScore)
                                adultCandidate = AnalysisResult(
                                    isDanger = true,
                                    category = AlertCategory.ADULT_CONTENT,
                                    severity = "HIGH",
                                    score = score,
                                    reasonAr = "مؤشر محتوى بالغ (Sexy context) مع سياق داعم.",
                                    reasonEn = "Adult-content signal (sexy context) with supporting explicit context.",
                                    matchedSignals = baseSignals
                                )
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("SecurityCortex", "Local AI inference failed", e)
        }

        if (violenceSceneCandidate != null && violenceSceneCandidate.severity == "CRITICAL") {
            return violenceSceneCandidate
        }

        if (adultCandidate != null && violenceSceneCandidate != null) {
            return if (adultCandidate.score >= violenceSceneCandidate.score + 0.08f) {
                adultCandidate
            } else {
                violenceSceneCandidate
            }
        }

        if (adultCandidate != null) {
            return adultCandidate
        }

        if (violenceSceneCandidate != null) {
            return violenceSceneCandidate
        }

        if (!LEGACY_VISUAL_SENTINEL_PROFILE &&
            injuryCandidate != null &&
            injuryCandidate.severity == "CRITICAL" &&
            injuryCandidate.score >= injuryFastPathScoreThreshold
        ) {
            return injuryCandidate
        }

        return AnalysisResult(
            isDanger = false,
            category = AlertCategory.SAFE,
            severity = "LOW",
            score = 0.0f,
            reasonAr = "لم يتم رصد إشارات بصرية خطرة.",
            reasonEn = "No risky visual indicators were detected."
        )
    }

    private data class NsfwModelRun(
        val drawing: Float,
        val hentai: Float,
        val neutral: Float,
        val porn: Float,
        val sexy: Float,
        val explicit: Float,
        val preprocessing: InputNormalizationMode
    )

    private fun selectBestScoresCandidate(
        first: NsfwModelRun,
        second: NsfwModelRun?
    ): NsfwModelRun {
        if (second == null) return first
        val firstAdultMargin = maxOf(first.explicit, first.sexy) - first.neutral
        val secondAdultMargin = maxOf(second.explicit, second.sexy) - second.neutral
        return if (secondAdultMargin > firstAdultMargin + 0.03f) second else first
    }

    private fun runNsfwModel(
        bitmap: Bitmap,
        normalization: InputNormalizationMode
    ): NsfwModelRun? {
        val interpreter = nsfwTflite ?: return null
        val scores = runModelRawScores(interpreter, bitmap, normalization) ?: return null
        val outSize = scores.size
        if (outSize < 5) return null

        // NSFWJS-compatible order: 0=Drawing, 1=Hentai, 2=Neutral, 3=Porn, 4=Sexy
        val calibrated = calibrateNsfwScores(scores)
        val drawing = calibrated.getOrElse(0) { 0f }
        val hentai = calibrated.getOrElse(1) { 0f }
        val neutral = calibrated.getOrElse(2) { 0f }
        val porn = calibrated.getOrElse(3) { 0f }
        val sexy = calibrated.getOrElse(4) { 0f }
        val explicit = maxOf(porn, hentai)

        return NsfwModelRun(
            drawing = drawing,
            hentai = hentai,
            neutral = neutral,
            porn = porn,
            sexy = sexy,
            explicit = explicit,
            preprocessing = normalization
        )
    }

    private data class ViolenceSceneRun(
        val score: Float,
        val severity: String,
        val reasonAr: String,
        val reasonEn: String,
        val matchedSignals: List<String>
    )

    private fun runViolenceSceneModel(bitmap: Bitmap): AnalysisResult? {
        val interpreter = violenceTflite ?: return null
        try {
            val startNs = System.nanoTime()

            val zeroToOneScores = runModelRawScores(interpreter, bitmap, InputNormalizationMode.ZERO_TO_ONE)
            val minusOneScores = runModelRawScores(interpreter, bitmap, InputNormalizationMode.MINUS_ONE_TO_ONE)
            val selected = selectViolenceScoresCandidate(zeroToOneScores, minusOneScores) ?: return null
            val calibrated = calibrateProbabilities(selected)
            if (calibrated.isEmpty()) return null

            val eval = evaluateViolenceScores(calibrated) ?: return null

            val elapsedMs = (System.nanoTime() - startNs) / 1_000_000
            Log.v(
                "SecurityCortex",
                "ViolenceScene Inference ${elapsedMs}ms | score=${"%.3f".format(Locale.US, eval.score)} model=$violenceModelFile"
            )

            return AnalysisResult(
                isDanger = true,
                category = AlertCategory.VIOLENCE,
                severity = eval.severity,
                score = eval.score,
                reasonAr = eval.reasonAr,
                reasonEn = eval.reasonEn,
                matchedSignals = eval.matchedSignals
            )
        } catch (e: Exception) {
            Log.w("SecurityCortex", "Violence scene model inference failed: ${e.message}")
        }
        return null
    }

    private fun selectViolenceScoresCandidate(
        first: FloatArray?,
        second: FloatArray?
    ): FloatArray? {
        if (first == null) return second
        if (second == null) return first

        val firstEval = evaluateViolenceScores(calibrateProbabilities(first))
        val secondEval = evaluateViolenceScores(calibrateProbabilities(second))
        if (firstEval == null) return second
        if (secondEval == null) return first
        return if (secondEval.score > firstEval.score + 0.03f) second else first
    }

    private fun evaluateViolenceScores(probabilities: FloatArray): ViolenceSceneRun? {
        if (probabilities.isEmpty()) return null

        // Supported output styles:
        // [v] sigmoid or [safe, violence] or multiclass with class0 ~= safe.
        val safeScore = when (probabilities.size) {
            1 -> (1f - probabilities[0]).coerceIn(0f, 1f)
            else -> probabilities.getOrElse(0) { 0f }.coerceIn(0f, 1f)
        }
        val riskyScores = when (probabilities.size) {
            1 -> listOf(probabilities[0].coerceIn(0f, 1f))
            2 -> listOf(probabilities[1].coerceIn(0f, 1f))
            else -> probabilities.drop(1).map { it.coerceIn(0f, 1f) }
        }
        val riskyTop = riskyScores.maxOrNull() ?: 0f
        val riskySecond = riskyScores.sortedDescending().getOrElse(1) { 0f }
        val topRiskMargin = riskyTop - riskySecond

        val score = when (probabilities.size) {
            1 -> probabilities[0].coerceIn(0f, 1f)
            2 -> probabilities[1].coerceIn(0f, 1f)
            else -> maxOf(riskyTop, (1f - safeScore) * 0.85f)
        }
        val riskVsSafeMargin = score - safeScore

        if (score < violenceSceneMediumThreshold) return null
        val safeSuppressed =
            safeScore >= violenceSceneSafeSuppressionThreshold && score < violenceSceneHighThreshold
        val weakMargin =
            riskVsSafeMargin < violenceSceneMarginGuardThreshold && score < violenceSceneCriticalThreshold
        val ambiguousTopClass =
            probabilities.size > 2 && topRiskMargin < 0.06f && score < violenceSceneHighThreshold
        if (safeSuppressed || weakMargin || ambiguousTopClass) {
            return null
        }

        val severity = when {
            score >= violenceSceneCriticalThreshold -> "CRITICAL"
            score >= violenceSceneHighThreshold -> "HIGH"
            else -> "MEDIUM"
        }

        val topIdx = when (probabilities.size) {
            1 -> 1
            else -> probabilities.indices.maxByOrNull { probabilities[it] } ?: 0
        }
        val topValue = when (probabilities.size) {
            1 -> score
            else -> probabilities.getOrElse(topIdx) { 0f }.coerceIn(0f, 1f)
        }

        val signals = listOf(
            "detector=violence_scene_model",
            "model=$violenceModelFile",
            "score=${"%.3f".format(Locale.US, score)}",
            "safe=${"%.3f".format(Locale.US, safeScore)}",
            "margin=${"%.3f".format(Locale.US, riskVsSafeMargin)}",
            "riskTop=${"%.3f".format(Locale.US, riskyTop)}",
            "riskTopMargin=${"%.3f".format(Locale.US, topRiskMargin)}",
            "topClass=$topIdx",
            "topClassScore=${"%.3f".format(Locale.US, topValue)}",
            "classes=${probabilities.size}"
        )

        return ViolenceSceneRun(
            score = score,
            severity = severity,
            reasonAr = "تم رصد مشهد عنيف/قسوة بصرياً عبر نموذج مشاهد العنف على الجهاز (score=${"%.2f".format(Locale.US, score * 100)}%).",
            reasonEn = "On-device violence-scene model detected violent/cruel visual context (score=${"%.2f".format(Locale.US, score * 100)}%).",
            matchedSignals = signals
        )
    }

    private fun runModelRawScores(
        interpreter: Interpreter,
        bitmap: Bitmap,
        normalization: InputNormalizationMode
    ): FloatArray? {
        val inputTensor = interpreter.getInputTensor(0)
        val inputType = inputTensor.dataType()
        val inputShape = inputTensor.shape()
        val targetH = inputShape.getOrNull(1) ?: 224
        val targetW = inputShape.getOrNull(2) ?: 224

        val imageProcessorBuilder = ImageProcessor.Builder()
            .add(ResizeOp(targetH, targetW, ResizeOp.ResizeMethod.BILINEAR))
        if (inputType == DataType.FLOAT32) {
            when (normalization) {
                InputNormalizationMode.ZERO_TO_ONE -> imageProcessorBuilder.add(NormalizeOp(0f, 255f))
                InputNormalizationMode.MINUS_ONE_TO_ONE -> imageProcessorBuilder.add(NormalizeOp(127.5f, 127.5f))
            }
        }
        val imageProcessor = imageProcessorBuilder.build()

        var tImage = TensorImage(inputType)
        tImage.load(bitmap)
        tImage = imageProcessor.process(tImage)

        val outputTensor = interpreter.getOutputTensor(0)
        val outSize = outputTensor.shape().lastOrNull() ?: return null
        if (outSize <= 0) {
            return null
        }

        return when (outputTensor.dataType()) {
            DataType.FLOAT32 -> {
                val out = Array(1) { FloatArray(outSize) }
                interpreter.run(tImage.buffer, out)
                out[0]
            }
            DataType.UINT8 -> {
                val out = Array(1) { ByteArray(outSize) }
                interpreter.run(tImage.buffer, out)
                val qp = outputTensor.quantizationParams()
                val scale = if (qp.scale == 0f) 1f else qp.scale
                val zero = qp.zeroPoint
                FloatArray(outSize) { idx ->
                    ((out[0][idx].toInt() and 0xFF) - zero) * scale
                }
            }
            DataType.INT8 -> {
                val out = Array(1) { ByteArray(outSize) }
                interpreter.run(tImage.buffer, out)
                val qp = outputTensor.quantizationParams()
                val scale = if (qp.scale == 0f) 1f else qp.scale
                val zero = qp.zeroPoint
                FloatArray(outSize) { idx ->
                    (out[0][idx].toInt() - zero) * scale
                }
            }
            else -> {
                val out = Array(1) { FloatArray(outSize) }
                interpreter.run(tImage.buffer, out)
                out[0]
            }
        }
    }

    private fun calibrateNsfwScores(raw: FloatArray): FloatArray {
        if (raw.isEmpty()) return raw
        val trimmed = if (raw.size > 5) raw.copyOf(5) else raw.copyOf()
        return calibrateProbabilities(trimmed)
    }

    private fun calibrateProbabilities(raw: FloatArray): FloatArray {
        if (raw.isEmpty()) return raw

        val validProbabilityRange = raw.all { it in 0f..1f }
        val sum = raw.sum()
        val resemblesProbabilities = validProbabilityRange && sum in 0.85f..1.15f

        val probs = if (resemblesProbabilities) {
            raw
        } else {
            if (raw.size == 1) {
                floatArrayOf(sigmoid(raw[0]))
            } else {
                softmax(raw)
            }
        }

        return FloatArray(probs.size) { idx -> probs[idx].coerceIn(0f, 1f) }
    }

    private fun sigmoid(value: Float): Float {
        val x = value.coerceIn(-15f, 15f)
        return (1.0 / (1.0 + kotlin.math.exp((-x).toDouble()))).toFloat()
    }

    private fun softmax(values: FloatArray): FloatArray {
        if (values.isEmpty()) return values
        val maxValue = values.maxOrNull() ?: 0f
        val exp = FloatArray(values.size)
        var sum = 0.0
        for (i in values.indices) {
            val e = kotlin.math.exp((values[i] - maxValue).toDouble())
            exp[i] = e.toFloat()
            sum += e
        }
        if (sum <= 0.0) return FloatArray(values.size)
        return FloatArray(values.size) { i -> (exp[i] / sum.toFloat()) }
    }

    private fun detectInjuryClusters(bitmap: Bitmap): AnalysisResult? {
        try {
            val width = bitmap.width.coerceAtLeast(1)
            val height = bitmap.height.coerceAtLeast(1)
            // Match legacy visualSentinel.ts injury-grid behavior (fast + recall-oriented).
            val targetWidth = 100
            val targetHeight = ((height.toFloat() / width.toFloat()) * targetWidth)
                .toInt()
                .coerceAtLeast(48)
                .coerceAtMost(220)

            val scaled = Bitmap.createScaledBitmap(bitmap, targetWidth, targetHeight, true)
            val scaledWidth = scaled.width
            val scaledHeight = scaled.height
            if (scaledWidth <= 0 || scaledHeight <= 0) {
                if (scaled !== bitmap) scaled.recycle()
                return null
            }
            val pixels = IntArray(scaledWidth * scaledHeight)
            scaled.getPixels(pixels, 0, scaledWidth, 0, 0, scaledWidth, scaledHeight)

            val hsv = FloatArray(3)
            var dangerPixels = 0
            val gridSize = 10
            val rows = scaledHeight / gridSize
            val cols = scaledWidth / gridSize
            if (rows <= 0 || cols <= 0) {
                if (scaled !== bitmap) scaled.recycle()
                return null
            }
            var clusters = 0
            val dangerByRow = IntArray(rows.coerceAtLeast(1))
            val clusterMask = BooleanArray(rows * cols)
            val dangerMask = BooleanArray(pixels.size)
            var strongRedPixels = 0
            var darkDangerPixels = 0
            var dangerSatSum = 0f
            var dangerSatSqSum = 0f
            var dangerValueGlobalSum = 0f
            var dangerValueGlobalSqSum = 0f

            for (row in 0 until rows) {
                for (col in 0 until cols) {
                    var cellDanger = 0
                    var dangerValueSum = 0f
                    var dangerValueSqSum = 0f
                    for (y in 0 until gridSize) {
                        for (x in 0 until gridSize) {
                            val px = (row * gridSize + y) * scaledWidth + (col * gridSize + x)
                            if (px >= pixels.size) continue
                            val c = pixels[px]

                            val r = (c shr 16) and 0xFF
                            val g = (c shr 8) and 0xFF
                            val b = c and 0xFF

                            Color.RGBToHSV(r, g, b, hsv)
                            val hue = hsv[0] // 0..360
                            val sat = hsv[1] * 100f // 0..100
                            val value = hsv[2] * 100f // 0..100

                            // Red-dominance guard reduces UI false positives from dark magenta/purple regions.
                            val redDominance = r - maxOf(g, b)
                            val hasRedDominance = redDominance >= 14 && r >= 56
                            val isBloodColor =
                                (hue <= 16f || hue >= 350f) && sat > 42f && value > 6f && hasRedDominance
                            val isDeepInjury =
                                (hue <= 14f || hue >= 348f) &&
                                    sat > 30f &&
                                    value < 38f &&
                                    value > 2f &&
                                    redDominance >= 12
                            if (isBloodColor || isDeepInjury) {
                                dangerPixels++
                                cellDanger++
                                dangerMask[px] = true
                                dangerValueSum += value
                                dangerValueSqSum += value * value
                                dangerSatSum += sat
                                dangerSatSqSum += sat * sat
                                dangerValueGlobalSum += value
                                dangerValueGlobalSqSum += value * value
                                dangerByRow[row] += 1
                                if (redDominance >= 18) {
                                    strongRedPixels++
                                }
                                if (value <= 26f && redDominance >= 10) {
                                    darkDangerPixels++
                                }
                            }
                        }
                    }
                    val cellArea = gridSize * gridSize
                    if (cellDanger > (cellArea * injuryClusterCellRatioThreshold)) {
                        val meanValue = dangerValueSum / cellDanger.coerceAtLeast(1)
                        val varianceValue =
                            (dangerValueSqSum / cellDanger.coerceAtLeast(1)) - (meanValue * meanValue)
                        // Suppress flat maroon UI bands; genuine injury regions usually vary in luminance.
                        if (varianceValue >= injuryVarianceGuardThreshold) {
                            clusters++
                            clusterMask[row * cols + col] = true
                        }
                    }
                }
            }

            val totalPixels = (scaledWidth * scaledHeight).toFloat().coerceAtLeast(1f)
            val dangerRatio = dangerPixels / totalPixels

            // Guard against top-heavy UI bars (common source of self-FP) without hurting central-image recall.
            val topRows = (rows / 3).coerceAtLeast(1)
            val bottomStart = (rows * 2 / 3).coerceAtMost(rows)
            val topDanger = dangerByRow.take(topRows).sum()
            val bottomDanger = if (bottomStart < rows) dangerByRow.drop(bottomStart).sum() else 0
            val topShare = if (dangerPixels > 0) topDanger.toFloat() / dangerPixels.toFloat() else 0f
            val bottomShare = if (dangerPixels > 0) bottomDanger.toFloat() / dangerPixels.toFloat() else 0f
            val headerLikeUiPattern = topShare >= 0.80f && bottomShare <= 0.10f && clusters <= 2
            val strongRedShare =
                if (dangerPixels > 0) strongRedPixels.toFloat() / dangerPixels.toFloat() else 0f
            val darkShare =
                if (dangerPixels > 0) darkDangerPixels.toFloat() / dangerPixels.toFloat() else 0f
            val satVariance = if (dangerPixels > 0) {
                val mean = dangerSatSum / dangerPixels.toFloat()
                (dangerSatSqSum / dangerPixels.toFloat()) - (mean * mean)
            } else {
                0f
            }
            val valueVarianceGlobal = if (dangerPixels > 0) {
                val mean = dangerValueGlobalSum / dangerPixels.toFloat()
                (dangerValueGlobalSqSum / dangerPixels.toFloat()) - (mean * mean)
            } else {
                0f
            }

            var componentCount = 0
            var maxComponentCells = 0
            if (clusters > 0) {
                val visited = BooleanArray(clusterMask.size)
                val q = java.util.ArrayDeque<Int>()
                for (idx in clusterMask.indices) {
                    if (!clusterMask[idx] || visited[idx]) continue
                    componentCount++
                    visited[idx] = true
                    q.add(idx)
                    var size = 0
                    while (q.isNotEmpty()) {
                        val current = q.removeFirst()
                        size++
                        val r = current / cols
                        val c = current % cols
                        val neighbors = intArrayOf(
                            (r - 1) * cols + c,
                            (r + 1) * cols + c,
                            r * cols + (c - 1),
                            r * cols + (c + 1)
                        )
                        for (next in neighbors) {
                            if (next < 0 || next >= clusterMask.size) continue
                            val nr = next / cols
                            val nc = next % cols
                            if (kotlin.math.abs(nr - r) + kotlin.math.abs(nc - c) != 1) continue
                            if (clusterMask[next] && !visited[next]) {
                                visited[next] = true
                                q.add(next)
                            }
                        }
                    }
                    if (size > maxComponentCells) {
                        maxComponentCells = size
                    }
                }
            }

            val scanHeight = rows * gridSize
            val scanWidth = cols * gridSize
            var edgeSamples = 0
            var edgeHits = 0
            for (y in 0 until (scanHeight - 1).coerceAtLeast(0)) {
                for (x in 0 until (scanWidth - 1).coerceAtLeast(0)) {
                    val idx = y * scaledWidth + x
                    if (idx < 0 || idx >= dangerMask.size || !dangerMask[idx]) continue
                    val right = idx + 1
                    val down = idx + scaledWidth
                    val c = pixels[idx]
                    val r = (c shr 16) and 0xFF
                    val g = (c shr 8) and 0xFF
                    val b = c and 0xFF
                    val lum = (0.299f * r) + (0.587f * g) + (0.114f * b)

                    if (right < dangerMask.size && dangerMask[right]) {
                        val rc = pixels[right]
                        val rr = (rc shr 16) and 0xFF
                        val rg = (rc shr 8) and 0xFF
                        val rb = rc and 0xFF
                        val rightLum = (0.299f * rr) + (0.587f * rg) + (0.114f * rb)
                        edgeSamples++
                        if (kotlin.math.abs(lum - rightLum) >= 20f) {
                            edgeHits++
                        }
                    }
                    if (down < dangerMask.size && dangerMask[down]) {
                        val dc = pixels[down]
                        val dr = (dc shr 16) and 0xFF
                        val dg = (dc shr 8) and 0xFF
                        val db = dc and 0xFF
                        val downLum = (0.299f * dr) + (0.587f * dg) + (0.114f * db)
                        edgeSamples++
                        if (kotlin.math.abs(lum - downLum) >= 20f) {
                            edgeHits++
                        }
                    }
                }
            }
            val edgeShare = if (edgeSamples > 0) edgeHits.toFloat() / edgeSamples.toFloat() else 0f

            val fragmentedUiPattern =
                clusters >= 3 &&
                    maxComponentCells <= 1 &&
                    componentCount >= 3 &&
                    (topShare >= 0.45f || dangerRatio < 0.22f)
            val weakRedUiPattern =
                clusters >= 2 &&
                    maxComponentCells <= 2 &&
                    strongRedShare < 0.16f &&
                    dangerRatio < 0.26f
            val fragmentedHighClusterUiPattern =
                clusters >= 8 && maxComponentCells <= 2 && componentCount >= 6
            val broadWarmBackgroundPattern =
                dangerRatio >= 0.28f && darkShare < 0.11f && edgeShare < 0.25f
            val uniformWarmUiPattern =
                dangerRatio >= 0.24f &&
                    darkShare < 0.10f &&
                    valueVarianceGlobal < 190f &&
                    satVariance < 230f
            val lowTextureHighDensityPattern =
                clusters >= 8 && dangerRatio >= 0.24f && edgeShare < 0.22f && darkShare < 0.12f
            if (headerLikeUiPattern) {
                if (scaled !== bitmap) {
                    scaled.recycle()
                }
                return null
            }
            if (
                fragmentedUiPattern ||
                weakRedUiPattern ||
                fragmentedHighClusterUiPattern ||
                broadWarmBackgroundPattern ||
                uniformWarmUiPattern ||
                lowTextureHighDensityPattern
            ) {
                if (scaled !== bitmap) {
                    scaled.recycle()
                }
                return null
            }

            if (scaled !== bitmap) {
                scaled.recycle()
            }

            val hasStructuredCluster =
                (maxComponentCells >= 3 && edgeShare >= 0.20f) ||
                    (clusters >= 2 && (darkShare >= 0.08f || edgeShare >= 0.34f)) ||
                    (
                        dangerRatio >= maxOf(injuryDangerRatioThreshold * 3f, 0.12f) &&
                            darkShare >= 0.06f &&
                            edgeShare >= 0.24f
                        )
            if (hasStructuredCluster && dangerRatio > injuryDangerRatioThreshold) {
                val clusterFactor = (clusters.toFloat() / 8f).coerceIn(0f, 1f)
                val componentFactor = (maxComponentCells.toFloat() / 6f).coerceIn(0f, 1f)
                val densityFactor = (dangerRatio / 0.40f).coerceIn(0f, 1f)
                val darkFactor = (darkShare / 0.20f).coerceIn(0f, 1f)
                val edgeFactor = (edgeShare / 0.45f).coerceIn(0f, 1f)
                val confidence = (
                    clusterFactor * 0.18f +
                        componentFactor * 0.24f +
                        densityFactor * 0.16f +
                        darkFactor * 0.24f +
                        edgeFactor * 0.18f
                    ).coerceIn(0f, 0.99f)

                val severity = when {
                    confidence >= 0.90f && darkShare >= 0.16f && edgeShare >= 0.30f -> "CRITICAL"
                    confidence >= 0.78f && (darkShare >= 0.10f || edgeShare >= 0.38f) -> "HIGH"
                    else -> null
                }
                if (severity == null) {
                    return null
                }
                return AnalysisResult(
                    isDanger = true,
                    category = AlertCategory.VIOLENCE,
                    severity = severity,
                    score = confidence,
                    reasonAr = "تم رصد تكتلات لونية عالية الدلالة لإصابات/دم (clusters=$clusters, ratio=${"%.3f".format(Locale.US, dangerRatio)}).",
                    reasonEn = "Detected dense injury/blood-like color clusters (clusters=$clusters, ratio=${"%.3f".format(Locale.US, dangerRatio)}).",
                    matchedSignals = listOf(
                        "detector=injury_heuristic",
                        "clusters=$clusters",
                        "components=$componentCount",
                        "maxComponent=$maxComponentCells",
                        "dangerRatio=${"%.3f".format(Locale.US, dangerRatio)}",
                        "topShare=${"%.3f".format(Locale.US, topShare)}",
                        "strongRedShare=${"%.3f".format(Locale.US, strongRedShare)}",
                        "darkShare=${"%.3f".format(Locale.US, darkShare)}",
                        "edgeShare=${"%.3f".format(Locale.US, edgeShare)}",
                        "satVar=${"%.1f".format(Locale.US, satVariance)}",
                        "valVar=${"%.1f".format(Locale.US, valueVarianceGlobal)}",
                        "confidence=${"%.3f".format(Locale.US, confidence)}"
                    )
                )
            }
        } catch (e: Exception) {
            Log.w("SecurityCortex", "Injury heuristic failed: ${e.message}")
        }
        return null
    }

    private data class TextVariantsBundle(
        val primary: String,
        val variants: List<String>,
        val signals: List<String>
    )

    private fun mapSkeletonChar(c: Char): Char {
        return when (c) {
            'o', '0', '@', '*', 'و', 'ؤ', 'q', 'p', 'b', 'd', 'g', 'v', 'u', 'w', 'ة', 'ه' -> '0'
            'i', 'l', '1', '!', '|', 'ا', 'أ', 'إ', 'آ', 'ٱ', 'ل', 't', 'f' -> '1'
            's', '5', '$', 'z', 'س', 'ش', 'n', 'm', 'r', 'ر', 'ز', 'د', 'ذ' -> '5'
            'e', '3', 'c', 'ع', '4', 'a', 'x', 'k', 'y', 'ي', 'ى', 'ئ', 'ح', 'خ', 'ج' -> '3'
            else -> c
        }
    }

    private fun purifyToSkeleton(input: String): String {
        if (input.isBlank()) return ""

        val normalized = Normalizer.normalize(input, Normalizer.Form.NFKC)
        val out = StringBuilder(normalized.length)
        var last: Char? = null
        for (raw in normalized) {
            val c = raw.lowercaseChar()
            if (c.isWhitespace() || c == '.' || c == ',' || c == '_') continue
            val mapped = mapSkeletonChar(c)
            if (last == null || mapped != last) {
                out.append(mapped)
                last = mapped
            }
        }
        return out.toString()
    }

    private fun buildTextVariants(input: String): TextVariantsBundle {
        val canonical = normalizeForMatch(input)
        val deobfuscatedRaw = deobfuscateCommon(input)
        val deobfuscatedNormalized = normalizeForMatch(deobfuscatedRaw)
        val arabiziRaw = decodeArabizi(input)
        val arabiziNormalized = normalizeForMatch(arabiziRaw)
        val primary =
            when {
                canonical.isNotBlank() -> canonical
                deobfuscatedNormalized.isNotBlank() -> deobfuscatedNormalized
                arabiziNormalized.isNotBlank() -> arabiziNormalized
                else -> ""
            }
        if (primary.isBlank()) {
            return TextVariantsBundle(primary = "", variants = emptyList(), signals = emptyList())
        }

        val compactCanonical = canonical.replace(" ", "")
        val collapsedCanonical = if (canonical.isNotBlank()) collapseRepeatedChars(canonical) else ""
        val compactCollapsed = collapsedCanonical.replace(" ", "")
        val deobfuscatedCompact = deobfuscatedNormalized.replace(" ", "")
        val arabiziCompact = arabiziNormalized.replace(" ", "")

        val variants = listOf(
            canonical,
            compactCanonical,
            collapsedCanonical,
            compactCollapsed,
            deobfuscatedNormalized,
            deobfuscatedCompact,
            arabiziNormalized,
            arabiziCompact
        )
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .distinct()

        val normalizationSignals = mutableListOf<String>()
        if (deobfuscatedNormalized.isNotBlank() && deobfuscatedNormalized != canonical) {
            normalizationSignals += "norm=deobfuscated"
        }
        if (arabiziNormalized.isNotBlank() && arabiziNormalized != canonical) {
            normalizationSignals += "norm=arabizi-decoded"
        }
        if (canonical.isBlank() && deobfuscatedNormalized.isNotBlank()) {
            normalizationSignals += "norm=symbol-deobfuscated"
        }
        if (collapsedCanonical != canonical) {
            normalizationSignals += "norm=repetition-collapsed"
        }

        return TextVariantsBundle(
            primary = primary,
            variants = variants,
            signals = normalizationSignals.distinct()
        )
    }

    private fun mergeSignals(matches: List<String>, normalizationSignals: List<String>): List<String> {
        return (matches + normalizationSignals).distinct().take(10)
    }

    private fun findMatchedPatterns(
        variants: List<String>,
        patterns: Collection<String>,
        limit: Int = 6
    ): List<String> {
        if (variants.isEmpty()) return emptyList()
        val variantCompacts = variants.map { it.replace(" ", "") }
        return patterns.asSequence()
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .filter { pattern ->
                val compactPattern = pattern.replace(" ", "")
                variants.any { it.contains(pattern) } ||
                    (compactPattern.length >= 3 && variantCompacts.any { it.contains(compactPattern) })
            }
            .distinct()
            .take(limit)
            .toList()
    }

    private fun collapseRepeatedChars(input: String): String {
        return input.replace(Regex("(\\p{L})\\1{2,}"), "$1$1")
    }

    private fun deobfuscateCommon(input: String): String {
        val lowered = Normalizer.normalize(input, Normalizer.Form.NFKC).lowercase(Locale.getDefault())
        val mapped = buildString(lowered.length) {
            for (c in lowered) {
                append(
                    when (c) {
                        '0' -> 'o'
                        '1' -> 'i'
                        '3' -> 'e'
                        '4' -> 'a'
                        '5' -> 's'
                        '7' -> 't'
                        '8' -> 'b'
                        '9' -> 'g'
                        '@' -> 'a'
                        '$' -> 's'
                        '€' -> 'e'
                        '£' -> 'l'
                        '¥' -> 'y'
                        '¢' -> 'c'
                        '×' -> 'x'
                        '*' -> 'x'
                        '§' -> 's'
                        '|' -> 'i'
                        '¡' -> 'i'
                        '!' -> 'i'
                        else -> c
                    }
                )
            }
        }
        return mapped
    }

    private fun decodeArabizi(input: String): String {
        val lowered = Normalizer.normalize(input, Normalizer.Form.NFKC).lowercase(Locale.getDefault())
        return buildString(lowered.length) {
            for (c in lowered) {
                append(
                    when (c) {
                        '2' -> 'ا'
                        '3' -> 'ع'
                        '4' -> 'ش'
                        '5' -> 'خ'
                        '6' -> 'ط'
                        '7' -> 'ح'
                        '8' -> 'ق'
                        '9' -> 'ص'
                        else -> c
                    }
                )
            }
        }
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
