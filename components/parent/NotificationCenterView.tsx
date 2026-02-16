import React from 'react';
import { MonitoringAlert } from '../../types';

interface NotificationCenterViewProps {
  lang: 'ar' | 'en';
  alerts: MonitoringAlert[];
}

const NotificationCenterView: React.FC<NotificationCenterViewProps> = ({ lang, alerts }) => (
  <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <h4 className="text-lg font-black text-slate-900">
      {lang === 'ar' ? 'مركز الإشعارات' : 'Notification Center'}
    </h4>
    <div className="space-y-2">
      {alerts.slice(0, 15).map((alert) => (
        <div key={alert.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-sm font-black text-slate-900">{alert.childName} • {alert.platform}</p>
          <p className="text-[11px] font-bold text-slate-600 mt-1">{alert.content}</p>
        </div>
      ))}
      {alerts.length === 0 && (
        <p className="text-sm font-bold text-slate-400 text-center py-4">
          {lang === 'ar' ? 'لا توجد إشعارات.' : 'No notifications.'}
        </p>
      )}
    </div>
  </div>
);

export default NotificationCenterView;
