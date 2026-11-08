const styles: Record<string, string> = {
  success: "bg-accent-soft text-accent-soft-text",
  warn: "bg-warn-soft text-warn-soft-text",
  neutral: "bg-[#EEF1F4] text-[#374151]",
  sat: "bg-sat-soft text-sat-soft-text",
};

export function Badge({
  children,
  variant = "neutral",
}: {
  children: React.ReactNode;
  variant?: keyof typeof styles;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${styles[variant]}`}
    >
      {children}
    </span>
  );
}
