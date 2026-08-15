import { genCode, nowStr, shuffle, uid } from "./ids";
import type {
  LogEntry,
  Match,
  MatchStage,
  Room,
  RoomMode,
  Standing,
  Team,
} from "./types";

export function createRoom(input: {
  name: string;
  mode: RoomMode;
  target: number;
}): Room {
  const now = Date.now();
  return {
    code: genCode(4),
    name: input.name || "Torneo El Patio",
    mode: input.mode,
    target: input.target || 200,
    adminCode: genCode(6, "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"),
    playersA: [],
    playersB: [],
    teams: [],
    members: [],
    matches: [],
    activeMatchId: null,
    stage: "roster",
    champion: null,
    log: [{ ts: now, time: nowStr(), text: "Sala creada." }],
    createdAt: now,
    updatedAt: now,
  };
}

export function addLog(room: Room, text: string, byMemberId?: string): void {
  const entry: LogEntry = { ts: Date.now(), time: nowStr(), text, byMemberId };
  room.log.unshift(entry);
  if (room.log.length > 400) room.log.length = 400;
}

export function teamById(room: Room, id: string | null): Team | null {
  if (!id) return null;
  return room.teams.find((t) => t.id === id) || null;
}

export function matchById(room: Room, id: string | null): Match | null {
  if (!id) return null;
  return room.matches.find((m) => m.id === id) || null;
}

export function activeMatch(room: Room): Match | null {
  return matchById(room, room.activeMatchId);
}

function makeMatch(partial: {
  stage: MatchStage;
  order: number;
  round?: number;
  teamAId: string | null;
  teamBId: string | null;
  restTeamId?: string | null;
  status?: Match["status"];
}): Match {
  const ready = Boolean(partial.teamAId && partial.teamBId);
  return {
    id: uid("m"),
    stage: partial.stage,
    order: partial.order,
    round: partial.round ?? 1,
    teamAId: partial.teamAId,
    teamBId: partial.teamBId,
    scoreA: 0,
    scoreB: 0,
    leveA: 0,
    leveB: 0,
    status: partial.status ?? (ready ? "ready" : "pending"),
    winnerId: null,
    restTeamId: partial.restTeamId ?? null,
    log: [],
  };
}

export function drawTeamsFromPlayers(room: Room): void {
  if (room.playersA.length < 1 || room.playersB.length < 1) {
    throw new Error("Necesitas al menos 1 jugador en A y 1 en B para rifar.");
  }
  const A = shuffle(room.playersA);
  const B = shuffle(room.playersB);
  const n = Math.min(A.length, B.length);
  const teams: Team[] = [];
  for (let i = 0; i < n; i += 1) {
    teams.push({
      id: uid("t"),
      name: `${A[i].name} & ${B[i].name}`,
      players: [A[i].name, B[i].name],
      eliminatedIn: null,
    });
  }
  const leftover = shuffle(A.slice(n).concat(B.slice(n)));
  for (let i = 0; i < leftover.length; i += 2) {
    if (leftover[i + 1]) {
      teams.push({
        id: uid("t"),
        name: `${leftover[i].name} & ${leftover[i + 1].name}`,
        players: [leftover[i].name, leftover[i + 1].name],
        eliminatedIn: null,
      });
    } else {
      teams.push({
        id: uid("t"),
        name: `${leftover[i].name} (refuerzo)`,
        players: [leftover[i].name],
        eliminatedIn: null,
      });
    }
  }
  room.teams = shuffle(teams);
  room.stage = "teams_drawn";
  assignMembersToTeams(room);
  addLog(
    room,
    `Rifa hecha: ${room.teams.length} parejas balanceadas (A + B).`,
  );
}

export function assignMembersToTeams(room: Room): void {
  for (const member of room.members) {
    if (member.teamId && room.teams.some((t) => t.id === member.teamId)) continue;
    const hit = room.teams.find((t) =>
      t.players.some(
        (p) => p.toLowerCase() === member.nickname.toLowerCase(),
      ),
    );
    if (hit) member.teamId = hit.id;
  }
}

