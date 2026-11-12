import assert from "node:assert/strict";

// Real HTTP integration checks through the managed proxy. Each actor has an
// independent cookie jar, as if they were on separate classroom iPads.
const base = process.argv[2] || "http://localhost:80";
let assertions = 0;
class Client {
  cookie = "";
  async request(path, { method = "GET", data, status = 200 } = {}) {
    const response = await fetch(`${base}/api${path}`, {
      method,
      headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...(this.cookie ? { Cookie: this.cookie } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = await response.json();
    assert.equal(response.status, status, `${method} ${path}: ${body.error || ""}`);
    assertions++;
    for (const cookie of response.headers.getSetCookie()) this.cookie = cookie.split(";")[0];
    return body;
  }
}

const teacher = new Client();
const visitor = new Client();
let room = await teacher.request("/rooms", { method: "POST", status: 201 });
const code = room.code;
assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
for (const invalid of ["K7Q", "K7QF", "K7QF3", "K7QF3MX", "I7QF3M", "O7QF3M", "07QF3M", "17QF3M"]) {
  await visitor.request(`/rooms/${invalid}/join`, { method: "POST", data: { name: "Invalid test" }, status: 400 });
}
const game = await visitor.request("/game");
assert.equal(game.rounds.length, 4);
assert.equal(game.roles.length, 3);
assert.ok(!JSON.stringify(game).includes("2050"));
assert.ok(!JSON.stringify(game).includes("delta"));
const actors = [];
for (let i = 0; i < 8; i++) {
  const client = new Client();
  // Lower case and whitespace are normalized on the server too.
  const typedCode = i === 0 ? encodeURIComponent(`${code.slice(0, 3).toLowerCase()} ${code.slice(3).toLowerCase()}`) : code;
  const view = await client.request(`/rooms/${typedCode}/join`, { method: "POST", data: { name: `API Test ${i}` } });
  actors.push({ client, id: view.playerId });
}
room = await teacher.request(`/rooms/${code}`);
assert.equal(room.players.length, 8);
const removed = actors.pop();
await actors[0].client.request(`/rooms/${code}/players/${removed.id}`, { method: "DELETE", status: 403 });
await teacher.request(`/rooms/${code}/players/missing`, { method: "DELETE", status: 404 });
room = await teacher.request(`/rooms/${code}/players/${removed.id}`, { method: "DELETE" });
assert.equal(room.players.length, 7);
await removed.client.request(`/rooms/${code}`, { status: 403 });
const rejoined = await removed.client.request(`/rooms/${code}/join`, { method: "POST", data: { name: "API Test Rejoined" } });
assert.notEqual(rejoined.playerId, removed.id);
room = await teacher.request(`/rooms/${code}/players/${rejoined.playerId}`, { method: "DELETE" });
assert.equal(room.players.length, 7);
room = await teacher.request(`/rooms/${code}/control`, { method: "POST", data: { action: "group", passage: 1 } });
assert.deepEqual(room.groups.map((g) => g.playerIds.length).sort(), [3, 4]);
await teacher.request(`/rooms/${code}/players/${actors[0].id}`, { method: "DELETE", status: 409 });
await removed.client.request(`/rooms/${code}/join`, { method: "POST", data: { name: "API Test Too Late" }, status: 409 });
room = await teacher.request(`/rooms/${code}/control`, { method: "POST", data: { action: "start", passage: 1 } });
await Promise.all(actors.map(({ client }) => client.request(`/rooms/${code}/play`, { method: "POST", data: { action: "ready", passage: 1, round: 1 } })));
room = await teacher.request(`/rooms/${code}`);
assert.ok(room.groups.every((g) => g.phase === "decision"));
const groupBefore = room.groups.map((g) => ({ id: g.id, playerIds: g.playerIds }));
const roleBefore = new Map(room.players.map((p) => [p.id, p.role]));
for (let round = 1; round <= 4; round++) {
  for (const group of room.groups) {
    const state = room.players.find((p) => p.groupId === group.id && p.role === "state");
    const stateClient = actors.find((a) => a.id === state.id).client;
    await stateClient.request(`/rooms/${code}/play`, { method: "POST", data: { action: "decide", passage: 1, round, measureId: `${round}b` } });
    const voters = room.players.filter((p) => p.groupId === group.id && p.role !== "state");
    // Simultaneous reactions exercise the row lock and lost-update protection.
    await Promise.all(voters.map((player) => actors.find((a) => a.id === player.id).client.request(`/rooms/${code}/play`, {
      method: "POST",
      data: {
        action: "react", passage: 1, round, stance: "accept",
        reason: player.role === "business" ? game.businessReasons[0] : game.citizenReasons[0],
      },
    })));
    const effects = await stateClient.request(`/rooms/${code}`);
    assert.equal(effects.groups[0].phase, "effects");
    assert.equal(effects.groups[0].reactions.length, voters.length);
    assert.equal(effects.groups[0].history.length, round);
    await stateClient.request(`/rooms/${code}/play`, { method: "POST", data: { action: "next", passage: 1, round } });
  }
  room = await teacher.request(`/rooms/${code}`);
}
assert.equal(room.status, "results");
assert.equal(room.allFinished, true);
assert.ok(room.groups.every((g) => g.climateReached));
await actors[0].client.request(`/rooms/${code}/control`, { method: "POST", data: { action: "rotate", passage: 1 }, status: 403 });
room = await teacher.request(`/rooms/${code}/control`, { method: "POST", data: { action: "rotate", passage: 1 } });
assert.equal(room.passage, 2);
assert.deepEqual(room.groups.map((g) => ({ id: g.id, playerIds: g.playerIds })), groupBefore);
for (const group of room.groups) {
  assert.deepEqual(group.meters, game.initialMeters);
  assert.deepEqual(group.history, []);
  assert.deepEqual(group.reactions, []);
  assert.equal(group.measureId, null);
  assert.equal(group.round, 1);
  assert.equal(group.phase, "role");
}
assert.ok(room.players.filter((p) => p.role === roleBefore.get(p.id)).every((p) => p.role === "citizen"));
assert.ok(room.players.every((p) => !p.ready));
for (const { client } of actors) {
  const view = await client.request(`/rooms/${code}`);
  assert.equal(view.passage, 2);
  assert.equal(view.groups.length, 1);
}
console.log(`PASS: ${assertions} HTTP checks; exact code validation, remove/rejoin, permissions, 3/4 groups, simultaneous reactions, all four rounds and rotation/reset.`);
