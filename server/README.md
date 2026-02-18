# Server Webhooks

---

## Email Invitation Webhook (No Spam)

Sends beautiful Arabic invitation emails via professional email services (Resend, SendGrid, Brevo) instead of Firebase's built-in emails that often land in spam.

### Quick Setup (Resend - Recommended)

1. Create a free account at https://resend.com (100 emails/day free)
2. Get your API key from the Resend dashboard
3. Add to `.env`:

```env
# Frontend -> email webhook
VITE_EMAIL_INVITATION_WEBHOOK_URL=http://localhost:8788/email/invite
VITE_EMAIL_INVITATION_WEBHOOK_TOKEN=replace_with_strong_token

# Email webhook server
EMAIL_WEBHOOK_BEARER_TOKEN=replace_with_strong_token
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM_ADDRESS=Amanah <onboarding@resend.dev>
EMAIL_WEBHOOK_PORT=8788
```

> For production, verify your own domain in Resend and use `noreply@your-domain.com` instead of `onboarding@resend.dev`.

4. Run the webhook:

```bash
npm run email:webhook
```

5. Run the frontend:

```bash
npm run dev
```

Now co-parent invitations will send professional emails that land in the inbox (not spam).

### Alternative Providers

**SendGrid** (100 emails/day free):
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your_sendgrid_api_key
```

**Brevo** (300 emails/day free):
```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=your_brevo_api_key
```

**Mock** (testing only - logs to console):
```env
EMAIL_PROVIDER=mock
```

### Test the endpoint

```bash
curl -X POST "http://localhost:8788/email/invite" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer replace_with_strong_token" ^
  -d "{\"email\":\"mother@example.com\",\"inviterName\":\"أحمد\",\"appUrl\":\"https://amanah-protect.web.app/\"}"
```

---

# SMS Verification Webhook (No Firebase Billing)

This webhook sends real SMS verification codes for profile phone updates without requiring Firebase Billing.
If Textbelt free key is blocked for your country, use `android_gateway` mode (real SMS via your own phone/SIM).

## 1) Configure `.env`

Set these values in your project `.env`:

```env
# Frontend -> webhook
VITE_SMS_VERIFICATION_WEBHOOK_URL=http://localhost:8787/sms/verification
VITE_SMS_VERIFICATION_WEBHOOK_TOKEN=replace_with_strong_token
VITE_PHONE_VERIFICATION_PREFER_GATEWAY=1

# Optional direct client fallback
VITE_SMS_TEXTBELT_KEY=textbelt

# Webhook server (Textbelt mode)
SMS_WEBHOOK_BEARER_TOKEN=replace_with_strong_token
SMS_PROVIDER=textbelt
SMS_TEXTBELT_KEY=textbelt
SMS_WEBHOOK_CORS_ORIGIN=*
PORT=8787
```

Important:
- `VITE_SMS_VERIFICATION_WEBHOOK_TOKEN` must equal `SMS_WEBHOOK_BEARER_TOKEN`.
- Phone number must be E.164 format (example for Qatar: `+974XXXXXXXX`).

## 2) Run the webhook

```bash
npm run sms:webhook
```

Expected startup log:

```text
[SMS_WEBHOOK] listening on http://localhost:8787/sms/verification ...
```

## 3) Run the frontend

```bash
npm run dev
```

Now sending the phone verification code from Settings will call the webhook and dispatch a real SMS.

## 4) Android Gateway Mode (No Card Required)

Use this mode when Textbelt returns:
`free SMS are disabled for this country due to abuse`.

Set in `.env`:

```env
SMS_PROVIDER=android_gateway
SMS_ANDROID_GATEWAY_URL=https://your-phone-gateway.example/send
SMS_ANDROID_GATEWAY_TOKEN=your_gateway_token_if_needed
SMS_ANDROID_GATEWAY_PHONE_FIELD=phone
SMS_ANDROID_GATEWAY_MESSAGE_FIELD=message
```

Then run:

```bash
npm run sms:webhook
npm run dev
```

How it works:
- Your app calls local webhook (`localhost:8787`).
- Webhook forwards SMS to your Android gateway endpoint.
- Android gateway app sends SMS using your SIM.

Your Android gateway endpoint must accept JSON with phone/message fields (or set custom field names in `.env`).

## 5) Quick API test (optional)

```bash
curl -X POST "http://localhost:8787/sms/verification" ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer replace_with_strong_token" ^
  -d "{\"phone\":\"+974XXXXXXXX\",\"code\":\"123456\",\"purpose\":\"manual_test\",\"ttlSeconds\":600}"
```

## 6) Notes

- `SMS_PROVIDER=mock` logs messages to console only (no real SMS).
- Textbelt shared key (`textbelt`) is limited. For stable delivery use your own Textbelt key.
- Supported providers in webhook: `textbelt`, `android_gateway`, `mock`.
- Current app flow validates the code in the frontend state. For production-grade security, move code generation/storage/verification entirely to backend.
