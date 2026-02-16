
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitoringAlert, AlertSeverity, Category } from '../types';
import { AmanahShield } from '../constants';

interface NotificationToastProps {
  alert: MonitoringAlert;
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ alert, onClose }) => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const isSystemSuccess = alert.category === Category.SAFE; 

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500); 
    }, 5000);
    return () => clearTimeout(timer);
  }, [alert, onClose]);

  const handleToastClick = () => {
    if (!isSystemSuccess) {
      navigate('/vault', { state: { openAlertId: alert.id } });
    }
    setVisible(false);
    setTimeout(onClose, 500);
  };

  // تدرج ذهبي مصقول مطابق تماماً لـ goldMetal في Constants
  const qatarGoldGradient = "linear-gradient(135deg, #FFF8D8 0%, #F7DE8D 10%, #D1A23D 22%, #FFF2B6 36%, #B47E1B 50%, #FFE6A0 64%, #C69126 78%, #7A4D0A 100%)";

  return (
    <div className={`fixed top-12 left-0 right-0 z-[9999] px-6 transition-all duration-700 ease-out transform ${visible ? 'translate-y-0 opacity-100' : '-translate-y-32 opacity-0'}`}>
      <div 
        onClick={handleToastClick}
        className={`max-w-md mx-auto relative bg-white rounded-[2rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] overflow-hidden flex items-center p-5 gap-5 cursor-pointer transition-all active:scale-[0.97] group border-4 border-transparent`}
        style={isSystemSuccess ? { 
          background: `linear-gradient(white, white) padding-box, ${qatarGoldGradient} border-box`,
        } : {
          borderColor: '#dc2626'
        }}
      >
        {/* لمعة داخلية لإعطاء تأثير العمق المعدني */}
        {isSystemSuccess && (
          <div className="absolute inset-0 rounded-[1.8rem] pointer-events-none" 
               style={{ 
                 boxShadow: 'inset 0 0 12px rgba(255,242,182,0.6), 0 0 20px rgba(180,126,27,0.2)' 
               }}>
          </div>
        )}

        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 relative z-10 transition-transform group-hover:scale-110 ${isSystemSuccess ? 'bg-slate-50 border border-slate-100 shadow-inner' : (alert.severity === AlertSeverity.CRITICAL ? 'bg-red-600 text-white' : 'bg-[#8A1538] text-white')}`}>
          {isSystemSuccess ? (
            <AmanahShield className="w-10 h-10" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          )}
        </div>

        <div className="flex-1 min-w-0 text-right relative z-10">
          <div className="flex justify-between items-center flex-row-reverse mb-0.5">
            <p className={`text-[9px] font-black uppercase tracking-widest ${isSystemSuccess ? 'text-[#8A1538]/50' : 'text-slate-400'}`}>Amanah Security • الآن</p>
            <div className={`w-1.5 h-1.5 rounded-full ${isSystemSuccess ? 'bg-[#D1A23D]' : 'bg-red-600'} animate-pulse`}></div>
          </div>
          <h4 className={`text-sm font-black truncate ${isSystemSuccess ? 'text-[#8A1538]' : 'text-slate-900'}`}>
            {isSystemSuccess ? "إشعار تنفيذ مهمة" : `تنبيه أمني لـ ${alert.childName}`}
          </h4>
          <p className={`text-[11px] font-bold leading-tight ${isSystemSuccess ? 'text-[#8A1538]/80' : 'text-slate-600'}`}>
            {alert.aiAnalysis}
          </p>
        </div>

        {!isSystemSuccess && (
          <button className="text-slate-300 hover:text-red-500 p-1 relative z-10">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationToast;
