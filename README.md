<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1NvomZsaYRa0-oeAOMSO2Ax8D2vnCzLG2

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Real SMS Without Firebase Billing

You can run a local SMS webhook and connect the app to it:

1. Configure `.env` with:
   - `VITE_SMS_VERIFICATION_WEBHOOK_URL=http://localhost:8787/sms/verification`
   - `VITE_SMS_VERIFICATION_WEBHOOK_TOKEN=...`
   - `VITE_PHONE_VERIFICATION_PREFER_GATEWAY=1` (skip Firebase attempt in this mode)
   - `SMS_WEBHOOK_BEARER_TOKEN=...` (same token)
   - `SMS_PROVIDER=textbelt` or `SMS_PROVIDER=android_gateway`
   - `SMS_TEXTBELT_KEY=textbelt` (shared free key, limited) or your own key
   - `SMS_ANDROID_GATEWAY_URL=...` when using `android_gateway`
2. Start webhook:
   - `npm run sms:webhook`
3. Start app:
   - `npm run dev`

Detailed setup: `server/README.md`.

### Troubleshooting

**If Build Fails on Windows (esbuild version mismatch):**
If `npm run build` fails with "Host version ... does not match binary version", this is due to a known issue with esbuild on Windows after dependency updates.
To fix:
1. Delete `node_modules` folder and `package-lock.json`.
2. Run `npm install` again to cleanly reinstall dependencies.
3. Run `npm run build`.
