import { useState, type ReactNode } from "react";
import { useParams, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRoom,
  useGetGame,
  usePlayTurn,
  getGetRoomQueryKey,
  type GameCatalog,
  type GameGroup,
  type Participant,
  type RoomView,
  type TurnInput,
} from "@workspace/api-client-react";
import { AlertTriangle, ArrowRight, Check, Coins, Flag, Info, LogIn, Presentation, Users } from "lucide-react";
import { BigButton, CenterCard, ErrorNote, Logo, MeterStrip, Skeleton, Waiting } from "@/components/kit";
import { GroupResult, TakeAway } from "@/components/result";
import { ROLE_META, ROUND_ICONS, STANCES, errorStatus, errorText, usePageTitle } from "@/lib/game";
import { cn } from "@/lib/utils";

export default function PlayPage() {
  const { code = "" } = useParams<{ code: string }>();
  usePageTitle(`Spiel ${code}`);
  const room = useGetRoom(code, { query: { queryKey: getGetRoomQueryKey(code), refetchInterval: 1500, retry: false } });
  const game = useGetGame();

  if (room.isLoading || game.isLoading)
    return (
      <div className="mx-auto grid max-w-2xl gap-4 p-6">
        <Skeleton className="h-14" />
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    );

  if (room.isError || !room.data) {
    const st = errorStatus(room.error);
    const noAccess = st === 401 || st === 403;
    return (
      <CenterCard icon={<AlertTriangle className="h-10 w-10" />} title={st === 404 ? "Raum nicht gefunden" : noAccess ? "Du bist noch nicht dabei" : "Keine Verbindung"}>
        <p className="text-muted-foreground">{errorText(room.error)}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {!noAccess ? <BigButton variant="outline" onClick={() => room.refetch()} data-testid="button-retry-room">Nochmal</BigButton> : null}
          <Link href={`/beitreten?code=${code}`} className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-6 font-bold text-primary-foreground" data-testid="link-join-again">
            <LogIn className="h-5 w-5" /> Beitreten
          </Link>
        </div>
      </CenterCard>
    );
  }
  if (game.isError || !game.data)
    return (
      <CenterCard icon={<AlertTriangle className="h-10 w-10" />} title="Spielinhalte fehlen">
        <ErrorNote error={errorText(game.error)} onRetry={() => game.refetch()} />
      </CenterCard>
    );

  const r = room.data;
  if (r.viewerRole === "teacher")
    return (
      <CenterCard icon={<Presentation className="h-10 w-10" />} title="Du bist die Lehrkraft">
        <Link href={`/lehrer/${code}`} className="inline-flex min-h-14 items-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground" data-testid="link-teacher">Zur Übersicht</Link>
      </CenterCard>
    );

  const me = r.players.find((p) => p.id === r.playerId);
  if (!me)
    return (
      <CenterCard icon={<LogIn className="h-10 w-10" />} title="Du bist noch nicht dabei">
        <Link href={`/beitreten?code=${code}`} className="inline-flex min-h-14 items-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground" data-testid="link-join">Beitreten</Link>
      </CenterCard>
    );

  return <Game r={r} me={me} game={game.data} />;
}

