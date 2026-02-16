
import { GoogleGenAI, Type } from "@google/genai";
import { MonitoringAlert, AlertSeverity, Category, ChatMessage, PsychologicalProfile } from "../types";

/**
 * إنشاء دردشة مع المستشار الأبوي الذكي
 */
export const createAdvisorChat = (lang: 'ar' | 'en') => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = lang === 'ar' 
    ? "أنت خبير تربوي ونفسي في تطبيق Amanah للرقابة الأبوية. مهمتك مساعدة الأهل في فهم تنبيهات أطفالهم وتقديم نصائح عملية للتعامل مع حالات التنمر، الابتزاز، أو إدمان الألعاب. كن هادئاً، مهنياً، وداعماً."
    : "You are a child psychologist and parental expert for Amanah. Help parents understand alerts and give actionable advice for bullying, blackmail, or gaming addiction.";
    
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction,
      temperature: 0.7,
    },
  });
};

/**
 * تحليل تربوي عميق للأهل بناءً على سجل التنبيهات
 */
export const getParentalAdvice = async (alerts: MonitoringAlert[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const context = alerts.map(a => `${a.category}: ${a.content}`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `بصفتك خبيراً في علم النفس التربوي، حلل سجل التنبيهات التالي للطفل وقدم 3 نصائح عملية للأهل للتعامل معه:
      ${context}
      
      المخرجات يجب أن تكون بصيغة JSON:
      {
        "analysis": "ملخص للحالة",
        "tips": ["نصيحة 1", "نصيحة 2", "نصيحة 3"],
        "dangerLevel": "LOW/MEDIUM/HIGH"
      }`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (e) {
    return { analysis: "جاري تحليل البيانات...", tips: [], dangerLevel: "LOW" };
  }
};

// Fix: Added missing analyzeLocationSafety function using Gemini 2.5 Maps grounding
/**
 * تحليل أمان الموقع الجغرافي باستخدام خرائط جوجل
 * يستخدم Gemini 2.5 Flash لدعم grounding خرائط جوجل
 */
export const analyzeLocationSafety = async (latitude: number, longitude: number) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      // Fix: Use gemini-2.5-flash as Maps grounding is only supported in Gemini 2.5 series models
      model: "gemini-2.5-flash",
      contents: `بصفتك خبيراً أمنياً وتربوياً في تطبيق Amanah، قم بتحليل أمان المنطقة المحيطة بالإحداثيات (${latitude}, ${longitude}). ابحث عن المرافق الآمنة مثل مراكز الشرطة، المستشفيات، والمدارس، وحذر من أي مناطق خطرة محتملة أو أماكن غير ملائمة للأطفال. قدم الإجابة باللغة العربية بشكل مهني ومختصر وودود.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude,
              longitude
            }
          }
        }
      },
    });

    // استخراج روابط الخرائط من بيانات التدعيم (Grounding Chunks)
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const mapsLinks = groundingChunks
      .filter((chunk: any) => chunk.maps)
      .map((chunk: any) => ({
        uri: chunk.maps.uri,
        title: chunk.maps.title
      }));

    return {
      text: response.text || "تم تحليل المنطقة المحيطة بنجاح.",
      mapsLinks: mapsLinks
    };
  } catch (e) {
    console.error("Location Analysis Error:", e);
    return { 
      text: "عذراً، تعذر إجراء تحليل أمني دقيق للموقع في هذه اللحظة. يرجى مراجعة الخريطة يدوياً.", 
      mapsLinks: [] 
    };
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
): Promise<Partial<MonitoringAlert & { conversationLog: ChatMessage[], suspectUsername: string, psychProfile?: PsychologicalProfile }>> => {
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [
    { 
      text: `Act as a strict real-time safety guard for a child (Protection Mode: MAXIMUM). 
      Analyze input for: Child ${childName}, Platform ${platform}.
      
      CRITICAL: Detect VIOLENCE, BLOOD, GORE, INJURIES, and SELF-HARM.
      
      Text context: "${text}"
      
      JSON Output Only.
      Category: One of [${Object.values(Category).join(', ')}].
      Severity: One of [${Object.values(AlertSeverity).join(', ')}].
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

  try {
    const response = await ai.models.generateContent({
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
  } catch (error) {
    console.error("AI Guard Error:", error);
    return { category: Category.SAFE, severity: AlertSeverity.LOW, timestamp: new Date() };
  }
};
