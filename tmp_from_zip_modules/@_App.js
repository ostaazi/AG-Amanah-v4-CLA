import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { AlertSeverity } from '@/types';
import DashboardView from '@/components/DashboardView';
import SimulatorView from '@/components/SimulatorView';
import SettingsView from '@/components/SettingsView';
import LiveMonitorView from '@/components/LiveMonitorView';
import SovereignEvidenceCenter from '@/components/EvidenceVaultView';
import PsychologicalInsightView from '@/components/PsychologicalInsightView';
import MapView from '@/components/MapView';
import SafetyProtocolStudio from '@/components/SafetyProtocolStudio';
import IncidentsCenterView from '@/components/IncidentsCenterView';
import FamilyIncidentResponseView from '@/components/FamilyIncidentResponseView';
import SystemSecurityReportView from '@/components/SystemSecurityReportView';
import SystemStatusBar from '@/components/SystemStatusBar';
import AuthView from '@/components/AuthView';
import { ICONS, AmanahLogo, AdminShieldBadge, AmanahGlobalDefs } from '@/constants';
import { subscribeToAuthChanges } from '@/services/authService';
import { syncParentProfile, updateMemberInDB, subscribeToChildren, subscribeToAlerts } from '@/services/firestoreService';
import { canPerform } from '@/services/rbacService';
import { MY_DESIGNED_ASSETS, FALLBACK_ASSETS } from '@/assets';
import { getStore } from '@/lib/sovereignStore';
const App = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState({
        id: 'guest', name: 'الوالد', role: 'FAMILY_OWNER', avatar: MY_DESIGNED_ASSETS.ADMIN_AVATAR || FALLBACK_ASSETS.ADMIN
    });
    const [children, setChildren] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // محاكاة قائمة الحوادث للعرض
    const mockIncidents = useMemo(() => [
        {
            incident_id: 'inc-101',
            child_id: 'c1',
            childName: 'أحمد',
            device_id: 'dev-x9',
            incident_type: 'تواصل مشبوه',
            severity: 'critical',
            status: 'CONTAINED',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            updated_at: new Date().toISOString()
        }
    ], []);
    const navigationItems = useMemo(() => {
        const items = [
            { path: '/', label: 'الرئيسية', icon: _jsx(ICONS.Dashboard, {}), permission: 'family.read' },
            { path: '/incidents', label: 'مركز الحوادث', icon: _jsx(ICONS.Shield, {}), permission: 'alert.read' },
            { path: '/live-safety', label: 'الرصد الحي', icon: _jsx(ICONS.LiveCamera, {}), permission: 'realtime.screenshot.request' },
            { path: '/evidence', label: 'خزنة الأدلة', icon: _jsx(ICONS.Vault, {}), permission: 'evidence.read' },
            { path: '/studio', label: 'استوديو الدفاع', icon: _jsx(ICONS.Rocket, {}), permission: 'playbook.read' },
            { path: '/location', label: 'تتبع الموقع', icon: _jsx(ICONS.Location, {}), permission: 'device.location.view_live' },
            { path: '/pulse', label: 'النبض النفسي', icon: _jsx(ICONS.Pulse, {}), permission: 'child.view_reports' },
            { path: '/settings', label: 'الإعدادات', icon: _jsx(ICONS.Settings, {}), permission: 'family.update' },
        ];
        return items.filter(item => canPerform(currentUser.role, item.permission));
    }, [currentUser.role]);
    useEffect(() => {
        const unsubscribe = subscribeToAuthChanges(async (user) => {
            if (user) {
                const { profile } = await syncParentProfile(user.uid, user.email, currentUser);
                setCurrentUser(profile);
                setIsAuthenticated(true);
            }
            else {
                setIsAuthenticated(false);
            }
        });
        return () => unsubscribe();
    }, []);
    useEffect(() => {
        if (!isAuthenticated)
            return;
        const unsubChildren = subscribeToChildren(currentUser.id, setChildren);
        const unsubAlerts = subscribeToAlerts(currentUser.id, setAlerts);
        return () => { unsubChildren(); unsubAlerts(); };
    }, [isAuthenticated, currentUser.id]);
    if (!isAuthenticated)
        return _jsx(AuthView, { onLoginSuccess: () => { } });
    return (_jsxs("div", { className: "min-h-screen bg-[#f8fafc] text-slate-900 font-['Cairo']", dir: "rtl", children: [_jsx(AmanahGlobalDefs, {}), _jsx(SystemStatusBar, { hasCriticalAlert: alerts.some(a => a.severity === AlertSeverity.CRITICAL), alertCount: alerts.length }), _jsx(Sidebar, { isOpen: isMenuOpen, onClose: () => setIsMenuOpen(false), items: navigationItems, user: currentUser }), _jsxs("header", { className: "fixed top-7 left-0 right-0 h-20 px-6 flex items-center justify-between z-[150] bg-white/90 backdrop-blur-3xl border-b border-slate-100 shadow-sm", children: [_jsxs("div", { className: "flex items-center gap-4 cursor-pointer", onClick: () => navigate('/settings'), children: [_jsxs("div", { className: "relative", children: [_jsx("img", { src: currentUser.avatar, className: "w-11 h-11 rounded-full border-2 border-white shadow-md object-cover" }), currentUser.role === 'FAMILY_OWNER' && _jsx("div", { className: "absolute -bottom-1 -left-1 w-6 h-6", children: _jsx(AdminShieldBadge, {}) })] }), _jsxs("div", { className: "hidden md:block text-right", children: [_jsx("p", { className: "text-[10px] font-black text-slate-800 leading-none", children: currentUser.name }), _jsx("p", { className: "text-[8px] font-black text-indigo-500 mt-1 uppercase tracking-tighter bg-indigo-50 px-2 py-0.5 rounded-full inline-block", children: currentUser.role.replace('_', ' ') })] })] }), _jsx("div", { className: "w-20 cursor-pointer", onClick: () => navigate('/'), children: _jsx(AmanahLogo, {}) }), _jsx("button", { onClick: () => setIsMenuOpen(true), className: "p-4 bg-slate-950 text-white rounded-2xl shadow-xl active:scale-90", children: _jsx(ICONS.Menu, { className: "w-6 h-6" }) })] }), _jsx("main", { className: "pt-32 px-4 pb-44 max-w-7xl mx-auto min-h-screen", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(DashboardView, { children: children, alerts: alerts, onTriggerDemo: () => navigate('/simulator'), lang: "ar", parentId: currentUser.id }) }), _jsx(Route, { path: "/incidents", element: _jsx(IncidentsCenterView, { incidents: mockIncidents }) }), _jsx(Route, { path: "/incident/:id", element: _jsx(FamilyIncidentResponseView, { currentUser: currentUser }) }), _jsx(Route, { path: "/live-safety", element: _jsx(LiveMonitorView, { children: children, lang: "ar" }) }), _jsx(Route, { path: "/evidence", element: _jsx(SovereignEvidenceCenter, { records: getStore().evidence, currentUser: currentUser }) }), _jsx(Route, { path: "/studio", element: _jsx(SafetyProtocolStudio, { currentUser: currentUser }) }), _jsx(Route, { path: "/location", element: _jsx(MapView, { children: children }) }), _jsx(Route, { path: "/pulse", element: _jsx(PsychologicalInsightView, { theme: "light", child: children[0], onAcceptPlan: () => { } }) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsView, { currentUser: currentUser, children: children, lang: "ar", onUpdateMember: updateMemberInDB, onDeleteMember: async () => { }, onAddChild: async () => { }, onAddSupervisor: async () => ({}), showSuccessToast: () => { } }) }), _jsx(Route, { path: "/simulator", element: _jsx(SimulatorView, { children: children, parentId: currentUser.id, lang: "ar" }) }), _jsx(Route, { path: "/integrity", element: ['DEVELOPER', 'SRE', 'PLATFORM_ADMIN'].includes(currentUser.role) ? _jsx(SystemSecurityReportView, {}) : _jsx(Navigate, { to: "/" }) })] }) }), _jsx("nav", { className: "fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-3xl border-t border-slate-100 shadow-xl z-[1000] pb-8 pt-3", children: _jsx("div", { className: "flex overflow-x-auto no-scrollbar gap-1 px-4 items-center justify-start sm:justify-center min-w-full", children: navigationItems.slice(0, 6).map((item) => (_jsxs(Link, { to: item.path, className: `flex-shrink-0 flex flex-col items-center justify-center gap-1 p-2 min-w-[72px] transition-all ${location.pathname === item.path ? 'text-[#8A1538] scale-105' : 'text-slate-400 opacity-60'}`, children: [_jsx("div", { className: "w-6 h-6", children: item.icon }), _jsx("span", { className: "text-[8px] font-black uppercase tracking-tighter text-center whitespace-nowrap", children: item.label })] }, item.path))) }) })] }));
};
const Sidebar = ({ isOpen, onClose, items, user }) => {
    const navigate = useNavigate();
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: `fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[1200] transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, onClick: onClose }), _jsxs("div", { className: `fixed top-0 bottom-0 right-0 w-72 bg-white z-[1210] shadow-2xl transition-transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col p-8`, dir: "rtl", children: [_jsxs("div", { className: "flex justify-between items-center mb-8", children: [_jsx("button", { onClick: onClose, className: "p-2 text-slate-400 hover:text-red-500", children: _jsx(ICONS.Close, {}) }), _jsx("div", { className: "w-20", children: _jsx(AmanahLogo, {}) })] }), _jsx("div", { className: "flex-1 space-y-1 overflow-y-auto no-scrollbar", children: items.map((item) => (_jsxs("button", { onClick: () => { navigate(item.path); onClose(); }, className: "w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 text-slate-600 hover:text-[#8A1538] transition-all text-right font-black group", children: [_jsx("span", { className: "opacity-40 group-hover:opacity-100", children: item.icon }), _jsx("span", { className: "text-xs", children: item.label })] }, item.path))) })] })] }));
};
export default App;
