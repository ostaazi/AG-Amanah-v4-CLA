
import React from 'react';

// المكون الكامل (درع فوق الاسم) - تصميم ممركز عمودياً وأفقياً
export const AmanahLogo = ({ className = "w-full h-auto" }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 240 300"
    className={className}
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label="Amanah logo (shield above, Amanah below)"
    style={{ direction: 'ltr' }} 
  >
    <defs>
      <style>{`
        .brand { font-family: Arial, Helvetica, sans-serif; font-weight: 800; }
      `}</style>

      {/* Text shadow */}
      <filter id="shadowBrand" x="-35%" y="-35%" width="170%" height="170%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#6B7280" floodOpacity="0.45"/>
      </filter>

      {/* Shield Path */}
      <path id="shieldPathBalanced"
        d="M90 6
           C120 14 150 24 172 36
           C175 38 176 40 176 44
           L176 112
           C176 164 142 202 90 224
           C38 202 4 164 4 112
           L4 44
           C4 40 5 38 8 36
           C30 24 60 14 90 6
           Z"/>

      <clipPath id="shieldClip">
        <use href="#shieldPathBalanced"/>
      </clipPath>

      {/* Materials */}
      <linearGradient id="maroonBody" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stopColor="#B83A60"/>
        <stop offset="35%" stopColor="#8A1538"/>
        <stop offset="100%" stopColor="#3A0715"/>
      </linearGradient>

      <linearGradient id="goldMetal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="#FFF8D8"/>
        <stop offset="10%"  stopColor="#F7DE8D"/>
        <stop offset="22%"  stopColor="#D1A23D"/>
        <stop offset="36%"  stopColor="#FFF2B6"/>
        <stop offset="50%"  stopColor="#B47E1B"/>
        <stop offset="64%"  stopColor="#FFE6A0"/>
        <stop offset="78%"  stopColor="#C69126"/>
        <stop offset="100%" stopColor="#7A4D0A"/>
      </linearGradient>

      <linearGradient id="goldInner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.55"/>
        <stop offset="55%"  stopColor="#F0C96B" stopOpacity="0.18"/>
        <stop offset="100%" stopColor="#2A1603" stopOpacity="0.42"/>
      </linearGradient>

      <linearGradient id="glossSweep" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0"/>
        <stop offset="32%"  stopColor="#FFFFFF" stopOpacity="0.12"/>
        <stop offset="48%"  stopColor="#FFFFFF" stopOpacity="0.34"/>
        <stop offset="62%"  stopColor="#FFFFFF" stopOpacity="0.10"/>
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
      </linearGradient>

      {/* Shadows */}
      <filter id="softShadow" x="-35%" y="-35%" width="170%" height="170%">
        <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#000000" floodOpacity="0.20"/>
      </filter>

      <filter id="innerShadow" x="-35%" y="-35%" width="170%" height="170%">
        <feOffset dx="0" dy="3" in="SourceAlpha" result="off"/>
        <feGaussianBlur in="off" stdDeviation="4" result="blur"/>
        <feComposite in="blur" in2="SourceAlpha" operator="out" result="innerCut"/>
        <feColorMatrix in="innerCut" type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.28 0" result="shadow"/>
        <feComposite in="shadow" in2="SourceGraphic" operator="over"/>
      </filter>

      <filter id="goldSpecular" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="a"/>
        <feSpecularLighting in="a" surfaceScale="6" specularConstant="0.95" specularExponent="36"
          lightingColor="#FFFFFF" result="spec">
          <feDistantLight azimuth="235" elevation="48"/>
        </feSpecularLighting>
        <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
        <feMerge>
          <feMergeNode in="SourceGraphic"/>
          <feMergeNode in="specIn"/>
        </feMerge>
      </filter>
    </defs>

    {/* SHIELD (centered horizontally at x=120) */}
    <g transform="translate(32,14)" filter="url(#softShadow)">
      <use href="#shieldPathBalanced" fill="url(#maroonBody)" filter="url(#innerShadow)"/>

      <g clipPath="url(#shieldClip)">
        <path shapeRendering="geometricPrecision" fill="#FFFFFF" opacity="1"
          d="M-12 -12 H54 V16
             L78 29 L54 42
             L78 55 L54 68
             L78 81 L54 94
             L78 107 L54 120
             L78 133 L54 146
             L78 159 L54 172
             L78 185 L54 198
             L78 211 L54 224
             L78 237 L54 250
             V270 H-12 Z"/>
        <path d="M-35 55 C35 18 120 10 230 70 L230 92 C150 55 55 70 -35 135 Z"
              fill="url(#glossSweep)" opacity="0.22"/>
        <rect x="-12" y="-12" width="240" height="270" fill="#000000" opacity="0.04"/>
      </g>

      <use href="#shieldPathBalanced"
           fill="none"
           stroke="url(#goldMetal)"
           strokeWidth="10"
           strokeLinejoin="round"
           strokeLinecap="round"
           filter="url(#goldSpecular)"/>

      <path d="M90 14
               C118 21 144 31 162 41
               C164 42 166 44 166 47
               L166 112
               C166 158 135 191 90 210
               C45 191 14 158 14 112
               L14 47
               C14 44 16 42 18 41
               C36 31 62 21 90 14
               Z"
            fill="none"
            stroke="url(#goldInner)"
            strokeWidth="4.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.92"/>

      <g clipPath="url(#shieldClip)">
        <path d="M-35 55 C35 18 120 10 230 70 L230 92 C150 55 55 70 -35 135 Z"
              fill="url(#glossSweep)" opacity="0.48"/>
      </g>
    </g>

    {/* AMANAH (centered below shield) */}
    <text x="120" y="284"
      textAnchor="middle"
      className="brand"
      fontSize="58"
      fill="#8A1538"
      filter="url(#shadowBrand)">
      Amanah
    </text>
  </svg>
);

export const AmanahShield = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 230" className={className}>
     <use href="#shieldPathBalanced" transform="translate(0,0)" fill="url(#maroonBody)"/>
     <use href="#shieldPathBalanced" fill="none" stroke="url(#goldMetal)" strokeWidth="10"/>
  </svg>
);

export const ICONS = {
  Dashboard: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Devices: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  Location: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    </svg>
  ),
  Call: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  Menu: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  Close: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Shield: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Plus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  Settings: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Trash: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  LiveCamera: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  WalkieTalkie: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ),
  Pulse: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Vault: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  Rocket: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Chat: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
};
