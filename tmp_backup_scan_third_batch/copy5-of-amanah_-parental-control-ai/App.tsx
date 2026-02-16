
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AmanahGlobalDefs } from './constants';
import ParentLayout from './app/(parent)/layout';
import DashboardView from './components/DashboardView';
import AlertsView from './components/AlertsView';
import DevicesView from './components/DevicesView';
import LiveMonitorView from './components/LiveMonitorView';
import MapView from './components/MapView';
import ModesView from './components/ModesView';
import PsychologicalInsightView from './components/PsychologicalInsightView';
import SettingsView from './components/SettingsView';
import EvidenceVaultView from './components/parent/EvidenceVaultView';
import SystemSecurityReportView from './components/SystemSecurityReportView';
import SimulatorView from './components/SimulatorView';
import IncidentsCenterView from './components/IncidentsCenterView';
import ChainOfCustodyView from './components/ChainOfCustodyView';
import DefensePolicyView from './components/parent/DefensePolicyView';
import GeoFenceManager from './components/parent/GeoFenceManager';
import NotificationCenterView from './components/parent/NotificationCenterView';
import IncidentWarRoom from './components/IncidentWarRoom';

const currentFamilyId = '000-default-family';

const App: React.FC = () => {
  const [children] = React.useState<any[]>([
    {
      id: 'c1',
      name: 'أحمد',
      avatar: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png',
      status: 'online',
      batteryLevel: 85,
      signalStrength: 4,
      appUsage: [],
      parentId: 'p1',
      deviceNickname: 'iPhone 15 Pro',
      riskScore: { childScore: 12, trend: 'stable' },
      psychProfile: { anxietyLevel: 15, moodScore: 92, dominantEmotion: 'سعيدة', isolationRisk: 5, recentKeywords: [], recommendation: "حافظ على وتيرة التواصل الحالية." }
    }
  ]);
  const [currentUser] = React.useState<any>({ id: 'parent-1', role: 'FAMILY_OWNER', name: 'الوالد', avatar: 'https://i.pravatar.cc/150?u=father' });
  const [lang] = React.useState<'ar' | 'en'>('ar');
  const [theme] = React.useState<'light' | 'dark'>('light');

  return (
    <>
      <AmanahGlobalDefs />
      <Routes>
        <Route path="/" element={
          <ParentLayout familyId={currentFamilyId}>
            <DashboardView childList={children} alerts={[]} onTriggerDemo={() => {}} lang={lang} parentId={currentUser.id} />
          </ParentLayout>
        } />
        
        <Route path="/families/:familyId/incidents" element={
          <ParentLayout familyId={currentFamilyId}>
            <IncidentsCenterView incidents={[]} />
          </ParentLayout>
        } />

        <Route path="/families/:familyId/incidents/:id" element={
          <ParentLayout familyId={currentFamilyId}>
            <IncidentWarRoom incidentId="INC-99123-X" />
          </ParentLayout>
        } />

        <Route path="/families/:familyId/vault" element={
          <ParentLayout familyId={currentFamilyId}>
            <EvidenceVaultView familyId={currentFamilyId} />
          </ParentLayout>
        } />

        <Route path="/families/:familyId/notifications" element={
          <ParentLayout familyId={currentFamilyId}>
            <NotificationCenterView familyId={currentFamilyId} />
          </ParentLayout>
        } />

        <Route path="/families/:familyId/geofence" element={
          <ParentLayout familyId={currentFamilyId}>
            <GeoFenceManager familyId={currentFamilyId} />
          </ParentLayout>
        } />

        <Route path="/families/:familyId/policy" element={
          <ParentLayout familyId={currentFamilyId}>
            <DefensePolicyView familyId={currentFamilyId} />
          </ParentLayout>
        } />

        <Route path="/alerts" element={
          <ParentLayout familyId={currentFamilyId}>
            <AlertsView alerts={[]} theme={theme} lang={lang} />
          </ParentLayout>
        } />

        <Route path="/pulse" element={
          <ParentLayout familyId={currentFamilyId}>
            <PsychologicalInsightView theme={theme} child={children?.[0]} onAcceptPlan={() => {}} />
          </ParentLayout>
        } />

        <Route path="/live" element={
          <ParentLayout familyId={currentFamilyId}>
            <LiveMonitorView childList={children} lang={lang} />
          </ParentLayout>
        } />

        <Route path="/location" element={
          <ParentLayout familyId={currentFamilyId}>
            <MapView childList={children} />
          </ParentLayout>
        } />

        <Route path="/devices" element={
          <ParentLayout familyId={currentFamilyId}>
            <DevicesView childList={children} onToggleAppBlock={() => {}} onUpdateDevice={() => {}} lang={lang} />
          </ParentLayout>
        } />

        <Route path="/modes" element={
          <ParentLayout familyId={currentFamilyId}>
            <ModesView modes={[]} childList={children} onUpdateModes={() => {}} onApplyMode={() => {}} />
          </ParentLayout>
        } />

        <Route path="/simulator" element={
          <ParentLayout familyId={currentFamilyId}>
            <SimulatorView childList={children} parentId={currentUser.id} lang={lang} />
          </ParentLayout>
        } />

        <Route path="/settings" element={
          <ParentLayout familyId={currentFamilyId}>
            <SettingsView currentUser={currentUser} childList={children} lang={lang} onUpdateMember={async () => {}} onDeleteMember={async () => {}} onAddChild={async () => {}} onAddSupervisor={async () => ({} as any)} showSuccessToast={() => {}} />
          </ParentLayout>
        } />

        <Route path="/integrity" element={
          <ParentLayout familyId={currentFamilyId}>
            <SystemSecurityReportView />
          </ParentLayout>
        } />

        <Route path="/incident/:id/custody" element={
          <ParentLayout familyId={currentFamilyId}>
            <ChainOfCustodyView />
          </ParentLayout>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
