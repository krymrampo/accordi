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

export function BookmarkIcon() {
  return <Icon><path d="M6 4h12v17l-6-4-6 4z" /></Icon>;
}

export function ChevronIcon() {
  return <Icon size={17}><path d="m9 5 7 7-7 7" /></Icon>;
}

export function SunIcon() {
  return <Icon size={18}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Icon>;
}

export function MoonIcon() {
  return <Icon size={18}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Icon>;
}

export function TrashIcon() {
  return <Icon size={17}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></Icon>;
}

export function SpeedIcon() {
  return <Icon size={18}><path d="M12 14v-4M12 14l3-3M20.2 16A9 9 0 1 0 3.8 16" /></Icon>;
}

export function ZoomInIcon() {
  return <Icon size={18}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35M11 8v6M8 11h6" /></Icon>;
}

export function ZoomOutIcon() {
  return <Icon size={18}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35M8 11h6" /></Icon>;
}

