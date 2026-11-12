import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, BookOpen, Presentation, Smartphone, RotateCcw, X } from "lucide-react";
import { useCreateRoom } from "@workspace/api-client-react";
import { BigButton, ErrorNote, Logo, Scene } from "@/components/kit";
import { errorText, getStudentRoom, getTeacherRooms, rememberTeacherRoom, usePageTitle, ROLE_META } from "@/lib/game";

export default function HomePage() {
  usePageTitle("");
  const [, navigate] = useLocation();
  const create = useCreateRoom();
  const [howTo, setHowTo] = useState(false);
  const [teacherRooms] = useState(getTeacherRooms);
  const [student] = useState(getStudentRoom);

  const onCreate = () =>
    create.mutate(undefined, {
      onSuccess: (room) => {
        rememberTeacherRoom(room.code);
        navigate(`/lehrer/${room.code}`);
      },
    });

  return (
    <div className="min-h-[100dvh]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <button
          onClick={() => setHowTo(true)}
          className="inline-flex min-h-12 items-center gap-2 rounded-2xl px-4 font-bold hover:bg-foreground/5"
          data-testid="button-howto"
        >
          <BookOpen className="h-5 w-5" /> So geht's
        </button>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-bold">Im Spiel: klimaneutral bis 2050</span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[0.95] md:text-7xl">
            Wer zahlt
            <br />
            für das <span className="text-primary underline decoration-accent decoration-8 underline-offset-8">Klima</span>?
          </h1>
          <p className="mt-6 max-w-md text-xl text-muted-foreground">Vier Runden. Drei Rollen. Jede Entscheidung hat Folgen.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {Object.entries(ROLE_META).map(([id, r]) => (
              <span key={id} className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 font-bold shadow-sm">
                <r.icon className="h-4 w-4" style={{ color: r.tint }} /> {r.label}
              </span>
            ))}
          </div>
          <div className="relative mt-8 overflow-hidden rounded-[2rem] bg-[hsl(200_60%_88%)]">
            <Scene className="h-48 w-full md:h-60" />
          </div>
        </motion.section>

        <section className="grid gap-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[2rem] bg-primary p-7 text-primary-foreground"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
                <Smartphone className="h-7 w-7" />
              </div>
              <div>
                <div className="text-sm font-medium opacity-75">Schülerinnen und Schüler</div>
                <h2 className="font-display text-3xl font-extrabold">Mitspielen</h2>
              </div>
            </div>
            <Link
              href="/beitreten"
              className="mt-6 flex min-h-16 items-center justify-between rounded-2xl bg-accent px-6 text-xl font-bold text-accent-foreground shadow-[0_6px_0_hsl(40_80%_38%)] transition-transform active:translate-y-1"
              data-testid="link-join"
            >
              Code eingeben <ArrowRight className="h-6 w-6" />
            </Link>
            {student ? (
              <Link
                href={`/spiel/${student.code}`}
                className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl px-2 font-bold opacity-90 hover:opacity-100"
                data-testid="link-resume-student"
              >
                <RotateCcw className="h-4 w-4" /> Weiter als {student.name} · {student.code}
              </Link>
            ) : null}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-[2rem] border-2 border-foreground/10 bg-card p-7"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary">
                <Presentation className="h-7 w-7" />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Lehrkraft</div>
                <h2 className="font-display text-3xl font-extrabold">Raum öffnen</h2>
              </div>
            </div>
            <BigButton className="mt-6 w-full" onClick={onCreate} loading={create.isPending} data-testid="button-create-room">
              Neuen Raum erstellen
            </BigButton>
            <div className="mt-3">
              <ErrorNote error={create.isError ? errorText(create.error) : ""} />
            </div>
            {teacherRooms.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {teacherRooms.map((c) => (
                  <Link
                    key={c}
                    href={`/lehrer/${c}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-secondary px-4 font-bold"
                    data-testid={`link-resume-teacher-${c}`}
                  >
                    <RotateCcw className="h-4 w-4" /> Raum {c}
                  </Link>
                ))}
              </div>
            ) : null}
          </motion.div>
        </section>
      </main>

      <AnimatePresence>{howTo ? <HowTo onClose={() => setHowTo(false)} /> : null}</AnimatePresence>
    </div>
  );
}

function HowTo({ onClose }: { onClose: () => void }) {
  const steps = [
    "Lehrkraft öffnet einen Raum.",
    "Ihr tretet mit Code und Namen bei.",
    "Jede Gruppe bekommt Rollen.",
    "Der Staat wählt eine Maßnahme.",
    "Alle anderen reagieren.",
    "Ihr seht die Folgen. Vier Runden.",
  ];
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-4 sm:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        exit={{ y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[2rem] bg-card p-7"
        data-testid="sheet-howto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl font-extrabold">So geht's</h2>
          <button onClick={onClose} className="grid h-12 w-12 place-items-center rounded-2xl hover:bg-foreground/5" data-testid="button-close-howto" aria-label="Schließen">
            <X className="h-6 w-6" />
          </button>
        </div>
        <ol className="mt-5 grid gap-3">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-4 text-lg">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent font-display font-bold">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </motion.div>
    </motion.div>
  );
}
