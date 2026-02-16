
'use client';

import React from 'react';
import ParentSidebar from '../../components/parent/ParentSidebar';

/* Fix: Made children optional to resolve Property 'children' is missing error in App.tsx */
export default function ParentLayout({ 
  children,
  familyId = 'current-family'
}: { 
  children?: React.ReactNode;
  familyId?: string;
}) {
  return (
    <div className="flex gap-8 max-w-7xl mx-auto px-4" dir="rtl">
      {/* Sidebar - Visible on XL screens as per ParentSidebar design */}
      <ParentSidebar familyId={familyId} />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <div className="animate-in fade-in slide-in-from-left-4 duration-700">
          {children}
        </div>
      </div>
    </div>
  );
}
