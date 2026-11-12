import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Hash, User } from "lucide-react";
import { useJoinRoom, getGetRoomQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BigButton, ErrorNote, Logo } from "@/components/kit";
import { errorText, getStudentRoom, rememberStudentRoom, usePageTitle } from "@/lib/game";

export default function JoinPage() {
  usePageTitle("Beitreten");
  const search = useSearch();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const join = useJoinRoom();
  const pre = new URLSearchParams(search).get("code") ?? "";
  const [code, setCode] = useState(pre.toUpperCase());
  const [name, setName] = useState(() => getStudentRoom()?.name ?? "");

  const c = code.trim().toUpperCase();
  const n = name.trim();
  const valid = c.length >= 3 && n.length >= 1 && n.length <= 30;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    join.mutate(
      { code: c, data: { name: n } },
      {
        onSuccess: (room) => {
          rememberStudentRoom(room.code, n);
          qc.setQueryData(getGetRoomQueryKey(room.code), room);
          navigate(`/spiel/${room.code}`);
        },
      },
    );
  };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-6 py-5">
        <Link href="/" className="grid h-12 w-12 place-items-center rounded-2xl hover:bg-foreground/5" data-testid="link-back" aria-label="Zurück">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <Logo small />
        <span className="w-12" />
      </header>
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto mt-6 grid w-full max-w-xl gap-5 px-6"
      >
        <h1 className="font-display text-5xl font-extrabold">Mitspielen</h1>
        <label className="grid gap-2">
          <span className="flex items-center gap-2 font-bold"><Hash className="h-4 w-4" /> Raum-Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
            maxLength={10}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="z. B. K7QF"
            className="h-20 rounded-2xl border-2 border-input bg-card px-5 text-center font-display text-4xl font-extrabold tracking-[0.3em] outline-none focus:border-primary"
            data-testid="input-code"
          />
        </label>
        <label className="grid gap-2">
          <span className="flex items-center gap-2 font-bold"><User className="h-4 w-4" /> Dein Vorname</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            autoComplete="off"
            placeholder="Vorname"
            className="h-16 rounded-2xl border-2 border-input bg-card px-5 text-2xl font-bold outline-none focus:border-primary"
            data-testid="input-name"
          />
        </label>
        <ErrorNote error={join.isError ? errorText(join.error) : ""} />
        <BigButton type="submit" variant="accent" disabled={!valid} loading={join.isPending} className="min-h-16 text-xl" data-testid="button-join">
          Los geht's <ArrowRight className="h-6 w-6" />
        </BigButton>
      </motion.form>
    </div>
  );
}
