import React from 'react';
import { ParentAccount } from '../../types';
import SafetyPlaybookHub from '../SafetyPlaybookHub';

interface ParentSafetyPlaybookHubProps {
  lang: 'ar' | 'en';
  currentUser: ParentAccount;
}

const ParentSafetyPlaybookHub: React.FC<ParentSafetyPlaybookHubProps> = ({ lang, currentUser }) => (
  <SafetyPlaybookHub lang={lang} currentUser={currentUser} />
);

export default ParentSafetyPlaybookHub;
