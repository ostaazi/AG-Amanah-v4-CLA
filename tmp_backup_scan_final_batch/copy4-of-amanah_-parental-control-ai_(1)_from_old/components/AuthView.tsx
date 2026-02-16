
import React, { useState, useEffect } from 'react';
import { AmanahLogo, AmanahGlobalDefs } from '../constants';
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
        setSuccessMsg('تم إرسال رابط استعادة كلمة المرور لبريدك. يرجى مراجعة صندوق الوارد.');
        setTimeout(() => setMode('LOGIN'), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative overflow-hidden" dir="rtl">
      <AmanahGlobalDefs />
      
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(138,21,56,0.15)_0%,transparent_50%)]"></div>
      <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,rgba(79,70,229,0.1)_0%,transparent_50%)]"></div>
      
      <div className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 p-10 rounded-[4rem] shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-10 space-y-4">
          <div className="w-40 mx-auto transform hover:scale-105 transition-transform duration-500">
            <AmanahLogo />
          </div>
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white tracking-tighter">
              {mode === 'LOGIN' ? 'تسجيل الدخول' : mode === 'REGISTER' ? 'حساب جديد' : 'استعادة الحساب'}
            </h2>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Digital Family Shield</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase px-4 tracking-widest">البريد الإلكتروني</label>
            <input 
              type="email" required placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full p-5 bg-white/10 border border-white/10 rounded-2xl text-white outline-none focus:border-[#8A1538] font-bold transition-all focus:ring-4 focus:ring-[#8A1538]/10"
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
                className="w-full p-5 bg-white/10 border border-white/10 rounded-2xl text-white outline-none focus:border-[#8A1538] font-bold transition-all focus:ring-4 focus:ring-[#8A1538]/10"
              />
            </div>
          )}

          {error && <div className="p-5 bg-red-500/20 border border-red-500/40 rounded-2xl text-red-200 text-xs font-black text-center animate-shake leading-relaxed">⚠️ {error}</div>}
          {successMsg && <div className="p-5 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-emerald-200 text-xs font-black text-center animate-in zoom-in leading-relaxed">✅ {successMsg}</div>}

          <button 
            type="submit" disabled={loading}
            className={`w-full py-6 text-white rounded-[2rem] font-black text-lg shadow-xl transition-all active:scale-95 disabled:opacity-50 ${mode === 'FORGOT' ? 'bg-emerald-600' : 'bg-[#8A1538] hover:bg-[#a01c44] shadow-[#8A1538]/20'}`}
          >
            {loading ? 'جاري التحقق...' : (mode === 'LOGIN' ? 'دخول النظام' : mode === 'REGISTER' ? 'إنشاء حساب أمان' : 'إرسال رابط الاستعادة')}
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
              <span className="text-sm">دخول سريع بالبصمة</span>
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
               className="text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-colors"
             >
               {mode === 'LOGIN' ? 'ليس لديك حساب؟ انضم لعائلة أمانة' : 'لديك حساب بالفعل؟ سجل دخولك'}
             </button>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
