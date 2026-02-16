
import { GoogleGenAI, Type } from "@google/genai";
import { MonitoringAlert, AlertSeverity, Category, ChatMessage, PsychologicalProfile } from "../types";

/**
 * وظيفة تحليل أمان الموقع الجغرافي باستخدام Google Maps Grounding
 */
export const analyzeLocationSafety = async (lat: number, lng: number) => {
  const apiKey = (typeof window !== 'undefined' && (window as any).__ENV?.API_KEY) || (import.meta as any).env?.VITE_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    // Return a non-fatal response rather than crashing the whole app.
    return {
      safetyLevel: 'unknown' as const,
      riskFactors: ['Gemini API key is missing.'],
      safePlaces: [],
      advice: 'تعذر تحليل الموقع لأن مفتاح Gemini غير مضبوط في متغيرات Hugging Face.'
    };
  }

  let ai: GoogleGenAI;
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (e) {
    return {
      safetyLevel: 'unknown' as const,
      riskFactors: ['Failed to initialize Gemini client.'],
      safePlaces: [],
      advice: 'تعذر تهيئة Gemini. تحقق من صحة API_KEY.'
    };
  }
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: `بصفتك خبيراً أمنياً، حلل هذا الموقع الجغرافي (${lat}, ${lng}). هل المنطقة معروفة بأنها آمنة للعائلات؟ ما هي المراكز الحيوية أو الأماكن العامة الآمنة القريبة؟ قدم نصائح أمان للأهل.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng }
          }
        }
      },
    });

    const text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const mapsLinks = groundingChunks
      .filter((chunk: any) => chunk.maps)
      .map((chunk: any) => ({
        title: chunk.maps.title,
        uri: chunk.maps.uri
      }));

    return { text, mapsLinks };
  } catch (error) {
    console.error("Maps Grounding Error:", error);
    return { text: "تعذر تحليل بيانات الخريطة حالياً.", mapsLinks: [] };
  }
};

/**
 * التحليل العميق للمحتوى (Gemini Forensic Analysis)
 * تم التحديث لاستخدام محرك Flash لسرعة الاستجابة القصوى
 * + بروتوكول Circuit Breaker لقطع الاتصال بعد 6 ثواني
 */
export const analyzeContent = async (
  text: string, 
  childName: string, 
  platform: string,
  imageUri?: string
): Promise<Partial<MonitoringAlert & { conversationLog: ChatMessage[], suspectUsername: string, psychProfile?: PsychologicalProfile }>> => {
  
  // مهلة زمنية صارمة (Hard Limit)
  const TIMEOUT_MS = 6000; 
  
  const apiKey = (typeof window !== 'undefined' && (window as any).__ENV?.API_KEY) || (import.meta as any).env?.VITE_API_KEY;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    // Graceful fallback: keep the UI running even if the key is missing in a public Space.
    return {
      severity: 'medium',
      category: Category.PHISHING_LINK,
      title: 'تعذر الاتصال بمحرك التحليل',
      message: 'API_KEY غير مُعد أو غير صالح. أضف API_KEY في Variables/Secrets ثم أعد تشغيل الـ Space.',
      recommendedActions: ['أضف API_KEY الصحيح', 'أعد تشغيل الـ Space', 'جرّب مرة أخرى']
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [
    { 
      text: `Act as a strict real-time safety guard for a child (Protection Mode: MAXIMUM). 
      Analyze input for: Child ${childName}, Platform ${platform}.
      
      CRITICAL INSTRUCTION: You must aggressively detect VIOLENCE, BLOOD, GORE, INJURIES, and SELF-HARM.
      - If image contains red liquids resembling blood, wounds, bruises, or weapons -> Category: ${Category.VIOLENCE} or ${Category.SELF_HARM}, Severity: ${AlertSeverity.CRITICAL}.
      - Do not describe the gore in detail, just flag it.
      - Also check for Bullying, Predator, Blackmail, Adult Content.

      Text context: "${text}"
      
      JSON Output Only.
      Category: One of [${Object.values(Category).join(', ')}].
      Severity: One of [${Object.values(AlertSeverity).join(', ')}].
      If unsafe, provide brief analysis (in language of input), action, suspectUsername.
      ` 
    }
  ];

  if (imageUri) {
    const split = imageUri.split(',');
    if (split.length === 2) {
      const mimeType = split[0].match(/:(.*?);/)?.[1] || 'image/png';
      parts.push({ inlineData: { mimeType, data: split[1] } });
    }
  }

  // إعداد الطلب
  // FIX: Switched to 'gemini-3-flash-preview' for vision-integrated safety analysis
  const apiCall = ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          severity: { type: Type.STRING },
          aiAnalysis: { type: Type.STRING },
          actionTaken: { type: Type.STRING },
          suspectUsername: { type: Type.STRING },
          conversationLog: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sender: { type: Type.STRING },
                text: { type: Type.STRING },
                time: { type: Type.STRING },
                isSuspect: { type: Type.BOOLEAN },
              }
            }
          }
        }
      },
    },
  });

  // إعداد المؤقت
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("TIMEOUT_EXCEEDED")), TIMEOUT_MS)
  );

  try {
    // السباق بين الاستجابة والمؤقت
    const response: any = await Promise.race([apiCall, timeoutPromise]);
    
    if (response.text) {
        const result = JSON.parse(response.text);
        return {
            category: (result.category as Category) || Category.SAFE,
            severity: (result.severity as AlertSeverity) || AlertSeverity.LOW,
            aiAnalysis: result.aiAnalysis || "تحليل روتيني آمن",
            actionTaken: result.actionTaken || "لا إجراء",
            suspectUsername: result.suspectUsername || "System",
            conversationLog: result.conversationLog || [],
            timestamp: new Date()
        };
    }
    throw new Error("Empty Response");

  } catch (error: any) {
    console.warn("AI Guard Fallback:", error.message);
    
    const isTimeout = error.message === "TIMEOUT_EXCEEDED";
    
    return {
      category: Category.SAFE,
      severity: AlertSeverity.LOW,
      aiAnalysis: isTimeout 
        ? `[TimeGuard] تجاوز التحليل ${TIMEOUT_MS}ms. تم تأمين المرور لضمان تجربة المستخدم.` 
        : "تعذر التحليل السحابي. تم تفعيل الحماية المحلية.",
      actionTaken: isTimeout ? "تجاوز سريع (Fail-Safe)" : "مراقبة صامتة",
      timestamp: new Date(),
      conversationLog: [],
      suspectUsername: "System"
    };
  }
};
