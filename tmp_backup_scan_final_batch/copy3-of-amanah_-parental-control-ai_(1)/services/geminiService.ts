
import { GoogleGenAI, Type } from "@google/genai";
import { MonitoringAlert, AlertSeverity, Category, ChatMessage } from "../types";

export const analyzeLocationSafety = async (lat: number, lng: number) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: `Analyze location (${lat}, ${lng}) for family safety. Suggest safe zones nearby. Arabic response.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
      },
    });
    return { text: response.text || "No analysis.", mapsLinks: [] };
  } catch (error) {
    return { text: "Service unavailable.", mapsLinks: [] };
  }
};

export const analyzeContent = async (
  text: string, 
  childName: string, 
  platform: string,
  imageUri?: string
): Promise<Partial<MonitoringAlert & { conversationLog: ChatMessage[], suspectUsername: string }>> => {
  
  const TIMEOUT_MS = 10000; 
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [
    { 
      text: `CRITICAL SAFETY GUARD:
      Analyze input for Child ${childName}.
      Context: "${text || 'Image analysis only'}"
      
      MANDATORY CHECK FOR:
      1. GORE/VIOLENCE: Blood, severe injuries, wounds, medical trauma, self-harm.
      2. PREDATORY: Grooming, asking for secrets, private photos.
      3. BULLYING: Toxic language.

      If you see ANY blood or severe injury, set Category to VIOLENCE and Severity to CRITICAL immediately.
      JSON Output Only.` 
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
    setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)
  );

  try {
    const response: any = await Promise.race([apiCall, timeoutPromise]);
    if (response && response.text) {
        const result = JSON.parse(response.text);
        return {
            category: (result.category as Category) || Category.SAFE,
            severity: (result.severity as AlertSeverity) || AlertSeverity.LOW,
            aiAnalysis: String(result.aiAnalysis),
            actionTaken: String(result.actionTaken),
            suspectUsername: String(result.suspectUsername || "System"),
            conversationLog: Array.isArray(result.conversationLog) ? result.conversationLog : [],
            timestamp: new Date()
        };
    }
    throw new Error("Empty");
  } catch (error: any) {
    return { category: Category.SAFE, severity: AlertSeverity.LOW, aiAnalysis: "Cloud Analysis Timed Out.", timestamp: new Date(), conversationLog: [], suspectUsername: "System" };
  }
};
