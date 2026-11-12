import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import type { Meters } from "@workspace/api-client-react";
import { METERS } from "@/lib/game";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "ghost" | "outline";

export function BigButton({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const styles: Record<Variant, string> = {
    primary: "bg-primary text-primary-foreground shadow-[0_6px_0_hsl(192_72%_14%)] active:shadow-[0_1px_0_hsl(192_72%_14%)] active:translate-y-[5px]",
    accent: "bg-accent text-accent-foreground shadow-[0_6px_0_hsl(40_80%_38%)] active:shadow-[0_1px_0_hsl(40_80%_38%)] active:translate-y-[5px]",
    outline: "bg-card text-foreground border-2 border-foreground/15 active:scale-[0.98]",
    ghost: "bg-transparent text-foreground hover:bg-foreground/5 active:scale-[0.98]",
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-14 select-none items-center justify-center gap-3 rounded-2xl px-6 text-lg font-bold transition-[transform,box-shadow,opacity] duration-100 disabled:pointer-events-none disabled:opacity-45",
        styles[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function ErrorNote({ error, onRetry }: { error: string; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-2xl border-2 border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive"
      data-testid="text-error"
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span className="flex-1 font-medium">{error}</span>
      {onRetry ? (
        <button onClick={onRetry} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 font-bold hover:bg-destructive/10" data-testid="button-retry">
          <RotateCcw className="h-4 w-4" /> Nochmal
        </button>
      ) : null}
    </motion.div>
  );
}

export function Waiting({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-secondary px-5 py-4 text-lg font-medium" data-testid="status-waiting">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="pulse-dot h-2.5 w-2.5 rounded-full bg-primary" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </span>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-foreground/[0.07]", className)} />;
}

function MeterBar({ meterKey, value, compact }: { meterKey: (typeof METERS)[number]["key"]; value: number; compact?: boolean }) {
  const m = METERS.find((x) => x.key === meterKey)!;
  const prev = useRef(value);
  const [delta, setDelta] = useState<number | null>(null);
  useEffect(() => {
    const d = Math.round(value - prev.current);
    prev.current = value;
    if (d !== 0) {
      setDelta(d);
      const t = setTimeout(() => setDelta(null), 2600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [value]);
  const v = Math.max(0, Math.min(100, value));
  const Icon = m.icon;
  return (
    <div className="min-w-0" data-testid={`meter-${m.key}`}>
      <div className="mb-1 flex items-center gap-1.5">
        <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} style={{ color: m.color }} />
        <span className={cn("truncate font-bold", compact ? "text-xs" : "text-sm")}>{m.label}</span>
        <span className="relative ml-auto font-display text-sm font-bold tabular-nums">
          {Math.round(v)}
          <AnimatePresence>
            {delta !== null ? (
              <motion.span
                key={`${delta}-${value}`}
                initial={{ opacity: 0, y: 6, scale: 0.8 }}
                animate={{ opacity: 1, y: -18, scale: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "absolute right-0 top-0 rounded-full px-1.5 text-xs font-bold",
                  delta > 0 ? "bg-[hsl(var(--chart-1))] text-white" : "bg-destructive text-white",
                )}
              >
                {delta > 0 ? `+${delta}` : delta}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </span>
      </div>
      <div className={cn("relative overflow-hidden rounded-full bg-foreground/10", compact ? "h-2" : "h-3")}>
        <motion.div
          className="absolute inset-y-0 left-0 w-full origin-left rounded-full"
          style={{ background: m.color }}
          initial={false}
          animate={{ scaleX: v / 100 }}
          transition={{ type: "spring", stiffness: 140, damping: 18 }}
        />
      </div>
    </div>
  );
}

export function MeterStrip({ meters, compact, className }: { meters: Meters; compact?: boolean; className?: string }) {
  return (
    <div className={cn("grid grid-cols-5 gap-3", compact && "gap-2", className)}>
      {METERS.map((m) => (
        <MeterBar key={m.key} meterKey={m.key} value={meters[m.key]} compact={compact} />
      ))}
    </div>
  );
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" className={small ? "h-8 w-8" : "h-10 w-10"} aria-hidden>
        <circle cx="20" cy="20" r="19" fill="hsl(var(--primary))" />
        <circle cx="27" cy="13" r="5" fill="hsl(var(--accent))" />
        <path d="M4 27 Q12 20 20 25 T36 24 L36 32 Q28 39 20 39 Q9 39 4 27Z" fill="hsl(var(--chart-1))" />
        <path d="M14 26 V14 M14 14 l-5 -3 M14 14 l5 -3 M14 14 v6" stroke="hsl(var(--primary-foreground))" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <div className="leading-none">
        <div className={cn("font-display font-extrabold", small ? "text-base" : "text-xl")}>Klimaschutz</div>
        <div className="text-xs font-medium text-muted-foreground">Das Rollenspiel</div>
      </div>
    </div>
  );
}

export function Scene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 260" className={className} aria-hidden preserveAspectRatio="xMidYMax slice">
      <circle cx="470" cy="80" r="46" fill="hsl(var(--accent))" />
      <circle cx="470" cy="80" r="70" fill="none" stroke="hsl(var(--accent))" strokeOpacity=".35" strokeWidth="2" strokeDasharray="4 8" />
      <g className="drift" opacity=".5">
        {[0, 600].map((o) => (
          <g key={o} transform={`translate(${o} 0)`}>
            <path d="M40 70 q30 -20 60 0 q20 -10 40 4 h-100z" fill="hsl(var(--card))" />
            <path d="M300 50 q30 -20 60 0 q20 -10 40 4 h-100z" fill="hsl(var(--card))" />
          </g>
        ))}
      </g>
      <path d="M0 190 Q120 140 260 175 T600 160 V260 H0Z" fill="hsl(var(--chart-1))" opacity=".85" />
      <path d="M0 220 Q160 185 330 215 T600 205 V260 H0Z" fill="hsl(var(--primary))" />
      {[
        [120, 160],
        [210, 150],
        [360, 165],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 2} y={y - 70} width="4" height="72" rx="2" fill="hsl(var(--card))" />
          <g className="rotor" style={{ animationDuration: `${5 + i}s` }}>
            <circle cx={x} cy={y - 70} r="3" fill="hsl(var(--card))" />
            {[0, 120, 240].map((a) => (
              <rect key={a} x={x - 2} y={y - 108} width="4" height="38" rx="2" fill="hsl(var(--card))" transform={`rotate(${a} ${x} ${y - 70})`} />
            ))}
          </g>
        </g>
      ))}
      <g fill="hsl(var(--foreground))" opacity=".85">
        <rect x="470" y="170" width="44" height="40" />
        <rect x="490" y="135" width="10" height="40" />
        <rect x="520" y="180" width="30" height="30" />
      </g>
      <path d="M495 130 q-8 -14 4 -22 q10 -8 2 -20" fill="none" stroke="hsl(var(--foreground))" strokeOpacity=".25" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function CenterCard({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-3xl bg-secondary text-primary">{icon}</div>
      <h1 className="font-display text-3xl font-extrabold">{title}</h1>
      {children}
    </div>
  );
}
