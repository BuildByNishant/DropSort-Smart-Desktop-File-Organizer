export default function Logo({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="dsg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f6bff" />
          <stop offset="1" stopColor="#8b4dff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#dsg)" />
      <rect x="22" y="12" width="6" height="16" rx="1" fill="#fff" />
      <polygon points="15,26 35,26 25,38" fill="#fff" transform="translate(4 -2)" />
      <path d="M13 36h12l3 -3h23a2 2 0 0 1 2 2v14a3 3 0 0 1 -3 3H16a3 3 0 0 1 -3 -3z" fill="#fff" opacity="0.95" />
    </svg>
  );
}
