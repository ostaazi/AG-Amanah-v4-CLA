
import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { ParentAccount, Child, FamilyMember, UserRole } from '../types';
import { translations } from '../translations';
import { 
  fetchSupervisors, 
} from '../services/firestoreService';
import { injectMockSuite, clearAllUserData } from '../services/mockDataService';
import { FALLBACK_ASSETS, MY_DESIGNED_ASSETS } from '../assets';

interface SettingsViewProps {
  currentUser: ParentAccount;
  children: Child[];
  lang: 'ar' | 'en';
  onUpdateMember: (id: string, type: UserRole, updates: any) => Promise<void>;
  onDeleteMember: (id: string, role: UserRole) => Promise<void>;
  onAddChild: (data: Partial<Child>) => Promise<void>;
  onAddSupervisor: (data: any) => Promise<FamilyMember>;
  showSuccessToast: (msg: string) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, children, lang, onUpdateMember, onDeleteMember, onAddChild, onAddSupervisor, showSuccessToast }) => {
  const t = translations[lang];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [supervisors, setSupervisors] = useState<FamilyMember[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [devLoading, setDevLoading] = useState<'NONE' | 'INJECTING' | 'CLEARING'>('NONE');
  
  // States for Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<FamilyMember | null>(null);
  const [showPairingModal, setShowPairingModal] = useState<FamilyMember | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState('');
  
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: '', role: 'SUPERVISOR' as UserRole });
  const [editForm, setEditForm] = useState({ name: '', email: '', avatar: '', role: 'SUPERVISOR' as UserRole });

  const libraryImages = [
    ...(currentUser as any).avatarLibrary || [],
    ...MY_DESIGNED_ASSETS.LIBRARY_ICONS,
    ...FALLBACK_ASSETS.DEFAULTS
  ];

  useEffect(() => {
    loadSupervisors();
  }, [currentUser.id]);

  const loadSupervisors = async () => {
    const data = await fetchSupervisors(currentUser.id);
    setSupervisors(data);
  };

  const handleInjectMockData = async () => {
    setDevLoading('INJECTING');
    try {
      await injectMockSuite(currentUser.id);
      showSuccessToast(lang === 'ar' ? "تم حقن بيانات الاختبار بنجاح" : "Mock data injected");
      // إعادة تحميل الصفحة لتحديث البيانات في كل المكونات
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setDevLoading('NONE');
    }
  };

  const handleClearData = async () => {
    if (!window.confirm(lang === 'ar' ? "سيتم حذف كافة الأبناء والتنبيهات والأنشطة لهذا الحساب. هل أنت متأكد؟" : "Clear everything?")) return;
    setDevLoading('CLEARING');
    try {
      await clearAllUserData(currentUser.id);
      showSuccessToast(lang === 'ar' ? "تم تصفير كافة البيانات" : "Data cleared");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setDevLoading('NONE');
    }
  };

  const generatePairingCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPairingCode(code.slice(0, 3) + '-' + code.slice(3));
  };

  const getQRUrl = (code: string, childId: string) => {
    const pairingData = `amanah://pair?code=${code}&childId=${childId}&parentId=${currentUser.id}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pairingData)}&bgcolor=ffffff&color=4f46e5`;
  };

  const handleLinkDevice = (member: FamilyMember) => {
    generatePairingCode();
    setShowPairingModal(member);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGlobalLoading(true);
    try {
      const compressedBase64 = await compressImage(file);
      setEditForm(prev => ({ ...prev, avatar: compressedBase64 }));
      showSuccessToast(lang === 'ar' ? "تم تجهيز الصورة" : "Image ready");
    } finally {
      setGlobalLoading(false);
    }
  };

  const executeDelete = async (member: FamilyMember) => {
    setGlobalLoading(true);
    try {
      await onDeleteMember(member.id, member.role);
      if (member.role === 'SUPERVISOR') {
        setSupervisors(prev => prev.filter(s => s.id !== member.id));
      }
      showSuccessToast(lang === 'ar' ? "تم حذف العضو بنجاح" : "Member deleted");
      setDeletingMemberId(null);
    } catch (e) {
      console.error("Delete failed", e);
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!showEditModal || globalLoading) return;
    setGlobalLoading(true);
    try {
      const updates: any = {
        name: editForm.name,
        avatar: editForm.avatar,
        role: editForm.role
      };
      if (editForm.avatar && !libraryImages.includes(editForm.avatar)) {
        const currentLib = (currentUser as any).avatarLibrary || [];
        updates.avatarLibrary = [editForm.avatar, ...currentLib].slice(0, 15);
      }
      await onUpdateMember(showEditModal.id, showEditModal.role, updates);
      if (showEditModal.role === 'SUPERVISOR') {
        setSupervisors(prev => prev.map(s => s.id === showEditModal.id ? { ...s, ...updates } : s));
      }
      showSuccessToast(lang === 'ar' ? "تم الحفظ" : "Saved");
      setShowEditModal(null);
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!inviteForm.name || globalLoading) return;
    setGlobalLoading(true);
    try {
      const finalAvatar = editForm.avatar || (inviteForm.role === 'CHILD' ? FALLBACK_ASSETS.CHILD : FALLBACK_ASSETS.SUPERVISOR);
      if (inviteForm.role === 'CHILD') {
        await onAddChild({ name: inviteForm.name, avatar: finalAvatar });
      } else {
        const newSup = await onAddSupervisor({
          name: inviteForm.name,
          email: inviteForm.email,
          password: inviteForm.password,
          avatar: finalAvatar,
          parentId: currentUser.id
        });
        setSupervisors(prev => [...prev, newSup]);
      }
      setShowInviteModal(false);
      setInviteForm({ name: '', email: '', password: '', role: 'SUPERVISOR' });
      setEditForm({ name: '', email: '', avatar: '', role: 'SUPERVISOR' });
    } catch (e) {
      console.error("Add failed", e);
    } finally {
      setGlobalLoading(false);
    }
  };

  const getMemberAvatar = (member: FamilyMember) => {
    if (member.avatar) return member.avatar;
    if (member.role === 'CHILD') return FALLBACK_ASSETS.CHILD;
    if (member.role === 'SUPERVISOR') return FALLBACK_ASSETS.SUPERVISOR;
    return FALLBACK_ASSETS.ADMIN;
  };

  const allMembersList = [
    { ...currentUser, role: 'ADMIN' as UserRole },
    ...supervisors.map(s => ({ ...s, role: 'SUPERVISOR' as UserRole })),
    ...children.map(c => ({ ...c, role: 'CHILD' as UserRole }))
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-48 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="px-4 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">إدارة العائلة</h2>
          <p className="text-slate-500 font-bold mt-1">تعديل ملفات الأعضاء بدقة وربط الأجهزة.</p>
        </div>
        <div className="flex gap-3">
            <button 
              onClick={() => { setInviteForm({ ...inviteForm, role: 'CHILD' }); setShowInviteModal(true); }}
              className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all flex items-center gap-3"
            >
              <span className="bg-indigo-600 p-1 rounded-md scale-75"><ICONS.Devices /></span>
              {lang === 'ar' ? 'ربط جهاز طفل' : 'Link Child'}
            </button>
            <button 
              onClick={() => { setEditForm({ ...editForm, avatar: '' }); setShowInviteModal(true); }}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl active:scale-95 transition-all"
            >
              {lang === 'ar' ? '+ إضافة عضو' : '+ Add Member'}
            </button>
        </div>
      </div>

      <section className="space-y-6">
           {allMembersList.map(member => (
             <div key={member.id} className="relative group">
                <div className={`p-6 bg-white rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-2xl transition-all duration-300 ${deletingMemberId === member.id ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                          <img src={getMemberAvatar(member)} className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md bg-white transition-all group-hover:scale-110" />
                          <div className="absolute -top-2 -right-2 bg-white w-7 h-7 rounded-full flex items-center justify-center shadow-md text-[10px] font-black">
                            {member.role === 'ADMIN' ? '🛡️' : member.role === 'SUPERVISOR' ? '👩‍🏫' : '👶'}
                          </div>
                      </div>
                      <div>
                          <h4 className="font-black text-slate-800 text-lg">{member.name}</h4>
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${member.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-600' : member.role === 'SUPERVISOR' ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                            {member.role === 'ADMIN' ? 'مدير' : member.role === 'SUPERVISOR' ? 'مشرف' : 'طفل'}
                          </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                       {member.role === 'CHILD' && (
                         <button 
                           onClick={() => handleLinkDevice(member)}
                           className="p-5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-[1.8rem] shadow-sm border border-slate-100 active:scale-90 transition-all group/btn"
                           title="ربط جهاز جديد"
                         >
                           <ICONS.Devices />
                         </button>
                       )}
                       <button 
                        onClick={() => { 
                          setShowEditModal(member); 
                          setEditForm({ name: member.name, email: member.email || '', avatar: getMemberAvatar(member), role: member.role }); 
                        }}
                        className="p-5 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-[1.8rem] border border-slate-100 active:scale-90 transition-all"
                      >
                        <ICONS.Settings />
                      </button>
                      {member.role !== 'ADMIN' && (
                        <button 
                          onClick={() => setDeletingMemberId(member.id)}
                          className="p-5 bg-white text-red-400 hover:bg-red-50 hover:text-red-600 rounded-[1.8rem] shadow-sm border border-slate-100 active:scale-90 transition-all"
                        >
                          <ICONS.Trash />
                        </button>
                      )}
                    </div>
                </div>

                {deletingMemberId === member.id && (
                  <div className="absolute inset-0 bg-red-600 rounded-full flex items-center justify-between px-8 py-4 animate-in zoom-in-95 duration-300 z-50 shadow-[0_20px_40px_rgba(220,38,38,0.4)] border-4 border-white/10">
                     <div className="flex items-center justify-between w-full gap-4">
                        <span className="text-white font-black text-xl lg:text-2xl whitespace-nowrap drop-shadow-md">حذف نهائي؟</span>
                        
                        <div className="flex gap-4 items-center">
                            <button 
                              onClick={() => executeDelete(member)}
                              disabled={globalLoading}
                              className="bg-white text-red-600 px-10 py-4 rounded-full font-black text-lg shadow-[0_10px_20px_rgba(0,0,0,0.15)] active:scale-95 disabled:opacity-50 transition-all hover:bg-slate-50"
                            >
                              {globalLoading ? '...' : 'نعم، احذف'}
                            </button>
                            
                            <button 
                              onClick={() => setDeletingMemberId(null)}
                              className="bg-red-800/40 text-white px-10 py-4 rounded-full font-black text-lg hover:bg-red-900/50 transition-all active:scale-95"
                            >
                              إلغاء
                            </button>
                        </div>
                     </div>
                  </div>
                )}
             </div>
           ))}
      </section>

      {/* Developer & Testing Tools Card */}
      <section className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl text-white relative overflow-hidden group">
         <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-indigo-600 rounded-2xl"><ICONS.Rocket /></div>
               <h3 className="text-2xl font-black tracking-tight">أدوات التطوير والاختبار (Amanah Dev-Tools)</h3>
            </div>
            
            <p className="text-slate-400 font-bold text-sm leading-relaxed max-w-2xl">
               هذا القسم مخصص لاختبار كفاءة النظام. يمكنك حقن بيانات تجريبية كاملة (أطفال، تنبيهات حقيقية، أنشطة) لمحاكاة بيئة عمل حقيقية، أو تصفير كافة البيانات لتنظيف الحساب.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <button 
                 onClick={handleInjectMockData}
                 disabled={devLoading !== 'NONE'}
                 className="py-5 bg-white text-slate-900 rounded-[2rem] font-black text-lg flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all disabled:opacity-50"
               >
                 {devLoading === 'INJECTING' ? (
                   <span className="w-5 h-5 border-2 border-slate-900/20 border-t-slate-900 rounded-full animate-spin"></span>
                 ) : '🧪 حقن بيانات تجريبية'}
               </button>

               <button 
                 onClick={handleClearData}
                 disabled={devLoading !== 'NONE'}
                 className="py-5 bg-red-600/20 border border-red-500/30 text-red-400 rounded-[2rem] font-black text-lg flex items-center justify-center gap-4 active:scale-95 transition-all disabled:opacity-50 hover:bg-red-600 hover:text-white"
               >
                 {devLoading === 'CLEARING' ? (
                   <span className="w-5 h-5 border-2 border-red-400/20 border-t-red-400 rounded-full animate-spin"></span>
                 ) : '🗑️ تصفير كافة البيانات'}
               </button>
            </div>
         </div>
         <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-indigo-600/10 rounded-full blur-3xl group-hover:scale-110 transition-transform"></div>
      </section>

      {/* مودال ربط الأجهزة */}
      {showPairingModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-in fade-in">
           <div className="bg-white w-full max-w-lg rounded-[4rem] shadow-2xl p-10 text-center border-4 border-indigo-600/20 animate-in zoom-in-95 overflow-hidden flex flex-col items-center">
              <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-3xl mb-6 shadow-xl">
                 <ICONS.Devices />
              </div>
              <h3 className="text-3xl font-black text-slate-900 mb-2">ربط جهاز {showPairingModal.name}</h3>
              <p className="text-slate-500 font-bold mb-8 px-4">وجه كاميرا جهاز الطفل نحو الرمز، أو أدخل الكود يدوياً.</p>
              
              <div className="relative mb-10 group">
                 <div className="absolute -inset-4 bg-indigo-500/10 rounded-[3rem] blur-xl group-hover:bg-indigo-500/20 transition-all duration-500"></div>
                 <div className="relative bg-white p-6 rounded-[3rem] shadow-inner border-2 border-slate-50">
                    <img 
                      src={getQRUrl(pairingCode, showPairingModal.id)} 
                      alt="Pairing QR Code" 
                      className="w-48 h-48 md:w-64 md:h-64 object-contain animate-in fade-in zoom-in duration-700"
                    />
                 </div>
                 <div className="absolute -top-2 -right-2 bg-indigo-600 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                    📸
                 </div>
              </div>

              <div className="w-full bg-slate-50 p-6 rounded-[2.5rem] border-2 border-dashed border-indigo-100 mb-8">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">الكود اليدوي</p>
                 <span className="text-4xl font-black text-slate-800 tracking-widest font-mono drop-shadow-sm">{pairingCode}</span>
              </div>

              <div className="w-full space-y-4">
                  <button 
                    onClick={() => setShowPairingModal(null)}
                    className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg shadow-xl active:scale-95 transition-all"
                  >
                    تم، جاري المزامنة
                  </button>
                  <button 
                    onClick={generatePairingCode}
                    className="text-indigo-600 font-black text-xs uppercase tracking-widest hover:underline"
                  >
                    توليد رمز جديد
                  </button>
              </div>
           </div>
        </div>
      )}

      {(showEditModal || showInviteModal) && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-in fade-in">
           <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl flex flex-col max-h-[85vh] border-x-4 border-white overflow-hidden animate-in zoom-in-95">
              
              <div className="p-8 flex justify-between items-center bg-slate-50 border-b border-slate-100 flex-shrink-0">
                 <h3 className="text-xl font-black text-slate-900">{showEditModal ? 'تعديل البيانات' : 'إضافة عضو'}</h3>
                 <button onClick={() => { setShowEditModal(null); setShowInviteModal(false); }} className="text-slate-300 hover:text-red-500 transition-colors"><ICONS.Close /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                 <div className="flex flex-col items-center gap-4">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                       <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-8 border-indigo-50 shadow-xl transition-all hover:scale-105 active:scale-95">
                          <img src={editForm.avatar || (inviteForm.role === 'CHILD' ? FALLBACK_ASSETS.CHILD : FALLBACK_ASSETS.SUPERVISOR)} className="w-full h-full object-cover bg-white" />
                          <div className="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">تغيير الصورة</div>
                       </div>
                    </div>
                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileUpload} />

                    <div className="w-full space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">مكتبة الأفاتار</label>
                       <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                          {libraryImages.map((img, idx) => (
                            <button key={idx} onClick={() => setEditForm({ ...editForm, avatar: img })} className={`flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all ${editForm.avatar === img ? 'border-indigo-600 scale-110 shadow-lg' : 'border-transparent'}`}><img src={img} className="w-full h-full object-cover" /></button>
                          ))}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="flex gap-4">
                       <button onClick={() => setInviteForm(p => ({...p, role: 'SUPERVISOR'}))} className={`flex-1 py-3 rounded-xl font-black text-xs border-2 transition-all ${inviteForm.role === 'SUPERVISOR' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>مشرف</button>
                       <button onClick={() => setInviteForm(p => ({...p, role: 'CHILD'}))} className={`flex-1 py-3 rounded-xl font-black text-xs border-2 transition-all ${inviteForm.role === 'CHILD' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>طفل</button>
                    </div>

                    <Input label="الاسم المستعار" value={showEditModal ? editForm.name : inviteForm.name} onChange={v => showEditModal ? setEditForm({...editForm, name: v}) : setInviteForm({...inviteForm, name: v})} />
                    
                    {inviteForm.role === 'SUPERVISOR' && (
                       <>
                         <Input label="البريد الإلكتروني" value={inviteForm.email} onChange={v => setInviteForm({...inviteForm, email: v})} />
                         <Input label="كلمة المرور" type="password" value={inviteForm.password} onChange={v => setInviteForm({...inviteForm, password: v})} />
                       </>
                    )}
                 </div>
              </div>

              <div className="p-8 bg-white border-t border-slate-100 flex gap-4 flex-shrink-0 z-10 shadow-[0_-15px_30px_rgba(0,0,0,0.05)]">
                 <button 
                   onClick={showEditModal ? handleUpdate : handleAddMember} 
                   disabled={globalLoading}
                   className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl font-black text-xl shadow-xl active:scale-95 disabled:opacity-50 transition-all"
                 >
                   {globalLoading ? 'جاري الحفظ...' : 'تأكيد الحفظ'}
                 </button>
                 <button 
                   onClick={() => { setShowEditModal(null); setShowInviteModal(false); }} 
                   className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-3xl font-black text-xl hover:bg-slate-200 transition-colors"
                 >
                   إلغاء
                 </button>
              </div>

           </div>
        </div>
      )}
    </div>
  );
};

const Input = ({ label, value, onChange, type = "text" }: { label: string, value: string, onChange: (v: string) => void, type?: string }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase px-2 tracking-widest">{label}</label>
    <input 
      type={type} value={value} onChange={e => onChange(e.target.value)}
      className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-bold text-right shadow-inner"
    />
  </div>
);

export default SettingsView;
