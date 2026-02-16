
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
      text: `Act as a forensic child safety analyst (Amanah AI Expert). 
      Analyze the following intercepted content:
      - Child Name: ${childName}
      - Platform: ${platform}
      - Intercepted Text: "${text}"
      
      CRITICAL TASKS:
      1. DETECTION: Identify cyberbullying, grooming, self-harm, or scams. Understand Arabic slang/dialects.
      2. FORENSICS: Create a fictional but realistic conversation log of 5-7 messages leading to this moment.
      3. SUSPECT PROFILE: Generate a probable username for the suspect.
      4. PSYCHOLOGY: If danger is high, provide a psychological profile (mood, anxiety, isolation risk).
      5. ACTION: Suggest immediate parental intervention steps.

      Output must be in JSON format.` 
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
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, enum: Object.values(Category) },
            severity: { type: Type.STRING, enum: Object.values(AlertSeverity) },
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
                  isSuspect: { type: Type.BOOLEAN }
                }
              }
            },
            psychProfile: {
              type: Type.OBJECT,
              properties: {
                moodScore: { type: Type.NUMBER },
                dominantEmotion: { type: Type.STRING },
                anxietyLevel: { type: Type.NUMBER },
                isolationRisk: { type: Type.NUMBER },
                futurePrediction: { type: Type.STRING },
                recentKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendation: { type: Type.STRING }
              }
            }
          },
          required: ["category", "severity", "aiAnalysis", "suspectUsername", "conversationLog"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    if (result.psychProfile) result.psychProfile.lastAnalysisDate = new Date();
    return result;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return { category: Category.SAFE, severity: AlertSeverity.LOW, aiAnalysis: "فشل التحليل العميق." };
  }
};
