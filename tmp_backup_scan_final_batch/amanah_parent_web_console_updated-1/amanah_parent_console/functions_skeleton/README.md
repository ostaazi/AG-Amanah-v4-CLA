# Amanah AI Proxy (Firebase Functions) - Skeleton

This web console is intentionally **client-only** and does **NOT** embed any AI provider API keys.

To enable AI features securely, create Firebase Callable Functions:

- `analyzeContent`
- `analyzeLocationSafety`

Store the Gemini key (or any provider key) only in **server-side** environment configuration.

## Expected request/response shapes

### analyzeContent
Request:
```json
{ "text": "...", "childName": "...", "platform": "...", "imageUri": "optional" }
```
Response (example):
```json
{
  "category": "HIGH_RISK",
  "severity": "HIGH",
  "aiAnalysis": "...",
  "actionTaken": "...",
  "suspectUsername": "...",
  "conversationLog": [{"sender":"...","text":"...","time":"...","isSuspect":true}],
  "mapsLinks": []
}
```

### analyzeLocationSafety
Request:
```json
{ "lat": 25.2854, "lng": 51.5310 }
```
Response:
```json
{ "text": "...", "mapsLinks": [{"title":"...","uri":"https://maps.google.com/..."}] }
```

## Notes
- Apply authentication/authorization checks in the function (ensure `context.auth.uid` is valid).
- Rate-limit per user/device and log suspicious spikes.
