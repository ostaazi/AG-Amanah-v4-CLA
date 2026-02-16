
import React, { useState, useRef, useEffect } from 'react';
import { createAdvisorChat } from '../services/geminiService';
import { ICONS } from '../constants';

const ParentalAdvisor: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const trendingTopics = lang === 'ar' 
    ? ['كيف أحمي طفلي من التنمر؟', 'أفضل وقت للشاشة لعمر 10 سنوات', 'علامات الاكتئاب الرقمي']
    : ['How to protect from bullying?', 'Best screen time for 10yo', 'Signs of digital depression'];

  useEffect(() => {
    chatRef.current = createAdvisorChat(lang);
    const welcome = lang === 'ar' 
      ? 'أهلاً بك في مركز النصائح الذكي. أنا هنا لتحليل سلوك طفلك الرقمي وتقديم حلول تربوية مبنية على العلم. ما الذي يشغل بالك اليوم؟'
      : 'Welcome to the Smart Insights Center. I am here to analyze your child’s digital behavior and provide science-based parenting solutions. What is on your mind today?';
    setMessages([{ role: 'model', text: welcome }]);
  }, [lang]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageToSend = text || input;
    if (!messageToSend.trim() || loading) return;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: messageToSend }]);
    setLoading(true);

    try {
      const result = await chatRef.current.sendMessage({ message: messageToSend });
      setMessages(prev => [...prev, { role: 'model', text: result.text }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: lang === 'ar' ? 'عذراً، حدث خطأ في الاتصال بالسيرفر الذكي.' : 'Sorry, a connection error occurred with the AI server.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-white rounded-[3.5rem] border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in duration-700">
      <div className="bg-slate-950 p-8 text-white flex items-center justify-between">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-3xl shadow-xl shadow-indigo-900/40">🧠</div>
           <div>
              <h3 className="text-2xl font-black tracking-tighter">{lang === 'ar' ? 'المستشار التربوي الذكي' : 'Smart Parental Advisor'}</h3>
              <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">Amanah AI Engine v3.0</p>
           </div>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl">
           <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
           <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Proactive Analysis ON</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
            <div className={`max-w-[85%] p-6 rounded-[2.5rem] text-base font-bold shadow-sm leading-relaxed ${
              m.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-200' 
                : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white p-6 rounded-[2rem] rounded-tl-none flex gap-2 border border-slate-100 shadow-sm">
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-.3s]"></div>
              <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-.5s]"></div>
            </div>
          </div>
        )}

        {messages.length === 1 && (
          <div className="pt-4 flex flex-wrap gap-3 animate-in fade-in duration-1000">
             {trendingTopics.map(topic => (
               <button key={topic} onClick={() => handleSend(topic)} className="bg-white border border-slate-200 hover:border-indigo-400 px-6 py-3 rounded-2xl text-[11px] font-black text-slate-600 transition-all shadow-sm">
                 {topic}
               </button>
             ))}
          </div>
        )}
      </div>

      <div className="p-8 bg-white border-t border-slate-100 flex gap-4 items-center">
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          placeholder={lang === 'ar' ? 'اكتب تساؤلك هنا...' : 'Type your question here...'}
          className="flex-1 p-6 bg-slate-50 border border-slate-200 rounded-[2rem] font-black outline-none focus:border-indigo-600 focus:bg-white transition-all shadow-inner"
        />
        <button 
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="w-16 h-16 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl shadow-indigo-200 active:scale-90 transition-all disabled:opacity-50 flex items-center justify-center"
        >
          <ICONS.Chat />
        </button>
      </div>
    </div>
  );
};

export default ParentalAdvisor;
