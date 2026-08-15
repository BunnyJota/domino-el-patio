"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MatchFX, { unlockAudio } from "@/components/MatchFX";
import ScoreSheet from "@/components/ScoreSheet";
import { RULES_TEXT, STAGE_LABEL } from "@/lib/rules";
import { classificationStandings, teamById } from "@/lib/tournament";
import type { ActionName, ActionPayload, Match, Room, RoomMode } from "@/lib/types";

const SESSION_KEY = "elpatio-session";

type View = "landing" | "create" | "join" | "lobby" | "pick" | "play";
type Tab = "apunte" | "calendario" | "ranking" | "reglas" | "historial";

interface Session {
  roomCode: string;
  isAdmin: boolean;
  adminCode?: string;
  memberId?: string;
  nickname?: string;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function escapeText(s: string) {
  return s;
}

export default function DominoApp() {
  const [view, setView] = useState<View>("landing");
  const [tab, setTab] = useState<Tab>("apunte");
  const [room, setRoom] = useState<Room | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [createMode, setCreateMode] = useState<RoomMode>("individual");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("200");
  const [joinCode, setJoinCode] = useState("");
  const [joinAdmin, setJoinAdmin] = useState("");
  const [nickname, setNickname] = useState("");
  const [pickTeamId, setPickTeamId] = useState("");
  const [joinTier, setJoinTier] = useState<"A" | "B">("A");
  const [addA, setAddA] = useState("");
  const [addB, setAddB] = useState("");
  const [addTeam, setAddTeam] = useState("");
  const [storage, setStorage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2400);
  };