/** Circle method, then flatten so the patio plays one mesa at a time. */
export function buildClassificationMatches(teams: Team[]): Match[] {
  if (teams.length < 2) return [];
  const hasBye = teams.length % 2 === 1;
  let arr: Array<Team | null> = hasBye ? [...teams, null] : [...teams];
  const n = arr.length;
  const roundCount = n - 1;
  const half = n / 2;
  const matches: Match[] = [];
  let order = 1;

  for (let r = 0; r < roundCount; r += 1) {
    let restTeam: Team | null = null;
    const pairs: Array<[Team, Team]> = [];
    for (let i = 0; i < half; i += 1) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (!a) {
        restTeam = b;
        continue;
      }
      if (!b) {
        restTeam = a;
        continue;
      }
      pairs.push([a, b]);
    }
    for (const [a, b] of pairs) {
      matches.push(
        makeMatch({
          stage: "classification",
          order: order++,
          round: r + 1,
          teamAId: a.id,
          teamBId: b.id,
          restTeamId: restTeam?.id ?? null,
        }),
      );
    }
    const fixed = arr[0];
    const rest = arr.slice(1);
    const moved = rest.pop();
    arr = [fixed, moved ?? null, ...rest];
  }
  return matches;
}

export function classificationStandings(room: Room): Standing[] {
  const classMatches = room.matches.filter((m) => m.stage === "classification");
  const rows: Standing[] = room.teams.map((team) => {
    let played = 0;
    let wins = 0;
    let losses = 0;
    let pf = 0;
    let pa = 0;
    for (const m of classMatches) {
      if (m.teamAId !== team.id && m.teamBId !== team.id) continue;
      if (m.status !== "done") continue;
      played += 1;
      const mine = m.teamAId === team.id ? m.scoreA : m.scoreB;
      const opp = m.teamAId === team.id ? m.scoreB : m.scoreA;
      pf += mine;
      pa += opp;
      if (m.winnerId === team.id) wins += 1;
      else losses += 1;
    }
    const isChampion = room.champion === team.id;
    const isOut = Boolean(team.eliminatedIn) && !isChampion;
    let label = "En juego";
    if (isChampion) label = "Campeón";
    else if (team.eliminatedIn === "classification") label = "Fuera en liguilla";
    else if (team.eliminatedIn === "pre_elim") label = "Fuera en pre-elim";
    else if (team.eliminatedIn === "final") label = "Subcampeón";
    else if (room.stage === "pre_elim") label = "Pre-eliminatoria";
    else if (room.stage === "final") label = "En la final";
    return {
      team,
      played,
      wins,
      losses,
      pf,
      pa,
      diff: pf - pa,
      isChampion,
      isOut,
      label,
    };
  });

  rows.sort((a, b) => {
    if (a.isChampion !== b.isChampion) return a.isChampion ? -1 : 1;
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.diff !== b.diff) return b.diff - a.diff;
    if (a.pf !== b.pf) return b.pf - a.pf;
    const h2h = headToHead(room, a.team.id, b.team.id);
    if (h2h !== 0) return h2h;
    return a.team.name.localeCompare(b.team.name, "es");
  });
  return rows;
}

function headToHead(room: Room, aId: string, bId: string): number {
  const m = room.matches.find(
    (x) =>
      x.stage === "classification" &&
      x.status === "done" &&
      ((x.teamAId === aId && x.teamBId === bId) ||
        (x.teamAId === bId && x.teamBId === aId)),
  );
  if (!m || !m.winnerId) return 0;
  if (m.winnerId === aId) return -1;
  if (m.winnerId === bId) return 1;
  return 0;
}

export function startTournament(room: Room): void {
  if (room.teams.length < 2) {
    throw new Error("Se necesitan al menos 2 parejas para comenzar.");
  }
  room.teams = room.teams.map((t) => ({ ...t, eliminatedIn: null }));
  room.matches = [];
  room.champion = null;

  if (room.teams.length === 2) {
    const final = makeMatch({
      stage: "final",
      order: 1,
      teamAId: room.teams[0].id,
      teamBId: room.teams[1].id,
    });
    room.matches = [final];
    room.stage = "final";
    room.activeMatchId = final.id;
    addLog(
      room,
      "Solo hay 2 parejas: se juega la Final directo, sin liguilla.",
    );
    return;
  }

  const queue = buildClassificationMatches(room.teams);
  room.matches = queue;
  room.stage = "classification";
  room.activeMatchId = queue[0]?.id ?? null;
  addLog(
    room,
    `Liguilla sorteada: ${queue.length} partidas, una mesa a la vez. Todos se enfrentan.`,
  );
}

