import { collection, addDoc, query, where, getDocs, deleteDoc, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/services/firebaseConfig";
import { Category, AlertSeverity } from "@/types";
/**
 * خدمة إدارة البيانات التجريبية (Amanah Stress-Test Suite)
 */
const MOCK_CHILDREN = [
    {
        name: "سارة",
        age: 12,
        avatar: "https://cdn-icons-png.flaticon.com/512/4140/4140048.png",
        status: "online",
        batteryLevel: 85,
        signalStrength: 4,
        appUsage: [
            { id: 't1', appName: 'TikTok', icon: '📸', minutesUsed: 180, isBlocked: false },
            { id: 't2', appName: 'Snapchat', icon: '👻', minutesUsed: 45, isBlocked: false }
        ],
        psychProfile: {
            anxietyLevel: 15,
            moodScore: 92,
            dominantEmotion: 'سعيدة',
            isolationRisk: 5,
            recentKeywords: []
        }
    },
    {
        name: "عمر",
        age: 15,
        avatar: "https://cdn-icons-png.flaticon.com/512/4140/4140047.png",
        status: "offline",
        batteryLevel: 12,
        signalStrength: 2,
        appUsage: [
            { id: 't3', appName: 'PUBG', icon: '🔫', minutesUsed: 320, isBlocked: true },
            { id: 't4', appName: 'Discord', icon: '👾', minutesUsed: 90, isBlocked: false }
        ],
        psychProfile: {
            anxietyLevel: 65,
            moodScore: 40,
            dominantEmotion: 'منعزل',
            isolationRisk: 80,
            recentKeywords: ["انتحار", "وحيد", "كره"]
        }
    }
];
const generateMockAlerts = (childName) => [
    {
        childName,
        platform: "Instagram",
        content: "أرسل لي صورتك بدون ملابس وسأعطيك سكنات نادرة في اللعبة.",
        category: Category.PREDATOR,
        severity: AlertSeverity.CRITICAL,
        aiAnalysis: "محاولة استدراج واضحة (Grooming) باستخدام مكافآت داخل الألعاب.",
        actionTaken: "حظر المستخدم وعزل الجهاز",
        latency: "0.145ms",
        suspectId: "Gamer_X_99",
        suspectUsername: "Gamer_X_99",
        conversationLog: [
            { sender: "Gamer_X_99", text: "هلا بطل، تلعب فورتنايت؟", time: "10:00 PM", isSuspect: true },
            { sender: childName, text: "ايه العبها كل يوم", time: "10:01 PM", isSuspect: false },
            { sender: "Gamer_X_99", text: "عندي سكنات نادرة ابي اعطيك اياها، بس ورني صورتك اول", time: "10:02 PM", isSuspect: true }
        ]
    },
    {
        childName,
        platform: "Twitter",
        content: "أنت إنسان فاشل ولا تستحق العيش، العالم سيكون أفضل بدونك.",
        category: Category.BULLYING,
        severity: AlertSeverity.HIGH,
        aiAnalysis: "تنمر إلكتروني حاد يتضمن تحريضاً غير مباشر على إيذاء النفس.",
        actionTaken: "تنبيه الوالدين فوراً",
        latency: "0.098ms",
        suspectId: "Anonymous_Hater",
        suspectUsername: "Anonymous_Hater",
        conversationLog: [
            { sender: "Anonymous_Hater", text: "محد يحبك في المدرسة يا نوب", time: "09:30 PM", isSuspect: true },
            { sender: "Anonymous_Hater", text: "أنت إنسان فاشل ولا تستحق العيش، العالم سيكون أفضل بدونك.", time: "09:32 PM", isSuspect: true }
        ]
    }
];
/**
 * حقن حزمة الاختبار الكاملة
 */
export const injectMockSuite = async (parentId) => {
    if (!db)
        return;
    // 1. إضافة أطفال
    for (const childData of MOCK_CHILDREN) {
        const childRef = await addDoc(collection(db, "children"), {
            ...childData,
            parentId,
            createdAt: Timestamp.now()
        });
        // 2. إضافة تنبيهات لكل طفل
        const alerts = generateMockAlerts(childData.name);
        for (const alert of alerts) {
            await addDoc(collection(db, "alerts"), {
                ...alert,
                parentId,
                status: 'NEW',
                timestamp: Timestamp.now()
            });
        }
    }
    // 3. إضافة أنشطة نظام
    const mockActivities = [
        { action: "مزامنة أجهزة", details: "تم ربط 2 أجهزة جديدة بنجاح", type: "SUCCESS" },
        { action: "تحديث الأمان", details: "تم تحديث محرك الذكاء الاصطناعي V1.0.5", type: "INFO" },
        { action: "تحليل بصري", details: "تم رصد محاولة وصول للكاميرا وتم حجبها", type: "WARNING" }
    ];
    for (const act of mockActivities) {
        await addDoc(collection(db, "activities"), {
            ...act,
            parentId,
            timestamp: Timestamp.now()
        });
    }
};
/**
 * حذف كافة بيانات المستخدم (Purge)
 */
export const clearAllUserData = async (parentId) => {
    if (!db)
        return;
    const collections = ["children", "alerts", "activities"];
    for (const colName of collections) {
        const q = query(collection(db, colName), where("parentId", "==", parentId));
        const snap = await getDocs(q);
        const deletePromises = snap.docs.map(d => deleteDoc(doc(db, colName, d.id)));
        await Promise.all(deletePromises);
    }
};
/**
 * تحديث بيانات النبض النفسي عشوائياً للاختبار
 */
export const randomizePsychProfiles = async (parentId) => {
    if (!db)
        return;
    try {
        const q = query(collection(db, "children"), where("parentId", "==", parentId));
        const snap = await getDocs(q);
        const emotions = ['سعيدة', 'هادئ', 'متوتر', 'قلق', 'منعزل', 'مكتئب'];
        const updatePromises = snap.docs.map(d => {
            const anxiety = Math.floor(Math.random() * 100);
            const mood = Math.floor(Math.random() * 100);
            const isolation = Math.floor(Math.random() * 100);
            const emotion = emotions[Math.floor(Math.random() * emotions.length)];
            return updateDoc(doc(db, "children", d.id), {
                psychProfile: {
                    anxietyLevel: anxiety,
                    moodScore: mood,
                    dominantEmotion: emotion,
                    isolationRisk: isolation,
                    recentKeywords: anxiety > 70 ? ["خوف", "هروب", "وحدة"] : []
                }
            });
        });
        await Promise.all(updatePromises);
    }
    catch (e) {
        console.error("Randomize Psych Profiles Error:", e);
    }
};
