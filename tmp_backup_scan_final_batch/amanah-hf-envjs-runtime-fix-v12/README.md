---
title: Amanah AI Parental Control
emoji: 🛡️
colorFrom: indigo
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# Amanah AI: Advanced Parental Shield

نظام رقابة أبوية متقدم يعتمد على الذكاء الاصطناعي.

## النشر (Deployment)
يتم النشر تلقائياً عبر Docker على Hugging Face Spaces.

### المتغيرات المطلوبة في الإعدادات (Secrets):
يرجى إضافة هذه المفاتيح في تبويب **Settings > Variables and secrets** لكي يعمل التطبيق:

1.  `API_KEY`: مفتاح Google Gemini API.
2.  `FIREBASE_API_KEY`: مفتاح Firebase الخاص بك.
3.  `FIREBASE_AUTH_DOMAIN`
4.  `FIREBASE_PROJECT_ID`
5.  `FIREBASE_STORAGE_BUCKET`
6.  `FIREBASE_MESSAGING_SENDER_ID`
7.  `FIREBASE_APP_ID`

## المميزات
- فحص فوري للمحتوى البصري والنصي.
- تتبع جغرافي ذكي.
- بث مباشر وتحكم في العتاد.
- خزنة أدلة جنائية مشفرة.