// ==========================================
// 🎨 ملف الأصول المركزية (Central Assets Registry)
// ==========================================

import { AVATAR_LIBRARY_DATA } from './avatar_library_assets';

export const MY_DESIGNED_ASSETS = {
  // صورة المدير (أنت)
  ADMIN_AVATAR: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
  // صورة الابن (أحمد)
  CHILD_AVATAR: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
  // مكتبة الصور الكاملة (يتم استيرادها من ملف avatar_library_assets)
  LIBRARY_ICONS: AVATAR_LIBRARY_DATA,
};

export const FALLBACK_ASSETS = {
  ADMIN: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
  CHILD: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
  SUPERVISOR:
    'https://img.freepik.com/premium-vector/hijab-woman-avatar-illustration-vector-woman-hijab-profile-icon_671746-348.jpg',
  DEFAULTS: [
    'https://cdn-icons-png.flaticon.com/512/4140/4140048.png',
    'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
    'https://cdn-icons-png.flaticon.com/512/4140/4140033.png',
    'https://cdn-icons-png.flaticon.com/512/6024/6024190.png',
    'https://cdn-icons-png.flaticon.com/512/4140/4140051.png',
  ],
};
