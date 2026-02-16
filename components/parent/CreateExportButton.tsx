import React from 'react';

interface CreateExportButtonProps {
  lang: 'ar' | 'en';
  onCreate: () => void;
  disabled?: boolean;
  isBusy?: boolean;
}

const CreateExportButton: React.FC<CreateExportButtonProps> = ({
  lang,
  onCreate,
  disabled = false,
  isBusy = false,
}) => (
  <button
    onClick={onCreate}
    disabled={disabled || isBusy}
    className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black text-sm shadow disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {isBusy
      ? lang === 'ar'
        ? 'جاري إنشاء الحزمة...'
        : 'Building package...'
      : lang === 'ar'
        ? 'إنشاء تصدير جديد'
        : 'Create New Export'}
  </button>
);

export default CreateExportButton;
