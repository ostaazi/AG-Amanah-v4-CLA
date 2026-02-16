
import React, { useState, useEffect } from 'react';
import { AmanahLogo } from '../constants';
import { loginParent, registerParent, resetPassword } from '../services/authService';
import { authenticateBiometrics } from '../services/biometricService';

interface AuthViewProps {
  onLoginSuccess: (user: any) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT';

const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isBioLoading, setIsBioLoading] = useState(false);
  const [hasStoredBio, setHasStoredBio] = useState(false);

  useEffect(() => {
    const savedBioId = localStorage.getItem('amanah_last_bio_id');
    setHasStoredBio(!!savedBioId);
  }, []);

  const handleBiometricLogin = async () => {
    setIsBioLoading(true);
    setError('');
    try {
      const savedBioId = localStorage.getItem('amanah_last_bio_id');
      if (!savedBioId) throw new Error("البصمة غير مسجلة لهذا الجهاز.");
      const success = await authenticateBiometrics(savedBioId);
      if (success) {
        onLoginSuccess({ uid: 'bio-user', email: 'parent@amanah.ai', name: 'الوالد' });
      } else {
        throw new Error("فشل التحقق من الهوية.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsBioLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'LOGIN') {
        const user = await loginParent(email, password);
        onLoginSuccess(user);
      } else if (mode === 'REGISTER') {
        const user = await registerParent(email, password);
        onLoginSuccess(user);
      } else if (mode === 'FORGOT') {
        await resetPassword(email);
        setSuccessMsg('تم إرسال رابط استعادة كلمة المرور لبريدك.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.15)_0%,transparent_70%)]"></div>
      
      <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[3.5rem] shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center mb-10">
          <div className="w-32 mx-auto mb-6"><AmanahLogo /></div>
          <h2 className="text-3xl font-black text-white leading-tight">
            {mode === 'LOGIN' ? 'مرحباً بعودتك' : mode === 'REGISTER' ? 'حماية جديدة' : 'استعادة الحساب'}
          </h2>
          <p className="text-slate-400 font-bold text-sm">أمان عائلتك يبدأ من هنا</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase px-4 tracking-widest">البريد الإلكتروني</label>
            <input 
              type="email" required placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500 font-bold transition-all"
            />
          </div>

          {mode !== 'FORGOT' && (
            <div className="space-y-2">
              <div className="flex justify-between px-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">كلمة المرور</label>
                {mode === 'LOGIN' && (
                  <button type="button" onClick={() => setMode('FORGOT')} className="text-[10px] font-black text-indigo-400 hover:text-indigo-300">نسيت كلمة السر؟</button>
                )}
              </div>
              <input 
                type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500 font-bold transition-all"
              />
            </div>
          )}

          {error && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-200 text-xs font-bold text-center animate-shake">⚠️ {error}</div>}
          {successMsg && <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs font-bold text-center animate-in zoom-in">✅ {successMsg}</div>}

          <button 
            type="submit" disabled={loading}
            className={`w-full py-5 text-white rounded-[2rem] font-black text-lg shadow-xl transition-all active:scale-95 disabled:opacity-50 ${mode === 'FORGOT' ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {loading ? 'جاري التحميل...' : (mode === 'LOGIN' ? 'تسجيل الدخول' : mode === 'REGISTER' ? 'إنشاء الحساب' : 'إرسال الرابط')}
          </button>
        </form>

        {mode === 'LOGIN' && hasStoredBio && (
          <div className="mt-8 pt-8 border-t border-white/10">
            <button 
              onClick={handleBiometricLogin}
              disabled={isBioLoading}
              className="w-full py-5 bg-white/10 hover:bg-white/20 text-white rounded-[2rem] font-black flex items-center justify-center gap-4 transition-all"
            >
              <span className="text-2xl">{isBioLoading ? '⏳' : '☝️'}</span>
              <span>{isBioLoading ? 'جاري التحقق...' : 'دخول سريع بالبصمة'}</span>
            </button>
          </div>
        )}
        
        <div className="mt-8 text-center">
             <button 
               onClick={() => {
                 setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                 setError('');
                 setSuccessMsg('');
               }}
               className="text-slate-400 font-bold text-xs hover:text-white transition-colors"
             >
               {mode === 'LOGIN' ? 'ليس لديك حساب؟ انضم إلينا' : 'لديك حساب بالفعل؟ سجل دخولك'}
             </button>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