  const applyRoom = useCallback((next: Room, extra?: Partial<Session>) => {
    setRoom(next);
    setSession((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...extra };
      saveSession(merged);
      return merged;
    });
  }, []);

  const run = useCallback(
    async (action: ActionName, payload: ActionPayload = {}) => {
      if (!session?.roomCode) return null;
      setBusy(true);
      try {
        const res = await fetch(`/api/rooms/${session.roomCode}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-code": session.adminCode || "",
            "x-room-updated": String(room?.updatedAt || ""),
          },
          body: JSON.stringify({
            action,
            payload,
            adminCode: session.adminCode,
            memberId: session.memberId,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || "No se pudo guardar.");
          return null;
        }
        applyRoom(data.room as Room, data.memberId ? { memberId: data.memberId } : undefined);
        return data.room as Room;
      } catch {
        showToast("Error de conexión.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [applyRoom, room?.updatedAt, session],
  );

  const refresh = useCallback(async (code: string, adminCode?: string) => {
    const res = await fetch(`/api/rooms/${code}`, {
      headers: { "x-admin-code": adminCode || "" },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "No se encontró esa sala.");
    return data as { room: Room; isAdmin: boolean };
  }, []);

  useEffect(() => {
    fetch("/api/rooms", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.storage === "string") setStorage(data.storage);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  useEffect(() => {
    const existing = loadSession();
    if (!existing?.roomCode) return;
    refresh(existing.roomCode, existing.adminCode)
      .then((data) => {
        setRoom(data.room);
        const next = { ...existing, isAdmin: data.isAdmin };
        setSession(next);
        saveSession(next);
        if (data.room.stage === "roster" || data.room.stage === "teams_drawn") {
          setView("lobby");
        } else setView("play");
      })
      .catch(() => {
        localStorage.removeItem(SESSION_KEY);
      });
  }, [refresh]);

  useEffect(() => {
    if (!session?.roomCode || view === "landing" || view === "create" || view === "join") return;
    const timer = window.setInterval(async () => {
      try {
        const data = await refresh(session.roomCode, session.adminCode);
        setRoom((prev) => {
          if (!prev || data.room.updatedAt > prev.updatedAt) return data.room;
          return prev;
        });
      } catch {
        /* keep current */
      }
    }, 3500);
    return () => window.clearInterval(timer);
  }, [refresh, session, view]);

  const member = useMemo(
    () => room?.members.find((m) => m.id === session?.memberId) || null,
    [room, session?.memberId],
  );
  const myTeamId = member?.teamId || null;

  async function createSala() {
    setBusy(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Torneo El Patio",
          mode: createMode,
          target: parseInt(target, 10) || 200,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "No se pudo crear.");
        return;
      }
      const created = data.room as Room;
      const next: Session = {
        roomCode: created.code,
        isAdmin: true,
        adminCode: data.adminCode,
        nickname: "Organizador",
      };
      saveSession(next);
      setSession(next);
      setRoom(created);
      setView("lobby");
      showToast(`Sala creada: ${created.code}`);
    } catch {
      showToast("Error de conexión.");
    } finally {
      setBusy(false);
    }
  }

  async function joinSala() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    try {
      const data = await refresh(code, joinAdmin.trim().toUpperCase());
      const nick = nickname.trim();
      if (!nick && !data.isAdmin) {
        showToast("Escribe tu nombre para entrar.");
        return;
      }
      const next: Session = {
        roomCode: code,
        isAdmin: data.isAdmin,
        adminCode: data.isAdmin ? joinAdmin.trim().toUpperCase() : undefined,
        nickname: nick,
      };
      let live = data.room;
      if (nick) {
        const after = await fetch(`/api/rooms/${code}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-code": next.adminCode || "",
          },
          body: JSON.stringify({
            action: "join",
            payload: {
              nickname: nick,
              tier: data.room.mode === "individual" ? joinTier : undefined,
            },
          }),
        }).then((r) => r.json());
        if (after.error) {
          showToast(after.error);
          return;
        }
        next.memberId = after.memberId;
        live = after.room as Room;
      }
      setRoom(live);
      saveSession(next);
      setSession(next);
      const joinedMember = live.members.find((m) => m.id === next.memberId);
      if (live.teams.length && !data.isAdmin && !joinedMember?.teamId) setView("pick");
      else if (live.stage === "roster" || live.stage === "teams_drawn") setView("lobby");
      else setView("play");
      showToast(data.isAdmin ? "Entraste como dueño de la sala" : "Entraste a la sala");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "No se encontró esa sala.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmTeam() {
    if (!pickTeamId) {
      showToast("Selecciona tu grupo.");
      return;
    }
    const next = await run("selectTeam", { teamId: pickTeamId });
    if (next) {
      setView(next.stage === "roster" || next.stage === "teams_drawn" ? "lobby" : "play");
      showToast("Grupo seleccionado.");
    }
  }

  function shareCode() {
    if (!room) return;
    const text = `Únete a Dominó El Patio "${room.name}" con el código: ${room.code}`;
    if (navigator.share) navigator.share({ text }).catch(() => undefined);
    else if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast("Código copiado");
    } else showToast(`Código: ${room.code}`);
  }

  function leave() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRoom(null);
    setView("landing");
  }

  const needsTeam =
    Boolean(room && session && !session.isAdmin && room.teams.length > 0 && !myTeamId);
  const prevStage = useRef(room?.stage);

  useEffect(() => {
    if (needsTeam && view !== "pick" && view !== "join" && view !== "landing") {
      setView("pick");
    }
  }, [needsTeam, view]);

  useEffect(() => {
    if (!room) return;
    const wasLobby =
      prevStage.current === "roster" || prevStage.current === "teams_drawn";
    const nowPlay = room.stage !== "roster" && room.stage !== "teams_drawn";
    prevStage.current = room.stage;
    if (wasLobby && nowPlay && (view === "lobby" || (view === "pick" && !needsTeam))) {
      setView("play");
    }
  }, [needsTeam, room, view]);

  return (
    <div id="app" onPointerDown={unlockAudio}>
      {view === "landing" && (
        <>
          <div className="hero">
            <img className="brand-logo" src="/logo.png" alt="Dominó El Patio" />
            <p className="sub">
              Crea la sala, rifa las parejas y anota el torneo en vivo. Quien gana espera
              la final; los perdedores pelean el otro cupo. Cada grupo apunta sus puntos.
            </p>
          </div>
          {storage === "missing" && (
            <div className="storage-alert" role="alert">
              <strong>Falta la base de datos en Vercel.</strong>
              En el proyecto: Settings → Environment Variables, agrega{" "}
              <code>DATABASE_URL</code> de Neon (Integrations → Neon) y vuelve a desplegar.
            </div>
          )}
          <div className="landing-actions">
            <button className="btn btn-primary btn-block" onClick={() => setView("create")}>
              Crear torneo
            </button>
            <div className="divider-word">o</div>
            <button className="btn btn-outline btn-block" onClick={() => setView("join")}>
              Unirse con un código
            </button>
          </div>
          <footer className="mode-tag">Reglamento oficial incluido · Una mesa a la vez</footer>
        </>
      )}

      {view === "create" && (
        <div className="card stack" style={{ maxWidth: 460, margin: "24px auto" }}>
          <h2 style={{ fontSize: 22 }}>Crear torneo</h2>
          <div>
            <label className="field-label">Nombre del torneo</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Sábado en El Patio" />
          </div>
          <div>
            <label className="field-label">¿Cómo vienen los participantes?</label>
            <div className="row wrap" style={{ gap: 8 }}>
              <button
                className={`btn btn-sm ${createMode === "individual" ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1 }}
                onClick={() => setCreateMode("individual")}
              >
                Listas A y B
              </button>
              <button
                className={`btn btn-sm ${createMode === "equipos" ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1 }}
                onClick={() => setCreateMode("equipos")}
              >
                Ya tengo parejas
              </button>
            </div>
          </div>
          <div>
            <label className="field-label">Puntos para ganar la partida</label>
            <input type="number" min={30} step={10} value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={createSala}>
            Crear y entrar como dueño
          </button>
          <button className="btn btn-outline btn-block" onClick={() => setView("landing")}>
            Cancelar
          </button>
        </div>
      )}

      {view === "join" && (
        <div className="card stack" style={{ maxWidth: 420, margin: "24px auto" }}>
          <h2 style={{ fontSize: 22 }}>Unirse a la sala</h2>
          <div>
            <label className="field-label">Código de la sala</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Ej. K3PQ"
              maxLength={6}
              style={{ textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}
            />
          </div>
          <div>
            <label className="field-label">Tu nombre</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Para que te reconozcan en tu grupo" />
          </div>
          <div>
            <label className="field-label">Si aún no hay rifa, ¿eres jugador A o B?</label>
            <div className="row" style={{ gap: 8 }}>
              <button className={`btn btn-sm ${joinTier === "A" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setJoinTier("A")}>A · más experiencia</button>
              <button className={`btn btn-sm ${joinTier === "B" ? "btn-primary" : "btn-ghost"}`} style={{ flex: 1 }} onClick={() => setJoinTier("B")}>B · menos experiencia</button>
            </div>
          </div>
          <div>
            <label className="field-label">Código de dueño <span className="muted">(opcional)</span></label>
            <input value={joinAdmin} onChange={(e) => setJoinAdmin(e.target.value.toUpperCase())} placeholder="Solo si vas a administrar" style={{ fontFamily: "var(--font-mono)" }} />
          </div>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={joinSala}>
            Entrar a la sala
          </button>
          <button className="btn btn-outline btn-block" onClick={() => setView("landing")}>
            Cancelar
          </button>
        </div>
      )}

      {view === "pick" && room && (
        <div className="stack">
          <TopBar room={room} onShare={shareCode} subtitle="Elige tu grupo" />
          <div className="card stack">
            <h2 style={{ fontSize: 22 }}>¿Cuál es tu pareja?</h2>
            <p className="muted">Al entrar debes seleccionar tu grupo para anotar sus puntos.</p>
            <div className="group-pick">
              {room.teams.map((t) => (
                <button
                  key={t.id}
                  className={`group-card ${pickTeamId === t.id ? "selected" : ""}`}
                  onClick={() => setPickTeamId(t.id)}
                >
                  <strong>{t.name}</strong>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {t.players.join(" · ") || "Pareja"}
                  </div>
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-block" disabled={busy} onClick={confirmTeam}>
              Entrar con este grupo
            </button>
          </div>
        </div>
      )}

      {view === "lobby" && room && session && (
        <Lobby
          room={room}
          isAdmin={session.isAdmin}
          busy={busy}
          addA={addA}
          addB={addB}
          addTeam={addTeam}
          setAddA={setAddA}
          setAddB={setAddB}
          setAddTeam={setAddTeam}
          onShare={shareCode}
          onLeave={leave}
          onAddPlayer={async (tier) => {
            const value = tier === "A" ? addA : addB;
            const ok = await run("addPlayer", { tier, name: value });
            if (ok) {
              if (tier === "A") setAddA("");
              else setAddB("");
            }
          }}
          onRemovePlayer={(playerId) => run("removePlayer", { playerId })}
          onAddTeam={async () => {
            const ok = await run("addTeam", { name: addTeam });
            if (ok) setAddTeam("");
          }}
          onRemoveTeam={(teamId) => run("removeTeam", { teamId })}
          onDraw={() => run("drawTeams")}
          onRedraw={() => run("redrawTeams")}
          onStart={() => run("startTournament").then((r) => r && setView("play"))}
        />
      )}

      {view === "play" && room && session && (
        <Play
          room={room}
          tab={tab}
          setTab={setTab}
          isAdmin={session.isAdmin}
          myTeamId={myTeamId}
          busy={busy}
          onShare={shareCode}
          onAddPoints={async (matchId, side, delta) => {
            const ok = await run("addPoints", { matchId, side, delta, label: "Apunte" });
            if (ok) showToast("Puntos anotados.");
            return Boolean(ok);
          }}
          onDeclare={(matchId, winnerId) => run("declareWinner", { matchId, winnerId })}
          onReset={async () => {
            if (!confirm("Esto borra la llave y vuelve a la sala. ¿Continuar?")) return;
            const next = await run("reset");
            if (next) setView("lobby");
          }}
          onBack={() => setView("lobby")}
        />
      )}

      {toast && <div className="toast">{escapeText(toast)}</div>}
    </div>
  );
}

function TopBar({
  room,
  subtitle,
  onShare,
}: {
  room: Room;
  subtitle: string;
  onShare: () => void;
}) {
  return (
    <div className="topbar">
      <div>
        <p className="eyebrow">{subtitle}</p>
        <h2 style={{ fontSize: 20 }}>{room.name}</h2>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span className="room-chip">{room.code}</span>
        <button className="btn-icon" onClick={onShare} aria-label="Compartir código">
          ⇪
        </button>
      </div>
    </div>
  );
}

function Lobby({
  room,
  isAdmin,
  busy,
  addA,
  addB,
  addTeam,
  setAddA,
  setAddB,
  setAddTeam,
  onShare,
  onLeave,
  onAddPlayer,
  onRemovePlayer,
  onAddTeam,
  onRemoveTeam,
  onDraw,
  onRedraw,
  onStart,
}: {
  room: Room;
  isAdmin: boolean;
  busy: boolean;
  addA: string;
  addB: string;
  addTeam: string;
  setAddA: (v: string) => void;
  setAddB: (v: string) => void;
  setAddTeam: (v: string) => void;
  onShare: () => void;
  onLeave: () => void;
  onAddPlayer: (tier: "A" | "B") => void;
  onRemovePlayer: (id: string) => void;
  onAddTeam: () => void;
  onRemoveTeam: (id: string) => void;
  onDraw: () => void;
  onRedraw: () => void;
  onStart: () => void;
}) {
  const individual = room.mode === "individual";
  const canDraw = isAdmin && individual && room.playersA.length >= 1 && room.playersB.length >= 1 && (room.stage === "roster" || room.stage === "teams_drawn");
  const canStart = isAdmin && room.teams.length >= 2;

  return (
    <div className="stack">
      <TopBar room={room} subtitle="Paso 1 · Crear el torneo" onShare={onShare} />
      <div className="card">
        <div className="row between wrap" style={{ marginBottom: 6 }}>
          <div>
            <p className="eyebrow">{individual ? "Parejas balanceadas A + B" : "Parejas ya formadas"}</p>
            <h2 style={{ fontSize: 24 }}>{room.name}</h2>
          </div>
          <span className="badge badge-alive">Meta: {room.target} pts</span>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          {isAdmin
            ? "Paso 2: rifa de equipos. Paso 3: primera mesa. Quien gane espera la final; los demás pelean el otro cupo."
            : "Estás en la sala. Cuando existan grupos, selecciona el tuyo para anotar puntos."}
        </p>
      </div>

      {individual ? (
        <div className="tier-cols">
          {(["A", "B"] as const).map((tier) => {
            const list = tier === "A" ? room.playersA : room.playersB;
            const value = tier === "A" ? addA : addB;
            const setValue = tier === "A" ? setAddA : setAddB;
            return (
              <div key={tier} className={`tier-panel tier-${tier.toLowerCase()}`}>
                <div className="tier-head">
                  <span className={`tier-dot ${tier.toLowerCase()}`} />
                  <div>
                    <h4>Jugadores {tier} <span className="muted">({list.length})</span></h4>
                    <small>{tier === "A" ? "Más experimentados" : "Menos experimentados"}</small>
                  </div>
                </div>
                {isAdmin && (
                  <div className="row" style={{ marginBottom: 10 }}>
                    <input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onAddPlayer(tier)}
                      placeholder="Nombre del jugador"
                    />
                    <button className="btn btn-ghost btn-sm" onClick={() => onAddPlayer(tier)}>Añadir</button>
                  </div>
                )}
                <div className="stack" style={{ gap: 6 }}>
                  {list.length === 0 && <p className="muted" style={{ fontSize: 13 }}>Sin jugadores todavía.</p>}
                  {list.map((p) => (
                    <div className="roster-item" key={p.id}>
                      <span>{p.name}</span>
                      {isAdmin && (
                        <button className="btn-icon" onClick={() => onRemovePlayer(p.id)} aria-label="Quitar">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {isAdmin && (
            <div className="card stack">
              <label className="field-label">Agregar pareja</label>
              <div className="row">
                <input value={addTeam} onChange={(e) => setAddTeam(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onAddTeam()} placeholder="Ej. Juan & Pedro" />
                <button className="btn btn-primary btn-sm" onClick={onAddTeam}>Añadir</button>
              </div>
            </div>
          )}
          <div className="card stack">
            <h3 style={{ fontSize: 15 }}>{room.teams.length} pareja{room.teams.length === 1 ? "" : "s"}</h3>
            {room.teams.length === 0 && <div className="empty-state"><div className="glyph">🁣</div><p>Todavía no hay parejas registradas.</p></div>}
            {room.teams.map((t) => (
              <div className="roster-item" key={t.id}>
                <span>{t.name}</span>
                {isAdmin && <button className="btn-icon" onClick={() => onRemoveTeam(t.id)}>✕</button>}
              </div>
            ))}
          </div>
        </>
      )}

      {room.stage === "teams_drawn" && (
        <div className="card stack">
          <h3 style={{ fontSize: 15 }}>Paso 2 · Parejas rifadas</h3>
          {room.teams.map((t) => (
            <div className="team-pair-card" key={t.id}>
              <span>{t.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                {room.members.filter((m) => m.teamId === t.id).length} en el grupo
              </span>
            </div>
          ))}
        </div>
      )}

      {canDraw && (
        <button className="btn btn-primary btn-block" disabled={busy} onClick={room.stage === "teams_drawn" ? onRedraw : onDraw}>
          {room.stage === "teams_drawn" ? "🔁 Volver a rifar parejas" : "🎲 Paso 2 · Rifar parejas (A + B)"}
        </button>
      )}
      {canStart && (
        <button className="btn btn-cyan btn-block" disabled={busy} onClick={onStart}>
          ▶ Paso 3 · Comenzar torneo
        </button>
      )}
      {isAdmin && (
        <p className="muted center" style={{ fontSize: 12 }}>
          Código de dueño: <span style={{ fontFamily: "var(--font-mono)" }}>{room.adminCode}</span> — guárdalo para volver a entrar.
        </p>
      )}
      <button className="btn btn-outline btn-sm btn-block" onClick={onLeave}>Salir de la sala</button>
    </div>
  );
}

function Play({
  room,
  tab,
  setTab,
  isAdmin,
  myTeamId,
  busy,
  onShare,
  onAddPoints,
  onDeclare,
  onReset,
  onBack,
}: {
  room: Room;
  tab: Tab;
  setTab: (t: Tab) => void;
  isAdmin: boolean;
  myTeamId: string | null;
  busy: boolean;
  onShare: () => void;
  onAddPoints: (matchId: string, side: "A" | "B", delta: number) => Promise<boolean>;
  onDeclare: (matchId: string, winnerId: string) => void;
  onReset: () => void;
  onBack: () => void;
}) {
  const tabs: Array<[Tab, string]> = [
    ["apunte", "Apunte"],
    ["calendario", "Mesas"],
    ["ranking", "Tabla"],
    ["reglas", "Reglas"],
    ["historial", "Diario"],
  ];
  const champ = teamById(room, room.champion);

  return (
    <div className={isAdmin ? "" : "player-play"}>
      <MatchFX room={room} myTeamId={myTeamId} />
      <TopBar room={room} subtitle={STAGE_LABEL[room.stage] || room.name} onShare={onShare} />
      <div className="tabs" style={{ marginBottom: 18 }}>
        {tabs.map(([id, label]) => (
          <button key={id} className={`tab-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "apunte" && (
        <div className="stack">
          {room.champion && champ && (
            <div className="card center" style={{ padding: "34px 20px", borderColor: "rgba(255,210,74,0.5)" }}>
              <p className="eyebrow" style={{ marginBottom: 8 }}>Campeón de El Patio</p>
              <h2 style={{ fontSize: 28, color: "var(--gold-soft)" }}>🏆 {champ.name}</h2>
            </div>
          )}
          <ScoreSheet
            room={room}
            isAdmin={isAdmin}
            myTeamId={myTeamId}
            busy={busy}
            onAddPoints={onAddPoints}
            onDeclare={onDeclare}
          />
        </div>
      )}

      {tab === "calendario" && <Calendar room={room} />}
      {tab === "ranking" && <Ranking room={room} />}
      {tab === "reglas" && <Rules />}
      {tab === "historial" && <History room={room} />}

      {isAdmin && (
        <div className="row wrap" style={{ gap: 8, marginTop: 22 }}>
          <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={onBack}>← Sala</button>
          <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={onReset}>Reiniciar torneo</button>
        </div>
      )}
    </div>
  );
}

function Calendar({ room }: { room: Room }) {
  const stages: Array<[Match["stage"], string]> = [
    ["classification", "1. Ronda inicial"],
    ["pre_elim", "2. Repechaje de perdedores"],
    ["final", "3. Final"],
  ];
  return (
    <div className="timeline">
      {stages.map(([stage, title]) => {
        const list = room.matches.filter((m) => m.stage === stage).sort((a, b) => a.order - b.order);
        if (!list.length) {
          return (
            <div key={stage}>
              <p className="phase-title">{title}</p>
              <p className="muted" style={{ fontSize: 13, paddingLeft: 4 }}>Se arma sola cuando cierre la fase anterior.</p>
            </div>
          );
        }
        return (
          <div key={stage} className="stack" style={{ gap: 8 }}>
            <p className="phase-title">{title}</p>
            {list.map((m) => (
              <MatchTile key={m.id} room={room} match={m} live={room.activeMatchId === m.id} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MatchTile({ room, match, live }: { room: Room; match: Match; live: boolean }) {
  const teamA = teamById(room, match.teamAId);
  const teamB = teamById(room, match.teamBId);
  const aWin = match.status === "done" && match.winnerId === match.teamAId;
  const bWin = match.status === "done" && match.winnerId === match.teamBId;
  let status = "Pendiente";
  if (live) status = "En mesa ahora";
  else if (match.status === "done") status = "Finalizado";
  else if (match.status === "ready") status = "En cola";
  return (
    <div className={`tile-card ${match.status === "done" ? "done" : ""} ${live ? "live" : ""}`}>
      <div className="tile-half">
        <span className={`team-name ${!teamA ? "tbd" : ""} ${aWin ? "winner" : ""}`}>
          {aWin ? "♛ " : ""}
          {teamA?.name || "Por definir"}
        </span>
        <span className="team-score">{teamA ? match.scoreA : ""}</span>
      </div>
      <div className="tile-mid" />
      <div className="tile-half">
        <span className={`team-name ${!teamB ? "tbd" : ""} ${bWin ? "winner" : ""}`}>
          {bWin ? "♛ " : ""}
          {teamB?.name || "Por definir"}
        </span>
        <span className="team-score">{teamB ? match.scoreB : ""}</span>
      </div>
      <div className="tile-status">{status}</div>
      {match.restTeamId && teamById(room, match.restTeamId) && (
        <div className="tile-status rest-pill" style={{ paddingTop: 0 }}>
          Espera: {teamById(room, match.restTeamId)?.name}
        </div>
      )}
    </div>
  );
}

function History({ room }: { room: Room }) {
  const closed = room.matches
    .filter((m) => m.status === "done" && m.teamAId && m.teamBId)
    .sort((a, b) => b.order - a.order || b.stage.localeCompare(a.stage));
  return (
    <div className="stack">
      {closed.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="phase-title">Mesas cerradas</p>
          {closed.map((m) => {
            const a = teamById(room, m.teamAId);
            const b = teamById(room, m.teamBId);
            const aWin = m.winnerId === m.teamAId;
            const bWin = m.winnerId === m.teamBId;
            return (
              <div className="history-card" key={m.id}>
                <p className="eyebrow">{STAGE_LABEL[m.stage]} · Mesa {m.order}</p>
                <div className="history-row">
                  <span className={aWin ? "winner" : ""}>{aWin ? "♛ " : ""}{a?.name}</span>
                  <strong>{m.scoreA}</strong>
                </div>
                <div className="history-row">
                  <span className={bWin ? "winner" : ""}>{bWin ? "♛ " : ""}{b?.name}</span>
                  <strong>{m.scoreB}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {room.log.length === 0 ? (
        <div className="empty-state"><div className="glyph">🁩</div><p>Aún no hay jugadas registradas.</p></div>
      ) : (
        <div className="card" style={{ padding: "6px 14px" }}>
          {room.log.map((e) => (
            <div className="log-entry" key={e.ts + e.text}>
              <span className="log-time">{e.time}</span>
              <span>{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Ranking({ room }: { room: Room }) {
  if (room.teams.length === 0) {
    return <div className="empty-state"><div className="glyph">🁤</div><p>El ranking aparece cuando hay equipos.</p></div>;
  }
  const rows = classificationStandings(room);
  return (
    <div className="card" style={{ padding: "8px 14px" }}>
      {rows.map((r, i) => (
        <div className="rank-row" key={r.team.id}>
          <span className="rank-pos">{i + 1}</span>
          <div>
            <div className="rank-name">{r.team.name}</div>
            <div className="rank-sub">
              {r.wins}G · {r.losses}P · dif. {r.diff >= 0 ? "+" : ""}{r.diff}
            </div>
          </div>
          <span className={`badge ${r.isChampion ? "badge-champion" : r.isOut ? "badge-out" : "badge-alive"}`}>
            {r.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Rules() {
  const r = RULES_TEXT;
  return (
    <div className="card rules-doc">
      <h3>1. Puntuación</h3>
      <ol>{r.puntuacion.map((x) => <li key={x}>{x}</li>)}</ol>
      <h3>2. Reglas durante la jugada</h3>
      <ol>{r.jugada.map((x) => <li key={x}>{x}</li>)}</ol>
      <h3>3. Fichas y jugadas</h3>
      <ol>{r.fichas.map((x) => <li key={x}>{x}</li>)}</ol>
      <h3>4. Conducta de los jugadores</h3>
      <ol>{r.conducta.map((x) => <li key={x}>{x}</li>)}</ol>
      <h3>5. Espectadores</h3>
      <ol>{r.espectadores.map((x) => <li key={x}>{x}</li>)}</ol>
      <h3>6. Faltas y penalizaciones</h3>
      <ul>{r.faltas.map((f) => <li key={f.tag}><span className="fault-tag">{f.tag}</span> — {f.detalle}</li>)}</ul>
      <h3>7. Decisiones del árbitro</h3>
      <ol>{r.arbitro.map((x) => <li key={x}>{x}</li>)}</ol>
      <h3>8. Aceptación</h3>
      <p style={{ fontSize: 14.5 }}>La participación implica aceptar este reglamento.</p>
    </div>
  );
}
