/**
 * Amanah Privacy & Compliance Service
 * ====================================
 * Tracks COPPA / GDPR-K compliance status, data collection inventory,
 * consent management, and data subject rights (access, erasure).
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    query,
    where,
    Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type ComplianceFramework = 'COPPA' | 'GDPR_K' | 'LOCAL_POLICY';

export type ComplianceStatus = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'NOT_ASSESSED';

export interface ComplianceCheck {
    id: string;
    framework: ComplianceFramework;
    requirement: string;
    requirementAr: string;
    status: ComplianceStatus;
    description: string;
    descriptionAr: string;
    lastAssessedAt: Date | null;
    evidence?: string;
}

export interface DataCollectionItem {
    id: string;
    dataType: string;
    dataTypeAr: string;
    purpose: string;
    purposeAr: string;
    source: 'CHILD_DEVICE' | 'PARENT_INPUT' | 'SYSTEM_GENERATED' | 'AI_ANALYSIS';
    retentionDays: number;
    encrypted: boolean;
    sharedWith: string[];
    legalBasis: string;
}

export interface ConsentRecord {
    id: string;
    parentId: string;
    consentType: string;
    granted: boolean;
    grantedAt: Date;
    revokedAt?: Date;
    childIds: string[];
    description: string;
}

export interface ComplianceSummary {
    overallScore: number;
    frameworks: {
        framework: ComplianceFramework;
        score: number;
        totalChecks: number;
        compliant: number;
        partial: number;
        nonCompliant: number;
    }[];
    dataCollectionCount: number;
    activeConsents: number;
    lastFullAssessment: Date | null;
}

// ─── Compliance Checklist (static baseline) ─────────────────────────────────

const COMPLIANCE_CHECKS: ComplianceCheck[] = [
    // ── COPPA ─────────────────────────────────────────────────────────────────
    {
        id: 'COPPA-001',
        framework: 'COPPA',
        requirement: 'Parental Consent Required',
        requirementAr: 'موافقة الوالدين مطلوبة',
        status: 'COMPLIANT',
        description: 'App requires parent account setup before child monitoring begins.',
        descriptionAr: 'التطبيق يتطلب إعداد حساب الوالد قبل بدء مراقبة الطفل.',
        lastAssessedAt: null,
    },
    {
        id: 'COPPA-002',
        framework: 'COPPA',
        requirement: 'Data Collection Disclosure',
        requirementAr: 'إفصاح عن جمع البيانات',
        status: 'PARTIAL',
        description: 'Data collected is documented but no public privacy notice page exists.',
        descriptionAr: 'البيانات المجمّعة موثّقة لكن لا يوجد صفحة إشعار خصوصية عامة.',
        lastAssessedAt: null,
    },
    {
        id: 'COPPA-003',
        framework: 'COPPA',
        requirement: 'Right to Review Child Data',
        requirementAr: 'حق مراجعة بيانات الطفل',
        status: 'PARTIAL',
        description: 'Parent can view data in console but no formal export/review flow.',
        descriptionAr: 'يمكن للوالد عرض البيانات لكن لا يوجد تدفق تصدير/مراجعة رسمي.',
        lastAssessedAt: null,
    },
    {
        id: 'COPPA-004',
        framework: 'COPPA',
        requirement: 'Right to Delete Child Data',
        requirementAr: 'حق حذف بيانات الطفل',
        status: 'NON_COMPLIANT',
        description: 'No dedicated child data deletion flow implemented.',
        descriptionAr: 'لا يوجد تدفق مخصص لحذف بيانات الطفل.',
        lastAssessedAt: null,
    },
    {
        id: 'COPPA-005',
        framework: 'COPPA',
        requirement: 'Data Minimization',
        requirementAr: 'تقليل جمع البيانات',
        status: 'COMPLIANT',
        description: 'Only safety-relevant data is collected from child devices.',
        descriptionAr: 'يتم جمع البيانات المتعلقة بالسلامة فقط من أجهزة الأطفال.',
        lastAssessedAt: null,
    },

    // ── GDPR-K ────────────────────────────────────────────────────────────────
    {
        id: 'GDPR-001',
        framework: 'GDPR_K',
        requirement: 'Right of Access (Art. 15)',
        requirementAr: 'حق الوصول (مادة 15)',
        status: 'PARTIAL',
        description: 'Data visible in console but no structured export (JSON/PDF).',
        descriptionAr: 'البيانات مرئية في لوحة التحكم لكن لا يوجد تصدير منظم.',
        lastAssessedAt: null,
    },
    {
        id: 'GDPR-002',
        framework: 'GDPR_K',
        requirement: 'Right to Erasure (Art. 17)',
        requirementAr: 'حق الحذف (مادة 17)',
        status: 'NON_COMPLIANT',
        description: 'No automated data erasure flow for child data.',
        descriptionAr: 'لا يوجد تدفق حذف تلقائي لبيانات الطفل.',
        lastAssessedAt: null,
    },
    {
        id: 'GDPR-003',
        framework: 'GDPR_K',
        requirement: 'Data Processing Records (Art. 30)',
        requirementAr: 'سجلات معالجة البيانات (مادة 30)',
        status: 'NON_COMPLIANT',
        description: 'No formal record of data processing activities.',
        descriptionAr: 'لا يوجد سجل رسمي لأنشطة معالجة البيانات.',
        lastAssessedAt: null,
    },
    {
        id: 'GDPR-004',
        framework: 'GDPR_K',
        requirement: 'Data Encryption at Rest',
        requirementAr: 'تشفير البيانات أثناء التخزين',
        status: 'COMPLIANT',
        description: 'AES-GCM encryption with PBKDF2 key derivation implemented.',
        descriptionAr: 'تم تطبيق تشفير AES-GCM مع اشتقاق مفتاح PBKDF2.',
        lastAssessedAt: null,
    },
    {
        id: 'GDPR-005',
        framework: 'GDPR_K',
        requirement: 'Breach Notification Readiness',
        requirementAr: 'جاهزية إشعار الاختراق',
        status: 'NON_COMPLIANT',
        description: 'No breach notification process or template exists.',
        descriptionAr: 'لا يوجد عملية أو نموذج لإشعار الاختراق.',
        lastAssessedAt: null,
    },

    // ── LOCAL POLICY ──────────────────────────────────────────────────────────
    {
        id: 'LOCAL-001',
        framework: 'LOCAL_POLICY',
        requirement: 'Evidence Chain of Custody',
        requirementAr: 'سلسلة حيازة الأدلة',
        status: 'PARTIAL',
        description: 'Forensics module exists but not all evidence events are chained.',
        descriptionAr: 'وحدة الطب الشرعي موجودة لكن ليست كل أحداث الأدلة مسلسلة.',
        lastAssessedAt: null,
    },
    {
        id: 'LOCAL-002',
        framework: 'LOCAL_POLICY',
        requirement: 'Audit Trail for Parent Actions',
        requirementAr: 'سجل تدقيق لإجراءات الوالد',
        status: 'PARTIAL',
        description: 'Activity logging exists but lacks before/after state capture.',
        descriptionAr: 'تسجيل الأنشطة موجود لكن يفتقر لالتقاط الحالة قبل/بعد.',
        lastAssessedAt: null,
    },
];

// ─── Data Collection Inventory ──────────────────────────────────────────────

const DATA_COLLECTION_INVENTORY: DataCollectionItem[] = [
    {
        id: 'DC-001',
        dataType: 'Screen Text Content',
        dataTypeAr: 'محتوى نص الشاشة',
        purpose: 'Threat detection and safety monitoring',
        purposeAr: 'كشف التهديدات ومراقبة السلامة',
        source: 'CHILD_DEVICE',
        retentionDays: 30,
        encrypted: true,
        sharedWith: ['Gemini AI (analysis only)'],
        legalBasis: 'Parental consent for child safety',
    },
    {
        id: 'DC-002',
        dataType: 'Screenshots',
        dataTypeAr: 'لقطات الشاشة',
        purpose: 'Evidence collection for safety alerts',
        purposeAr: 'جمع الأدلة لتنبيهات السلامة',
        source: 'CHILD_DEVICE',
        retentionDays: 90,
        encrypted: true,
        sharedWith: [],
        legalBasis: 'Parental consent for child safety',
    },
    {
        id: 'DC-003',
        dataType: 'Device Location',
        dataTypeAr: 'موقع الجهاز',
        purpose: 'Location safety and geofencing',
        purposeAr: 'سلامة الموقع والسياج الجغرافي',
        source: 'CHILD_DEVICE',
        retentionDays: 7,
        encrypted: false,
        sharedWith: [],
        legalBasis: 'Parental consent for child safety',
    },
    {
        id: 'DC-004',
        dataType: 'App Usage Data',
        dataTypeAr: 'بيانات استخدام التطبيقات',
        purpose: 'Digital wellbeing monitoring',
        purposeAr: 'مراقبة الرفاهية الرقمية',
        source: 'CHILD_DEVICE',
        retentionDays: 30,
        encrypted: false,
        sharedWith: [],
        legalBasis: 'Parental consent for child safety',
    },
    {
        id: 'DC-005',
        dataType: 'Monitoring Alerts',
        dataTypeAr: 'تنبيهات المراقبة',
        purpose: 'Safety incident records',
        purposeAr: 'سجلات حوادث السلامة',
        source: 'SYSTEM_GENERATED',
        retentionDays: 365,
        encrypted: true,
        sharedWith: [],
        legalBasis: 'Legitimate interest in child protection',
    },
    {
        id: 'DC-006',
        dataType: 'AI Analysis Results',
        dataTypeAr: 'نتائج تحليل الذكاء الاصطناعي',
        purpose: 'Content classification and risk scoring',
        purposeAr: 'تصنيف المحتوى وتقييم المخاطر',
        source: 'AI_ANALYSIS',
        retentionDays: 30,
        encrypted: true,
        sharedWith: ['Google Gemini (processing)'],
        legalBasis: 'Parental consent for child safety',
    },
    {
        id: 'DC-007',
        dataType: 'Device Health Metrics',
        dataTypeAr: 'مقاييس صحة الجهاز',
        purpose: 'Device status monitoring',
        purposeAr: 'مراقبة حالة الجهاز',
        source: 'CHILD_DEVICE',
        retentionDays: 7,
        encrypted: false,
        sharedWith: [],
        legalBasis: 'Parental consent for device management',
    },
];

// ─── Public API ─────────────────────────────────────────────────────────────

export const getComplianceChecks = async (
    _parentId?: string
): Promise<ComplianceCheck[]> => {
    // Future: merge with Firestore overrides per parent
    return COMPLIANCE_CHECKS.map((c) => ({
        ...c,
        lastAssessedAt: new Date(),
    }));
};

export const getDataCollectionInventory = (): DataCollectionItem[] =>
    DATA_COLLECTION_INVENTORY;

export const getComplianceSummary = async (
    parentId?: string
): Promise<ComplianceSummary> => {
    const checks = await getComplianceChecks(parentId);
    const frameworks: ComplianceFramework[] = ['COPPA', 'GDPR_K', 'LOCAL_POLICY'];

    const frameworkDetails = frameworks.map((fw) => {
        const fwChecks = checks.filter((c) => c.framework === fw);
        const compliant = fwChecks.filter((c) => c.status === 'COMPLIANT').length;
        const partial = fwChecks.filter((c) => c.status === 'PARTIAL').length;
        const nonCompliant = fwChecks.filter((c) => c.status === 'NON_COMPLIANT').length;
        const totalChecks = fwChecks.length;
        const score =
            totalChecks > 0
                ? Math.round(((compliant + partial * 0.5) / totalChecks) * 100)
                : 0;
        return { framework: fw, score, totalChecks, compliant, partial, nonCompliant };
    });

    const overallScore = Math.round(
        frameworkDetails.reduce((s, f) => s + f.score, 0) / frameworkDetails.length
    );

    return {
        overallScore,
        frameworks: frameworkDetails,
        dataCollectionCount: DATA_COLLECTION_INVENTORY.length,
        activeConsents: 0, // will be populated from Firestore
        lastFullAssessment: new Date(),
    };
};

export const getConsentRecords = async (
    parentId: string
): Promise<ConsentRecord[]> => {
    if (!db) return [];
    try {
        const q = query(
            collection(db, 'consents'),
            where('parentId', '==', parentId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => {
            const data = d.data();
            return {
                id: d.id,
                parentId: data.parentId,
                consentType: data.consentType || '',
                granted: data.granted ?? false,
                grantedAt: data.grantedAt?.toDate?.() ?? new Date(),
                revokedAt: data.revokedAt?.toDate?.() ?? undefined,
                childIds: data.childIds ?? [],
                description: data.description || '',
            };
        });
    } catch (error) {
        console.error('[compliance] Failed to fetch consent records:', error);
        return [];
    }
};
