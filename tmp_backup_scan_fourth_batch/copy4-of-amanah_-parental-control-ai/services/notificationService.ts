
/**
 * Amanah Push Notification Engine
 * Purpose: Bridge the gap between Web and OS notifications for real-time safety alerts.
 */

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    console.warn("هذا المتصفح لا يدعم إشعارات النظام.");
    return false;
  }

  // إذا كانت الصلاحية ممنوحة مسبقاً
  if (Notification.permission === "granted") {
    return true;
  }

  // إذا كانت الصلاحية محظورة، لا يمكن طلبها برمجياً ويجب على المستخدم تغييرها من الإعدادات
  if (Notification.permission === "denied") {
    return false;
  }

  // طلب الصلاحية لأول مرة
  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
};

export const sendSystemNotification = (title: string, options: NotificationOptions) => {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    // تشغيل هزاز الهاتف إذا كان مدعوماً (Android/Mobile Chrome)
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {}
    }
    
    try {
      // Fix: Cast NotificationOptions object to any to include 'renotify' which may be missing from TypeScript definition
      return new Notification(title, {
        icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛡️</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛡️</text></svg>',
        dir: 'rtl',
        lang: 'ar',
        tag: 'amanah-alert', // منع تكرار الإشعارات المتشابهة
        renotify: true,
        ...options,
      } as any);
    } catch (e) {
      console.error("Notification display failed:", e);
    }
  }
};
