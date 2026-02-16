
import React, { useState, useRef } from 'react';
import { ICONS } from '../constants';
import { Child, ParentAccount, UserRole } from '../types';
import { MY_DESIGNED_ASSETS } from '../assets';
import { translations } from '../translations';

interface SettingsViewProps {
  children: Child[];
  supervisors: ParentAccount[];
  currentUser: ParentAccount;
  lang: 'ar' | 'en';
  theme: 'light' | 'dark';
  avatarLibrary: string[];
  onAddToLibrary: (url: string) => void;
  onAddBulkToLibrary: (urls: string[]) => void;
  onRemoveFromLibrary: (index: number) => void;
  onReorderLibrary: (newOrder: string[]) => void;
  onSetLang: (l: 'ar' | 'en') => void;
  onAddChild: (name: string, age: number, avatar: string) => void;
  onAddSupervisor: (name: string, avatar?: string) => void;
  onDeleteChild: (id: string) => void;
  onDeleteSupervisor: (id: string) => void;
  onUpdateMember: (id: string, type: 'CHILD' | 'SUPERVISOR' | 'ADMIN', updates: any) => void;
  onConnectDevice: (childId: string, updates: Partial<Child>) => void;
  showSuccessToast: (msg: string) => void;
}

// دالة معالجة وضغط الصور
const processImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 300;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
            reject(new Error("Could not get canvas context"));
        }
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const SettingsView: React.FC<SettingsViewProps> = ({ 
  children, supervisors, currentUser, lang, theme, avatarLibrary, onAddToLibrary, onAddBulkToLibrary, onRemoveFromLibrary, onReorderLibrary, onSetLang, onAddChild, onAddSupervisor, onDeleteChild, onDeleteSupervisor, onUpdateMember, onConnectDevice, showSuccessToast 
}) => {
  const t = translations[lang];
  // New Member State
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAge, setNewMemberAge] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'CHILD' | 'SUPERVISOR'>('CHILD');
  const [newMemberAvatar, setNewMemberAvatar] = useState(''); 

  // Security States
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // Forgot Password Flow States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1); 
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

  // 2FA & Bio Setup Modals
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState<1 | 2 | 3>(1); 
  const [twoFaCode, setTwoFaCode] = useState('');
  const [secretKey] = useState('JBSW Y3DP EHPK 3PXP'); // مفتاح ثابت للمحاكاة
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  
  const [showBioSetup, setShowBioSetup] = useState(false);
  const [bioScanning, setBioScanning] = useState(false);

  // Edit & Delete Modals
  const [showEditMemberModal, setShowEditMemberModal] = useState<{id: string, name: string, role: string, type: 'CHILD' | 'SUPERVISOR' | 'ADMIN', avatar: string} | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberRole, setEditMemberRole] = useState<UserRole>('CHILD');
  const [memberToDelete, setMemberToDelete] = useState<{id: string, name: string, type: 'CHILD' | 'SUPERVISOR'} | null>(null);

  // --- Upload & Library Logic ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<{id: string, type: 'CHILD' | 'SUPERVISOR' | 'ADMIN' | 'NEW_MEMBER' | 'LIBRARY_ONLY'} | null>(null);
  const [pendingUploadImage, setPendingUploadImage] = useState<string | null>(null);
  const [showLibrarySavePrompt, setShowLibrarySavePrompt] = useState(false);
  
  // --- Avatar Selector Modal State ---
  const [showAvatarSelector, setShowAvatarSelector] = useState<{id: string, type: 'CHILD' | 'SUPERVISOR' | 'ADMIN'} | null>(null);

  // --- Assign Image State ---
  const [imageToAssign, setImageToAssign] = useState<string | null>(null);

  // Modern Input Style
  const inputStyle = `w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700 placeholder:text-slate-300 shadow-sm text-lg ${lang === 'ar' ? 'text-right' : 'text-left'}`;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !uploadingFor) return;

    try {
      if (uploadingFor.type === 'LIBRARY_ONLY') {
        const fileList = Array.from(files);
        const promises = fileList.map(file => processImage(file as File));
        const results = await Promise.all(promises);
        onAddBulkToLibrary(results);
        showSuccessToast(`تم رفع ${results.length} صورة للمكتبة`);
        setUploadingFor(null);
      } else {
        const file = files[0];
        const result = await processImage(file);
        setPendingUploadImage(result);
        setShowLibrarySavePrompt(true);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("حدث خطأ أثناء معالجة الصور.");
    } finally {
      e.target.value = '';
    }
  };

  const handleCopyAssetsCode = async () => {
    const currentAdminAvatar = currentUser.avatar.startsWith('data:') ? currentUser.avatar : (MY_DESIGNED_ASSETS.ADMIN_AVATAR || '');
    const currentChildAvatar = children[0]?.avatar.startsWith('data:') ? children[0].avatar : (MY_DESIGNED_ASSETS.CHILD_AVATAR || '');
    const libraryImages = avatarLibrary.filter(img => img.startsWith('data:'));

    const fileContent = `
// ==========================================
// 🎨 ملف الأصول المركزية (Central Assets Registry)
// ==========================================
// تم توليد هذا الملف تلقائياً. الصقه هنا لتثبيت الصور.

export const MY_DESIGNED_ASSETS = {
  // صورة المدير (أنت)
  ADMIN_AVATAR: "${currentAdminAvatar}", 
  
  // صورة الابن (أحمد)
  CHILD_AVATAR: "${currentChildAvatar}", 
  
  // مكتبة الصور الكاملة
  LIBRARY_ICONS: ${JSON.stringify(libraryImages, null, 2)}
};

// الصور الاحتياطية الافتراضية
export const FALLBACK_ASSETS = {
  ADMIN: 'https://i.pravatar.cc/150?u=father',
  CHILD: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
  DEFAULTS: [
    'https://cdn-icons-png.flaticon.com/512/4140/4140048.png',
    'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
    'https://cdn-icons-png.flaticon.com/512/4140/4140033.png',
    'https://cdn-icons-png.flaticon.com/512/6024/6024190.png',
    'https://cdn-icons-png.flaticon.com/512/4140/4140051.png'
  ]
};
`;
    try {
        await navigator.clipboard.writeText(fileContent);
        showSuccessToast('✅ تم نسخ الكود! الصقه الآن في ملف assets.ts');
    } catch (err) {
        alert('فشل النسخ التلقائي. يرجى النسخ يدوياً.');
    }
  };

  const handleMoveImage = (index: number, direction: 'left' | 'right') => {
    const newLibrary = [...avatarLibrary];
    if (direction === 'left' && index > 0) {
      [newLibrary[index], newLibrary[index - 1]] = [newLibrary[index - 1], newLibrary[index]];
    } else if (direction === 'right' && index < newLibrary.length - 1) {
      [newLibrary[index], newLibrary[index + 1]] = [newLibrary[index + 1], newLibrary[index]];
    }
    onReorderLibrary(newLibrary);
  };

  const confirmAssignment = (memberId: string, type: 'CHILD' | 'SUPERVISOR' | 'ADMIN') => {
    if (!imageToAssign) return;
    onUpdateMember(memberId, type, { avatar: imageToAssign });
    showSuccessToast('تم تحديث الصورة الشخصية بنجاح');
    setImageToAssign(null);
  };

  const applyAvatarUpdate = (imageUrl: string) => {
    if (!uploadingFor) return;

    if (uploadingFor.type === 'NEW_MEMBER') {
        setNewMemberAvatar(imageUrl);
    } else if (uploadingFor.type !== 'LIBRARY_ONLY') {
        onUpdateMember(uploadingFor.id, uploadingFor.type as any, { avatar: imageUrl });
        if (showEditMemberModal && showEditMemberModal.id === uploadingFor.id) {
             setShowEditMemberModal(prev => prev ? ({...prev, avatar: imageUrl}) : null);
        }
    }
    setUploadingFor(null);
  };

  const confirmSaveToLibrary = () => {
    if (pendingUploadImage) {
        onAddToLibrary(pendingUploadImage);
        applyAvatarUpdate(pendingUploadImage);
        setPendingUploadImage(null);
        setShowLibrarySavePrompt(false);
        showSuccessToast('تم الحفظ في المكتبة وتحديث الصورة');
    }
  };

  const skipSaveToLibrary = () => {
    if (pendingUploadImage) {
        applyAvatarUpdate(pendingUploadImage);
        setPendingUploadImage(null);
        setShowLibrarySavePrompt(false);
    }
  };

  const handleSelectFromLibrary = (imageUrl: string) => {
    if (!showAvatarSelector) return;
    onUpdateMember(showAvatarSelector.id, showAvatarSelector.type, { avatar: imageUrl });
    if (showEditMemberModal && showEditMemberModal.id === showAvatarSelector.id) {
        setShowEditMemberModal(prev => prev ? ({...prev, avatar: imageUrl}) : null);
    }
    setShowAvatarSelector(null); 
    showSuccessToast("تم تحديث الصورة بنجاح");
  };

  const handleUploadNewClick = () => {
    if (!showAvatarSelector) return;
    setUploadingFor({ id: showAvatarSelector.id, type: showAvatarSelector.type });
    setShowAvatarSelector(null); 
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'ADMIN': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'SUPERVISOR': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      default: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  // --- Security Logic Handlers ---

  const handlePasswordChange = () => {
    if (!currentPass) {
        alert("يرجى إدخال كلمة المرور الحالية");
        return;
    }
    if (newPass.length < 6) {
        alert("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
        return;
    }
    // Simulation
    showSuccessToast("تم تحديث كلمة المرور بنجاح");
    setCurrentPass('');
    setNewPass('');
  };

  const handleForgotPassFlow = () => {
    if (resetStep === 1) {
      if (!resetEmail.includes('@')) return alert('يرجى إدخال بريد إلكتروني صحيح');
      setResetStep(2); 
      showSuccessToast('تم إرسال رمز التحقق إلى بريدك');
    } else if (resetStep === 2) {
      if (resetOtp.length < 4) return alert('رمز التحقق غير صحيح');
      setResetStep(3);
    } else if (resetStep === 3) {
      if (resetNewPassword.length < 6) return alert('كلمة المرور قصيرة جداً');
      showSuccessToast('تم استعادة الحساب وتغيير كلمة المرور'); 
      setShowForgotModal(false); 
      setResetStep(1); 
      setResetEmail(''); 
      setResetOtp(''); 
      setResetNewPassword('');
    }
  };

  const handle2FAToggle = () => {
    if (twoFactorEnabled) { 
        setTwoFactorEnabled(false); 
        showSuccessToast('تم تعطيل المصادقة الثنائية'); 
    } else { 
        // Start Setup Flow
        setShow2FASetup(true); 
        setTwoFaStep(1); 
        setTwoFaCode('');
        // Generate Dummy Backup Codes
        const codes = Array.from({length: 8}, () => Math.floor(10000000 + Math.random() * 90000000).toString().match(/.{1,4}/g)?.join(' ') || '');
        setBackupCodes(codes);
    }
  };

  const confirm2FASetup = () => {
      // In a real app, we verify the TOTP here against the secret
      if (twoFaCode.length < 6) return alert("الرمز غير صحيح (تأكد من تطبيق Authenticator)");
      // Move to Backup Codes step
      setTwoFaStep(3);
  };
  
  const finish2FASetup = () => {
      setTwoFactorEnabled(true);
      setShow2FASetup(false);
      showSuccessToast('تم تفعيل المصادقة الثنائية بنجاح!');
  }

  const copySecret = () => {
      navigator.clipboard.writeText(secretKey);
      showSuccessToast('تم نسخ المفتاح السري');
  }
  
  const copyBackupCodes = () => {
      navigator.clipboard.writeText(backupCodes.join('\n'));
      showSuccessToast('تم نسخ رموز الطوارئ');
  }

  const handleBioToggle = () => {
    if (biometricsEnabled) { 
        setBiometricsEnabled(false); 
        showSuccessToast('تم إلغاء تفعيل البصمة'); 
    } else { 
        // Start Bio Setup
        setShowBioSetup(true); 
        setBioScanning(false);
    }
  };

  const simulateBioScan = () => {
      setBioScanning(true);
      setTimeout(() => {
          setBiometricsEnabled(true);
          setShowBioSetup(false);
          setBioScanning(false);
          showSuccessToast('تم تفعيل الدخول بالبصمة بنجاح');
      }, 2000);
  };

  const handleAddNewMember = () => {
    if (!newMemberName.trim()) return alert("الاسم مطلوب");
    const finalAvatar = newMemberAvatar || (newMemberRole === 'CHILD' ? 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png' : 'https://cdn-icons-png.flaticon.com/512/6024/6024190.png');
    if (newMemberRole === 'CHILD') {
      if (!newMemberAge) return alert("العمر مطلوب للطفل");
      onAddChild(newMemberName, parseInt(newMemberAge), finalAvatar);
      showSuccessToast('تم إضافة الطفل بنجاح');
    } else {
      onAddSupervisor(newMemberName, finalAvatar);
      showSuccessToast('تم إضافة المشرف بنجاح');
    }
    setNewMemberName(''); setNewMemberAge(''); setNewMemberAvatar('');
  };

  const confirmDelete = () => {
    if (!memberToDelete) return;
    if (memberToDelete.type === 'CHILD') { onDeleteChild(memberToDelete.id); showSuccessToast(`تم حذف حساب ${memberToDelete.name} بنجاح`); }
    else { onDeleteSupervisor(memberToDelete.id); showSuccessToast(`تم حذف حساب المشرف ${memberToDelete.name} بنجاح`); }
    setMemberToDelete(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-32 animate-in fade-in" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleAvatarUpload} />
      
      <div className="flex justify-between items-center px-4">
        <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{t.settingsTitle}</h2>
        <div className="flex p-1 bg-white border border-slate-100 rounded-full shadow-sm">
           <button onClick={() => onSetLang('ar')} className={`px-8 py-2 rounded-full text-xs font-black transition-all ${lang === 'ar' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>العربية</button>
           <button onClick={() => onSetLang('en')} className={`px-8 py-2 rounded-full text-xs font-black transition-all ${lang === 'en' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>English</button>
        </div>
      </div>

      {/* Account & Security Section */}
      <section className="bg-white/80 backdrop-blur-2xl rounded-[3.5rem] p-10 border border-white shadow-xl space-y-10">
        <h3 className="text-2xl font-black text-slate-800 border-b pb-4 flex items-center gap-4">{t.securityPrivacy}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           <div className="space-y-6">
              <div className="flex justify-between items-center px-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.changePass}</p>
              </div>
              <div className="relative">
                <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} placeholder={t.currentPass} className={inputStyle} />
                <button onClick={() => setShowForgotModal(true)} className={`absolute ${lang === 'ar' ? 'left-6' : 'right-6'} top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg`}>{t.forgotPass}</button>
              </div>
              <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder={t.newPass} className={inputStyle} />
              <button onClick={handlePasswordChange} className="w-full py-4 bg-slate-900 text-white rounded-full font-black text-sm shadow-xl hover:bg-slate-800 active:scale-95 transition-all">{t.saveChanges}</button>
           </div>
           <div className="space-y-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">{t.loginSettings}</p>
              
              {/* Encryption Status Indicator (Zero-Knowledge) */}
              <div className="flex items-center justify-between p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100 shadow-sm">
                 <div className="flex items-center gap-3">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="font-black text-emerald-800 text-sm">{t.encryptionStatus}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <span className="text-lg">🔒</span>
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{t.encryptionActive}</span>
                 </div>
              </div>

              <ToggleRow label={t.twoFA} active={twoFactorEnabled} onToggle={handle2FAToggle} lang={lang} />
              <ToggleRow label={t.biometrics} active={biometricsEnabled} onToggle={handleBioToggle} lang={lang} />
           </div>
        </div>
      </section>

      {/* --- Developer Tools (Asset Generator) --- */}
      <section className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl space-y-8 text-white border-b-8 border-indigo-600 relative overflow-hidden">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-x-10 -translate-y-10"></div>
         <div className="flex justify-between items-center relative z-10">
             <div>
                <h3 className="text-2xl font-black flex items-center gap-3">{t.installCode}</h3>
                <p className="text-slate-400 text-xs font-bold mt-2 leading-relaxed max-w-lg">
                   بسبب قيود أمان المتصفح، لا يمكن للتطبيق تعديل ملفات الكود مباشرة.
                   الحل الأسرع: اضغط الزر لنسخ الكود، ثم الصقه في ملف <span className="text-indigo-400 font-mono bg-white/10 px-1 rounded">assets.ts</span>.
                </p>
             </div>
         </div>
         <div className="space-y-4 relative z-10">
            <button 
              onClick={handleCopyAssetsCode}
              className="w-full py-6 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 rounded-2xl font-black shadow-lg shadow-emerald-900/50 transition-all active:scale-95 flex items-center justify-center gap-4 group"
            >
               <span className="text-2xl group-hover:scale-125 transition-transform">📋</span>
               <div className={`text-${lang === 'ar' ? 'right' : 'left'}`}>
                  <span className="block text-sm">{t.copyCode}</span>
                  <span className="block text-[9px] font-bold text-emerald-100 opacity-80">جاهز للصق المباشر في assets.ts</span>
               </div>
            </button>
         </div>
      </section>

      {/* Image Library Management */}
      <section className="bg-white/80 backdrop-blur-2xl rounded-[3.5rem] p-10 border border-white shadow-xl space-y-8">
         <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-4">
            <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
                {t.library}
                <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black border border-indigo-100">{avatarLibrary.length}</span>
                </h3>
            </div>
            
            <button onClick={() => { setUploadingFor({id: 'lib', type: 'LIBRARY_ONLY'}); setTimeout(() => fileInputRef.current?.click(), 0); }} className="bg-indigo-600 text-white px-6 py-3 rounded-[1.2rem] font-black text-xs shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
                <span>+</span> {t.uploadToLib}
            </button>
         </div>
         {avatarLibrary.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-[2.5rem] border border-slate-100 border-dashed"><span className="text-4xl opacity-50 block mb-2">🖼️</span><p className="text-sm font-bold text-slate-400">المكتبة فارغة حالياً</p></div>
         ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 max-h-80 overflow-y-auto custom-scrollbar p-2">
               {avatarLibrary.map((img, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer">
                     <img src={img} className="w-full h-full object-cover" loading="lazy" />
                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[1px] gap-2">
                        <div className="flex gap-2">
                           <button onClick={(e) => { e.stopPropagation(); setImageToAssign(img); }} className="bg-emerald-500 text-white p-2 rounded-full hover:bg-emerald-600 transition-colors shadow-lg active:scale-90" title="استخدم هذه الصورة">👤</button>
                           <button onClick={(e) => { e.stopPropagation(); onRemoveFromLibrary(idx); }} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg active:scale-90" title="حذف من المكتبة">✕</button>
                        </div>
                        <div className="flex gap-2 mt-1">
                           {idx < avatarLibrary.length - 1 && <button onClick={(e) => {e.stopPropagation(); handleMoveImage(idx, 'right');}} className="text-white hover:text-indigo-400 font-black text-xs px-2 py-1 bg-white/10 rounded-lg">◀</button>}
                           {idx > 0 && <button onClick={(e) => {e.stopPropagation(); handleMoveImage(idx, 'left');}} className="text-white hover:text-indigo-400 font-black text-xs px-2 py-1 bg-white/10 rounded-lg">▶</button>}
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         )}
      </section>

      {/* ... Add Member & List Members sections ... */}
      <section className="bg-gradient-to-br from-indigo-50 to-white backdrop-blur-xl p-12 rounded-[3.5rem] border border-white shadow-xl space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-200/20 rounded-full blur-3xl -translate-x-10 -translate-y-10"></div>
          <div className="relative z-10">
            <h4 className="text-3xl font-black text-indigo-900 mb-2">{t.addMember}</h4>
            <div className="bg-slate-100 p-2 rounded-[2rem] flex mb-8 max-w-md mx-auto shadow-inner">
               <button onClick={() => setNewMemberRole('CHILD')} className={`flex-1 py-4 rounded-[1.8rem] text-sm font-black transition-all flex items-center justify-center gap-2 ${newMemberRole === 'CHILD' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><span>👶</span> {t.child}</button>
               <button onClick={() => setNewMemberRole('SUPERVISOR')} className={`flex-1 py-4 rounded-[1.8rem] text-sm font-black transition-all flex items-center justify-center gap-2 ${newMemberRole === 'SUPERVISOR' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}><span>🛡️</span> {t.supervisor}</button>
            </div>
            <div className="space-y-4">
               <div className="flex justify-center mb-6">
                 <div className="relative group cursor-pointer" onClick={() => { setUploadingFor({id: 'new', type: 'NEW_MEMBER'}); setTimeout(() => fileInputRef.current?.click(), 0); }}>
                    <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-slate-200 to-slate-300 shadow-inner relative overflow-hidden">
                        <img src={newMemberAvatar || (newMemberRole === 'CHILD' ? 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png' : 'https://cdn-icons-png.flaticon.com/512/6024/6024190.png')} className="w-full h-full rounded-full object-cover border-4 border-white" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]"><span className="text-white font-black text-[10px]">تغيير</span></div>
                    </div>
                 </div>
               </div>
               {avatarLibrary.length > 0 && (
                   <div className="flex gap-2 justify-center pb-4 overflow-x-auto custom-scrollbar">
                      {avatarLibrary.map((img, idx) => (
                          <img key={idx} src={img} onClick={() => setNewMemberAvatar(img)} className="w-10 h-10 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-110 transition-transform" />
                      ))}
                   </div>
               )}
              <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="الاسم" className={inputStyle} />
              <div className={`transition-all duration-500 overflow-hidden ${newMemberRole === 'CHILD' ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
                 <input value={newMemberAge} onChange={e => setNewMemberAge(e.target.value)} type="number" placeholder="العمر" className={inputStyle} />
              </div>
            </div>
            <button onClick={handleAddNewMember} className="w-full mt-8 py-5 rounded-[2rem] font-black text-white bg-indigo-600 shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 text-lg">{t.add}</button>
          </div>
      </section>

      <section className="bg-white/80 backdrop-blur-2xl rounded-[3.5rem] p-10 border border-white shadow-xl">
        <h3 className="text-2xl font-black text-slate-800 mb-8 px-4 tracking-tighter">{t.manageMembers}</h3>
        <div className="space-y-4">
           {[currentUser, ...supervisors, ...children.map(c => ({...c, role: 'CHILD'}))].map((member: any) => (
             <div key={member.id} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[2.5rem] border border-white shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <img src={member.avatar} className="w-14 h-14 rounded-2xl shadow-md border-2 border-white object-cover" />
                  <div className={`text-${lang === 'ar' ? 'right' : 'left'}`}>
                    <p className="font-black text-slate-800 text-sm">{member.name}</p>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${getRoleBadgeColor(member.role)}`}>{member.role === 'ADMIN' ? t.admin : member.role === 'SUPERVISOR' ? t.supervisor : t.child}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => { setEditMemberName(member.name); setEditMemberRole(member.role as UserRole); setShowEditMemberModal({ id: member.id, name: member.name, role: member.role, type: member.role === 'CHILD' ? 'CHILD' : (member.role === 'ADMIN' ? 'ADMIN' : 'SUPERVISOR'), avatar: member.avatar }); }} className="p-3 bg-white text-indigo-600 rounded-xl shadow-sm border border-slate-100 hover:scale-110 transition-transform"><ICONS.Settings /></button>
                   {member.id !== currentUser.id && <button onClick={() => setMemberToDelete({ id: member.id, name: member.name, type: member.role === 'CHILD' ? 'CHILD' : 'SUPERVISOR' })} className="p-3 bg-white text-red-600 rounded-xl shadow-sm border border-slate-100 hover:scale-110 transition-transform">🗑️</button>}
                </div>
             </div>
           ))}
        </div>
      </section>

      {/* --- MODALS & OVERLAYS --- */}

      {/* 1. 2FA Setup Modal (Google Authenticator Style) */}
      {show2FASetup && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95 relative border-4 border-white/50">
              <div className="flex justify-between items-center mb-2">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-xl">🔐</div>
                  <button onClick={() => setShow2FASetup(false)} className="text-slate-400 hover:text-slate-600"><ICONS.Close /></button>
              </div>
              
              {twoFaStep === 1 && (
                  <div className="space-y-6">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">إعداد Google Authenticator</h3>
                        <p className="text-xs font-bold text-slate-500 mt-2 leading-relaxed">افتح تطبيق Google Authenticator على هاتفك وامسح رمز QR أدناه.</p>
                      </div>
                      
                      <div className="bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-inner inline-block relative">
                          {/* Real QR Code using external API for simulation */}
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=otpauth://totp/Amanah:Admin?secret=${secretKey.replace(/\s/g, '')}&issuer=Amanah`} 
                            className="w-40 h-40 object-contain rounded-xl mix-blend-multiply opacity-90"
                            alt="2FA QR Code"
                          />
                          <div className="absolute inset-0 border-4 border-white/50 rounded-3xl pointer-events-none"></div>
                      </div>

                      <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">أو أدخل المفتاح يدوياً</p>
                          <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                             <code className="flex-1 font-mono font-black text-slate-700 tracking-widest text-center text-sm">{secretKey}</code>
                             <button onClick={copySecret} className="p-2 bg-white rounded-xl shadow-sm text-slate-500 hover:text-indigo-600 hover:scale-110 transition-all" title="نسخ المفتاح">📋</button>
                          </div>
                      </div>

                      <button onClick={() => setTwoFaStep(2)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">التالي: التحقق من الرمز</button>
                  </div>
              )}

              {twoFaStep === 2 && (
                  <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-black text-slate-900">أدخل رمز التحقق</h3>
                        <p className="text-xs font-bold text-slate-500 mt-2">أدخل الرمز المكون من 6 أرقام الظاهر في التطبيق.</p>
                      </div>
                      
                      <input 
                        value={twoFaCode} 
                        onChange={(e) => setTwoFaCode(e.target.value)} 
                        className="w-full p-5 text-center text-3xl font-black tracking-[0.5em] bg-slate-50 border-2 border-indigo-100 rounded-[1.5rem] outline-none focus:border-indigo-600 focus:bg-white transition-all text-slate-800" 
                        maxLength={6} 
                        placeholder="000000"
                        autoFocus
                      />
                      
                      <div className="flex gap-3 pt-4">
                        <button onClick={confirm2FASetup} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">تفعيل الحماية</button>
                        <button onClick={() => setTwoFaStep(1)} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:bg-slate-200">رجوع</button>
                      </div>
                  </div>
              )}

              {twoFaStep === 3 && (
                  <div className="space-y-6">
                      <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto shadow-lg shadow-emerald-100 mb-2">✅</div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900">تم التفعيل بنجاح!</h3>
                        <p className="text-xs font-bold text-slate-500 mt-2">احتفظ برموز الطوارئ هذه في مكان آمن. ستستخدمها في حال فقدت هاتفك.</p>
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-[1.5rem] border border-slate-200 grid grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar">
                          {backupCodes.map((code, idx) => (
                             <div key={idx} className="bg-white p-2 rounded-xl border border-slate-100 text-center font-mono font-bold text-slate-600 text-xs tracking-wider">
                                {code}
                             </div>
                          ))}
                      </div>

                      <div className="flex flex-col gap-3">
                        <button onClick={copyBackupCodes} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-xs shadow-lg flex items-center justify-center gap-2 hover:bg-slate-900 active:scale-95 transition-all">
                            <span>📋</span> نسخ جميع الرموز
                        </button>
                        <button onClick={finish2FASetup} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-xl hover:bg-emerald-600 active:scale-95 transition-all">تم، إغلاق النافذة</button>
                      </div>
                  </div>
              )}
           </div>
        </div>
      )}

      {/* 2. Biometric Setup Modal */}
      {showBioSetup && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl space-y-8 text-center animate-in zoom-in-95">
              <h3 className="text-xl font-black text-slate-900">تفعيل بصمة الإصبع</h3>
              <div 
                onClick={simulateBioScan}
                className={`w-32 h-32 mx-auto rounded-full border-4 flex items-center justify-center text-6xl cursor-pointer transition-all ${bioScanning ? 'border-indigo-500 bg-indigo-50 text-indigo-600 animate-pulse' : 'border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-400'}`}
              >
                 {bioScanning ? '⚡' : '👆'}
              </div>
              <p className="text-xs font-bold text-slate-500">{bioScanning ? 'جاري التحقق من البصمة...' : 'اضغط على الرمز أعلاه للمسح'}</p>
              <button onClick={() => setShowBioSetup(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">إلغاء</button>
           </div>
        </div>
      )}

      {/* 3. Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-6 text-center animate-in zoom-in-95">
              <h3 className="text-xl font-black text-slate-900">استعادة كلمة المرور</h3>
              
              {resetStep === 1 && (
                  <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-500">أدخل بريدك الإلكتروني المسجل</p>
                      <input value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="Email" className={inputStyle} />
                      <button onClick={handleForgotPassFlow} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs">إرسال الرمز</button>
                  </div>
              )}
              {resetStep === 2 && (
                  <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-500">أدخل الرمز المرسل إلى بريدك</p>
                      <input value={resetOtp} onChange={e => setResetOtp(e.target.value)} placeholder="Code" className={inputStyle} />
                      <button onClick={handleForgotPassFlow} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs">تحقق</button>
                  </div>
              )}
              {resetStep === 3 && (
                  <div className="space-y-4">
                      <p className="text-xs font-bold text-slate-500">تعيين كلمة مرور جديدة</p>
                      <input type="password" value={resetNewPassword} onChange={e => setResetNewPassword(e.target.value)} placeholder="New Password" className={inputStyle} />
                      <button onClick={handleForgotPassFlow} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs">تغيير كلمة المرور</button>
                  </div>
              )}
              <button onClick={() => { setShowForgotModal(false); setResetStep(1); }} className="text-xs font-bold text-slate-400 hover:text-slate-600">إلغاء</button>
           </div>
        </div>
      )}

      {/* 4. Assign Image Modal */}
      {imageToAssign && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 text-center relative overflow-hidden">
               <div className="w-24 h-24 mx-auto rounded-full p-1 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl relative overflow-hidden mb-2">
                  <img src={imageToAssign} className="w-full h-full rounded-full object-cover border-4 border-white" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[1px]"><span className="text-white text-2xl">👤</span></div>
               </div>
               <div>
                  <h3 className="text-xl font-black text-slate-900">تعيين الصورة لمن؟</h3>
                  <p className="text-sm font-bold text-slate-500 mt-2">اختر العضو الذي تريد تحديث صورته الشخصية:</p>
               </div>
               
               <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar p-1">
                  {/* Current User */}
                  <button onClick={() => confirmAssignment(currentUser.id, 'ADMIN')} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 transition-all">
                     <img src={currentUser.avatar} className="w-10 h-10 rounded-xl object-cover grayscale opacity-70" />
                     <div className="text-right">
                        <p className="font-black text-xs text-indigo-900">أنا (المسؤول)</p>
                        <p className="text-[9px] font-bold text-indigo-400">تحديث صورتي</p>
                     </div>
                  </button>

                  {/* Supervisors */}
                  {supervisors.map(s => (
                     <button key={s.id} onClick={() => confirmAssignment(s.id, 'SUPERVISOR')} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all">
                        <img src={s.avatar} className="w-10 h-10 rounded-xl object-cover grayscale opacity-70" />
                        <div className="text-right">
                           <p className="font-black text-xs text-slate-800">{s.name}</p>
                           <p className="text-[9px] font-bold text-slate-400">مشرف</p>
                        </div>
                     </button>
                  ))}

                  {/* Children */}
                  {children.map(c => (
                     <button key={c.id} onClick={() => confirmAssignment(c.id, 'CHILD')} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all">
                        <img src={c.avatar} className="w-10 h-10 rounded-xl object-cover grayscale opacity-70" />
                        <div className="text-right">
                           <p className="font-black text-xs text-slate-800">{c.name}</p>
                           <p className="text-[9px] font-bold text-slate-400">طفل</p>
                        </div>
                     </button>
                  ))}
               </div>

               <button onClick={() => setImageToAssign(null)} className="w-full py-4 bg-slate-100 text-slate-500 rounded-[1.5rem] font-black text-xs hover:bg-slate-200 active:scale-95 transition-all">إلغاء</button>
           </div>
        </div>
      )}

      {/* ... Existing Popups (Save Prompt, Delete, Edit, Avatar Selector) ... */}
      {showLibrarySavePrompt && (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 text-center relative overflow-hidden">
               <div className="w-full h-40 bg-slate-100 rounded-[2rem] overflow-hidden mb-4 border-4 border-white shadow-inner">
                  {pendingUploadImage && <img src={pendingUploadImage} className="w-full h-full object-cover" />}
               </div>
               <div><h3 className="text-xl font-black text-slate-900 mb-2">إضافة للمكتبة الدائمة؟</h3><p className="text-sm font-bold text-slate-500 leading-relaxed">هل ترغب في حفظ هذه الصورة في المكتبة لاستخدامها مستقبلاً؟</p></div>
               <div className="flex gap-3 pt-4">
                 <button onClick={confirmSaveToLibrary} className="flex-1 bg-indigo-600 text-white py-4 rounded-[1.5rem] font-black text-xs shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">نعم، احفظها</button>
                 <button onClick={skipSaveToLibrary} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-[1.5rem] font-black text-xs hover:bg-slate-200 active:scale-95 transition-all">لا، فقط لهذا العضو</button>
               </div>
           </div>
        </div>
      )}

      {memberToDelete && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 text-center relative overflow-hidden">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2"><span className="text-4xl">⚠️</span></div>
              <div><h3 className="text-2xl font-black text-slate-900 mb-2">هل أنت متأكد؟</h3><p className="text-sm font-bold text-slate-500 leading-relaxed">سيتم حذف حساب <span className="text-red-600">{memberToDelete.name}</span> نهائياً.</p></div>
              <div className="flex gap-3 pt-4">
                 <button onClick={confirmDelete} className="flex-1 bg-red-600 text-white py-4 rounded-[1.5rem] font-black text-sm shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all">نعم، حذف الحساب</button>
                 <button onClick={() => setMemberToDelete(null)} className="flex-1 bg-slate-100 text-slate-500 py-4 rounded-[1.5rem] font-black text-sm hover:bg-slate-200 active:scale-95 transition-all">إلغاء</button>
              </div>
           </div>
        </div>
      )}

      {showAvatarSelector && (
        <div className="fixed inset-0 z-[1600] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 text-center relative border-4 border-white/50">
              <div className="flex justify-between items-center px-2">
                 <h3 className="text-xl font-black text-slate-900">اختر صورة شخصية</h3>
                 <button onClick={() => setShowAvatarSelector(null)} className="text-slate-400 hover:text-slate-600"><ICONS.Close /></button>
              </div>
              <button 
                onClick={handleUploadNewClick}
                className="w-full py-5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-[2rem] font-black shadow-lg hover:shadow-indigo-200 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                 <span className="text-2xl">📤</span>
                 <span>رفع صورة جديدة من الجهاز</span>
              </button>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest my-2">أو اختر من المكتبة</div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 max-h-60 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-[2rem] border border-slate-100">
                 {avatarLibrary.map((img, idx) => (
                    <img key={idx} src={img} onClick={() => handleSelectFromLibrary(img)} className="w-full aspect-square rounded-2xl object-cover border-2 border-white shadow-sm cursor-pointer hover:scale-110 hover:border-indigo-500 hover:shadow-md transition-all" />
                 ))}
              </div>
           </div>
        </div>
      )}

      {showEditMemberModal && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
           <div className={`bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95 text-${lang === 'ar' ? 'right' : 'left'} relative overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar`}>
              <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
              <div className="text-center"><h3 className="text-3xl font-black tracking-tighter text-slate-900">تعديل العضو</h3><p className="text-slate-400 font-bold text-sm mt-2">تحديث البيانات والصلاحيات</p></div>
              <div className="flex justify-center -mb-2">
                <div className="relative group cursor-pointer" onClick={() => setShowAvatarSelector({ id: showEditMemberModal.id, type: showEditMemberModal.type as any })}>
                   <div className="w-28 h-28 rounded-full p-1 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl relative overflow-hidden">
                      <img src={showEditMemberModal.avatar} className="w-full h-full rounded-full object-cover border-4 border-white" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]"><span className="text-white font-black text-xs">تغيير</span></div>
                   </div>
                </div>
              </div>
              <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase px-4">الاسم</label><input value={editMemberName} onChange={e => setEditMemberName(e.target.value)} className={inputStyle} /></div>
              <div className="flex gap-4 pt-4">
                 <button onClick={() => { onUpdateMember(showEditMemberModal.id, showEditMemberModal.type, { name: editMemberName, role: editMemberRole }); setShowEditMemberModal(null); showSuccessToast('تم حفظ التغييرات بنجاح'); }} className="flex-[2] bg-gradient-to-r from-indigo-600 to-indigo-500 text-white py-5 rounded-[1.8rem] font-black text-lg shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 transition-all active:scale-95">حفظ التغييرات</button>
                 <button onClick={() => setShowEditMemberModal(null)} className="flex-1 bg-slate-100 text-slate-500 py-5 rounded-[1.8rem] font-black text-lg hover:bg-slate-200 transition-colors active:scale-95">إلغاء</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const ToggleRow: React.FC<{ label: string, active: boolean, onToggle: () => void, lang: string }> = ({ label, active, onToggle, lang }) => (
  <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-white cursor-pointer group hover:bg-white transition-all shadow-sm hover:shadow-md" onClick={onToggle}>
     <span className="font-black text-slate-700 text-sm">{label}</span>
     <div className={`w-14 h-8 rounded-full transition-all duration-300 flex items-center px-1 shadow-inner ${active ? 'bg-emerald-500' : 'bg-slate-200'}`}>
       <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${active ? (lang === 'ar' ? '-translate-x-6' : 'translate-x-6') : ''}`}></div>
     </div>
  </div>
);

export default SettingsView;
