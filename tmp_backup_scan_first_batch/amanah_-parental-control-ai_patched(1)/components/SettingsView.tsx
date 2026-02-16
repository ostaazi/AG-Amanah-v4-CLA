
import React, { useState, useRef } from 'react';
import { ICONS } from '../constants';
import { Child, ParentAccount, UserRole } from '../types';

interface SettingsViewProps {
  children: Child[];
  supervisors: ParentAccount[];
  currentUser: ParentAccount;
  lang: 'ar' | 'en';
  theme: 'light' | 'dark';
  onSetLang: (l: 'ar' | 'en') => void;
  onAddChild: (name: string, age: number, avatar: string) => void;
  onAddSupervisor: (email: string) => void;
  onDeleteChild: (id: string) => void;
  onDeleteSupervisor: (id: string) => void;
  onUpdateMember: (id: string, type: 'CHILD' | 'SUPERVISOR' | 'ADMIN', updates: any) => void;
  onConnectDevice: (childId: string, updates: Partial<Child>) => void;
  showSuccessToast: (msg: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ 
  children, supervisors, currentUser, lang, theme, onSetLang, onAddChild, onAddSupervisor, onDeleteChild, onDeleteSupervisor, onUpdateMember, onConnectDevice, showSuccessToast 
}) => {
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState('');
  const [motherEmail, setMotherEmail] = useState('');
  
  // Security States
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // Link States
  const [showDeviceLinkModal, setShowDeviceLinkModal] = useState(false);
  const [selectedChildForDevice, setSelectedChildForDevice] = useState('');
  const [deviceModel, setDeviceModel] = useState('');

  // Platforms State (Simulated connection)
  const [connectedPlatforms, setConnectedPlatforms] = useState<Record<string, boolean>>({
    'WhatsApp': true,
    'TikTok': true,
    'Instagram': false,
    'Snapchat': false,
    'Discord': true
  });

  // Edit Modal State
  const [showEditMemberModal, setShowEditMemberModal] = useState<{id: string, name: string, role: string, type: 'CHILD' | 'SUPERVISOR' | 'ADMIN'} | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberRole, setEditMemberRole] = useState<UserRole>('CHILD');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<{id: string, type: 'CHILD' | 'SUPERVISOR' | 'ADMIN'} | null>(null);

  const inputStyle = "w-full p-5 bg-white border border-slate-200 rounded-[2rem] outline-none focus:ring-4 focus:ring-indigo-600/5 transition-all font-bold text-slate-700 shadow-sm";
  const primaryBtn = "w-full py-5 rounded-full font-black text-lg text-white shadow-xl transition-all active:scale-95";

  const togglePlatform = (name: string) => {
    setConnectedPlatforms(prev => {
      const next = { ...prev, [name]: !prev[name] };
      showSuccessToast(next[name] ? `تم تفعيل مراقبة ${name}` : `تم إيقاف مراقبة ${name}`);
      return next;
    });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingFor) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateMember(uploadingFor.id, uploadingFor.type, { avatar: reader.result as string });
        setUploadingFor(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'ADMIN': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'SUPERVISOR': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-32 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
      
      <div className="flex justify-between items-center px-4">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">الإعدادات</h2>
        <div className="flex p-1 bg-white border border-slate-100 rounded-full shadow-sm">
           <button onClick={() => onSetLang('ar')} className={`px-8 py-2 rounded-full text-xs font-black transition-all ${lang === 'ar' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>العربية</button>
           <button onClick={() => onSetLang('en')} className={`px-8 py-2 rounded-full text-xs font-black transition-all ${lang === 'en' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>English</button>
        </div>
      </div>

      {/* Account & Security Section */}
      <section className="bg-white/80 backdrop-blur-2xl rounded-[3.5rem] p-10 border border-white shadow-xl space-y-10">
        <h3 className="text-2xl font-black text-slate-800 border-b pb-4 flex items-center gap-4">
           🔐 الأمان والخصوصية
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">تغيير كلمة المرور</p>
              <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder="كلمة المرور الحالية" className={inputStyle} />
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="كلمة المرور الجديدة" className={inputStyle} />
              <button 
                onClick={() => { showSuccessToast("تم التحديث"); setCurrentPass(''); setNewPass(''); }}
                className="w-full py-4 bg-slate-900 text-white rounded-full font-black text-sm shadow-xl active:scale-95 transition-all"
              >
                حفظ التغييرات
              </button>
           </div>

           <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">إعدادات الدخول</p>
              
              <ToggleRow 
                label="المصادقة الثنائية (2FA)" 
                active={twoFactorEnabled} 
                onToggle={() => setTwoFactorEnabled(!twoFactorEnabled)} 
                lang={lang}
              />
              <ToggleRow 
                label="البصمة البيومترية" 
                active={biometricsEnabled} 
                onToggle={() => setBiometricsEnabled(!biometricsEnabled)} 
                lang={lang}
              />
           </div>
        </div>
      </section>

      {/* Platforms Connection Section (Bark Feature) */}
      <section className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl text-white space-y-8">
        <div className="flex justify-between items-center border-b border-white/10 pb-6">
          <h3 className="text-2xl font-black tracking-tighter">المنصات المراقبة</h3>
          <span className="text-[10px] font-black bg-indigo-600 px-4 py-1.5 rounded-full uppercase tracking-widest">AMANAH V9 ENGINE</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(connectedPlatforms).map(([name, isConnected]) => (
            <button 
              key={name}
              onClick={() => togglePlatform(name)}
              className={`p-6 rounded-[2.5rem] border-2 transition-all flex flex-col items-center gap-3 ${isConnected ? 'bg-indigo-600 border-indigo-400 shadow-lg' : 'bg-white/5 border-white/10 opacity-40 hover:opacity-100'}`}
            >
              <span className="text-3xl">{name === 'WhatsApp' ? '💬' : name === 'TikTok' ? '🎵' : name === 'Instagram' ? '📸' : name === 'Snapchat' ? '👻' : '🛡️'}</span>
              <p className="text-[10px] font-black uppercase tracking-widest">{name}</p>
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-white' : 'bg-white/20'}`}></div>
            </button>
          ))}
        </div>
        <p className="text-[10px] font-bold text-indigo-300 text-center opacity-60 italic">يتم تحليل المحادثات والوسائط تلقائياً باستخدام محرك الذكاء الاصطناعي في السحابة.</p>
      </section>

      {/* Family Management */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-indigo-50/40 backdrop-blur-xl p-10 rounded-[3.5rem] border border-white shadow-xl space-y-6">
            <h4 className="text-xl font-black text-indigo-900">إضافة فرد للعائلة</h4>
            <div className="space-y-3">
              <input value={newChildName} onChange={e => setNewChildName(e.target.value)} placeholder="الاسم" className={inputStyle} />
              <input value={newChildAge} onChange={e => setNewChildAge(e.target.value)} type="number" placeholder="العمر" className={inputStyle} />
            </div>
            <button onClick={() => { onAddChild(newChildName, parseInt(newChildAge), 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png'); setNewChildName(''); setNewChildAge(''); }} className="w-full py-4 rounded-full font-black text-indigo-700 bg-white border-2 border-indigo-200">إضافة</button>
          </div>
          <div className="bg-emerald-50/40 backdrop-blur-xl p-10 rounded-[3.5rem] border border-white shadow-xl space-y-6">
            <h4 className="text-xl font-black text-emerald-900">دعوة مشرف</h4>
            <input value={motherEmail} onChange={e => setMotherEmail(e.target.value)} type="email" placeholder="البريد الإلكتروني" className={inputStyle} />
            <button onClick={() => { onAddSupervisor(motherEmail); setMotherEmail(''); }} className="w-full py-4 rounded-full font-black text-emerald-700 bg-white border-2 border-emerald-200">إرسال دعوة</button>
          </div>
      </section>

      {/* List Members */}
      <section className="bg-white/80 backdrop-blur-2xl rounded-[3.5rem] p-10 border border-white shadow-xl">
        <h3 className="text-2xl font-black text-slate-800 mb-8 px-4 tracking-tighter">إدارة الأعضاء</h3>
        <div className="space-y-4">
           {[currentUser, ...supervisors, ...children.map(c => ({...c, role: 'CHILD'}))].map((member: any) => (
             <div key={member.id} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[2.5rem] border border-white shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <img src={member.avatar} className="w-14 h-14 rounded-2xl shadow-md border-2 border-white object-cover" />
                  <div className="text-right">
                    <p className="font-black text-slate-800 text-sm">{member.name}</p>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${getRoleBadgeColor(member.role)}`}>
                      {member.role === 'ADMIN' ? 'مدير' : member.role === 'SUPERVISOR' ? 'مشرف' : 'طفل'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => { 
                      setEditMemberName(member.name); 
                      setEditMemberRole(member.role as UserRole);
                      setShowEditMemberModal({id: member.id, name: member.name, role: member.role, type: member.role === 'CHILD' ? 'CHILD' : (member.role === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR')}); 
                   }} className="p-3 bg-white text-indigo-600 rounded-xl shadow-sm border border-slate-100 hover:scale-110 transition-transform"><ICONS.Settings /></button>
                   {member.id !== currentUser.id && (
                     <button onClick={() => member.role === 'CHILD' ? onDeleteChild(member.id) : onDeleteSupervisor(member.id)} className="p-3 bg-white text-red-600 rounded-xl shadow-sm border border-slate-100 hover:scale-110 transition-transform">🗑️</button>
                   )}
                </div>
             </div>
           ))}
        </div>
      </section>

      {/* Member Edit Modal */}
      {showEditMemberModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 text-right">
              <h3 className="text-3xl font-black text-center tracking-tighter">تعديل العضو</h3>
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-slate-400 uppercase px-4">الاسم</label>
                 <input value={editMemberName} onChange={e => setEditMemberName(e.target.value)} className={inputStyle} />
              </div>
              <div className="flex gap-4">
                 <button onClick={() => { 
                    onUpdateMember(showEditMemberModal.id, showEditMemberModal.type, { name: editMemberName }); 
                    setShowEditMemberModal(null); 
                 }} className="flex-[2] bg-slate-900 text-white py-5 rounded-full font-black text-lg shadow-xl">حفظ</button>
                 <button onClick={() => setShowEditMemberModal(null)} className="flex-1 bg-slate-100 text-slate-400 py-5 rounded-full font-black">إلغاء</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const ToggleRow: React.FC<{ label: string, active: boolean, onToggle: () => void, lang: string }> = ({ label, active, onToggle, lang }) => (
  <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-white cursor-pointer group" onClick={onToggle}>
     <span className="font-black text-slate-700 text-sm">{label}</span>
     <div className={`w-12 h-6 rounded-full transition-all flex items-center px-1 ${active ? 'bg-emerald-600' : 'bg-slate-300'}`}>
       <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${active ? (lang === 'ar' ? '-translate-x-6' : 'translate-x-6') : ''}`}></div>
     </div>
  </div>
);

export default SettingsView;
