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

### Troubleshooting

**If Build Fails on Windows (esbuild version mismatch):**
If `npm run build` fails with "Host version ... does not match binary version", this is due to a known issue with esbuild on Windows after dependency updates.
To fix:
1. Delete `node_modules` folder and `package-lock.json`.
2. Run `npm install` again to cleanly reinstall dependencies.
3. Run `npm run build`.
