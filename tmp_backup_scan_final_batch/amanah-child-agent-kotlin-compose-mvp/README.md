# Amanah Child Agent (Android) — Kotlin + Jetpack Compose (MVP)

This package contains the **source files** for the Child Agent MVP:
- Scan QR (payload: `AMANAH_PAIR:v1:<sessionId>`)
- Ask child for 6‑digit pairing code
- Call your **Backend API (Firebase Functions / HTTPS)** to verify and finalize pairing
- Store the returned device credentials securely (EncryptedSharedPreferences)

## Important
This zip is **not** a full Gradle-wrapped project (no `gradle-wrapper.jar`).
Fastest setup:
1) Open **Android Studio** → New Project → **Empty Activity (Jetpack Compose)**.
2) Replace the generated project's `app/src/main/...` files with the ones in this zip.
3) Copy the `dependencies` blocks from the included Gradle snippets (below).
4) Set your Backend URL and build.

## Backend contract (recommended)
`POST /pair/verify` with JSON:
```json
{
  "sessionId": "....",
  "code": "123456",
  "device": {
    "platform": "android",
    "model": "SM-S928B",
    "osVersion": "14",
    "appVersion": "1.0.0"
  }
}
```

Response (example):
```json
{
  "ok": true,
  "deviceId": "dev_....",
  "parentUid": "uid_....",
  "accessToken": "jwt_or_custom_token",
  "expiresIn": 2592000
}
```

## Where to set BACKEND URL
In `PairingApi.kt`, update:
`private const val BASE_URL = "https://YOUR_DOMAIN_OR_FUNCTION_URL"`

## Files included
- `android_src/app/src/main/...` → copy into your Android Studio project.

## Gradle snippets
See `gradle_snippets/` folder.

## Security notes
- Pairing sessions should expire quickly (e.g., 10 minutes).
- Limit attempts per session (e.g., 5) and per IP/device.
- Store only what you need on device; encrypt at rest.
- Use TLS only; reject non-https endpoints.

