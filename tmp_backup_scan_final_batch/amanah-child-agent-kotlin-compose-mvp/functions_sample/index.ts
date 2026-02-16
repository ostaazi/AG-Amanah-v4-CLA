/**
 * Firebase Functions (TypeScript) — sample pairing endpoint
 * Path: POST /pair/verify
 *
 * Firestore collections:
 * - pairingSessions/{sessionId}
 *   { codeHash, expiresAt, parentUid, attempts, maxAttempts, used, createdAt }
 * - devices/{deviceId}
 *   { parentUid, linkedAt, model, osVersion, appVersion, status }
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import * as express from "express";

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(express.json());

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

app.post("/pair/verify", async (req, res) => {
  try {
    const { sessionId, code, device } = req.body || {};
    if (!sessionId || !code || String(code).length !== 6) {
      return res.status(400).json({ ok: false, error: "invalid_request" });
    }

    const ref = db.collection("pairingSessions").doc(String(sessionId));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "session_not_found" });

    const data = snap.data() as any;
    const now = Date.now();

    if (data.used) return res.status(409).json({ ok: false, error: "session_used" });
    if (data.expiresAt && data.expiresAt.toMillis && data.expiresAt.toMillis() < now) {
      return res.status(410).json({ ok: false, error: "session_expired" });
    }

    const attempts = Number(data.attempts || 0);
    const maxAttempts = Number(data.maxAttempts || 5);
    if (attempts >= maxAttempts) return res.status(429).json({ ok: false, error: "too_many_attempts" });

    // Prefer storing codeHash only (not plain code)
    const ok = data.codeHash === sha256(String(code));
    await ref.update({ attempts: attempts + 1 });

    if (!ok) return res.status(401).json({ ok: false, error: "invalid_code" });

    const parentUid = String(data.parentUid || "");
    if (!parentUid) return res.status(500).json({ ok: false, error: "missing_parent" });

    // Create device record
    const deviceId = "dev_" + crypto.randomBytes(16).toString("hex");
    await db.collection("devices").doc(deviceId).set({
      parentUid,
      linkedAt: admin.firestore.FieldValue.serverTimestamp(),
      model: device?.model || "unknown",
      osVersion: device?.osVersion || "unknown",
      appVersion: device?.appVersion || "unknown",
      status: "linked"
    });

    // Mark session used
    await ref.update({ used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });

    // OPTIONAL: issue a signed JWT or Firebase Custom Token (recommended)
    // For brevity, return a placeholder token.
    const accessToken = "REPLACE_WITH_JWT_OR_CUSTOM_TOKEN";

    return res.json({ ok: true, deviceId, parentUid, accessToken, expiresIn: 60 * 60 * 24 * 30 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export const amanahApi = functions.https.onRequest(app);
