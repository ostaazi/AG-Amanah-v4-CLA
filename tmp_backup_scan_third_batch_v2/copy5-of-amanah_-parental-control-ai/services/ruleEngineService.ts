
import { Category, AlertSeverity } from '../types';

interface AutoAction {
  command: string;
  payload: any;
  priority: 'high' | 'critical' | 'med';
}

/**
 * محرك الاستجابة السيادي (Sovereign Rule Engine)
 */
export const getDefenseActions = (type: Category, severity: AlertSeverity): AutoAction[] => {
  const actions: AutoAction[] = [];

  // بروتوكول مكافحة الاستدراج (Grooming / Exploitation)
  if (type === Category.PREDATOR || type === Category.SEXUAL_EXPLOITATION) {
    actions.push({ command: 'BLACKOUT', payload: { message: 'Emergency Lockdown Active' }, priority: 'critical' });
    actions.push({ command: 'QUARANTINE_ON', payload: {}, priority: 'critical' });
    actions.push({ command: 'CAMERA_DISABLE', payload: {}, priority: 'high' });
    actions.push({ command: 'LOCKTASK_ON', payload: { packages: ['com.amanah.child'] }, priority: 'critical' });
  }

  // بروتوكول حماية التنمر
  if (type === Category.BULLYING && severity === AlertSeverity.HIGH) {
    actions.push({ command: 'BLOCK_APPS_SET', payload: { packages: ['com.whatsapp', 'com.instagram.android'], hidden: true }, priority: 'high' });
  }

  // بروتوكول إيذاء النفس
  if (type === Category.SELF_HARM) {
    actions.push({ command: 'QUARANTINE_ON', payload: {}, priority: 'high' });
    actions.push({ command: 'NOTIFY_EMERGENCY', payload: { msg: 'High Risk Signal Detected' }, priority: 'critical' });
  }

  return actions;
};