function seedPlayoffs(room: Room): void {
  const ranked = classificationStandings(room).map((s) => s.team);
  if (ranked.length < 2) {
    throw new Error("No hay suficientes equipos para la pre-eliminatoria.");
  }

  if (ranked.length === 2) {
    const final = makeMatch({
      stage: "final",
      order: 1,
      teamAId: ranked[0].id,
      teamBId: ranked[1].id,
    });
    room.matches.push(final);
    room.stage = "final";
    room.activeMatchId = final.id;
    addLog(room, "Liguilla cerrada. Se juega la Final.");
    return;
  }

  if (ranked.length === 3) {
    const pre = makeMatch({
      stage: "pre_elim",
      order: 1,
      teamAId: ranked[1].id,
      teamBId: ranked[2].id,
    });
    const final = makeMatch({
      stage: "final",
      order: 1,
      teamAId: ranked[0].id,
      teamBId: null,
      status: "pending",
    });
    room.matches.push(pre, final);
    room.stage = "pre_elim";
    room.activeMatchId = pre.id;
    addLog(
      room,
      `Liguilla cerrada. ${ranked[0].name} espera en la Final. Pre-elim: ${ranked[1].name} vs ${ranked[2].name}.`,
    );
    return;
  }

  const top = ranked.slice(0, 4);
  for (const extra of ranked.slice(4)) {
    extra.eliminatedIn = "classification";
  }
  const pre1 = makeMatch({
    stage: "pre_elim",
    order: 1,
    teamAId: top[0].id,
    teamBId: top[3].id,
  });
  const pre2 = makeMatch({
    stage: "pre_elim",
    order: 2,
    teamAId: top[1].id,
    teamBId: top[2].id,
  });
  const final = makeMatch({
    stage: "final",
    order: 1,
    teamAId: null,
    teamBId: null,
    status: "pending",
  });
  room.matches.push(pre1, pre2, final);
  room.stage = "pre_elim";
  room.activeMatchId = pre1.id;
  addLog(
    room,
    `Liguilla cerrada. Pre-elim justa: 1° vs 4° y 2° vs 3°. Los ganadores van a la Final.`,
  );
}

function fillFinal(room: Room): void {
  const pres = room.matches
    .filter((m) => m.stage === "pre_elim" && m.status === "done")
    .sort((a, b) => a.order - b.order);
  const final = room.matches.find((m) => m.stage === "final");
  if (!final) return;
  if (pres.length === 1) {
    final.teamBId = pres[0].winnerId;
  } else if (pres.length >= 2) {
    final.teamAId = pres[0].winnerId;
    final.teamBId = pres[1].winnerId;
  }
  if (final.teamAId && final.teamBId) final.status = "ready";
}

function nextReady(room: Room, stage: MatchStage, afterOrder: number): Match | null {
  return (
    room.matches
      .filter(
        (m) =>
          m.stage === stage &&
          m.status !== "done" &&
          m.order > afterOrder &&
          m.teamAId &&
          m.teamBId,
      )
      .sort((a, b) => a.order - b.order)[0] || null
  );
}

export function finishMatch(room: Room, match: Match, winnerId: string): void {
  if (match.status === "done") return;
  match.status = "done";
  match.winnerId = winnerId;
  const loserId = winnerId === match.teamAId ? match.teamBId : match.teamAId;
  const winner = teamById(room, winnerId);
  const loser = teamById(room, loserId);
  addLog(
    room,
    `${winner ? winner.name : "Equipo"} gana ${match.scoreA}-${match.scoreB}.`,
  );

  if (match.stage === "classification") {
    const next = nextReady(room, "classification", match.order);
    if (next) {
      room.activeMatchId = next.id;
      addLog(room, `Siguiente mesa: ${labelMatch(room, next)}.`);
    } else {
      seedPlayoffs(room);
    }
    return;
  }

  if (match.stage === "pre_elim") {
    if (loser) loser.eliminatedIn = "pre_elim";
    const next = nextReady(room, "pre_elim", match.order);
    if (next) {
      room.activeMatchId = next.id;
      addLog(room, `Siguiente pre-elim: ${labelMatch(room, next)}.`);
    } else {
      fillFinal(room);
      const final = room.matches.find((m) => m.stage === "final");
      room.stage = "final";
      room.activeMatchId = final?.id ?? null;
      addLog(room, "Se arma la Final.");
    }
    return;
  }

  if (loser) loser.eliminatedIn = "final";
  room.champion = winnerId;
  room.stage = "finished";
  room.activeMatchId = null;
  addLog(room, `Campeón del Patio: ${winner ? winner.name : "Equipo"}.`);
}

