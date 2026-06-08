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
        <linearGradient id="crossGradShift" x1="40" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00ffcc" />
          <stop offset="100%" stopColor="#00ff88" />
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
        <filter id="ringGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.5" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <style>{`
        @keyframes pharma-pulse {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50% { opacity: 0.75; filter: brightness(1.3); }
        }
        @keyframes pharma-corner-blink {
          0%, 100% { opacity: 0.9; r: 1.4; }
          50% { opacity: 0.3; r: 1.0; }
        }
        @keyframes pharma-ring-spin {
          0% { stroke-dashoffset: 0; opacity: 0.4; }
          50% { opacity: 0.9; }
          100% { stroke-dashoffset: -75.4; opacity: 0.4; }
        }
        @keyframes pharma-ring-spin-rev {
          0% { stroke-dashoffset: 0; opacity: 0.25; }
          50% { opacity: 0.7; }
          100% { stroke-dashoffset: 75.4; opacity: 0.25; }
        }
        @keyframes pharma-border-pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.55; }
        }
        @keyframes pharma-center-glow {
          0%, 100% { opacity: 0.18; }
          50% { opacity: 0.45; }
        }
        @keyframes pharma-scan {
          0% { transform: translateY(-12px); opacity: 0; }
          20% { opacity: 0.6; }
          80% { opacity: 0.6; }
          100% { transform: translateY(12px); opacity: 0; }
        }
        .pharma-cross {
          animation: pharma-pulse 2.4s ease-in-out infinite;
        }
        .pharma-corner-dot {
          animation: pharma-corner-blink 1.8s ease-in-out infinite;
        }
        .pharma-corner-dot-2 {
          animation: pharma-corner-blink 1.8s ease-in-out infinite 0.45s;
        }
        .pharma-corner-dot-3 {
          animation: pharma-corner-blink 1.8s ease-in-out infinite 0.9s;
        }
        .pharma-corner-dot-4 {
          animation: pharma-corner-blink 1.8s ease-in-out infinite 1.35s;
        }
        .pharma-ring-outer {
          animation: pharma-ring-spin 3s linear infinite;
        }
        .pharma-ring-inner {
          animation: pharma-ring-spin-rev 2.2s linear infinite;
        }
        .pharma-border {
          animation: pharma-border-pulse 2.4s ease-in-out infinite;
        }
        .pharma-center {
          animation: pharma-center-glow 1.6s ease-in-out infinite;
        }
        .pharma-scan-line {
          animation: pharma-scan 2.8s ease-in-out infinite;
        }
      `}</style>

      <rect width="40" height="40" rx="10" fill="url(#logoBg)" />

      <rect className="pharma-border" width="40" height="40" rx="10" fill="none" stroke="#00c46a" strokeWidth="1" />

      <circle
        className="pharma-ring-outer"
        cx="20" cy="20" r="12"
        fill="none"
        stroke="#00ffaa"
        strokeWidth="0.6"
        strokeDasharray="6 3"
        filter="url(#ringGlow)"
      />
      <circle
        className="pharma-ring-inner"
        cx="20" cy="20" r="8.5"
        fill="none"
        stroke="#00c46a"
        strokeWidth="0.5"
        strokeDasharray="3 4"
      />

      <g filter="url(#cornerGlow)">
        <line x1="5" y1="5" x2="11" y2="5" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <line x1="5" y1="5" x2="5" y2="11" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <circle className="pharma-corner-dot" cx="5" cy="5" r="1.4" fill="#00ffaa" />

        <line x1="35" y1="5" x2="29" y2="5" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <line x1="35" y1="5" x2="35" y2="11" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <circle className="pharma-corner-dot-2" cx="35" cy="5" r="1.4" fill="#00ffaa" />

        <line x1="5" y1="35" x2="11" y2="35" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <line x1="5" y1="35" x2="5" y2="29" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <circle className="pharma-corner-dot-3" cx="5" cy="35" r="1.4" fill="#00ffaa" />

        <line x1="35" y1="35" x2="29" y2="35" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <line x1="35" y1="35" x2="35" y2="29" stroke="#00e87e" strokeWidth="0.8" opacity="0.7" />
        <circle className="pharma-corner-dot-4" cx="35" cy="35" r="1.4" fill="#00ffaa" />
      </g>

      <g filter="url(#outerGlow)">
        <rect x="15.5" y="8" width="9" height="24" rx="3" fill="url(#crossGrad)" opacity="0.3" />
        <rect x="8" y="15.5" width="24" height="9" rx="3" fill="url(#crossGrad)" opacity="0.3" />
      </g>

      <g className="pharma-cross" filter="url(#crossGlow)">
        <rect x="15.5" y="8" width="9" height="24" rx="3" fill="url(#crossGrad)" />
        <rect x="8" y="15.5" width="24" height="9" rx="3" fill="url(#crossGrad)" />
      </g>

      <rect className="pharma-center" x="15.5" y="15.5" width="9" height="9" rx="2" fill="white" />

      <rect
        className="pharma-scan-line"
        x="15.5" y="20" width="9" height="1.5" rx="0.5"
        fill="#00ffcc"
        opacity="0"
      />
    </svg>
  );
}
