# Firebase Functions sample (pair/verify) — 참고용

This is a **reference** implementation you can merge into your existing backend.
It validates:
- session exists
- not expired
- attempts not exceeded
- code matches (prefer hashing server-side)
Then it binds device to parent.

See `functions_sample/index.ts`.
