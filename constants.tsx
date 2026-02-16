import React from 'react';

// المسار المشترك للدرع المتوازن
const SHIELD_PATH =
  'M120 18 C147 25 173 35 192 46 C194 48 196 50 196 54 L196 122 C196 172 163 208 120 226 C77 208 44 172 44 122 L44 54 C44 50 46 48 48 46 C67 35 93 25 120 18 Z';

/**
 * المكون الذي يحتوي على كافة التعريفات البصرية المشتركة (تدرجات وظلال)
 * يجب رندرة هذا المكون مرة واحدة في أعلى مستوى من التطبيق
 */
export const AmanahGlobalDefs = () => (
  <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
    <defs>
      <style>{`.brand-font { font-family: 'Cairo', sans-serif; font-weight: 900; }`}</style>

      <filter id="softShadow" x="-35%" y="-35%" width="170%" height="170%">
        <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#000" floodOpacity="0.20" />
      </filter>

      <filter id="innerShadow" x="-35%" y="-35%" width="170%" height="170%">
        <feOffset dx="0" dy="3" in="SourceAlpha" result="off" />
        <feGaussianBlur in="off" stdDeviation="4" result="blur" />
        <feComposite in="blur" in2="SourceAlpha" operator="out" result="innerCut" />
        <feColorMatrix
          in="innerCut"
          type="matrix"
          values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0.28 0"
          result="shadow"
        />
        <feComposite in="shadow" in2="SourceGraphic" operator="over" />
      </filter>

      <filter id="goldSpecular" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="a" />
        <feSpecularLighting
          in="a"
          surfaceScale="6"
          specularConstant="0.95"
          specularExponent="36"
          lightingColor="#FFF"
          result="spec"
        >
          <feDistantLight azimuth="235" elevation="48" />
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="specIn" />
        </feMerge>
      </filter>

      <clipPath id="shieldClip">
        <path d={SHIELD_PATH} />
      </clipPath>

      <linearGradient id="maroonBody" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#B83A60" />
        <stop offset="35%" stopColor="#8A1538" />
        <stop offset="100%" stopColor="#3A0715" />
      </linearGradient>

      <linearGradient id="goldMetal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFF8D8" />
        <stop offset="10%" stopColor="#F7DE8D" />
        <stop offset="22%" stopColor="#D1A23D" />
        <stop offset="36%" stopColor="#FFF2B6" />
        <stop offset="50%" stopColor="#B47E1B" />
        <stop offset="64%" stopColor="#FFE6A0" />
        <stop offset="78%" stopColor="#C69126" />
        <stop offset="100%" stopColor="#7A4D0A" />
      </linearGradient>

      <linearGradient id="goldInner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
        <stop offset="55%" stopColor="#F0C96B" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#2A1603" stopOpacity="0.42" />
      </linearGradient>

      <linearGradient id="glossSweep" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#FFF" stopOpacity="0" />
        <stop offset="32%" stopColor="#FFF" stopOpacity="0.12" />
        <stop offset="48%" stopColor="#FFF" stopOpacity="0.34" />
        <stop offset="62%" stopColor="#FFF" stopOpacity="0.10" />
        <stop offset="100%" stopColor="#FFF" stopOpacity="0" />
      </linearGradient>
    </defs>
  </svg>
);

// المكون الذي يرسم الدرع فقط مع توهج التنفس الذهبي
export const AmanahShield = ({
  className = 'w-10 h-10',
  animate = true,
}: {
  className?: string;
  animate?: boolean;
}) => (
  <svg
    viewBox="0 0 240 240"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${animate ? 'animate-shield-breathing' : ''}`}
    preserveAspectRatio="xMidYMid meet"
  >
    <g filter="url(#softShadow)">
      <path d={SHIELD_PATH} fill="url(#maroonBody)" filter="url(#innerShadow)" />
      <g clipPath="url(#shieldClip)">
        <path
          shapeRendering="geometricPrecision"
          fill="#FFF"
          d="M30 0 H95 V35 L120 50 L95 65 L120 80 L95 95 L120 110 L95 125 L120 140 L95 155 L120 170 L95 185 L120 200 L95 215 V260 H30 Z"
        />
        <path
          d="M10 70 C70 40 140 35 230 85 L230 105 C160 75 85 85 10 150 Z"
          fill="url(#glossSweep)"
          opacity="0.22"
        />
      </g>
      <path
        d={SHIELD_PATH}
        fill="none"
        stroke="url(#goldMetal)"
        strokeWidth="10"
        strokeLinejoin="round"
        strokeLinecap="round"
        filter="url(#goldSpecular)"
      />
      <path
        d="M120 26 C145 33 168 42 183 51 C184 52 186 54 186 57 L186 122 C186 164 158 195 120 211 C82 195 54 164 54 122 L54 57 C54 54 56 52 57 51 C72 42 95 33 120 26 Z"
        fill="none"
        stroke="url(#goldInner)"
        strokeWidth="4.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.92"
      />
    </g>
  </svg>
);

// اللوجو الرسمي الكامل مع النص
export const AmanahLogo = ({ className = 'w-full h-auto' }: { className?: string }) => (
  <div className={`flex flex-col items-center gap-4 ${className}`}>
    <AmanahShield className="w-full" />
    <span
      className="brand-font text-center leading-none"
      style={{
        color: '#8A1538',
        fontSize: '1.2em',
        filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))',
      }}
    >
      Amanah
    </span>
  </div>
);

export const AdminShieldBadge = ({ className = 'w-10 h-10' }: { className?: string }) => (
  <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M120 10 C160 20 200 35 230 50 L230 140 C230 200 190 220 120 245 C50 220 10 200 10 140 L10 50 C40 35 80 20 120 10 Z"
      fill="#1e293b"
      stroke="#f7de8d"
      strokeWidth="12"
    />
    <path
      d="M90 120 L110 140 L150 100"
      fill="none"
      stroke="#f7de8d"
      strokeWidth="15"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ICONS = {
  Dashboard: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  ),
  Devices: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  ),
  Location: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
    </svg>
  ),
  Menu: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h7"
      />
    </svg>
  ),
  Close: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Shield: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  ),
  Plus: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  Settings: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
    </svg>
  ),
  Trash: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  LiveCamera: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  ),
  WalkieTalkie: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  ),
  Pulse: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  ),
  Vault: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  ),
  Rocket: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  ),
  History: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  Refresh: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  ),
  Bell: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  ),
  Fingerprint: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
      />
    </svg>
  ),
  Apps: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  ),
  Globe: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  ),
  Chat: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Chain: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 10-7.07-7.07L10 5m4 6a5 5 0 00-7.07 0L5.52 12.41a5 5 0 107.07 7.07L14 18"
      />
    </svg>
  ),
  Command: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 8h12M6 12h8m-8 4h6M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"
      />
    </svg>
  ),
  ShieldCheck: ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5-3a11.95 11.95 0 01-8-3 11.95 11.95 0 01-8 3v5a11 11 0 008 10 11 11 0 008-10V7z"
      />
    </svg>
  ),
};
