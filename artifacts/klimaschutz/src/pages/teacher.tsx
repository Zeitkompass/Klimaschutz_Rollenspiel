import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRoom,
  useGetGame,
  useControlRoom,
  getGetRoomQueryKey,
  type RoomView,
  type RoomControlAction,
} from "@workspace/api-client-react";
import { Check, Flag, Home, Play, Repeat, Shuffle, Users, Lock, AlertTriangle } from "lucide-react";
import { BigButton, CenterCard, ErrorNote, Logo, MeterStrip, Skeleton } from "@/components/kit";
import { GroupResult, TakeAway } from "@/components/result";
import { BASE, PHASE_LABEL, ROLE_META, ROUND_ICONS, errorStatus, errorText, usePageTitle } from "@/lib/game";

export default function TeacherPage() {
  const { code = "" } = useParams<{ code: string }>();
  usePageTitle(`Lehrkraft ${code}`);
  const room = useGetRoom(code, { query: { queryKey: getGetRoomQueryKey(code), refetchInterval: 1500, retry: false } });
  const qc = useQueryClient();
  const control = useControlRoom();

  const act = (action: RoomControlAction, r: RoomView) =>
    control.mutate(
      { code, data: { action, passage: r.passage } },
      {
        onSuccess: (data) => {
          qc.setQueryData(getGetRoomQueryKey(code), data);
          qc.invalidateQueries({ queryKey: getGetRoomQueryKey(code) });
        },
      },
    );

  if (room.isLoading)
    return (
      <div className="mx-auto grid max-w-6xl gap-5 p-6">
        <Skeleton className="h-16" />
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );

  if (room.isError || !room.data) {
    const st = errorStatus(room.error);
    return (
      <CenterCard icon={<AlertTriangle className="h-10 w-10" />} title={st === 404 ? "Raum nicht gefunden" : st === 401 || st === 403 ? "Kein Lehrerzugang" : "Keine Verbindung"}>
        <p className="text-muted-foreground">{errorText(room.error)}</p>
        <div className="flex gap-3">
          <BigButton variant="outline" onClick={() => room.refetch()} data-testid="button-retry-room">Nochmal</BigButton>
          <Link href="/" className="inline-flex min-h-14 items-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground" data-testid="link-home">Startseite</Link>
        </div>
      </CenterCard>
    );
  }

  const r = room.data;
  if (r.viewerRole !== "teacher")
    return (
      <CenterCard icon={<Lock className="h-10 w-10" />} title="Nur für die Lehrkraft">
        <Link href={`/spiel/${code}`} className="inline-flex min-h-14 items-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground" data-testid="link-student-view">Zu meinem Spiel</Link>
      </CenterCard>
    );

  const err = control.isError ? errorText(control.error) : "";

  return (
    <div className="min-h-[100dvh] pb-16">
      <header className="sticky top-0 z-20 border-b border-foreground/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
          <Link href="/" data-testid="link-logo"><Logo small /></Link>
          <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold" data-testid="text-passage">Durchgang {r.passage}</span>
          <span className="ml-auto font-display text-2xl font-extrabold tracking-[0.2em]" data-testid="text-room-code">{r.code}</span>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 px-6 pt-6">
        <ErrorNote error={err} />
        {r.status === "lobby" ? <Lobby r={r} onGroup={() => act("group", r)} pending={control.isPending} /> : null}
        {r.status === "grouped" ? <Grouped r={r} onStart={() => act("start", r)} pending={control.isPending} /> : null}
        {r.status === "active" ? <Live r={r} /> : null}
        {r.status === "results" || r.status === "ended" ? (
          <Results r={r} onRotate={() => act("rotate", r)} onEnd={() => act("end", r)} pending={control.isPending} />
        ) : null}
      </main>
    </div>
  );
}

function canGroup(n: number) {
  return n === 3 || n === 4 || n >= 6;
}

