"use client";

import { useState } from "react";
import { STAGE_LABEL } from "@/lib/rules";
import { canScoreMatch, canScoreSide, teamById, waitingForFinal } from "@/lib/tournament";
import type { Match, Room } from "@/lib/types";

export default function ScoreSheet({
  room,
  isAdmin,
  myTeamId,
  busy,
  onAddPoints,
  onDeclare,
}: {
  room: Room;
  isAdmin: boolean;
  myTeamId: string | null;
  busy: boolean;
  onAddPoints: (matchId: string, side: "A" | "B", delta: number) => Promise<boolean>;
  onDeclare: (matchId: string, winnerId: string) => void;
}) {
  const ctx = { isAdmin, teamId: myTeamId };
  const active = room.matches.find((m) => m.id === room.activeMatchId) || null;
  const sitting = waitingForFinal(room, myTeamId);
  const playerFocus = Boolean(myTeamId && !isAdmin);

  if (sitting && (!active || (active.teamAId !== myTeamId && active.teamBId !== myTeamId))) {
    const mine = teamById(room, myTeamId);
    return (
      <div className="stack">
        <div className="wait-banner">
          <p className="eyebrow">Ya ganaron su mesa</p>
          <h2>{mine?.name || "Su grupo"} espera en la Final</h2>
          <p className="muted">Los perdedores se enfrentan para sacar el otro finalista. Esta hoja se limpia sola.</p>
        </div>
        {active && active.teamAId && active.teamBId && (
          <MatchSheet
            room={room}
            match={active}
            myTeamId={myTeamId}
            canA={false}
            canB={false}
            canAny={false}
            isAdmin={isAdmin}
            playerFocus={false}
            busy={busy}
            onAddPoints={onAddPoints}
            onDeclare={onDeclare}
          />
        )}
      </div>
    );
  }

  if (!active || !active.teamAId || !active.teamBId) {
    return (
      <div className="empty-state">
        <div className="glyph">🁠</div>
        <p>
          {myTeamId
            ? "Tu grupo todavía no tiene mesa asignada."
            : "Todavía no hay mesa en juego."}
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      {!isAdmin && (
        <p className="muted" style={{ fontSize: 13 }}>
          Anotas solo los puntos de tu grupo. Las mesas cerradas pasan al historial.
        </p>
      )}
      {isAdmin && (
        <p className="muted" style={{ fontSize: 13 }}>
          Solo la mesa en juego. Al cerrarse, las columnas se limpian y quedan en Historial.
        </p>
      )}
      <MatchSheet
        room={room}
        match={active}
        myTeamId={myTeamId}
        canA={canScoreSide(room, active, ctx, "A")}
        canB={canScoreSide(room, active, ctx, "B")}
        canAny={canScoreMatch(room, active, ctx)}
        isAdmin={isAdmin}
        playerFocus={playerFocus && (active.teamAId === myTeamId || active.teamBId === myTeamId)}
        busy={busy}
        onAddPoints={onAddPoints}
        onDeclare={onDeclare}
      />
    </div>
  );
}

function MatchSheet({
  room,
  match,
  myTeamId,
  canA,
  canB,
  canAny,
  isAdmin,
  playerFocus,
  busy,
  onAddPoints,
  onDeclare,
}: {
  room: Room;
  match: Match;
  myTeamId: string | null;
  canA: boolean;
  canB: boolean;
  canAny: boolean;
  isAdmin: boolean;
  playerFocus: boolean;
  busy: boolean;
  onAddPoints: (matchId: string, side: "A" | "B", delta: number) => Promise<boolean>;
  onDeclare: (matchId: string, winnerId: string) => void;
}) {
  const teamA = teamById(room, match.teamAId);
  const teamB = teamById(room, match.teamBId);
  const linesA = match.log.filter((e) => e.side === "A" && typeof e.delta === "number");
  const linesB = match.log.filter((e) => e.side === "B" && typeof e.delta === "number");
  const members = room.members.filter(
    (m) => m.teamId === match.teamAId || m.teamId === match.teamBId,
  );
  const rest = teamById(room, match.restTeamId);

  return (
    <div className={`card stack ${playerFocus ? "player-sheet-card" : ""}`}>
      <div className="row between wrap">
        <p className="eyebrow">
          {STAGE_LABEL[match.stage]} · Mesa {match.order}
        </p>
        <span className={`badge ${match.status === "done" ? "badge-champion" : "badge-alive"}`}>
          {match.status === "done" ? "Cerrada" : `Meta ${room.target}`}
        </span>
      </div>
      {rest && (
        <p className="rest-pill">Espera: {rest.name}</p>
      )}

      <div className={`sheet ${playerFocus ? "player-focus" : ""}`}>
        <ScoreColumn
          name={teamA?.name || "Por definir"}
          mine={myTeamId === match.teamAId}
          lines={linesA.map((e) => e.delta as number)}
          total={match.scoreA}
          canAdd={canA}
          busy={busy}
          allowNegative={isAdmin}
          onAdd={(delta) => onAddPoints(match.id, "A", delta)}
        />
        <ScoreColumn
          name={teamB?.name || "Por definir"}
          mine={myTeamId === match.teamBId}
          lines={linesB.map((e) => e.delta as number)}
          total={match.scoreB}
          canAdd={canB}
          busy={busy}
          allowNegative={isAdmin}
          onAdd={(delta) => onAddPoints(match.id, "B", delta)}
        />
      </div>

      {isAdmin && members.length > 0 && (
        <p className="muted" style={{ fontSize: 12.5 }}>
          En esta mesa anotan: {members.map((m) => m.nickname).join(", ")}
        </p>
      )}

      {isAdmin && canAny && teamA && teamB && match.teamAId && match.teamBId && (
        <button
          className="btn btn-outline btn-sm btn-block"
          onClick={() => {
            const lead = match.scoreA >= match.scoreB ? match.teamAId : match.teamBId;
            const leadName = match.scoreA >= match.scoreB ? teamA.name : teamB.name;
            const pick = confirm(`¿Cerrar la mesa y declarar ganador a ${leadName}? Cancelar elige al otro.`);
            if (!lead) return;
            const other = lead === match.teamAId ? match.teamBId : match.teamAId;
            if (!other) return;
            onDeclare(match.id, pick ? lead : other);
          }}
        >
          Cerrar mesa / declarar ganador
        </button>
      )}
    </div>
  );
}

function ScoreColumn({
  name,
  mine,
  lines,
  total,
  canAdd,
  busy,
  allowNegative,
  onAdd,
}: {
  name: string;
  mine: boolean;
  lines: number[];
  total: number;
  canAdd: boolean;
  busy: boolean;
  allowNegative: boolean;
  onAdd: (delta: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");

  async function submit(raw?: string) {
    const delta = parseInt(raw ?? value, 10);
    if (!delta || Number.isNaN(delta)) return;
    if (!allowNegative && delta < 0) return;
    const ok = await onAdd(delta);
    if (ok) setValue("");
  }

  return (
    <div className={`sheet-col ${mine ? "col-mine" : ""}`}>
      <div className={`sheet-name ${mine ? "mine" : ""}`}>{name}</div>
      <ul className="sheet-lines">
        {lines.length === 0 && (
          <li style={{ fontWeight: 500, fontSize: 13, justifyContent: "center", color: "#4c5c51" }}>
            Sin puntos
          </li>
        )}
        {lines.map((n, i) => (
          <li key={`${i}-${n}`}>
            <span>{i + 1}</span>
            <span>{n}</span>
          </li>
        ))}
      </ul>
      <div className="sheet-total">
        <span>Total</span>
        <span>{total}</span>
      </div>
      {canAdd && (
        <div className="sheet-add-wrap">
          <button className="btn btn-primary btn-block plus30" disabled={busy} onClick={() => void submit("30")}>
            +30
          </button>
          <div className="sheet-add">
            <input
              type="number"
              inputMode="numeric"
              placeholder={allowNegative ? "Pts (+/-)" : "Puntos"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
              Sumar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
