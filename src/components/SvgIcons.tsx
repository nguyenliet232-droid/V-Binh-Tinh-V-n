import type { ShipId, UpgradeId } from "../game/types";

export function TitleLockupSvg() {
  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox="0 0 64 40"
        className="w-16 h-10 text-amber-400"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 20L24 8L20 17L58 20L20 23L24 32L6 20Z"
          fill="#E2E8F0"
          stroke="#0F172A"
          strokeWidth="1.5"
        />
        <path d="M26 14L44 20L26 26L30 20L26 14Z" fill="#38BDF8" />
        <path d="M6 20L15 16L13 20L15 24L6 20Z" fill="#F59E0B" />
        <path
          d="M32 4L42 7M32 36L42 33"
          stroke="#F59E0B"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-50 leading-[1.06] text-balance">
        Vệ Binh Tinh Vân
      </h1>
    </div>
  );
}

export function HullIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="w-4 h-4 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 2.5L17 6V11.2C17 14.8 13.9 17.5 10 18.5C6.1 17.5 3 14.8 3 11.2V6L10 2.5Z"
        fill={filled ? "#34D399" : "#1E293B"}
        stroke={filled ? "#A7F3D0" : "#475569"}
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function ShieldIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="w-4 h-4 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <polygon
        points="10,2 17,6.5 17,13.5 10,18 3,13.5 3,6.5"
        fill={filled ? "#38BDF8" : "#1E293B"}
        stroke={filled ? "#BAE6FD" : "#475569"}
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {muted ? (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  );
}

export function PauseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="8" y1="5" x2="8" y2="19" />
      <line x1="16" y1="5" x2="16" y2="19" />
    </svg>
  );
}

export function UpgradeIcon({ id }: { id: UpgradeId }) {
  switch (id) {
    case "twin_cannons":
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M7 19V5M17 19V5M7 5l-2 2M7 5l2 2M17 5l-2 2M17 5l2 2" />
        </svg>
      );
    case "rapid_overclock":
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "ricochet_bolts":
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 17 10 6 16 16 20 8" />
          <polyline points="17 8 20 8 20 11" />
        </svg>
      );
    case "piercing_rounds":
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="12" x2="21" y2="12" />
          <polyline points="15 6 21 12 15 18" />
          <line x1="11" y1="5" x2="11" y2="19" strokeDasharray="2 3" />
        </svg>
      );
    case "phase_dash_blast":
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4" />
          <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
        </svg>
      );
    case "shield_capacitor":
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        >
          <path d="M12 3l8 4v5c0 4.5-3.4 7.8-8 9-4.6-1.2-8-4.5-8-9V7l8-4z" />
        </svg>
      );
    case "hull_plating":
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case "orbital_drone":
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="3" />
          <ellipse
            cx="12"
            cy="12"
            rx="9"
            ry="4"
            transform="rotate(-30 12 12)"
          />
        </svg>
      );
    case "core_magnet":
      return (
        <svg
          viewBox="0 0 24 24"
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 4v7a6 6 0 0 0 12 0V4" />
          <line x1="4" y1="4" x2="8" y2="4" />
          <line x1="16" y1="4" x2="20" y2="4" />
        </svg>
      );
  }
}

export function ShipPreviewSvg({ shipId }: { shipId: ShipId }) {
  if (shipId === "striker") {
    return (
      <svg
        viewBox="0 0 60 40"
        className="w-14 h-9 shrink-0"
        fill="none"
        aria-hidden="true"
      >
        {/* Twin Cyan Ion Exhaust Jets */}
        <path d="M22 14L4 12L17 17Z" fill="#38BDF8" fillOpacity="0.85" />
        <path d="M22 26L4 28L17 23Z" fill="#38BDF8" fillOpacity="0.85" />
        <line
          x1="2"
          y1="15"
          x2="18"
          y2="15"
          stroke="#BAE6FD"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="2"
          y1="25"
          x2="18"
          y2="25"
          stroke="#BAE6FD"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M55 20L29 8L33 16L19 12L23 20L19 28L33 24L29 32L55 20Z"
          fill="#E2E8F0"
          stroke="#0F172A"
          strokeWidth="1.5"
        />
        <path d="M27 11L43 16L33 17L27 11Z" fill="#38BDF8" />
        <path d="M27 29L43 24L33 23L27 29Z" fill="#38BDF8" />
        <ellipse cx="40" cy="20" rx="5.5" ry="2.6" fill="#F59E0B" />
      </svg>
    );
  }

  if (shipId === "aegis") {
    return (
      <svg
        viewBox="0 0 60 40"
        className="w-14 h-9 shrink-0"
        fill="none"
        aria-hidden="true"
      >
        {/* Broad Emerald Ion Plume */}
        <path d="M21 14L3 20L21 26Z" fill="#34D399" fillOpacity="0.8" />
        <path d="M20 17L9 20L20 23Z" fill="#A7F3D0" />
        <circle cx="5" cy="17" r="1.4" fill="#6EE7B7" fillOpacity="0.75" />
        <circle cx="7" cy="23" r="1.2" fill="#6EE7B7" fillOpacity="0.75" />
        <path
          d="M52 20L39 7L25 9L19 16V24L25 31L39 33L52 20Z"
          fill="#CBD5E1"
          stroke="#0F172A"
          strokeWidth="1.6"
        />
        <path d="M28 12L41 13L38 17L27 16L28 12Z" fill="#34D399" />
        <path d="M28 28L41 27L38 23L27 24L28 28Z" fill="#34D399" />
        <ellipse cx="37" cy="20" rx="5" ry="3.5" fill="#BAE6FD" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 60 40"
      className="w-14 h-9 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      {/* Amber Ember Jet Trail */}
      <path d="M23 16L3 20L23 24Z" fill="#F59E0B" fillOpacity="0.85" />
      <path d="M22 18L10 20L22 22Z" fill="#FDE68A" />
      <line
        x1="4"
        y1="14"
        x2="18"
        y2="12"
        stroke="#FBBF24"
        strokeWidth="1.2"
        strokeOpacity="0.65"
        strokeLinecap="round"
      />
      <line
        x1="4"
        y1="26"
        x2="18"
        y2="28"
        stroke="#FBBF24"
        strokeWidth="1.2"
        strokeOpacity="0.65"
        strokeLinecap="round"
      />
      <path
        d="M55 20L25 6L29 15L22 17V23L29 25L25 34L55 20Z"
        fill="#E2E8F0"
        stroke="#0F172A"
        strokeWidth="1.5"
      />
      <path d="M28 9L37 15L30 14L28 9Z" fill="#F59E0B" />
      <path d="M28 31L37 25L30 26L28 31Z" fill="#F59E0B" />
      <ellipse cx="39" cy="20" rx="6" ry="3" fill="#38BDF8" />
    </svg>
  );
}
