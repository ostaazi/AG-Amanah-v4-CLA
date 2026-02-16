import { Category, AlertSeverity } from '../types';

/**
 * محرك V19.0 Turbo-Linear Spectrum
 * تم تحسينه للسرعة القصوى عبر الفهرسة المسبقة (Pre-calculation)
 */

const SKELETON_MAP: Record<string, string> = {
  'o': '0', '0': '0', '@': '0', '*': '0', 'و': '0', 'ؤ': '0', 'q': '0', 'p': '0', 'b': '0', 'd': '0', 'g': '0', 'v': '0', 'u': '0', 'w': '0', 'ة': '0', 'ه': '0',
  'i': '1', 'l': '1', '1': '1', '!': '1', '|': '1', 'ا': '1', 'أ': '1', 'إ': '1', 'آ': '1', 'ٱ': '1', 'ل': '1', 't': '1', 'f': '1',
  's': '5', '5': '5', '$': '5', 'z': '5', 'س': '5', 'ش': '5', 'n': '5', 'm': '5', 'r': '5', 'ر': '5', 'ز': '5', 'د': '5', 'ذ': '5',
  'e': '3', '3': '3', 'c': '3', 'ع': '3', '4': '3', 'a': '3', 'x': '3', 'k': '3', 'y': '3', 'ي': '3', 'ى': '3', 'ئ': '3', 'ح': '3', 'خ': '3', 'ج': '3'
};

const RAW_DANGER_DATA = [
  { words: ['صوره', 'فيديو', 'مقاطع', 'عاري', 'صور', 'فضيحه', 'اباحي', 'porn', 'sex', 'naked', 'nude', 'xxx', 'bitch', 'fck', 'shit', 'dick', 'pussy', 'f*ck'], category: Category.ADULT_CONTENT, severity: AlertSeverity.MEDIUM },
  { words: ['خاص', 'سناب', 'رقمك', 'رقمي', 'اتصال', 'كاميرا', 'واتس', 'يوزر', 'تليجرام', 'snapchat', 'whatsapp', 'meet', 'kik', 'skype', 'address'], category: Category.PREDATOR, severity: AlertSeverity.HIGH },
  { words: ['انتحار', 'اقتل', 'موت', 'نفسي', 'اذبح', 'kill', 'suicide', 'die', 'hurt', 'blood', 'cut'], category: Category.SELF_HARM, severity: AlertSeverity.CRITICAL },
  { words: ['غبي', 'حيوان', 'حقير', 'كلب', 'فاشل', 'stupid', 'hate', 'loser', 'idiot', 'bitch'], category: Category.BULLYING, severity: AlertSeverity.MEDIUM },
  { words: ['ابتزاز', 'بفضحك', 'بنشر', 'صورك', 'بفضح', 'blackmail', 'leak', 'shame'], category: Category.BLACKMAIL, severity: AlertSeverity.CRITICAL }
];

/**
 * تحويل النص إلى الهيكل البصري بمرور واحد (Optimized Single Pass)
 */
export const purifyToSkeleton = (input: string): string => {
  if (!input) return "";
  
  // مرور واحد فقط لتحويل الحروف وتجاهل الرموز غير المهمة
  let result = "";
  let lastChar = "";
  
  for (let i = 0; i < input.length; i++) {
    const char = input[i].toLowerCase();
    
    // تجاهل المسافات وعلامات الترقيم الشائعة بمرور واحد
    if (char === ' ' || char === '\n' || char === '\t' || char === '.' || char === ',' || char === '_') continue;
    
    const mapped = SKELETON_MAP[char] || char;
    
    // منع التكرار الفوري أثناء المسح (Deduplication on the fly)
    if (mapped !== lastChar) {
      result += mapped;
      lastChar = mapped;
    }
  }
  return result;
};

// الفهرسة المسبقة للقاموس لضمان سرعة O(1) تقريباً عند البحث
const PRE_INDEXED_DICTIONARY = RAW_DANGER_DATA.map(group => ({
  ...group,
  skeletons: group.words.map(w => purifyToSkeleton(w))
}));

// فهرسة مسبقة للأفعال التحريضية
const PRE_INDEXED_ACTIONS = ['ارسل', 'عطني', 'ورني', 'هات', 'send', 'show', 'give', 'pic', 'video', 'add'].map(a => purifyToSkeleton(a));

/**
 * الفحص المحلي الفوري (Zero-Latency Check)
 */
export const localSentinelCheck = (text: string) => {
  // Fix: Added `latency: "0ms"` to ensure return type consistency with other return statements
  if (!text) return { isDanger: false, category: Category.SAFE, severity: AlertSeverity.LOW, skeleton: "", latency: "0ms" };
  
  const startTime = performance.now();
  const inputSkeleton = purifyToSkeleton(text);
  
  // البحث في القاموس المفهرس مسبقاً
  for (const group of PRE_INDEXED_DICTIONARY) {
    for (const wordSkeleton of group.skeletons) {
      if (inputSkeleton.includes(wordSkeleton)) {
        const hasAction = PRE_INDEXED_ACTIONS.some(aSkeleton => inputSkeleton.includes(aSkeleton));
        const duration = performance.now() - startTime;
        
        return { 
          isDanger: true, 
          category: group.category, 
          severity: hasAction ? AlertSeverity.CRITICAL : group.severity,
          skeleton: inputSkeleton,
          latency: duration.toFixed(4) + "ms"
        };
      }
    }
  }

  const duration = performance.now() - startTime;
  return { 
    isDanger: false, 
    category: Category.SAFE, 
    severity: AlertSeverity.LOW, 
    skeleton: inputSkeleton,
    latency: duration.toFixed(4) + "ms"
  };
};