/**
 * Firebase Functions skeleton for Amanah AI proxy.
 *
 * SECURITY: keep API keys here (server-side), never in the browser.
 *
 * This is a minimal template. You must:
 * 1) create a Firebase Functions project (TypeScript)
 * 2) install dependencies (firebase-functions, firebase-admin, and your AI SDK or fetch)
 * 3) set secrets via `firebase functions:secrets:set` or env config
 * 4) deploy
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";

export const analyzeLocationSafety = onCall(async (request) => {
  const { lat, lng } = (request.data ?? {}) as { lat?: number; lng?: number };
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new HttpsError("invalid-argument", "lat/lng required");
  }

  // TODO: call your provider / internal service
  // Return shape expected by the web console:
  return {
    text: `Location analysis placeholder for (${lat}, ${lng}).`,
    mapsLinks: [
      { title: "Google Maps", uri: `https://www.google.com/maps?q=${lat},${lng}` },
    ],
  };
});

export const analyzeContent = onCall(async (request) => {
  const { text, childName, platform, imageUri } = (request.data ?? {}) as {
    text?: string;
    childName?: string;
    platform?: string;
    imageUri?: string;
  };

  if (!text || !childName || !platform) {
    throw new HttpsError("invalid-argument", "text/childName/platform required");
  }

  // TODO: call your LLM safely and return a structured result.
  return {
    category: "SAFE",
    severity: "LOW",
    aiAnalysis: "This is a placeholder response from the secure backend proxy.",
    actionTaken: "Monitor",
    suspectUsername: "System",
    conversationLog: [],
  };
});
