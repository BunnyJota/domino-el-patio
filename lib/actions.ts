import { uid } from "./ids";
import type { ActionName, ActionPayload, Member, Room, SessionCtx } from "./types";
import {
  activeMatch,
  addLog,
  addPoints,
  applyFault,
  assignMembersToTeams,
  canScoreMatch,
  drawTeamsFromPlayers,
  finishMatch,
  maybeAutoFinish,
  matchById,
  resetTournament,
  sideForTeam,
  startTournament,
  teamById,
} from "./tournament";

function requireAdmin(ctx: SessionCtx): void {
  if (!ctx.isAdmin) throw new Error("Solo el dueño de la sala puede hacer esto.");
}

function findMember(room: Room, memberId?: string): Member | undefined {
  if (!memberId) return undefined;
  return room.members.find((m) => m.id === memberId);
}

export function applyAction(
  room: Room,
  action: ActionName,
  payload: ActionPayload,
  ctx: SessionCtx,
): { room: Room; memberId?: string } {
  const member = ctx.member || findMember(room, payload.memberId);

  switch (action) {
    case "join": {
      const nickname = (payload.nickname || "").trim();
      if (!nickname) throw new Error("Escribe tu nombre.");
      const existing = room.members.find(
        (m) => m.nickname.toLowerCase() === nickname.toLowerCase(),
      );
      if (existing) {
        if (payload.teamId) existing.teamId = payload.teamId;
        if (payload.tier && room.stage === "roster" && room.mode === "individual") {
          const list = payload.tier === "A" ? room.playersA : room.playersB;
          if (!list.some((p) => p.name.toLowerCase() === nickname.toLowerCase())) {
            list.push({ id: uid("p"), name: nickname });
          }
        }
        return { room, memberId: existing.id };
      }
      const newbie: Member = {
        id: uid("mb"),
        nickname,
        teamId: payload.teamId || null,
        isOwner: false,
        joinedAt: Date.now(),
      };
      if (payload.tier && room.mode === "individual" && room.stage === "roster") {
        const list = payload.tier === "A" ? room.playersA : room.playersB;
        if (!list.some((p) => p.name.toLowerCase() === nickname.toLowerCase())) {
          list.push({ id: uid("p"), name: nickname });
        }
      }
      room.members.push(newbie);
      assignMembersToTeams(room);
      addLog(room, `${nickname} entró a la sala.`);
      return { room, memberId: newbie.id };
    }

    case "selectTeam": {
      const who = member;
      if (!who) throw new Error("Primero entra a la sala con tu nombre.");
      if (!payload.teamId) throw new Error("Elige tu grupo.");
      const team = teamById(room, payload.teamId);
      if (!team) throw new Error("Ese grupo no existe.");
      who.teamId = team.id;
      addLog(room, `${who.nickname} se unió a ${team.name}.`);
      return { room, memberId: who.id };
    }

    case "addPlayer": {
      requireAdmin(ctx);
      const name = (payload.name || "").trim();
      if (!name) throw new Error("Escribe el nombre del jugador.");
      const entry = { id: uid("p"), name };
      if (payload.tier === "B") room.playersB.push(entry);
      else room.playersA.push(entry);
      return { room };
    }

    case "removePlayer": {
      requireAdmin(ctx);
      if (!payload.playerId) throw new Error("Jugador inválido.");
      room.playersA = room.playersA.filter((p) => p.id !== payload.playerId);
      room.playersB = room.playersB.filter((p) => p.id !== payload.playerId);
      return { room };
    }

    case "addTeam": {
      requireAdmin(ctx);
      const name = (payload.name || "").trim();
      if (!name) throw new Error("Escribe el nombre de la pareja.");
      room.teams.push({
        id: uid("t"),
        name,
        players: [],
        eliminatedIn: null,
      });
      if (room.stage === "roster") room.stage = "teams_drawn";
      return { room };
    }

    case "removeTeam": {
      requireAdmin(ctx);
      if (!payload.teamId) throw new Error("Grupo inválido.");
      room.teams = room.teams.filter((t) => t.id !== payload.teamId);
      for (const m of room.members) {
        if (m.teamId === payload.teamId) m.teamId = null;
      }
      return { room };
    }

    case "drawTeams":
    case "redrawTeams": {
      requireAdmin(ctx);
      if (room.stage !== "roster" && room.stage !== "teams_drawn") {
        throw new Error("Ya no se puede rifar: el torneo comenzó.");
      }
      drawTeamsFromPlayers(room);
      return { room };
    }

    case "startTournament": {
      requireAdmin(ctx);
      startTournament(room);
      return { room };
    }

    case "addPoints": {
      const match = matchById(room, payload.matchId || room.activeMatchId);
      if (!match) throw new Error("No hay partida activa.");
      if (
        !canScoreMatch(room, match, {
          isAdmin: ctx.isAdmin,
          teamId: member?.teamId,
        })
      ) {
        throw new Error("Solo tu grupo (o el dueño) puede anotar esta mesa.");
      }
      const requested = payload.side;
      const locked = sideForTeam(match, member?.teamId || null);
      const side =
        ctx.isAdmin || !locked ? requested : locked;
      if (side !== "A" && side !== "B") {
        throw new Error("Elige a qué grupo van los puntos.");
      }
      if (locked && !ctx.isAdmin && requested && requested !== locked) {
        throw new Error("Solo puedes anotar los puntos de tu grupo.");
      }
      const delta = Number(payload.delta);
      if (!delta) throw new Error("Ingresa los puntos de la mano.");
      addPoints(
        room,
        match,
        side,
        delta,
        payload.label || "Apunte",
        member?.id,
      );
      maybeAutoFinish(room, match);
      return { room };
    }

    case "applyFault": {
      const match = matchById(room, payload.matchId || room.activeMatchId);
      if (!match) throw new Error("No hay partida activa.");
      if (!ctx.isAdmin) {
        throw new Error("Las faltas las aplica el dueño de la sala.");
      }
      if (payload.side !== "A" && payload.side !== "B") {
        throw new Error("Elige el grupo.");
      }
      applyFault(
        room,
        match,
        payload.side,
        payload.level === "grave" ? "grave" : "leve",
        member?.id,
      );
      maybeAutoFinish(room, match);
      return { room };
    }

    case "declareWinner": {
      requireAdmin(ctx);
      const match = matchById(room, payload.matchId || room.activeMatchId);
      if (!match) throw new Error("No hay partida activa.");
      if (!payload.winnerId) throw new Error("Elige el ganador.");
      finishMatch(room, match, payload.winnerId);
      return { room };
    }

    case "reset": {
      requireAdmin(ctx);
      resetTournament(room);
      return { room };
    }

    default:
      throw new Error("Acción no reconocida.");
  }
}
