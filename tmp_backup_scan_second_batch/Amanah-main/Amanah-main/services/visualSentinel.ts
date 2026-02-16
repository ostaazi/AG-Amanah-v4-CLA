
import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import { Category, AlertSeverity } from '../types';

let model: nsfwjs.NSFWJS | null = null;
let isModelLoading = false;

/**
 * تحميل نموذج الذكاء الاصطناعي المحلي (يتم مرة واحدة فقط عند بدء التطبيق)
 */
export const loadVisualSentinelModel = async () => {
  if (model || isModelLoading) return;
  isModelLoading = true;
  try {
    // تحميل النموذج المصغر (Quantized) للأداء العالي على الموبايل
    model = await nsfwjs.load();
    console.log("✅ Visual Sentinel Engine Loaded Locally");
  } catch (error) {
    console.error("Failed to load local visual model:", error);
  } finally {
    isModelLoading = false;
  }
};

interface LocalVisualResult {
  isDanger: boolean;
  category: Category;
  severity: AlertSeverity;
  probability: number;
  label: string;
  latency: string;
}

/**
 * خوارزمية تحليل التكوين اللوني (Gore/Blood Heuristic)
 * تقوم بتحليل نسبة اللون الأحمر الدموي والوردي اللحمي في الصورة
 */
const detectGoreAlgorithmic = (imgElement: HTMLImageElement): { isGore: boolean, score: number } => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { isGore: false, score: 0 };

    // تصغير الصورة للمعالجة السريعة
    const width = 100; 
    const height = (imgElement.height / imgElement.width) * width;
    canvas.width = width;
    canvas.height = height;
    
    ctx.drawImage(imgElement, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    let gorePixels = 0;
    let totalPixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // معادلة تقريبية للكشف عن لون الدم والجروح (أحمر طاغي + تشبع معين)
      // Red dominant, not too bright (avoid pure red graphics), distinct from skin tone alone
      if (r > 100 && r > g * 1.5 && r > b * 1.5 && g < 150 && b < 150) {
         gorePixels++;
      }
      // كشف الكدمات/اللحم الداكن (Bruises/Dark Flesh)
      else if (r > 90 && g < 70 && b < 80 && r > g + 20) {
         gorePixels++;
      }
    }

    const goreRatio = gorePixels / totalPixels;
    
    // إذا تجاوزت نسبة "البيكسلات الدموية" 15% من الصورة
    return { isGore: goreRatio > 0.15, score: goreRatio };

  } catch (e) {
    console.error("Algorithmic Gore Check Failed:", e);
    return { isGore: false, score: 0 };
  }
};

/**
 * دالة الفحص الفوري (Zero-Latency Check)
 */
export const scanImageLocally = async (imgElement: HTMLImageElement): Promise<LocalVisualResult> => {
  const startTime = performance.now();

  // 1. تشغيل خوارزمية كشف العنف/الدماء (Heuristic) أولاً
  const goreCheck = detectGoreAlgorithmic(imgElement);
  if (goreCheck.isGore) {
      const duration = (performance.now() - startTime).toFixed(2) + 'ms';
      return {
          isDanger: true,
          category: Category.VIOLENCE, // تصنيف عنف
          severity: AlertSeverity.CRITICAL,
          probability: Math.min(0.95, goreCheck.score * 3), // تضخيم النسبة لتمثيل الاحتمالية
          label: "Local Detection: Gore/Blood Anomaly",
          latency: duration
      };
  }

  // إذا لم يتم تحميل النموذج بعد، نعتبر النتيجة آمنة محلياً ونترك الأمر لـ Gemini
  if (!model) {
    return {
      isDanger: false,
      category: Category.SAFE,
      severity: AlertSeverity.LOW,
      probability: 0,
      label: "Model Not Ready",
      latency: "0ms"
    };
  }

  try {
    // 2. إجراء التصنيف باستخدام NSFWJS (للإباحية)
    const predictions = await model.classify(imgElement);
    const duration = (performance.now() - startTime).toFixed(2) + 'ms';

    const pornPrediction = predictions.find(p => p.className === 'Porn');
    const hentaiPrediction = predictions.find(p => p.className === 'Hentai');
    const sexyPrediction = predictions.find(p => p.className === 'Sexy');

    // قواعد الاشتباك المحلية
    if ((pornPrediction && pornPrediction.probability > 0.6) || (hentaiPrediction && hentaiPrediction.probability > 0.6)) {
        return {
            isDanger: true,
            category: Category.ADULT_CONTENT,
            severity: AlertSeverity.CRITICAL,
            probability: Math.max(pornPrediction?.probability || 0, hentaiPrediction?.probability || 0),
            label: "Local Detection: Explicit Content",
            latency: duration
        };
    }

    if (sexyPrediction && sexyPrediction.probability > 0.8) {
        return {
            isDanger: true,
            category: Category.ADULT_CONTENT,
            severity: AlertSeverity.HIGH,
            probability: sexyPrediction.probability,
            label: "Local Detection: Suggestive Content",
            latency: duration
        };
    }

    // إذا كانت الصورة آمنة بصرياً (Neutral/Drawing)
    return {
        isDanger: false,
        category: Category.SAFE,
        severity: AlertSeverity.LOW,
        probability: 0,
        label: "Safe",
        latency: duration
    };

  } catch (error) {
    console.error("Local scan error:", error);
    return {
        isDanger: false,
        category: Category.SAFE,
        severity: AlertSeverity.LOW,
        probability: 0,
        label: "Error",
        latency: "0ms"
    };
  }
};
