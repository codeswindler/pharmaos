export function PharmaPOSLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#061424" />
          <stop offset="100%" stopColor="#082518" />
        </linearGradient>
        <linearGradient id="crossGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00ffaa" />
          <stop offset="100%" stopColor="#00c46a" />
        </linearGradient>
        <filter id="crossGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur1" />
          <feGaussianBlur stdDeviation="1.2" result="blur2" in="SourceGraphic" />
          <feMerge>
            <feMergeNode in="blur1" />
            <feMergeNode in="blur2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="outerGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="cornerGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="40" height="40" rx="10" fill="url(#logoBg)" />

      <rect width="40" height="40" rx="10" fill="none" stroke="#00c46a" strokeWidth="0.8" opacity="0.25" />

      <g filter="url(#cornerGlow)">
        <line x1="5" y1="5" x2="11" y2="5" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <line x1="5" y1="5" x2="5" y2="11" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <circle cx="5" cy="5" r="1.4" fill="#00ffaa" opacity="0.9" />

        <line x1="35" y1="5" x2="29" y2="5" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <line x1="35" y1="5" x2="35" y2="11" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <circle cx="35" cy="5" r="1.4" fill="#00ffaa" opacity="0.9" />

        <line x1="5" y1="35" x2="11" y2="35" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <line x1="5" y1="35" x2="5" y2="29" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <circle cx="5" cy="35" r="1.4" fill="#00ffaa" opacity="0.9" />

        <line x1="35" y1="35" x2="29" y2="35" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <line x1="35" y1="35" x2="35" y2="29" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <circle cx="35" cy="35" r="1.4" fill="#00ffaa" opacity="0.9" />
      </g>

      <g filter="url(#outerGlow)">
        <rect x="15.5" y="8" width="9" height="24" rx="3" fill="url(#crossGrad)" opacity="0.3" />
        <rect x="8" y="15.5" width="24" height="9" rx="3" fill="url(#crossGrad)" opacity="0.3" />
      </g>

      <rect
        x="15.5"
        y="8"
        width="9"
        height="24"
        rx="3"
        fill="url(#crossGrad)"
        filter="url(#crossGlow)"
      />
      <rect
        x="8"
        y="15.5"
        width="24"
        height="9"
        rx="3"
        fill="url(#crossGrad)"
        filter="url(#crossGlow)"
      />

      <rect x="15.5" y="15.5" width="9" height="9" rx="2" fill="white" opacity="0.22" />

      <style>{`
        @keyframes pharma-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes pharma-corner-blink {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </svg>
  );
}
