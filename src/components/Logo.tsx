export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="7"
        y="4"
        width="22"
        height="28"
        rx="3"
        stroke="var(--color-accent)"
        strokeWidth="2.4"
      />
      <path
        d="M12 12h12M12 17h12M12 22h7"
        stroke="var(--color-accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