function Game({ r, me, game }: { r: RoomView; me: Participant; game: GameCatalog }) {
  const group = r.groups.find((g) => g.id === me.groupId) ?? null;
  const role = me.role ? ROLE_META[me.role] : null;
  const showMeters = r.status === "active" && group && group.phase !== "finished";

  return (
    <div className="min-h-[100dvh] pb-16">
      <header className="sticky top-0 z-20 border-b border-foreground/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <Logo small />
          <div className="ml-auto flex items-center gap-2">
            {role ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-white" style={{ background: role.tint }} data-testid="text-my-role">
                <role.icon className="h-4 w-4" /> {role.label}
              </span>
            ) : null}
            <span className="max-w-[9rem] truncate rounded-full bg-secondary px-3 py-1.5 text-sm font-bold" data-testid="text-my-name">{me.name}</span>
          </div>
        </div>
        {showMeters && group ? (
          <div className="mx-auto max-w-3xl px-5 pb-3">
            <MeterStrip meters={group.meters} compact />
            {group.meters.treasury < 20 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-1.5 text-sm font-bold text-destructive" data-testid="text-treasury-warning">
                <Coins className="h-4 w-4" /> Der Staat hat kaum noch Geld für weitere Maßnahmen.
              </motion.div>
            ) : null}
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-3xl px-5 pt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${r.status}-${r.passage}-${group?.round}-${group?.phase}-${me.ready}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="grid gap-5"
          >
            <Stage r={r} me={me} group={group} game={game} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function usePlay(r: RoomView) {
  const qc = useQueryClient();
  const play = usePlayTurn();
  const send = (data: Omit<TurnInput, "passage">) =>
    play.mutate(
      { code: r.code, data: { ...data, passage: r.passage } },
      {
        onSuccess: (room) => {
          qc.setQueryData(getGetRoomQueryKey(r.code), room);
          qc.invalidateQueries({ queryKey: getGetRoomQueryKey(r.code) });
        },
      },
    );
  return { send, pending: play.isPending, error: play.isError ? errorText(play.error) : "" };
}

function Stage({ r, me, group, game }: { r: RoomView; me: Participant; group: GameGroup | null; game: GameCatalog }) {
  if (r.status === "ended" && !group)
    return <Ended />;
  if (r.status === "lobby" || !group)
    return (
      <Hero title={`Hallo ${me.name}!`} icon={<Users className="h-9 w-9" />}>
        <Waiting>Warte auf die Gruppen …</Waiting>
      </Hero>
    );
  if (r.status === "grouped") return <GroupIntro r={r} group={group} />;
  if (r.status === "results" || r.status === "ended" || group.phase === "finished")
    return (
      <>
        <GroupResult group={group} large />
        <TakeAway />
        {r.status === "active" ? <Waiting>Andere Gruppen spielen noch …</Waiting> : null}
        {r.status === "ended" ? <Ended /> : null}
        {r.status === "results" ? <Waiting>Die Lehrkraft entscheidet, wie es weitergeht.</Waiting> : null}
      </>
    );

  switch (group.phase) {
    case "role":
      return <RoleBrief r={r} me={me} group={group} game={game} />;
    case "decision":
      return me.role === "state" ? <Decide r={r} group={group} game={game} /> : (
        <>
          <RoundHead group={group} game={game} />
          <Waiting>Der Staat wählt eine Maßnahme …</Waiting>
        </>
      );
    case "reaction":
      return <ReactionStep r={r} me={me} group={group} game={game} />;
    case "effects":
      return <Effects r={r} me={me} group={group} game={game} />;
    default:
      return null;
  }
}

function Ended() {
  return (
    <CenterCard icon={<Flag className="h-10 w-10" />} title="Spiel beendet">
      <p className="text-muted-foreground">Danke fürs Mitspielen.</p>
      <Link href="/" className="inline-flex min-h-14 items-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground" data-testid="link-home">Startseite</Link>
    </CenterCard>
  );
}

function Hero({ title, icon, children }: { title: string; icon: ReactNode; children?: ReactNode }) {
  return (
    <div className="grid gap-5 pt-6">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent">{icon}</div>
      <h1 className="font-display text-4xl font-extrabold md:text-5xl">{title}</h1>
      {children}
    </div>
  );
}

function GroupIntro({ r, group }: { r: RoomView; group: GameGroup }) {
  return (
    <Hero title={`Gruppe ${group.number}`} icon={<Users className="h-9 w-9" />}>
      <div className="grid gap-2">
        {group.playerIds.map((id) => {
          const p = r.players.find((x) => x.id === id);
          const m = p?.role ? ROLE_META[p.role] : null;
          return p ? (
            <div key={id} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-lg font-bold" data-testid={`row-member-${id}`}>
              {m ? <m.icon className="h-5 w-5" style={{ color: m.tint }} /> : null}
              {p.name}
              <span className="ml-auto text-base font-medium text-muted-foreground">{m?.label}</span>
            </div>
          ) : null;
        })}
      </div>
      <Waiting>Gleich geht's los …</Waiting>
    </Hero>
  );
}

function RoundHead({ group, game }: { group: GameGroup; game: GameCatalog }) {
  const round = game.rounds.find((x) => x.number === group.round);
  const Icon = ROUND_ICONS[(group.round - 1) % 4];
  return (
    <div className="rounded-[2rem] bg-primary p-6 text-primary-foreground">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-foreground"><Icon className="h-6 w-6" /></div>
        <div>
          <div className="text-sm font-bold opacity-75">Runde {group.round} von 4</div>
          <h1 className="font-display text-3xl font-extrabold" data-testid="text-round-title">{round?.title}</h1>
        </div>
      </div>
      {round ? <p className="mt-4 text-lg opacity-90">{round.problem}</p> : null}
    </div>
  );
}

function RoleBrief({ r, me, group, game }: { r: RoomView; me: Participant; group: GameGroup; game: GameCatalog }) {
  const { send, pending, error } = usePlay(r);
  const info = game.roles.find((x) => x.id === me.role);
  const m = me.role ? ROLE_META[me.role] : null;
  const members = group.playerIds.map((id) => r.players.find((p) => p.id === id)).filter(Boolean) as Participant[];
  return (
    <>
      <div className="rounded-[2rem] p-7 text-white" style={{ background: m?.tint }}>
        {m ? <m.icon className="h-14 w-14" /> : null}
        <div className="mt-4 text-sm font-bold uppercase tracking-wider opacity-85">Deine Rolle</div>
        <h1 className="font-display text-5xl font-extrabold" data-testid="text-role-title">{info?.title ?? m?.label}</h1>
        {info ? <p className="mt-3 text-xl font-medium">{info.description}</p> : null}
        {me.perspective ? <p className="mt-3 text-lg opacity-90" data-testid="text-perspective">{me.perspective}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {members.map((p) => (
          <span key={p.id} className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-bold", p.ready ? "bg-[hsl(var(--chart-1))] text-white" : "bg-secondary")}>
            {p.ready ? <Check className="h-4 w-4" /> : null}
            {p.name}
          </span>
        ))}
      </div>
      <ErrorNote error={error} />
      {me.ready ? (
        <Waiting>Warte auf deine Gruppe …</Waiting>
      ) : (
        <BigButton variant="accent" className="min-h-16 text-xl" loading={pending} onClick={() => send({ action: "ready", round: group.round })} data-testid="button-ready">
          <Check className="h-6 w-6" /> Bereit
        </BigButton>
      )}
    </>
  );
}

function Decide({ r, group, game }: { r: RoomView; group: GameGroup; game: GameCatalog }) {
  const { send, pending, error } = usePlay(r);
  const [pick, setPick] = useState<string | null>(null);
  const round = game.rounds.find((x) => x.number === group.round);
  return (
    <>
      <RoundHead group={group} game={game} />
      <h2 className="font-display text-2xl font-extrabold">Wähle eine Maßnahme</h2>
      <div className="grid gap-3">
        {round?.measures.map((m) => {
          const on = pick === m.id;
          return (
            <motion.button
              key={m.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setPick(m.id)}
              className={cn("rounded-[1.5rem] border-[3px] bg-card p-5 text-left transition-colors", on ? "border-primary" : "border-transparent")}
              data-testid={`button-measure-${m.id}`}
            >
              <div className="flex items-start gap-3">
                <div className={cn("mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2", on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25")}>
                  {on ? <Check className="h-4 w-4" /> : null}
                </div>
                <div>
                  <div className="font-display text-xl font-extrabold">{m.title}</div>
                  <p className="mt-1 text-base text-muted-foreground">{m.description}</p>
                  {m.warning ? (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-destructive"><AlertTriangle className="h-4 w-4" /> {m.warning}</p>
                  ) : null}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
      <ErrorNote error={error} />
      <BigButton className="sticky bottom-4 min-h-16 text-xl" disabled={!pick} loading={pending} onClick={() => pick && send({ action: "decide", round: group.round, measureId: pick })} data-testid="button-decide">
        Entscheiden <ArrowRight className="h-6 w-6" />
      </BigButton>
    </>
  );
}

function MeasureCard({ group, game }: { group: GameGroup; game: GameCatalog }) {
  const measure = game.rounds.find((x) => x.number === group.round)?.measures.find((m) => m.id === group.measureId);
  if (!measure) return null;
  return (
    <div className="rounded-[1.5rem] border-[3px] border-primary bg-card p-5">
      <div className="text-sm font-bold uppercase tracking-wider text-primary">Der Staat hat gewählt</div>
      <div className="mt-1 font-display text-2xl font-extrabold" data-testid="text-chosen-measure">{measure.title}</div>
      <p className="mt-1 text-muted-foreground">{measure.description}</p>
    </div>
  );
}

function ReactionStep({ r, me, group, game }: { r: RoomView; me: Participant; group: GameGroup; game: GameCatalog }) {
  const { send, pending, error } = usePlay(r);
  const [stance, setStance] = useState<(typeof STANCES)[number]["id"] | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const done = group.reactions.some((x) => x.playerId === me.id);
  const reacting = group.playerIds.filter((id) => r.players.find((p) => p.id === id)?.role !== "state");
  const count = `${group.reactions.length} / ${reacting.length}`;

  if (me.role === "state" || done)
    return (
      <>
        <RoundHead group={group} game={game} />
        <MeasureCard group={group} game={game} />
        <Waiting>Reaktionen kommen … {count}</Waiting>
      </>
    );

  const reasons = me.role === "business" ? game.businessReasons : game.citizenReasons;
  return (
    <>
      <MeasureCard group={group} game={game} />
      <h2 className="font-display text-2xl font-extrabold">Deine Meinung?</h2>
      <div className="grid grid-cols-3 gap-3">
        {STANCES.map((s) => {
          const on = stance === s.id;
          return (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStance(s.id)}
              className={cn("flex min-h-28 flex-col items-center justify-center gap-2 rounded-[1.5rem] border-[3px] font-bold transition-colors", on ? "text-white" : "border-transparent bg-card")}
              style={on ? { background: s.tint, borderColor: s.tint } : undefined}
              data-testid={`button-stance-${s.id}`}
            >
              <s.icon className="h-8 w-8" style={on ? undefined : { color: s.tint }} />
              <span className="text-base md:text-lg">{s.label}</span>
            </motion.button>
          );
        })}
      </div>
      <h2 className="font-display text-2xl font-extrabold">Warum?</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {reasons.map((x, i) => (
          <button
            key={x}
            onClick={() => setReason(x)}
            className={cn("min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-lg font-medium transition-colors active:scale-[0.98]", reason === x ? "border-primary bg-primary text-primary-foreground" : "border-foreground/10 bg-card")}
            data-testid={`button-reason-${i}`}
          >
            {x}
          </button>
        ))}
      </div>
      <ErrorNote error={error} />
      <BigButton
        variant="accent"
        className="sticky bottom-4 min-h-16 text-xl"
        disabled={!stance || !reason}
        loading={pending}
        onClick={() => stance && reason && send({ action: "react", round: group.round, stance, reason })}
        data-testid="button-react"
      >
        Abschicken <ArrowRight className="h-6 w-6" />
      </BigButton>
    </>
  );
}

function Effects({ r, me, group, game }: { r: RoomView; me: Participant; group: GameGroup; game: GameCatalog }) {
  const { send, pending, error } = usePlay(r);
  const last = group.history.find((h) => h.round === group.round) ?? group.history[group.history.length - 1];
  const measure = game.rounds.find((x) => x.number === group.round)?.measures.find((m) => m.id === (last?.measureId ?? group.measureId));
  const tally = STANCES.map((s) => ({ ...s, n: (last?.reactions ?? group.reactions).filter((x) => x.stance === s.id).length }));
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent"><Info className="h-6 w-6" /></div>
        <div>
          <div className="text-sm font-bold text-muted-foreground">Runde {group.round} · Folgen</div>
          <h1 className="font-display text-3xl font-extrabold">{measure?.title ?? "Das ist passiert"}</h1>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {tally.map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3">
            <t.icon className="h-5 w-5" style={{ color: t.tint }} />
            <span className="font-display text-2xl font-extrabold">{t.n}</span>
            <span className="hidden text-sm text-muted-foreground sm:inline">{t.label}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-3">
        {(last?.explanations ?? []).slice(0, 3).map((e, i) => (
          <motion.div
            key={e}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.12 }}
            className="flex gap-3 rounded-2xl bg-card p-4 text-lg"
            data-testid={`text-explanation-${i}`}
          >
            <span className="font-display text-xl font-extrabold text-primary">{i + 1}</span>
            {e}
          </motion.div>
        ))}
      </div>
      <ErrorNote error={error} />
      {me.role === "state" ? (
        <BigButton className="min-h-16 text-xl" loading={pending} onClick={() => send({ action: "next", round: group.round })} data-testid="button-next">
          {group.round >= 4 ? "Zum Ergebnis" : "Nächste Runde"} <ArrowRight className="h-6 w-6" />
        </BigButton>
      ) : (
        <Waiting>Der Staat geht gleich weiter …</Waiting>
      )}
    </>
  );
}
