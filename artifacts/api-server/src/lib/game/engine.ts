import { randomInt, randomUUID } from "node:crypto";
import type { GameGroup, Participant, Role, RoomView, TurnInput, RoomControl } from "@workspace/api-zod";
import { INITIAL_METERS, catalog, impacts } from "./catalog";

export class GameError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type PrivatePlayer = Participant & { credentialHash: string };
export type PrivateGroup = GameGroup & { jobsPenalty: number; unpopularPenalty: number };
export type RoomState = {
  code: string;
  teacherHash: string;
  status: RoomView["status"];
  passage: number;
  players: PrivatePlayer[];
  groups: PrivateGroup[];
  createdAt: string;
};

const ensure: (condition: unknown, message: string, status?: number) => asserts condition =
  (condition, message, status = 409) => { if (!condition) throw new GameError(status, message); };
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
export const allFinished = (room: RoomState) =>
  room.groups.length > 0 && room.groups.every((g) => g.phase === "finished");

export function publicRoom(room: RoomState, identity: { teacher: boolean; playerId: string | null }): RoomView {
  const groupId = room.players.find((p) => p.id === identity.playerId)?.groupId;
  // Students cannot inspect another group's decisions, results, or reactions.
  return {
    code: room.code, status: room.status, passage: room.passage,
    players: room.players
      .filter((p) => identity.teacher || p.id === identity.playerId || (!!groupId && p.groupId === groupId))
      .map(({ credentialHash: _hash, ...player }) => player),
    groups: room.groups
      .filter((g) => identity.teacher || g.id === groupId)
      .map(({ jobsPenalty: _jobs, unpopularPenalty: _unpopular, ...group }) => group),
    viewerRole: identity.teacher ? "teacher" : "student",
    playerId: identity.playerId,
    allFinished: allFinished(room), createdAt: room.createdAt,
  };
}

function shuffled<T>(input: T[]): T[] {
  const output = [...input];
  for (let i = output.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [output[i], output[j]] = [output[j]!, output[i]!];
  }
  return output;
}

function resetGroup(group: PrivateGroup) {
  group.round = 1;
  group.phase = "role";
  group.meters = { ...INITIAL_METERS };
  group.measureId = null;
  group.reactions = [];
  group.history = [];
  group.summary = "";
  group.climateReached = false;
  group.jobsPenalty = 0;
  group.unpopularPenalty = 0;
}

function assignRoles(room: RoomState, group: PrivateGroup) {
  const slots: Role[] = group.playerIds.length === 4
    ? ["state", "business", "citizen", "citizen"]
    : ["state", "business", "citizen"];
  let citizenIndex = 0;
  group.playerIds.forEach((id, index) => {
    const player = room.players.find((p) => p.id === id)!;
    // Over a 3/4-passage cycle everyone visits every slot. For four people,
    // one citizen must remain citizen each change; all others change roles.
    player.role = slots[(index + room.passage - 1) % slots.length]!;
    player.groupId = group.id;
    player.ready = false;
    player.perspective = "";
    if (player.role === "citizen" && slots.length === 4) {
      player.perspective = citizenIndex++ === 0
        ? "Du arbeitest in einer Fabrik. Dein Arbeitsplatz ist dir besonders wichtig."
        : "Du möchtest mehr Klimaschutz, willst dir dein Leben aber weiterhin leisten können.";
    }
  });
}

