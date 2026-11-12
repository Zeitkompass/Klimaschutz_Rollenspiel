import assert from "node:assert/strict";
import { test } from "node:test";
import type { Reaction, TurnInput } from "@workspace/api-zod";
import { catalog, impacts, INITIAL_METERS } from "./catalog";
import {
  climateReactionDelta, control, play, publicRoom, removeParticipant,
  type RoomState,
} from "./engine";

type Stance = Reaction["stance"];
const stances: Stance[] = ["support", "accept", "oppose"];

function fixture(size: number): RoomState {
  return {
    code: "K7QF3M", teacherHash: "test-teacher-hash", status: "lobby", passage: 1,
    createdAt: new Date().toISOString(), groups: [],
    players: Array.from({ length: size }, (_, i) => ({
      id: `test-${i}`, name: `Test ${i}`, role: null, groupId: null, ready: false,
      perspective: "", credentialHash: `test-hash-${i}`,
    })),
  };
}
function started(size: number) {
  const room = fixture(size);
  control(room, { action: "group", passage: 1 });
  control(room, { action: "start", passage: 1 });
  ready(room);
  return room;
}
function ready(room: RoomState) {
  for (const player of room.players) {
    const group = room.groups.find((g) => g.id === player.groupId)!;
    play(room, player.id, { action: "ready", passage: room.passage, round: group.round });
  }
}
function finish(room: RoomState, choices: string[], stance: Stance = "accept") {
  for (let n = 1; n <= 4; n++) {
    for (const group of room.groups) {
      const state = room.players.find((p) => p.groupId === group.id && p.role === "state")!;
      play(room, state.id, { action: "decide", passage: room.passage, round: n, measureId: `${n}${choices[n - 1]}` });
      for (const member of room.players.filter((p) => p.groupId === group.id && p.role !== "state")) {
        const reason = member.role === "business" ? catalog.businessReasons[0]! : catalog.citizenReasons[0]!;
        play(room, member.id, { action: "react", passage: room.passage, round: n, stance, reason });
      }
      assert.equal(group.phase, "effects");
      assert.equal(group.history.length, n);
      assert.equal(group.history[n - 1]!.explanations.length, 3);
      play(room, state.id, { action: "next", passage: room.passage, round: n });
    }
  }
  assert.equal(room.status, "results");
}

test("all 81 measure combinations, both group sizes, neutral/support/opposition", () => {
  for (const size of [3, 4]) {
    let neutralSuccess = 0;
    let combinations = 0;
    for (const a of ["a", "b", "c"])
      for (const b of ["a", "b", "c"])
        for (const c of ["a", "b", "c"])
          for (const d of ["a", "b", "c"]) {
            combinations++;
            const choices = [a, b, c, d];
            const weakCount = choices.filter((x) => x === "c").length;
            for (const stance of stances) {
              const room = started(size);
              finish(room, choices, stance);
              const group = room.groups[0]!;
              if (stance === "accept") {
                assert.equal(group.climateReached, weakCount <= 1, `${size}: ${choices} ${stance}`);
                if (group.climateReached) neutralSuccess++;
              }
              if (weakCount >= 2) assert.equal(group.climateReached, false);
              if (weakCount === 0) assert.equal(group.climateReached, true);
              if (choices.every((x) => x === "c")) assert.ok(group.meters.climate < 40);
              for (const result of group.history)
                for (const meter of Object.values(result.meters)) assert.ok(meter >= 0 && meter <= 100);
            }
          }
    assert.equal(combinations, 81);
    assert.equal(neutralSuccess, 48);
  }
});

test("every citizen/company reaction pattern stays within ±4 and averages two citizens", () => {
  assert.equal(climateReactionDelta(["support"], "support"), 4);
  assert.equal(climateReactionDelta(["oppose"], "oppose"), -4);
  assert.equal(climateReactionDelta(["accept"], "accept"), 0);
  for (const citizen of stances) for (const business of stances) {
    assert.equal(climateReactionDelta([citizen], business), climateReactionDelta([citizen, citizen], business));
    for (const second of stances) {
      const result = climateReactionDelta([citizen, second], business);
      assert.ok(Math.abs(result) <= 4);
      assert.equal(result, climateReactionDelta([second, citizen], business));
    }
  }
});

test("exhaustive climate paths: all measures and all possible per-round reaction deltas", () => {
  let paths = 0;
  for (const adjustments of [[-4, -2, 0, 2, 4], [-4, -3, -2, -1, 0, 1, 2, 3, 4]]) {
    for (const a of ["a", "b", "c"]) for (const b of ["a", "b", "c"])
      for (const c of ["a", "b", "c"]) for (const d of ["a", "b", "c"]) {
        const choices = [a, b, c, d];
        const weakCount = choices.filter((x) => x === "c").length;
        const deltas = choices.map((choice, i) => impacts[`${i + 1}${choice}`]!.delta.climate);
        for (const r1 of adjustments) for (const r2 of adjustments)
          for (const r3 of adjustments) for (const r4 of adjustments) {
            const reactions = [r1, r2, r3, r4];
            let value = 0;
            for (let i = 0; i < 4; i++) {
              value = Math.max(0, Math.min(100, value + deltas[i]! + reactions[i]!));
            }
            if (weakCount >= 2) assert.ok(value < catalog.climateTarget);
            if (weakCount === 0) assert.ok(value >= catalog.climateTarget);
            paths++;
          }
      }
  }
  assert.equal(paths, 582066);
});

