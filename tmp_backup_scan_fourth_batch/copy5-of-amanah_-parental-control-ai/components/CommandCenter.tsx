
import React, { useState } from 'react';
import { Child, CommandPriority, ParentAccount } from '../types';
import { ICONS, AmanahShield } from '../constants';
import { sendSovereignCommand } from '../services/firestoreService';

interface CommandCenterProps {
  child: Child;
  currentUser: ParentAccount;
}

const CommandCenter: React.FC<CommandCenterProps> = ({ child, currentUser }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState<any>(null);
  const [reasonText, setReasonText] = useState('');

  const issueCommand = async (type: any, priority: CommandPriority = CommandPriority.MEDIUM, params: any = {}) => {
    // التحقق مما إذا كان الأمر يتطلب سبباً (للأوامر الحساسة)
    const sensitiveCommands = ['BLACKOUT_OVERLAY', 'DEVICE_UNLOCK', 'NET_QUARANTINE'];
    if (sensitiveCommands.includes(type) && !reasonText) {
       setShowReasonInput({ type, priority, params });
       return;
    }

    setIsProcessing(true);
    await sendSovereignCommand(currentUser.id, child.id, type, params, priority, reasonText);
    setIsProcessing(false);
    setShowReasonInput(null);
    setReasonText('');
    alert(`تم إرسال أمر ${type} بنجاح للأولوية ${priority}`);
  };

  const commands = [
    { type: 'BLACKOUT_OVERLAY', label: 'تعتيم الشاشة', icon: '🌑', priority: CommandPriority.CRITICAL, color: 'bg-red-600' },
    { type: 'NET_QUARANTINE', label: 'حجر الشبكة', icon: '📡', priority: CommandPriority.HIGH, color: 'bg-indigo-600' },
    { type: 'REQUEST_SCREENSHOT', label: 'لقطة شاشة حية', icon: '📸', priority: CommandPriority.MEDIUM, color: 'bg-slate-900' },
    { type: 'WALKIE_START', label: 'فتح اللاسلكي', icon: '📻', priority: CommandPriority.MEDIUM, color: 'bg-emerald-600' },
    { type: 'CAMERA_BLOCK', label: 'حجب الكاميرا', icon: '📷', priority: CommandPriority.HIGH, color: 'bg-amber-600' },
    { type: 'MIC_BLOCK', label: 'حجب المايك', icon: '🎙️', priority: CommandPriority.HIGH, color: 'bg-amber-600' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in" dir="rtl">
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
         {commands.map(cmd => (
           <button 
             key={cmd.type}
             onClick={() => issueCommand(cmd.type, cmd.priority)}
             disabled={isProcessing}
             className={`p-6 rounded-[2.2rem] text-white flex flex-col items-center justify-center gap-3 shadow-xl active:scale-95 transition-all hover:scale-105 relative overflow-hidden ${cmd.color} ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
           >
              <span className="text-3xl relative z-10">{cmd.icon}</span>
              <span className="font-black text-xs relative z-10">{cmd.label}</span>
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/10 rounded-md text-[7px] font-black uppercase tracking-widest">{cmd.priority}</div>
           </button>
         ))}
      </div>

      {showReasonInput && (
        <div className="fixed inset-0 z-[9500] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl p-10 space-y-8 text-right border-4 border-white">
              <div className="flex items-center gap-5">
                 <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center text-3xl">⚠️</div>
                 <div>
                    <h3 className="text-2xl font-black text-slate-800">تأكيد الإجراء السيادي</h3>
                    <p className="text-slate-400 font-bold text-xs">يتطلب هذا الأمر تسجيل سبب للتدقيق الجنائي.</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-2">السبب (مطلوب)</label>
                 <textarea 
                    value={reasonText} onChange={e => setReasonText(e.target.value)}
                    placeholder="مثال: رصد محاولة استدراج نشطة..."
                    className="w-full p-6 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:border-red-600 transition-all min-h-[120px] text-right"
                 />
              </div>

              <div className="flex gap-4">
                 <button 
                  onClick={() => issueCommand(showReasonInput.type, showReasonInput.priority, showReasonInput.params)}
                  className="flex-1 py-5 bg-red-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all"
                 >
                   تنفيذ الأمر الموثق
                 </button>
                 <button onClick={() => setShowReasonInput(null)} className="px-8 py-5 bg-slate-50 text-slate-400 rounded-2xl font-black">إلغاء</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default CommandCenter;
