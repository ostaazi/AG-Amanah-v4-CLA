
import { useState, useEffect } from 'react';

export function useUnreadCount(familyId: string) {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    try {
      const res = await fetch(`/api/families/${familyId}/notifications/unread-count`);
      const data = await res.json();
      if (data.ok) setCount(data.unread_count);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 5000); // تحديث كل 5 ثوانٍ
    return () => clearInterval(interval);
  }, [familyId]);

  return count;
}
