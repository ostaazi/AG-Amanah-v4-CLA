
import React, { useState } from 'react';
import { AmanahLogo } from '../constants';
import { loginParent, registerParent, resetPassword } from '../services/authService';

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
        setSuccessMsg('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.');
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden" dir="rtl">
      {/* Background Effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] -translate-y-20 translate-x-20"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-[100px] translate-y-20 -translate-x-20"></div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-10 rounded-[3rem] shadow-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-10">
          {/* تم تكبير اللوجو هنا من w-24 إلى w-64 */}
          <div className="w-64 mx-auto mb-8">
             <AmanahLogo className="w-full h-auto drop-shadow-2xl filter brightness-110" />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight mb-2">
            {mode === 'LOGIN' ? 'مرحباً بعودتك' : mode === 'REGISTER' ? 'حماية جديدة' : 'استعادة الحساب'}
          </h2>
          <p className="text-slate-400 font-bold text-sm">
            {mode === 'LOGIN' ? 'سجل دخولك لمتابعة لوحة التحكم' : mode === 'REGISTER' ? 'أنشئ حساباً لبدء حماية عائلتك' : 'أدخل بريدك لاستلام رابط التعيين'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">البريد الإلكتروني</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-5 bg-slate-950/50 border border-slate-700 rounded-[1.5rem] text-white placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-bold"
              placeholder="name@example.com"
            />
          </div>

          {mode !== 'FORGOT' && (
            <div className="space-y-2">
              <div className="flex justify-between px-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">كلمة المرور</label>
                {mode === 'LOGIN' && (
                  <button 
                    type="button"
                    onClick={() => switchMode('FORGOT')}
                    className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-5 bg-slate-950/50 border border-slate-700 rounded-[1.5rem] text-white placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-bold"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-200 text-xs font-bold text-center animate-in fade-in slide-in-from-top-2">
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-2xl text-emerald-200 text-xs font-bold text-center animate-in fade-in slide-in-from-top-2">
              ✅ {successMsg}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-5 text-white rounded-[2rem] font-black text-lg shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${
                mode === 'FORGOT' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50'
            }`}
          >
            {loading && <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
            {mode === 'LOGIN' ? 'تسجيل الدخول' : mode === 'REGISTER' ? 'إنشاء الحساب' : 'إرسال الرابط'}
          </button>
        </form>

        <div className="mt-8 text-center space-y-3">
          {mode === 'FORGOT' ? (
             <button 
               onClick={() => switchMode('LOGIN')}
               className="text-slate-400 font-bold text-xs hover:text-white transition-colors"
             >
               العودة لتسجيل الدخول
             </button>
          ) : (
             <button 
               onClick={() => switchMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN')}
               className="text-slate-400 font-bold text-xs hover:text-white transition-colors"
             >
               {mode === 'LOGIN' ? 'ليس لديك حساب؟ انضم إلينا' : 'لديك حساب بالفعل؟ سجل دخولك'}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthView;