function Lobby({ r, onGroup, pending }: { r: RoomView; onGroup: () => void; pending: boolean }) {
  const n = r.players.length;
  const url = `${window.location.origin}${BASE}/beitreten?code=${r.code}`;
  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <div className="rounded-[2rem] bg-primary p-7 text-primary-foreground">
        <div className="text-sm font-bold uppercase tracking-wider opacity-75">Code</div>
        <div className="font-display text-6xl font-extrabold tracking-[0.18em]">{r.code}</div>
        <div className="mt-5 inline-block rounded-2xl bg-card p-4">
          <QRCodeSVG value={url} size={200} fgColor="hsl(200 55% 14%)" bgColor="transparent" data-testid="img-qr" />
        </div>
        <p className="mt-3 max-w-[232px] break-all text-xs opacity-75">{url}</p>
      </div>
      <div className="rounded-[2rem] border-2 border-foreground/10 bg-card p-7">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="font-display text-3xl font-extrabold">Im Raum</h1>
          <span className="ml-auto rounded-full bg-secondary px-4 py-1 font-display text-2xl font-extrabold" data-testid="text-player-count">{n}</span>
        </div>
        {n === 0 ? (
          <div className="mt-8 grid place-items-center gap-2 rounded-2xl border-2 border-dashed border-foreground/15 py-12 text-center text-muted-foreground">
            <Users className="h-10 w-10" />
            <p className="text-lg font-medium">Noch niemand da. QR-Code zeigen.</p>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            <AnimatePresence>
              {r.players.map((p) => (
                <motion.span
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl bg-secondary px-4 py-2.5 text-lg font-bold"
                  data-testid={`text-player-${p.id}`}
                >
                  {p.name}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        )}
        <div className="mt-8 grid gap-3">
          {!canGroup(n) && n > 0 ? (
            <p className="rounded-2xl bg-accent/30 px-4 py-3 font-medium" data-testid="text-group-hint">
              {n === 5 ? "5 passt nicht in volle 3er- oder 4er-Gruppen. Wartet auf eine sechste Person." : "Mindestens 3 Personen."}
            </p>
          ) : null}
          <BigButton onClick={onGroup} disabled={!canGroup(n)} loading={pending} data-testid="button-group">
            <Shuffle className="h-5 w-5" /> Gruppen zufällig bilden
          </BigButton>
        </div>
      </div>
    </div>
  );
}

function PlayerChip({ r, id }: { r: RoomView; id: string }) {
  const p = r.players.find((x) => x.id === id);
  if (!p) return null;
  const meta = p.role ? ROLE_META[p.role] : null;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-background/70 px-3 py-2" data-testid={`row-member-${id}`}>
      {meta ? <meta.icon className="h-5 w-5 shrink-0" style={{ color: meta.tint }} /> : <Users className="h-5 w-5 opacity-40" />}
      <span className="flex-1 truncate font-bold">{p.name}</span>
      <span className="text-sm text-muted-foreground">{meta?.label ?? ""}</span>
      {p.ready ? <Check className="h-4 w-4 text-[hsl(var(--chart-1))]" /> : null}
    </div>
  );
}

function Grouped({ r, onStart, pending }: { r: RoomView; onStart: () => void; pending: boolean }) {
  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="font-display text-4xl font-extrabold">Gruppen &amp; Rollen</h1>
        <div className="ml-auto flex flex-wrap gap-3">
          <BigButton variant="accent" onClick={onStart} loading={pending} data-testid="button-start"><Play className="h-5 w-5" /> Spiel starten</BigButton>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {r.groups.map((g) => (
          <motion.div key={g.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.5rem] bg-secondary p-5" data-testid={`card-group-${g.id}`}>
            <h2 className="mb-3 font-display text-xl font-extrabold">Gruppe {g.number}</h2>
            <div className="grid gap-2">{g.playerIds.map((id) => <PlayerChip key={id} r={r} id={id} />)}</div>
          </motion.div>
        ))}
      </div>
    </>
  );
}

function Live({ r }: { r: RoomView }) {
  const game = useGetGame();
  const done = r.groups.filter((g) => g.phase === "finished").length;
  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="font-display text-4xl font-extrabold">Live</h1>
        <span className="ml-auto rounded-full bg-secondary px-4 py-2 font-bold" data-testid="text-finished-count">{done} / {r.groups.length} fertig</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {r.groups.map((g) => {
          const Icon = ROUND_ICONS[(g.round - 1) % 4] ?? Flag;
          const round = game.data?.rounds.find((x) => x.number === g.round);
          return (
            <motion.div key={g.id} layout className="rounded-[1.5rem] border-2 border-foreground/10 bg-card p-5" data-testid={`card-live-${g.id}`}>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-extrabold">Gruppe {g.number}</h2>
                <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm font-bold">
                  <Icon className="h-4 w-4" /> Runde {Math.min(g.round, 4)}{round ? ` · ${round.title}` : ""}
                </span>
              </div>
              <div className="mt-3 flex gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-1.5 flex-1 rounded-full" style={{ background: n < g.round || g.phase === "finished" ? "hsl(var(--primary))" : n === g.round ? "hsl(var(--accent))" : "hsl(var(--foreground) / .1)" }} />
                ))}
              </div>
              <div className="mt-3 text-sm font-bold text-primary" data-testid={`status-phase-${g.id}`}>{PHASE_LABEL[g.phase]}</div>
              <MeterStrip meters={g.meters} compact className="mt-4" />
              <div className="mt-4 grid gap-1.5 sm:grid-cols-2">{g.playerIds.map((id) => <PlayerChip key={id} r={r} id={id} />)}</div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}

function Results({ r, onRotate, onEnd, pending }: { r: RoomView; onRotate: () => void; onEnd: () => void; pending: boolean }) {
  const ended = r.status === "ended";
  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{ended ? "Spiel beendet" : "Alle Gruppen fertig"}</div>
          <h1 className="font-display text-4xl font-extrabold">Vergleich der Gruppen</h1>
        </div>
        {!ended ? (
          <div className="ml-auto flex flex-wrap gap-3">
            <BigButton variant="accent" onClick={onRotate} disabled={!r.allFinished} loading={pending} data-testid="button-rotate"><Repeat className="h-5 w-5" /> Neue Runde mit Rollenwechsel</BigButton>
            <BigButton variant="outline" onClick={onEnd} disabled={!r.allFinished} loading={pending} data-testid="button-end"><Flag className="h-5 w-5" /> Spiel beenden</BigButton>
          </div>
        ) : (
          <Link href="/" className="ml-auto inline-flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-6 font-bold text-primary-foreground" data-testid="link-home-end"><Home className="h-5 w-5" /> Startseite</Link>
        )}
      </div>
      <p className="text-muted-foreground">Kein Ranking. Vergleicht: Wer hat welche Kosten getragen?</p>
      <div className="grid gap-4 lg:grid-cols-2">{r.groups.map((g) => <GroupResult key={g.id} group={g} />)}</div>
      <TakeAway />
    </>
  );
}