export function labelMatch(room: Room, match: Match): string {
  const a = teamById(room, match.teamAId);
  const b = teamById(room, match.teamBId);
  return `${a ? a.name : "Por definir"} vs ${b ? b.name : "Por definir"}`;
}

export function addPoints(
  room: Room,
  match: Match,
  side: "A" | "B",
  delta: number,
  label: string,
  byMemberId?: string,
): void {
  if (match.status === "done") throw new Error("Esta partida ya terminó.");
  if (side === "A") match.scoreA = Math.max(0, match.scoreA + delta);
  else match.scoreB = Math.max(0, match.scoreB + delta);
  const team = teamById(room, side === "A" ? match.teamAId : match.teamBId);
  const text = `${team ? team.name : "Equipo " + side}: ${delta >= 0 ? "+" : ""}${delta} — ${label}`;
  const entry: LogEntry = {
    ts: Date.now(),
    time: nowStr(),
    text,
    byMemberId,
  };
  match.log.unshift(entry);
  addLog(room, text, byMemberId);
}

export function applyFault(
  room: Room,
  match: Match,
  side: "A" | "B",
  level: "leve" | "grave",
  byMemberId?: string,
): void {
  if (match.status === "done") throw new Error("Esta partida ya terminó.");
  const offender = teamById(room, side === "A" ? match.teamAId : match.teamBId);
  const other: "A" | "B" = side === "A" ? "B" : "A";
  if (level === "leve") {
    if (side === "A") match.leveA += 1;
    else match.leveB += 1;
    const count = side === "A" ? match.leveA : match.leveB;
    if (count === 1) {
      const text = `Advertencia por falta leve a ${offender ? offender.name : "equipo"}.`;
      match.log.unshift({ ts: Date.now(), time: nowStr(), text, byMemberId });
      addLog(room, text, byMemberId);
    } else {
      addPoints(
        room,
        match,
        other,
        30,
        `Reincidencia falta leve de ${offender ? offender.name : "equipo"}`,
        byMemberId,
      );
    }
  } else {
    addPoints(
      room,
      match,
      other,
      30,
      `Falta grave de ${offender ? offender.name : "equipo"}`,
      byMemberId,
    );
  }
}

export function maybeAutoFinish(room: Room, match: Match): boolean {
  if (match.status === "done") return false;
  if (match.scoreA >= room.target || match.scoreB >= room.target) {
    const winnerId =
      match.scoreA >= room.target ? match.teamAId : match.teamBId;
    if (!winnerId) return false;
    finishMatch(room, match, winnerId);
    return true;
  }
  return false;
}

export function canScoreMatch(
  room: Room,
  match: Match,
  ctx: { isAdmin: boolean; teamId?: string | null },
): boolean {
  if (match.status === "done" || match.status === "pending") return false;
  if (room.activeMatchId !== match.id) return false;
  if (ctx.isAdmin) return true;
  if (!ctx.teamId) return false;
  return ctx.teamId === match.teamAId || ctx.teamId === match.teamBId;
}

export function sideForTeam(match: Match, teamId: string | null): "A" | "B" | null {
  if (!teamId) return null;
  if (match.teamAId === teamId) return "A";
  if (match.teamBId === teamId) return "B";
  return null;
}

export function publicRoom(room: Room, isAdmin: boolean): Room {
  if (isAdmin) return room;
  return { ...room, adminCode: "" };
}

export function resetTournament(room: Room): void {
  if (room.mode === "equipos") {
    room.teams = room.teams.map((t) => ({ ...t, eliminatedIn: null }));
    room.stage = room.teams.length ? "teams_drawn" : "roster";
  } else {
    room.teams = [];
    room.stage = "roster";
  }
  room.matches = [];
  room.champion = null;
  room.activeMatchId = null;
  for (const m of room.members) {
    if (room.mode !== "equipos") m.teamId = null;
  }
  addLog(room, "El torneo fue reiniciado.");
}
