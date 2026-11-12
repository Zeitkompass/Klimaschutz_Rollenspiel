import { Link } from "wouter";
import { Compass } from "lucide-react";
import { CenterCard } from "@/components/kit";
import { usePageTitle } from "@/lib/game";

export default function NotFound() {
  usePageTitle("Nicht gefunden");
  return (
    <CenterCard icon={<Compass className="h-10 w-10" />} title="Diese Seite gibt es nicht">
      <Link href="/" className="inline-flex min-h-14 items-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground" data-testid="link-home">Zur Startseite</Link>
    </CenterCard>
  );
}
