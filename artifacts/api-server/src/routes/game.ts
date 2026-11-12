import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, climateRoomsTable } from "@workspace/db";
import {
  GetGameResponse, GetRoomParams, GetRoomResponse,
  JoinRoomBody, ControlRoomBody, PlayTurnBody, RemoveParticipantParams,
} from "@workspace/api-zod";
import { catalog } from "../lib/game/catalog";
import {
  GameError, control, play, publicRoom, removeParticipant,
  type RoomState,
} from "../lib/game/engine";

const router: IRouter = Router();
const SESSION_MS = 24 * 60 * 60 * 1000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const credential = () => randomBytes(32).toString("hex");
const cookieName = (code: string) => `climate_${code}`;
const visits = new Map<string, { count: number; until: number }>();

function limit(req: Request, key: string, max: number, window: number) {
  const now = Date.now();
  const id = `${key}:${req.ip}`;
  let hit = visits.get(id);
  if (!hit || hit.until <= now) {
    hit = { count: 0, until: now + window };
    visits.set(id, hit);
  }
  if (++hit.count > max) throw new GameError(429, "Zu viele Versuche. Bitte warte einen Moment.");
  if (visits.size > 1000) {
    for (const [k, v] of visits) if (v.until < now) visits.delete(k);
  }
}

function saveAccess(req: Request, res: Response, code: string, token: string) {
  const secure = req.secure || req.get("x-forwarded-proto")?.split(",")[0] === "https";
  res.cookie(cookieName(code), token, {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    maxAge: SESSION_MS,
    path: "/api",
  });
}

function identify(req: Request, room: RoomState) {
  const token = req.cookies?.[cookieName(room.code)];
  if (typeof token !== "string") throw new GameError(401, "Bitte tritt dem Raum zuerst mit deinem Namen bei.");
  const tokenHash = hash(token);
  if (tokenHash === room.teacherHash) return { teacher: true, playerId: null };
  const player = room.players.find((p) => p.credentialHash === tokenHash);
  if (!player) throw new GameError(403, "Du bist nicht mehr in diesem Raum. Du kannst erneut mit deinem Namen beitreten.");
  return { teacher: false, playerId: player.id };
}

function roomCode(req: Request) {
  const raw = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const normalized = (raw ?? "").toUpperCase().replace(/\s/g, "");
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(normalized)) throw new GameError(400, "Der Raumcode besteht aus sechs Buchstaben oder Zahlen.");
  return GetRoomParams.parse({ code: normalized }).code;
}
function ensureRoom(state: unknown): RoomState {
  if (!state) throw new GameError(404, "Dieser Raum wurde nicht gefunden. Prüfe den Raumcode.");
  const room = state as RoomState;
  if (Date.now() - new Date(room.createdAt).getTime() > SESSION_MS) {
    throw new GameError(410, "Dieser Spielraum ist abgelaufen. Bitte eröffnet einen neuen Raum.");
  }
  return room;
}

router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/game", (_req, res): void => {
  res.json(GetGameResponse.parse(catalog));
});

router.post("/rooms", async (req, res): Promise<void> => {
  limit(req, "create", 12, 60 * 60 * 1000);
  const token = credential();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
    const room: RoomState = {
      code, teacherHash: hash(token), status: "lobby", passage: 1,
      players: [], groups: [], createdAt: new Date().toISOString(),
    };
    const inserted = await db.insert(climateRoomsTable)
      .values({ code, state: room }).onConflictDoNothing().returning({ code: climateRoomsTable.code });
    if (!inserted.length) continue;
    saveAccess(req, res, code, token);
    res.status(201).json(GetRoomResponse.parse(publicRoom(room, { teacher: true, playerId: null })));
    return;
  }
  throw new GameError(503, "Der Raum konnte gerade nicht eröffnet werden. Bitte versuche es noch einmal.");
});

router.get("/rooms/:code", async (req, res): Promise<void> => {
  const code = roomCode(req);
  const [row] = await db.select({ state: climateRoomsTable.state }).from(climateRoomsTable)
    .where(eq(climateRoomsTable.code, code));
  const room = ensureRoom(row?.state);
  const identity = identify(req, room);
  res.json(GetRoomResponse.parse(publicRoom(room, identity)));
});

