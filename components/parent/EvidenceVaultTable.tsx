import React from 'react';
import { MonitoringAlert } from '../../types';

interface EvidenceVaultTableProps {
  lang: 'ar' | 'en';
  items: MonitoringAlert[];
}

const EvidenceVaultTable: React.FC<EvidenceVaultTableProps> = ({ lang, items }) => (
  <div className="rounded-[2rem] bg-white border border-slate-100 p-5 shadow-sm space-y-3" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <h4 className="text-lg font-black text-slate-900">
      {lang === 'ar' ? 'جدول خزنة الأدلة' : 'Evidence Vault Table'}
    </h4>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 text-[11px]">
            <th className="text-right py-2">{lang === 'ar' ? 'المعرف' : 'ID'}</th>
            <th className="text-right py-2">{lang === 'ar' ? 'الطفل' : 'Child'}</th>
            <th className="text-right py-2">{lang === 'ar' ? 'المنصة' : 'Platform'}</th>
            <th className="text-right py-2">{lang === 'ar' ? 'الشدة' : 'Severity'}</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 12).map((item) => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="py-2 font-mono text-[11px] text-slate-600">{item.id.slice(0, 8)}</td>
              <td className="py-2 font-black text-slate-800">{item.childName}</td>
              <td className="py-2 font-bold text-slate-600">{item.platform}</td>
              <td className="py-2 font-black text-slate-700">{item.severity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default EvidenceVaultTable;
