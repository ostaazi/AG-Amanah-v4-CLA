import React from 'react';

interface ParentSidebarProps {
  lang: 'ar' | 'en';
  items: Array<{ id: string; label: string }>;
  active: string;
  onSelect: (id: string) => void;
}

const ParentSidebar: React.FC<ParentSidebarProps> = ({ lang, items, active, onSelect }) => (
  <div className="rounded-[2rem] bg-white border border-slate-100 p-4 shadow-sm space-y-2" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    {items.map((item) => (
      <button
        key={item.id}
        onClick={() => onSelect(item.id)}
        className={`w-full text-right px-3 py-2 rounded-xl text-sm font-black border ${
          active === item.id
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-slate-50 text-slate-600 border-slate-200'
        }`}
      >
        {item.label}
      </button>
    ))}
  </div>
);

export default ParentSidebar;
