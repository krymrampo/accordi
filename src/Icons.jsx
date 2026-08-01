function Icon({ children, className = "", size = 20 }) {
  return (
    <svg
      aria-hidden="true"
      className={`ui-icon${className ? ` ${className}` : ""}`}
      fill="none"
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  );
}

export function SearchIcon() {
  return <Icon><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Icon>;
}

export function ExternalIcon() {
  return <Icon size={17}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></Icon>;
}

export function ReaderIcon() {
  return <Icon size={18}><path d="M5 8v8M9 5v14M13 8v8M17 6v12M21 9v6" /></Icon>;
}

export function ResetIcon() {
  return <Icon size={18}><path d="M4 10a8 8 0 1 1 2 7" /><path d="M4 4v6h6" /></Icon>;
}

export function PlayIcon({ paused = false }) {
  return paused
    ? <Icon size={18}><path d="M9 7v10M15 7v10" /></Icon>
    : <Icon size={18}><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4Z" /></Icon>;
}

export function PrintIcon() {
  return <Icon size={18}><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M7 14h10v6H7z" /></Icon>;
}

export function DownloadIcon() {
  return <Icon size={18}><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></Icon>;
}

export function RemovedIcon() {
  return <Icon><path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8" /><path d="M6 7l1 14h10l1-14" /></Icon>;
}

export function BookmarkIcon() {
  return <Icon><path d="M6 4h12v17l-6-4-6 4z" /></Icon>;
}

export function PhoneIcon() {
  return <Icon><rect x="6" y="2.5" width="12" height="19" rx="2" /><path d="M10 18h4" /></Icon>;
}

export function CheckIcon() {
  return <Icon size={18}><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></Icon>;
}

export function ChevronIcon() {
  return <Icon size={17}><path d="m9 5 7 7-7 7" /></Icon>;
}
