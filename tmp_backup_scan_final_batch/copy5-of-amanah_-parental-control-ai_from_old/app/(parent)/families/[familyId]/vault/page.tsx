'use client';

import React from 'react';
import { useParams } from 'react-router-dom';
import EvidenceVaultTable from '../../../../../components/parent/EvidenceVaultTable';

export default function EvidenceVaultPage() {
  const { familyId } = useParams<{ familyId: string }>();
  return <EvidenceVaultTable familyId={familyId || 'current-family'} />;
}
