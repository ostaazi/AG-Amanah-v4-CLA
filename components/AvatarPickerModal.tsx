import React, { useState, useEffect, useRef } from 'react';
import { ICONS } from '../constants';
import { MY_DESIGNED_ASSETS } from '../assets';
import { getImagesFromDB, saveImageToDB } from '../services/storageService';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  currentAvatar?: string;
  title?: string;
}

const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  currentAvatar,
  title,
}) => {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // دمج كافة المصادر المتاحة للصور
  const allAvatars = [...MY_DESIGNED_ASSETS.LIBRARY_ICONS, ...uploadedImages];

  useEffect(() => {
    if (isOpen) {
      loadUploadedImages();
    }
  }, [isOpen]);

  const loadUploadedImages = async () => {
    try {
      const stored = await getImagesFromDB();
      setUploadedImages(stored);
    } catch (e) {
      console.error('Failed to load local avatars', e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        await saveImageToDB(dataUrl);
        setUploadedImages((prev) => [dataUrl, ...prev]);
        onSelect(dataUrl);
        setIsUploading(false);
        onClose();
      };
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
      dir="rtl"
    >
      <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
          <div className="text-right">
            <h3 className="text-2xl font-black text-slate-800 tracking-tighter">
              {title || 'تغيير الصورة الشخصية'}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              اختر من مكتبة أمانة ({allAvatars.length} صورة)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-slate-200 rounded-full transition-all text-slate-400"
          >
            <ICONS.Close />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar space-y-10 flex-1 bg-white">
          {/* خيار الرفع السريع */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-8 border-4 border-dashed border-indigo-100 rounded-[2.5rem] hover:bg-indigo-50 hover:border-indigo-300 transition-all flex flex-col items-center gap-3 group bg-white shadow-sm"
            >
              <div className="text-5xl group-hover:scale-110 transition-transform">
                {isUploading ? '⏳' : '📸'}
              </div>
              <div className="text-center">
                <span className="font-black text-indigo-600 text-sm block">
                  {isUploading ? 'جاري معالجة الصورة...' : 'رفع صورة من معرض الصور الخاص بك'}
                </span>
                <span className="text-[9px] font-bold text-slate-400">
                  يمكنك استخدام الكاميرا أو الملفات
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={handleFileUpload}
              />
            </button>
          </div>

          {/* شبكة الصور */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                مكتبة الصور المتاحة
              </h4>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {allAvatars.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelect(url)}
                  className={`relative aspect-square rounded-3xl overflow-hidden border-4 transition-all hover:scale-110 active:scale-95 shadow-md ${currentAvatar === url ? 'border-indigo-600 ring-4 ring-indigo-50 z-10' : 'border-slate-50 hover:border-indigo-200'}`}
                >
                  <img
                    src={url}
                    className="w-full h-full object-cover"
                    alt={`Avatar ${idx}`}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://cdn-icons-png.flaticon.com/512/4140/4140048.png';
                    }}
                  />
                  {currentAvatar === url && (
                    <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                      <div className="bg-white rounded-full p-1.5 shadow-xl text-[12px] animate-bounce">
                        ✅
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center gap-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-14 py-4 bg-white text-slate-500 rounded-2xl font-black text-sm border border-slate-200 shadow-sm hover:bg-slate-100 transition-colors"
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarPickerModal;
