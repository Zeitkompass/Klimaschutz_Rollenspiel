import { motion } from "framer-motion";
import { CheckCircle2, CircleDashed } from "lucide-react";
import type { GameGroup } from "@workspace/api-client-react";
import { MeterStrip } from "@/components/kit";
import { cn } from "@/lib/utils";

export function GroupResult({ group, large }: { group: GameGroup; large?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[2rem] border-2 border-foreground/10 bg-card p-6"
      data-testid={`card-result-${group.id}`}
    >
      <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Gruppe {group.number}</div>
      <h2 className={cn("mt-1 font-display font-extrabold", large ? "text-3xl" : "text-xl")}>Habt ihr das Klimaziel erreicht?</h2>
      <div
        className={cn(
          "mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-lg font-bold",
          group.climateReached ? "bg-[hsl(var(--chart-1))] text-white" : "bg-accent text-accent-foreground",
        )}
        data-testid={`status-climate-${group.id}`}
      >
        {group.climateReached ? <CheckCircle2 className="h-5 w-5" /> : <CircleDashed className="h-5 w-5" />}
        {group.climateReached ? "Ja, Ziel erreicht" : "Noch nicht erreicht"}
      </div>
      <MeterStrip meters={group.meters} compact={!large} className="mt-5" />
      {group.summary ? <p className={cn("mt-5", large ? "text-lg" : "text-base")} data-testid={`text-summary-${group.id}`}>{group.summary}</p> : null}
    </motion.div>
  );
}

export function TakeAway() {
  return (
    <div className="rounded-[2rem] bg-primary p-6 text-primary-foreground">
      <p className="font-display text-2xl font-extrabold leading-tight md:text-3xl">Klimaschutz hat Folgen. Politik muss entscheiden, wer die Kosten trägt.</p>
    </div>
  );
}
