
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

/**
 * محرك تنظيف JSON الفائق (Forensic JSON Sanitizer)
 * يقوم باستخراج أول قيمة JSON صالحة فقط ويتجاهل الباقي تماماً.
 */
const cleanJsonResponse = (text: string) => {
  if (!text) return "{}";
  
  // 1. إزالة علامات Markdown
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  
  // 2. استخراج الكتل (Object/Array) - الأولوية القصوى
  const jsonBlockMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[0];
  }
  
  // 3. استخراج القيم المنطقية المنفردة (Isolate Primitives)
  // استخدام \b والتقاط أول كلمة فقط يمنع خطأ "Position 4" الناتج عن "true."
  const primitiveMatch = cleaned.match(/\b(true|false|null)\b/i);
  if (primitiveMatch) {
    return primitiveMatch[0].toLowerCase();
  }

  // 4. استخراج الأرقام
  const numberMatch = cleaned.match(/-?\d+(\.\d+)?/);
  if (numberMatch) {
    return numberMatch[0];
  }
  
  return cleaned;
};

/**
 * تحليل سبب فشل تنفيذ الأمر (Predictive Failure Analysis)
 */
export const predictCommandFailureCause = async (cmdData: any, deviceLogs: any[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze why command ${cmdData.type} failed. Logs: ${JSON.stringify(deviceLogs)}. Return JSON ONLY.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedCause: { type: Type.STRING },
            tamperProbability: { type: Type.NUMBER },
            recommendedAction: { type: Type.STRING }
          }
        }
      }
    });

    const cleaned = cleanJsonResponse(response.text || "{}");
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      return { predictedCause: "Invalid Protocol Format", tamperProbability: 0.1 };
    }
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { predictedCause: "Unknown Network Error", tamperProbability: 0.1 };
  }
};

/**
 * تحليل المحتوى المكتوب والبصري (Hybrid Content Analysis)
 */
export const analyzeContent = async (text: string, childName: string, platform: string, imageBase64?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const parts: any[] = [{ text: `Analyze this for child safety. Child: ${childName}, Platform: ${platform}. Text: ${text}. Return JSON.` }];
    
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64,
        },
      });
    }

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
                  isSuspect: { type: Type.BOOLEAN }
                }
              }
            }
          }
        }
      }
    });

    const cleaned = cleanJsonResponse(response.text || "{}");
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      return { category: 'SAFE', severity: 'low', aiAnalysis: 'Parsing failed, defaulting to safe.' };
    }
  } catch (error) {
    console.error("Gemini Content Analysis Error:", error);
    return { category: 'SAFE', severity: 'low', aiAnalysis: 'Analysis failed, defaulting to safe.' };
  }
};

/**
 * تحليل أمان الموقع الجغرافي باستخدام خرائط جوجل (Spatial Safety Intelligence)
 */
export const analyzeLocationSafety = async (lat: number, lng: number) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-latest',
      contents: `Analyze the safety of the area at coordinates ${lat}, ${lng} for a child. Identify safe zones like police stations, hospitals, or secure malls. Return a professional summary in Arabic.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      },
    });

    const text = response.text || "لم يتم العثور على تحليل دقيق للمنطقة.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const mapsLinks = chunks
      .filter((chunk: any) => chunk.maps)
      .map((chunk: any) => ({
        uri: chunk.maps.uri,
        title: chunk.maps.title
      }));

    return { text, mapsLinks };
  } catch (error) {
    console.error("Gemini Location Analysis Error:", error);
    return { 
      text: "عذراً، فشل محرك التحليل المكاني في معالجة الموقع حالياً.", 
      mapsLinks: [] 
    };
  }
};
