
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitoringAlert, Category } from '../types';
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
    // تم تعديل المهلة الزمنية إلى 2000 مللي ثانية (ثانيتين) لتختفي الإشعارات بسرعة
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500); 
    }, 2000);
    return () => clearTimeout(timer);
  }, [alert, onClose]);

  const handleToastClick = () => {
    if (!isSystemSuccess) {
      navigate('/vault', { state: { openAlertId: alert.id } });
    }
    setVisible(false);
    setTimeout(onClose, 500);
  };

  // التدرج الذهبي الرسمي لـ Amanah (8 درجات مصقولة)
  const qatarGold = "linear-gradient(135deg, #FFF8D8 0%, #F7DE8D 10%, #D1A23D 22%, #FFF2B6 36%, #B47E1B 50%, #FFE6A0 64%, #C69126 78%, #7A4D0A 100%)";

  return (
    <div className={`fixed top-12 left-0 right-0 z-[9999] px-6 transition-all duration-700 ease-out transform ${visible ? 'translate-y-0 opacity-100' : '-translate-y-32 opacity-0'}`}>
      <div 
        onClick={handleToastClick}
        className={`max-w-md mx-auto relative bg-white rounded-[2.2rem] shadow-[0_30px_70px_-15px_rgba(122,77,10,0.2)] flex items-center p-5 gap-5 cursor-pointer transition-all active:scale-[0.97] group border-4 border-transparent`}
        style={isSystemSuccess ? { 
          background: `linear-gradient(white, white) padding-box, ${qatarGold} border-box`,
        } : {
          borderColor: '#8A1538'
        }}
      >
        {/* أيقونة الدرع الرسمي */}
        <div className="w-14 h-14 flex items-center justify-center flex-shrink-0 relative z-10">
          <AmanahShield className="w-12 h-12 drop-shadow-sm" />
        </div>

        {/* نصوص الرسالة - باللون الماروني بالكامل */}
        <div className="flex-1 min-w-0 text-right relative z-10">
          <div className="flex justify-between items-center flex-row-reverse mb-0.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#8A1538]/50">Amanah Security • الآن</p>
            <div className={`w-1.5 h-1.5 rounded-full ${isSystemSuccess ? 'bg-[#D1A23D]' : 'bg-red-600'} animate-pulse`}></div>
          </div>
          <h4 className="text-[15px] font-black truncate text-[#8A1538]">
            {isSystemSuccess ? "إشعار تنفيذ مهمة" : `تنبيه أمني لـ ${alert.childName}`}
          </h4>
          <p className="text-[12px] font-bold leading-tight text-[#8A1538]/90">
            {alert.aiAnalysis}
          </p>
        </div>

        {!isSystemSuccess && (
          <button className="text-[#8A1538]/30 hover:text-red-600 p-1 relative z-10">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationToast;