test("all 12 measures and all 36 group reaction patterns apply the small climate effect", () => {
  for (const size of [3, 4]) for (const round of catalog.rounds) for (const measure of round.measures) {
    for (const citizen of stances) for (const business of stances)
      for (const second of size === 4 ? stances : ["accept"] as Stance[]) {
        const room = started(size);
        const group = room.groups[0]!;
        group.round = round.number;
        group.meters.climate = 20; // away from both clipping boundaries
        const state = room.players.find((p) => p.role === "state")!;
        const citizens = room.players.filter((p) => p.role === "citizen");
        const company = room.players.find((p) => p.role === "business")!;
        play(room, state.id, { action: "decide", passage: 1, round: round.number, measureId: measure.id });
        for (const [i, player] of citizens.entries()) {
          play(room, player.id, {
            action: "react", passage: 1, round: round.number,
            stance: i === 0 ? citizen : second, reason: catalog.citizenReasons[0]!,
          });
        }
        play(room, company.id, {
          action: "react", passage: 1, round: round.number, stance: business, reason: catalog.businessReasons[0]!,
        });
        const delta = climateReactionDelta(size === 3 ? [citizen] : [citizen, second], business);
        assert.equal(group.meters.climate, 20 + impacts[measure.id]!.delta.climate + delta);
        const explainsReaction = group.history[0]!.explanations[0]!.includes("Dadurch wirkt");
        assert.equal(explainsReaction, delta !== 0);
        if (measure.id.endsWith("a") || measure.id.endsWith("b")) assert.ok(group.meters.climate - 20 >= 30);
      }
  }
});

test("no reaction explanation when the effect was clipped at 100", () => {
  const room = started(3);
  room.groups[0]!.meters.climate = 100;
  finish(room, ["a", "a", "a", "a"], "support");
  assert.ok(room.groups[0]!.history.every((r) => !r.explanations[0]!.includes("Dadurch wirkt")));
});

test("random grouping keeps full three/four-person groups and the correct roles", () => {
  for (const n of [3, 4, ...Array.from({ length: 115 }, (_, i) => i + 6)]) {
    const room = fixture(n);
    control(room, { action: "group", passage: 1 });
    assert.equal(new Set(room.groups.flatMap((g) => g.playerIds)).size, n);
    for (const group of room.groups) {
      assert.ok([3, 4].includes(group.playerIds.length));
      const members = room.players.filter((p) => p.groupId === group.id);
      assert.equal(members.filter((p) => p.role === "state").length, 1);
      assert.equal(members.filter((p) => p.role === "business").length, 1);
      assert.equal(members.filter((p) => p.role === "citizen").length, group.playerIds.length - 2);
    }
  }
});

test("removal is lobby-only and grouping still works afterwards", () => {
  const room = fixture(5);
  removeParticipant(room, "test-4");
  assert.equal(room.players.length, 4);
  assert.throws(() => removeParticipant(room, "missing"));
  control(room, { action: "group", passage: 1 });
  const before = structuredClone(room);
  assert.throws(() => removeParticipant(room, room.players[0]!.id), /Nach der Gruppenbildung/);
  assert.deepEqual(room, before);
});

test("complete 3/4-passage rotation keeps groups, clears all decisions and resets all meters", () => {
  for (const size of [3, 4, 7]) {
    const room = started(size);
    const groups = room.groups.map((g) => ({ id: g.id, playerIds: [...g.playerIds] }));
    const roles = new Map(room.players.map((p) => [p.id, [p.role]]));
    const cycle = size === 3 ? 3 : 4;
    for (let passage = 1; passage < cycle; passage++) {
      finish(room, ["b", "b", "b", "b"]);
      control(room, { action: "rotate", passage });
      assert.equal(room.passage, passage + 1);
      assert.equal(room.status, "active");
      assert.deepEqual(room.groups.map((g) => ({ id: g.id, playerIds: g.playerIds })), groups);
      for (const group of room.groups) {
        assert.equal(group.round, 1);
        assert.equal(group.phase, "role");
        assert.deepEqual(group.meters, INITIAL_METERS);
        assert.deepEqual(group.history, []);
        assert.deepEqual(group.reactions, []);
        assert.equal(group.measureId, null);
        assert.equal(group.jobsPenalty, 0);
        assert.equal(group.unpopularPenalty, 0);
      }
      for (const player of room.players) {
        assert.equal(player.ready, false);
        roles.get(player.id)!.push(player.role);
      }
      ready(room);
    }
    for (const history of roles.values()) assert.equal(new Set(history).size, 3);
  }
});

test("role permissions, old requests, and private room data remain protected", () => {
  const room = started(7);
  const student = room.players.find((p) => p.role === "citizen")!;
  const group = room.groups.find((g) => g.id === student.groupId)!;
  assert.throws(() => play(room, student.id, { action: "decide", passage: 1, round: 1, measureId: "1a" }), /Nur der Staat/);
  const state = room.players.find((p) => p.groupId === group.id && p.role === "state")!;
  const stale: TurnInput = { action: "decide", passage: 0, round: 1, measureId: "1a" };
  assert.throws(() => play(room, state.id, stale), /Runde hat sich geändert/);
  const view = publicRoom(room, { teacher: false, playerId: student.id });
  assert.equal(view.groups.length, 1);
  assert.equal(view.players.length, group.playerIds.length);
  assert.ok(!JSON.stringify(view).includes("credentialHash"));
  assert.ok(!JSON.stringify(view).includes("teacherHash"));
  assert.ok(catalog.rounds.every((r) => r.measures.every((m) => !("delta" in m))));
});
