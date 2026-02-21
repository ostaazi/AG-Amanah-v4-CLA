
import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import { Category, AlertSeverity } from '../types';

let model: nsfwjs.NSFWJS | null = null;
let isModelLoading = false;

export const loadVisualSentinelModel = async () => {
  if (model || isModelLoading) return;
  isModelLoading = true;
  try {
    model = await nsfwjs.load();
    console.log("✅ Visual Sentinel Engine (Hybrid) Loaded");
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

const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
};

/**
 * خوارزمية Amanah Cluster-Vision V2.2
 * تبحث عن "تكتلات" الإصابة وليس النسبة المئوية الإجمالية
 */
const detectInjuriesAdvanced = (imgElement: HTMLImageElement): { isDanger: boolean, score: number, type: string } => {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { isDanger: false, score: 0, type: '' };

    const width = 100; 
    const height = Math.floor((imgElement.height / imgElement.width) * width);
    canvas.width = width;
    canvas.height = height;
    
    ctx.drawImage(imgElement, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    let dangerPixels = 0;
    let clustersFound = 0;
    
    // تقسيم الصورة لشبكة (Grid) للكشف عن التكتلات
    const gridSize = 10;
    const gridRows = Math.floor(height / gridSize);
    const gridCols = Math.floor(width / gridSize);
    
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        let cellDangerCount = 0;
        
        // فحص كل خلية في الشبكة
        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            const pxIndex = ((row * gridSize + y) * width + (col * gridSize + x)) * 4;
            if (pxIndex >= data.length) continue;
            
            const r = data[pxIndex], g = data[pxIndex+1], b = data[pxIndex+2];
            const hsv = rgbToHsv(r, g, b);

            // توسيع نطاق اللون الأحمر ليشمل الدماء القاتمة والأرجوانية
            const isBloodColor = (hsv.h < 25 || hsv.h > 325) && hsv.s > 35 && hsv.v > 10;
            const isDeepInjury = (hsv.h < 30 || hsv.h > 300) && hsv.s > 25 && hsv.v < 35 && hsv.v > 2;

            if (isBloodColor || isDeepInjury) {
              cellDangerCount++;
              dangerPixels++;
            }
          }
        }
        
        // إذا كان أكثر من 35% من الخلية "دماء"، فهذا تكتل إصابة خطير
        if (cellDangerCount > (gridSize * gridSize * 0.35)) {
          clustersFound++;
        }
      }
    }

    // القاعدة الذهبية: إذا وجدنا أكثر من تكتلين متجاورين أو نسبة إجمالية مشبوهة
    if (clustersFound >= 1 || dangerPixels > (data.length / 4 * 0.05)) {
      const score = (clustersFound * 0.5) + (dangerPixels / (data.length / 4) * 10);
      return { isDanger: true, score, type: 'Severe Physical Trauma / Blood Cluster' };
    }

    return { isDanger: false, score: 0, type: '' };

  } catch (e) {
    return { isDanger: false, score: 0, type: '' };
  }
};

export const scanImageLocally = async (imgElement: HTMLImageElement): Promise<LocalVisualResult> => {
  const startTime = performance.now();

  const injuryCheck = detectInjuriesAdvanced(imgElement);
  if (injuryCheck.isDanger) {
      const duration = (performance.now() - startTime).toFixed(2) + 'ms';
      return {
          isDanger: true,
          category: Category.VIOLENCE,
          severity: injuryCheck.score > 1.5 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
          probability: Math.min(0.99, injuryCheck.score / 3),
          label: injuryCheck.type,
          latency: duration
      };
  }

  if (!model) {
    return { isDanger: false, category: Category.SAFE, severity: AlertSeverity.LOW, probability: 0, label: "Initializing", latency: "0ms" };
  }

  try {
    const predictions = await model.classify(imgElement);
    const duration = (performance.now() - startTime).toFixed(2) + 'ms';

    const porn = predictions.find(p => p.className === 'Porn');
    const sexy = predictions.find(p => p.className === 'Sexy');

    if (porn && porn.probability > 0.5) {
        return { isDanger: true, category: Category.ADULT_CONTENT, severity: AlertSeverity.CRITICAL, probability: porn.probability, label: "NSFW: Explicit", latency: duration };
    }

    if (sexy && sexy.probability > 0.75) {
        return { isDanger: true, category: Category.ADULT_CONTENT, severity: AlertSeverity.MEDIUM, probability: sexy.probability, label: "NSFW: Suggestive", latency: duration };
    }

    return { isDanger: false, category: Category.SAFE, severity: AlertSeverity.LOW, probability: 0, label: "Safe", latency: duration };

  } catch (error) {
    return { isDanger: false, category: Category.SAFE, severity: AlertSeverity.LOW, probability: 0, label: "Error", latency: "0ms" };
  }
};
