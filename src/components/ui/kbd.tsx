export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded border border-hairline-strong bg-surface-raised px-1 py-0.5 font-mono text-[10px] text-ink-dim">
      {children}
    </kbd>
  );
}
