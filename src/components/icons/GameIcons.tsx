interface IconProps {
  size?: number;
  className?: string;
}

export function ShieldIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2L4 6.5V12C4 17.5 12 21 12 21C12 21 20 17.5 20 12V6.5L12 2Z" />
      <line x1="12" y1="8" x2="12" y2="14" />
    </svg>
  );
}

export function MedkitIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="6" width="16" height="14" rx="2" ry="2" />
      <line x1="12" y1="10" x2="12" y2="16" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}

export function PickaxeIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="12" x2="20" y2="4" />
      <line x1="12" y1="12" x2="4" y2="4" />
      <path d="M8 8L6 10" />
      <path d="M16 8L18 10" />
      <line x1="12" y1="12" x2="12" y2="22" />
    </svg>
  );
}

export function TrophyIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 9C6 6.5 8 5 12 5C16 5 18 6.5 18 9" />
      <path d="M6 9V16C6 17.5 8 18 12 18C16 18 18 17.5 18 16V9" />
      <path d="M5 9H7V10H5Z" />
      <path d="M17 9H19V10H17Z" />
      <line x1="12" y1="18" x2="12" y2="20" />
      <line x1="10" y1="20" x2="14" y2="20" />
    </svg>
  );
}

export function CrownIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 10L8 4L12 7L16 4L18 10" />
      <line x1="4" y1="10" x2="20" y2="10" />
      <path d="M4 10V18C4 19 5 20 6 20H18C19 20 20 19 20 18V10" />
      <circle cx="12" cy="14" r="1.5" />
    </svg>
  );
}

export function CoinIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 6L14 8L12 10L10 8Z" />
    </svg>
  );
}

export function BoltIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M13 2L6 14H10L11 22L18 10H14L13 2Z" />
    </svg>
  );
}

export function ControllerIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 8C4 8 3 9 3 11V16C3 18 4 19 6 19H18C20 19 21 18 21 16V11C21 9 20 8 18 8" />
      <path d="M5 13H7" />
      <path d="M6 12V14" />
      <circle cx="16" cy="13" r="1" />
      <circle cx="18" cy="11" r="1" />
    </svg>
  );
}

export function TargetIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  );
}

export function UsersIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="7" cy="6" r="2.5" />
      <path d="M4 11C4 9 5 8 7 8C9 8 10 9 10 11V18C10 19 9.5 20 8 20H6C4.5 20 4 19 4 18V11Z" />
      <circle cx="17" cy="6" r="2.5" />
      <path d="M14 11C14 9 15 8 17 8C19 8 20 9 20 11V18C20 19 19.5 20 18 20H16C14.5 20 14 19 14 18V11Z" />
    </svg>
  );
}

export function VideoIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 7V17C3 18 4 19 5 19H16C17 19 18 18 18 17V7C18 6 17 5 16 5H5C4 5 3 6 3 7Z" />
      <line x1="3" y1="8" x2="18" y2="8" />
      <line x1="3" y1="13" x2="18" y2="13" />
      <path d="M18 10L21 8V16L18 14" />
    </svg>
  );
}

export function TicketIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="5" width="20" height="14" rx="1" ry="1" />
      <circle cx="7" cy="12" r="1" fill="currentColor" />
      <circle cx="17" cy="12" r="1" fill="currentColor" />
      <defs>
        <pattern id="ticket-pattern" x="0" y="0" width="2" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="6" r="1" fill="currentColor" opacity="0.3" />
          <circle cx="1" cy="12" r="1" fill="currentColor" opacity="0.3" />
        </pattern>
      </defs>
      <line x1="11" y1="5" x2="11" y2="19" strokeDasharray="2,2" />
    </svg>
  );
}

export function SwordIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 4L10 8L18 2" />
      <path d="M18 20L14 16L6 22" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M8 8L16 16" />
    </svg>
  );
}

export function ChestIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 9C4 7 5.5 6 7 6H17C18.5 6 20 7 20 9V17C20 18.5 19 19 17.5 19H6.5C5 19 4 18.5 4 17V9Z" />
      <path d="M12 6C10.5 6 9.5 5 9.5 3.5C9.5 2.5 10.5 2 12 2C13.5 2 14.5 2.5 14.5 3.5C14.5 5 13.5 6 12 6Z" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function MapPinIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2C8 2 5 5 5 9C5 15 12 22 12 22C12 22 19 15 19 9C19 5 16 2 12 2Z" />
      <circle cx="12" cy="9" r="2" fill="currentColor" />
    </svg>
  );
}
