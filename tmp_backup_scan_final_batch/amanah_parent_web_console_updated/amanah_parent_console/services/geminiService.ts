import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseConfig";
import { MonitoringAlert, AlertSeverity, Category, ChatMessage } from "../types";

/**
 * IMPORTANT SECURITY NOTE
 * ----------------------
 * This Parent Web Console MUST NOT call any AI provider directly from the browser using secret API keys.
 * All Gemini (or any LLM) requests should be proxied through a trusted backend (e.g., Firebase Functions)
 * where the API key lives in server-side environment variables.
 */

type LocationSafetyResult = {
  text: string;
  mapsLinks: { title: string; uri: string }[];
};

/**
 * Analyze geographic safety via a backend proxy (Firebase Callable Function).
 * Callable name expected (server-side): analyzeLocationSafety
 */
export const analyzeLocationSafety = async (lat: number, lng: number): Promise<LocationSafetyResult> => {
  try {
    if (!functions) throw new Error("FUNCTIONS_NOT_CONFIGURED");

    const fn = httpsCallable(functions, "analyzeLocationSafety");
    const res: any = await fn({ lat, lng });
    const data = (res?.data ?? {}) as Partial<LocationSafetyResult>;

    return {
      text: typeof data.text === "string" ? data.text : "تعذر التحليل.",
      mapsLinks: Array.isArray(data.mapsLinks)
        ? data.mapsLinks
            .filter((x: any) => x && typeof x.uri === "string")
            .map((x: any) => ({
              title: String(x.title ?? "خريطة"),
              uri: String(x.uri ?? "#"),
            }))
        : [],
    };
  } catch (error) {
    console.error("Location Safety (Proxy) Error:", error);
    return { text: "تعذر تحليل بيانات الخريطة حالياً.", mapsLinks: [] };
  }
};

type AnalyzeContentParams = {
  text: string;
  childName: string;
  platform: string;
  imageUri?: string;
};

/**
 * Deep forensic analysis (backend-proxied).
 * Callable name expected (server-side): analyzeContent
 */
export const analyzeContent = async (
  text: string,
  childName: string,
  platform: string,
  imageUri?: string
): Promise<Partial<MonitoringAlert & { conversationLog: ChatMessage[]; suspectUsername: string }>> => {
  const TIMEOUT_MS = 6500;

  const safeFallback = (msg: string) => ({
    category: Category.SAFE,
    severity: AlertSeverity.LOW,
    aiAnalysis: msg,
    actionTaken: "مراقبة صامتة",
    timestamp: new Date(),
    conversationLog: [],
    suspectUsername: "System",
  });

  try {
    if (!functions) return safeFallback("تعذر التحليل السحابي. تم تفعيل الحماية المحلية.");

    const fn = httpsCallable(functions, "analyzeContent");
    const payload: AnalyzeContentParams = { text, childName, platform, imageUri };

    const apiCall = fn(payload);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT_EXCEEDED")), TIMEOUT_MS)
    );

    const res: any = await Promise.race([apiCall, timeoutPromise]);
    const data = (res?.data ?? {}) as any;

    return {
      category: (Object.values(Category) as string[]).includes(String(data.category))
        ? (data.category as Category)
        : Category.SAFE,
      severity: (Object.values(AlertSeverity) as string[]).includes(String(data.severity))
        ? (data.severity as AlertSeverity)
        : AlertSeverity.LOW,
      aiAnalysis: String(data.aiAnalysis ?? "تحليل روتيني"),
      actionTaken: String(data.actionTaken ?? "لا إجراء"),
      suspectUsername: String(data.suspectUsername ?? "System"),
      conversationLog: Array.isArray(data.conversationLog)
        ? data.conversationLog.map((m: any) => ({
            sender: String(m.sender ?? ""),
            text: String(m.text ?? ""),
            time: String(m.time ?? ""),
            isSuspect: !!m.isSuspect,
          }))
        : [],
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("Analyze Content (Proxy) Error:", error);
    return safeFallback("تعذر التحليل السحابي. تم تفعيل الحماية المحلية.");
  }
};