export function control(room: RoomState, input: RoomControl) {
  ensure(input.passage === room.passage, "Der Durchgang hat sich geändert. Bitte lade den Spielstand neu.");
  switch (input.action) {
    case "group": {
      ensure(room.status === "lobby", "Die Gruppen wurden bereits gebildet.");
      const count = room.players.length;
      ensure(count >= 3, "Mindestens drei Personen müssen beitreten.");
      ensure(count !== 5, "Mit fünf Personen fehlt eine vollständige Gruppe. Bitte wartet auf eine sechste Person.");
      ensure(count <= 120, "Es können höchstens 120 Personen mitspielen.");
      // Every integer >=6 is representable by groups of three and four.
      let fours = 0;
      while ((count - fours * 4) % 3 !== 0) fours++;
      const sizes = [...Array((count - fours * 4) / 3).fill(3), ...Array(fours).fill(4)] as number[];
      const members = shuffled(room.players);
      let cursor = 0;
      room.groups = sizes.map((size, i) => {
        const group: PrivateGroup = {
          id: randomUUID(), number: i + 1,
          playerIds: members.slice(cursor, cursor + size).map((p) => p.id),
          round: 1, phase: "role", meters: { ...INITIAL_METERS }, measureId: null,
          reactions: [], history: [], summary: "", climateReached: false,
          jobsPenalty: 0, unpopularPenalty: 0,
        };
        cursor += size;
        assignRoles(room, group);
        return group;
      });
      room.status = "grouped";
      break;
    }
    case "start":
      ensure(room.status === "grouped", "Bilde zuerst die Gruppen.");
      room.status = "active";
      break;
    case "rotate":
      ensure(room.status === "results" && allFinished(room), "Wartet, bis alle Gruppen Runde 4 beendet haben.");
      room.passage++;
      for (const group of room.groups) {
        resetGroup(group);
        assignRoles(room, group);
      }
      room.status = "active";
      break;
    case "end":
      ensure(room.status === "results" && allFinished(room), "Wartet, bis alle Gruppen Runde 4 beendet haben.");
      room.status = "ended";
      break;
  }
}

function resolveEffects(room: RoomState, group: PrivateGroup) {
  const change = impacts[group.measureId!]!;
  const citizens = room.players.filter((p) => p.groupId === group.id && p.role === "citizen");
  const citizenReactions = group.reactions.filter((r) => citizens.some((p) => p.id === r.playerId));
  const sentiment = (stance: string) => stance === "support" ? 2 : stance === "oppose" ? -3 : 0;
  const publicMood = citizenReactions.reduce((sum, r) => sum + sentiment(r.stance), 0) / citizens.length;
  const business = group.reactions.find((r) => room.players.find((p) => p.id === r.playerId)?.role === "business")!;
  const companyMood = sentiment(business.stance);
  const rawTreasury = group.meters.treasury + change.delta.treasury;
  const overspend = rawTreasury < 0 ? Math.min(20, Math.abs(rawTreasury)) : 0;
  group.meters = {
    climate: clamp(group.meters.climate + change.delta.climate),
    population: clamp(group.meters.population + change.delta.population + publicMood - overspend / 2),
    economy: clamp(group.meters.economy + change.delta.economy + companyMood - overspend / 2),
    treasury: clamp(rawTreasury),
    reelection: 0,
  };
  group.jobsPenalty += change.jobs;
  group.unpopularPenalty = Math.round(group.unpopularPenalty * 0.6 + change.unpopular + (publicMood < 0 ? 2 : 0));
  group.meters.reelection = clamp(
    group.meters.population * 0.65 + group.meters.economy * 0.35
    - group.jobsPenalty - group.unpopularPenalty
    - (group.meters.treasury < 20 ? 8 : 0) - (overspend > 0 ? 8 : 0),
  );
  const explanations = [...change.explanations];
  if (overspend > 0) {
    explanations[2] = "Die Staatskasse reicht nicht aus. Das belastet Wirtschaft und Wiederwahl zusätzlich.";
  } else if (publicMood < 0 && companyMood < 0) {
    explanations[2] = "Die Ablehnung belastet Bevölkerung, Wirtschaft und Wiederwahl zusätzlich.";
  } else if (publicMood < 0) {
    explanations[2] = "Die Ablehnung der Bürger senkt die Zufriedenheit und die Wiederwahl zusätzlich.";
  } else if (companyMood < 0) {
    explanations[2] = "Die Ablehnung der Unternehmen belastet die Wirtschaft zusätzlich.";
  }
  group.history.push({
    round: group.round, measureId: group.measureId!, reactions: structuredClone(group.reactions),
    meters: { ...group.meters }, explanations,
  });
  group.phase = "effects";
}

