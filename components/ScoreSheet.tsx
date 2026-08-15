"use client";

import { useState } from "react";
import { STAGE_LABEL } from "@/lib/rules";
import { canScoreMatch, canScoreSide, teamById } from "@/lib/tournament";
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
  const matches = room.matches
    .filter((m) => m.teamAId && m.teamBId)
    .sort((a, b) => {
      const order = { classification: 0, pre_elim: 1, final: 2 };
      if (a.stage !== b.stage) return order[a.stage] - order[b.stage];
      return a.order - b.order;
    });

  const visible = isAdmin
    ? matches
    : matches.filter(
        (m) => m.teamAId === myTeamId || m.teamBId === myTeamId || m.status === "done",
      );

  if (visible.length === 0) {
    return (
      <div className="empty-state">
        <div className="glyph">🁠</div>
        <p>
          {myTeamId
            ? "Tu grupo todavía no tiene mesa asignada."
            : "Todavía no hay mesas para anotar."}
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      {!isAdmin && (
        <p className="muted" style={{ fontSize: 13 }}>
          Anotas solo los puntos de tu grupo. El dueño de la sala ve todas las mesas.
        </p>
      )}
      {isAdmin && (
        <p className="muted" style={{ fontSize: 13 }}>
          Dueño: puedes anotar puntos en cualquier mesa. Cada grupo solo carga los suyos.
        </p>
      )}
      {visible.map((match) => (
        <MatchSheet
          key={match.id}
          room={room}
          match={match}
          myTeamId={myTeamId}
          canA={canScoreSide(room, match, ctx, "A")}
          canB={canScoreSide(room, match, ctx, "B")}
          canAny={canScoreMatch(room, match, ctx)}
          isAdmin={isAdmin}
          busy={busy}
          onAddPoints={onAddPoints}
          onDeclare={onDeclare}
        />
      ))}
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

  return (
    <div className="card stack">
      <div className="row between wrap">
        <p className="eyebrow">
          {STAGE_LABEL[match.stage]} · Mesa {match.order}
        </p>
        <span className={`badge ${match.status === "done" ? "badge-champion" : "badge-alive"}`}>
          {match.status === "done" ? "Cerrada" : `Meta ${room.target}`}
        </span>
      </div>

      <div className="sheet">
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

  async function submit() {
    const delta = parseInt(value, 10);
    if (!delta || Number.isNaN(delta)) return;
    if (!allowNegative && delta < 0) return;
    const ok = await onAdd(delta);
    if (ok) setValue("");
  }

  return (
    <div className="sheet-col">
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
            <span>{n >= 0 ? n : n}</span>
          </li>
        ))}
      </ul>
      <div className="sheet-total">
        <span>Total</span>
        <span>{total}</span>
      </div>
      {canAdd && (
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
      )}
    </div>
  );
}
