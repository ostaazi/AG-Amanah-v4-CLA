import React from 'react';
import { MonitoringAlert } from '../../types';
import EvidenceList from './EvidenceList';
import EvidenceVaultTable from './EvidenceVaultTable';

interface ParentEvidenceVaultViewProps {
  lang: 'ar' | 'en';
  records: MonitoringAlert[];
}

const ParentEvidenceVaultView: React.FC<ParentEvidenceVaultViewProps> = ({ lang, records }) => (
  <div className="space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <EvidenceList lang={lang} items={records} />
    <EvidenceVaultTable lang={lang} items={records} />
  </div>
);

export default ParentEvidenceVaultView;