function finishGroup(room: RoomState, group: PrivateGroup) {
  group.phase = "finished";
  group.climateReached = group.meters.climate >= catalog.climateTarget;
  const { population, economy, treasury } = group.meters;
  const costs = [
    treasury < 25 ? "Dafür habt ihr sehr viel Staatsgeld ausgegeben." : "",
    population < 50 ? "Viele Menschen sind unzufrieden." : "",
    economy < 45 ? "Unternehmen und Arbeitsplätze stehen unter Druck." : "",
  ].filter(Boolean);
  group.summary = group.climateReached
    ? `Ihr habt das Klimaziel erreicht. ${costs.slice(0, 2).join(" ") || "Klimaschutz hat Geld gekostet und Veränderungen verlangt."}`
    : `Das Klimaziel wurde ${group.meters.climate >= 85 ? "knapp " : ""}verfehlt. ${
      population >= 60 && economy >= 60
        ? "Die Wirtschaft läuft und die Menschen sind zufrieden. Für das Klima braucht es mehr Veränderungen."
        : costs[0] || "Die Maßnahmen haben noch nicht genug CO₂ eingespart."
    }`;
  if (allFinished(room)) room.status = "results";
}

export function play(room: RoomState, playerId: string, input: TurnInput) {
  ensure(room.status === "active", "Das Spiel ist gerade nicht aktiv.");
  const player = room.players.find((p) => p.id === playerId);
  ensure(player, "Dein Zugang wurde nicht gefunden.", 403);
  const group = room.groups.find((g) => g.id === player.groupId);
  ensure(group, "Deine Gruppe wurde noch nicht gebildet.");
  ensure(input.passage === room.passage && input.round === group.round,
    "Die Runde hat sich geändert. Bitte lade den Spielstand neu.");
  switch (input.action) {
    case "ready":
      ensure(group.phase === "role", "Die Rolle wurde bereits bestätigt.");
      player.ready = true;
      if (group.playerIds.every((id) => room.players.find((p) => p.id === id)!.ready)) {
        group.phase = "decision";
      }
      break;
    case "decide":
      ensure(player.role === "state", "Nur der Staat entscheidet über Maßnahmen.", 403);
      ensure(group.phase === "decision", "Die Maßnahme wurde bereits gewählt.");
      ensure(catalog.rounds[group.round - 1]?.measures.some((m) => m.id === input.measureId), "Wähle eine gültige Maßnahme.", 400);
      group.measureId = input.measureId!;
      group.phase = "reaction";
      break;
    case "react": {
      ensure(player.role === "citizen" || player.role === "business", "Der Staat kann keine Reaktion abgeben.", 403);
      ensure(group.phase === "reaction", "Die Reaktionsphase ist bereits beendet.");
      ensure(!group.reactions.some((r) => r.playerId === player.id), "Deine Reaktion wurde bereits gespeichert.");
      ensure(input.stance && ["support", "accept", "oppose"].includes(input.stance), "Wähle eine Reaktion.", 400);
      const reasons = player.role === "citizen" ? catalog.citizenReasons : catalog.businessReasons;
      ensure(input.reason && reasons.includes(input.reason), "Wähle einen der kurzen Gründe.", 400);
      group.reactions.push({ playerId: player.id, stance: input.stance, reason: input.reason });
      if (group.reactions.length === group.playerIds.length - 1) resolveEffects(room, group);
      break;
    }
    case "next":
      ensure(player.role === "state", "Nur der Staat startet die nächste Runde.", 403);
      ensure(group.phase === "effects", "Die Folgen müssen zuerst ausgewertet werden.");
      if (group.round === 4) {
        finishGroup(room, group);
      } else {
        group.round++;
        group.phase = "decision";
        group.measureId = null;
        group.reactions = [];
      }
      break;
  }
}
