import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: 'linear-gradient(145deg, #fb923c, #ea580c)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="110" height="110" viewBox="0 0 100 100" fill="none">
          <ellipse cx="50" cy="65" rx="36" ry="9" fill="white" opacity="0.9" />
          <ellipse cx="50" cy="64" rx="28" ry="7" fill="rgba(251,146,60,0.2)" />
          <rect x="24" y="20" width="3.5" height="22" rx="1.5" fill="white" />
          <rect x="21" y="20" width="2.5" height="11" rx="1" fill="white" />
          <rect x="27.5" y="20" width="2.5" height="11" rx="1" fill="white" />
          <rect x="24" y="30" width="3.5" height="3" rx="1" fill="white" />
          <rect x="72" y="20" width="3.5" height="26" rx="1.5" fill="white" />
          <path d="M72 20 Q79 26 75.5 34 L72 34 Z" fill="white" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
