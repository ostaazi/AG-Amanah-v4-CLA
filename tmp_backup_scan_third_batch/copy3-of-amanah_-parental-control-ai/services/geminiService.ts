
import { GoogleGenAI, Type } from "@google/genai";
import { MonitoringAlert, AlertSeverity, Category, ChatMessage, PsychologicalProfile } from "../types";

/**
 * وظيفة تحليل أمان الموقع الجغرافي باستخدام Google Maps Grounding
 */
export const analyzeLocationSafety = async (lat: number, lng: number) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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

    const text = response.text || "تعذر التحليل.";
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const mapsLinks = groundingChunks
      .filter((chunk: any) => chunk.maps)
      .map((chunk: any) => ({
        title: String(chunk.maps.title || "خريطة"),
        uri: String(chunk.maps.uri || "#")
      }));

    return { text, mapsLinks };
  } catch (error) {
    console.error("Maps Grounding Error:", error);
    return { text: "تعذر تحليل بيانات الخريطة حالياً.", mapsLinks: [] };
  }
};

/**
 * التحليل العميق للمحتوى (Gemini Forensic Analysis)
 */
export const analyzeContent = async (
  text: string, 
  childName: string, 
  platform: string,
  imageUri?: string
): Promise<Partial<MonitoringAlert & { conversationLog: ChatMessage[], suspectUsername: string }>> => {
  
  const TIMEOUT_MS = 6000; 
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [
    { 
      text: `Act as a strict real-time safety guard for a child. 
      Analyze input for: Child ${childName}, Platform ${platform}.
      Text context: "${text}"
      JSON Output Only.
      Category: One of [${Object.values(Category).join(', ')}].
      Severity: One of [${Object.values(AlertSeverity).join(', ')}].
      Provide suspectUsername and conversationLog array.
      ` 
    }
  ];

  if (imageUri && typeof imageUri === 'string') {
    const split = imageUri.split(',');
    if (split.length === 2) {
      const mimeType = split[0].match(/:(.*?);/)?.[1] || 'image/png';
      parts.push({ inlineData: { mimeType, data: split[1] } });
    }
  }

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

  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error("TIMEOUT_EXCEEDED")), TIMEOUT_MS)
  );

  try {
    const response: any = await Promise.race([apiCall, timeoutPromise]);
    
    if (response && response.text) {
        const result = JSON.parse(response.text);
        // تنظيف البيانات لضمان عدم وجود مراجع دائرية
        return {
            category: (result.category as Category) || Category.SAFE,
            severity: (result.severity as AlertSeverity) || AlertSeverity.LOW,
            aiAnalysis: String(result.aiAnalysis || "تحليل روتيني"),
            actionTaken: String(result.actionTaken || "لا إجراء"),
            suspectUsername: String(result.suspectUsername || "System"),
            conversationLog: Array.isArray(result.conversationLog) ? result.conversationLog.map((m: any) => ({
                sender: String(m.sender),
                text: String(m.text),
                time: String(m.time),
                isSuspect: !!m.isSuspect
            })) : [],
            timestamp: new Date()
        };
    }
    throw new Error("Empty Response");

  } catch (error: any) {
    return {
      category: Category.SAFE,
      severity: AlertSeverity.LOW,
      aiAnalysis: "تعذر التحليل السحابي. تم تفعيل الحماية المحلية.",
      actionTaken: "مراقبة صامتة",
      timestamp: new Date(),
      conversationLog: [],
      suspectUsername: "System"
    };
  }
};
