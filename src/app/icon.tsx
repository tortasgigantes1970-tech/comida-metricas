import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          borderRadius: 128,
          background: 'linear-gradient(145deg, #fb923c, #ea580c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Plato */}
        <svg width="300" height="300" viewBox="0 0 100 100" fill="none">
          {/* Plato base */}
          <ellipse cx="50" cy="72" rx="38" ry="8" fill="rgba(255,255,255,0.25)" />
          <ellipse cx="50" cy="68" rx="38" ry="10" fill="white" opacity="0.15" />
          <ellipse cx="50" cy="65" rx="36" ry="9" fill="white" opacity="0.9" />
          <ellipse cx="50" cy="64" rx="28" ry="7" fill="rgba(251,146,60,0.2)" />

          {/* Tenedor izquierda */}
          <rect x="24" y="20" width="3.5" height="22" rx="1.5" fill="white" />
          <rect x="21" y="20" width="2.5" height="11" rx="1" fill="white" />
          <rect x="27.5" y="20" width="2.5" height="11" rx="1" fill="white" />
          <rect x="24" y="30" width="3.5" height="3" rx="1" fill="white" />

          {/* Cuchillo derecha */}
          <rect x="72" y="20" width="3.5" height="26" rx="1.5" fill="white" />
          <path d="M72 20 Q79 26 75.5 34 L72 34 Z" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