router.post("/rooms/:code/join", async (req, res): Promise<void> => {
  const code = roomCode(req);
  limit(req, "join", 150, 5 * 60 * 1000);
  const input = JoinRoomBody.parse(req.body);
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new GameError(400, "Bitte gib deinen Namen ein.");
  let newToken: string | undefined;
  const view = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(climateRoomsTable)
      .where(eq(climateRoomsTable.code, code)).for("update");
    const room = ensureRoom(row?.state);
    // Retrying a join from the same browser must not duplicate the student.
    const oldToken = req.cookies?.[cookieName(code)];
    if (typeof oldToken === "string") {
      const existing = room.players.find((p) => p.credentialHash === hash(oldToken));
      if (existing) return publicRoom(room, { teacher: false, playerId: existing.id });
      if (hash(oldToken) === room.teacherHash) {
        throw new GameError(409, "Du bist in diesem Browser die Lehrkraft. Öffne die Schüleransicht auf einem anderen Gerät oder in einem privaten Fenster.");
      }
    }
    if (room.status !== "lobby") throw new GameError(409, "Das Spiel hat schon begonnen. Ein späterer Beitritt ist nicht möglich.");
    if (room.players.length >= 120) throw new GameError(409, "Der Spielraum ist voll.");
    if (room.players.some((p) => p.name.toLocaleLowerCase("de") === name.toLocaleLowerCase("de"))) {
      throw new GameError(409, "Dieser Name ist schon dabei. Ergänze zum Beispiel den ersten Buchstaben deines Nachnamens.");
    }
    newToken = credential();
    const player = {
      id: randomUUID(), name, role: null, groupId: null, ready: false, perspective: "",
      credentialHash: hash(newToken),
    };
    room.players.push(player);
    await tx.update(climateRoomsTable).set({ state: room, updatedAt: new Date() })
      .where(eq(climateRoomsTable.code, code));
    return publicRoom(room, { teacher: false, playerId: player.id });
  });
  if (newToken) saveAccess(req, res, code, newToken);
  res.json(GetRoomResponse.parse(view));
});

router.post("/rooms/:code/control", async (req, res): Promise<void> => {
  const code = roomCode(req);
  const input = ControlRoomBody.parse(req.body);
  const view = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(climateRoomsTable)
      .where(eq(climateRoomsTable.code, code)).for("update");
    const room = ensureRoom(row?.state);
    const identity = identify(req, room);
    if (!identity.teacher) throw new GameError(403, "Nur die Lehrkraft kann das Spiel steuern.");
    control(room, input);
    await tx.update(climateRoomsTable).set({ state: room, updatedAt: new Date() })
      .where(eq(climateRoomsTable.code, code));
    return publicRoom(room, identity);
  });
  res.json(GetRoomResponse.parse(view));
});

router.delete("/rooms/:code/players/:playerId", async (req, res): Promise<void> => {
  const code = roomCode(req);
  const { playerId } = RemoveParticipantParams.parse({ ...req.params, code });
  const view = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(climateRoomsTable)
      .where(eq(climateRoomsTable.code, code)).for("update");
    const room = ensureRoom(row?.state);
    const identity = identify(req, room);
    if (!identity.teacher) throw new GameError(403, "Nur die Lehrkraft kann Personen entfernen.");
    removeParticipant(room, playerId);
    await tx.update(climateRoomsTable).set({ state: room, updatedAt: new Date() })
      .where(eq(climateRoomsTable.code, code));
    return publicRoom(room, identity);
  });
  res.json(GetRoomResponse.parse(view));
});

router.post("/rooms/:code/play", async (req, res): Promise<void> => {
  const code = roomCode(req);
  const input = PlayTurnBody.parse(req.body);
  const view = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(climateRoomsTable)
      .where(eq(climateRoomsTable.code, code)).for("update");
    const room = ensureRoom(row?.state);
    const identity = identify(req, room);
    if (identity.teacher || !identity.playerId) throw new GameError(403, "Entscheidungen werden in der Schüleransicht getroffen.");
    play(room, identity.playerId, input);
    await tx.update(climateRoomsTable).set({ state: room, updatedAt: new Date() })
      .where(eq(climateRoomsTable.code, code));
    return publicRoom(room, identity);
  });
  res.json(GetRoomResponse.parse(view));
});

export default router;
