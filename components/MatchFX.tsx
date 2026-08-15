"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { teamById } from "@/lib/tournament";
import type { Room } from "@/lib/types";

type FxKind = "thirty" | "win" | "lose" | "champ";

interface FxEvent {
  id: number;
  kind: FxKind;
  title: string;
  subtitle: string;
}

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

export function unlockAudio() {
  const c = ctx();
  if (c && c.state === "suspended") void c.resume();
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain = 0.1,
  slideTo?: number,
) {
  const c = ctx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 4200;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, slideTo),
      c.currentTime + start + dur,
    );
  }
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.03);
}

/** Bright coin / chip hit */
function coin(start: number, gain = 0.07) {
  const f = 1400 + Math.random() * 1600;
  tone(f, start, 0.09, "square", gain * 0.7);
  tone(f * 1.5, start, 0.12, "sine", gain);
  tone(f * 0.5, start + 0.01, 0.08, "triangle", gain * 0.4);
}

function coinRain(count: number, baseStart: number, gap = 0.038) {
  for (let i = 0; i < count; i += 1) {
    coin(baseStart + i * gap, 0.045 + Math.random() * 0.04);
  }
}

/** Classic casino ding */
function ding(freq: number, start: number, gain = 0.14) {
  tone(freq, start, 0.55, "sine", gain);
  tone(freq * 2, start, 0.35, "triangle", gain * 0.45);
  tone(freq * 3, start, 0.22, "sine", gain * 0.2);
}

/** Suspense spin-up then jackpot */
function jackpotRise(start: number) {
  const steps = [400, 480, 560, 680, 820, 980, 1180];
  steps.forEach((f, i) => {
    tone(f, start + i * 0.055, 0.07, "sawtooth", 0.05 + i * 0.008, f * 1.08);
  });
}

function playCasinoThirty() {
  unlockAudio();
  // 1) Slot anticipation
  jackpotRise(0);
  // 2) Triple ding — "¡premio!"
  ding(880, 0.42, 0.16);
  ding(1174.7, 0.58, 0.18);
  ding(1568, 0.76, 0.22);
  // 3) Coin storm
  coinRain(22, 0.72, 0.032);
  // 4) Big rising fanfare (motivating / gordo)
  const fanfare = [523.25, 659.25, 783.99, 987.77, 1174.7, 1396.9, 1760];
  fanfare.forEach((n, i) => {
    const t = 0.95 + i * 0.085;
    tone(n, t, 0.32, "triangle", 0.13);
    tone(n * 2, t, 0.2, "sine", 0.05);
    tone(n / 2, t, 0.28, "sine", 0.04);
  });
  // 5) Sustained victory chord
  tone(523.25, 1.55, 0.9, "sine", 0.09);
  tone(659.25, 1.55, 0.9, "triangle", 0.1);
  tone(783.99, 1.55, 1.0, "sine", 0.11);
  tone(1046.5, 1.6, 1.1, "sine", 0.12);
  tone(1568, 1.7, 0.8, "triangle", 0.08);
  // 6) Extra payout coins
  coinRain(16, 1.55, 0.04);
  coinRain(10, 2.15, 0.045);
}

/** Short tally / chip when summing normal points */
function playScoreAdd(delta: number) {
  unlockAudio();
  if (delta < 0) {
    tone(320, 0, 0.12, "triangle", 0.07);
    tone(240, 0.08, 0.16, "sine", 0.05);
    return;
  }
  const hits = Math.min(5, Math.max(1, Math.round(Math.abs(delta) / 8)));
  for (let i = 0; i < hits; i += 1) {
    coin(i * 0.05, 0.055 + i * 0.008);
  }
  ding(740 + Math.min(delta, 40) * 8, hits * 0.05, 0.1);
  tone(523.25, hits * 0.05 + 0.04, 0.18, "triangle", 0.06);
}

function playCasinoWin() {
  unlockAudio();
  jackpotRise(0);
  ding(987.77, 0.38, 0.15);
  ding(1318.5, 0.55, 0.18);
  coinRain(14, 0.5, 0.035);
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
  notes.forEach((n, i) => {
    tone(n, 0.65 + i * 0.09, 0.28, "triangle", 0.12);
    tone(n * 2, 0.65 + i * 0.09, 0.16, "sine", 0.045);
  });
  tone(1046.5, 1.3, 0.7, "sine", 0.1);
  tone(1318.5, 1.35, 0.75, "triangle", 0.09);
  coinRain(8, 1.25, 0.04);
}

function playCasinoLose() {
  unlockAudio();
  coinRain(3, 0, 0.06);
  tone(392, 0.08, 0.2, "triangle", 0.08);
  tone(311.13, 0.22, 0.28, "sine", 0.07);
  tone(233.08, 0.42, 0.42, "triangle", 0.06, 180);
}

function playCasinoChamp() {
  unlockAudio();
  jackpotRise(0);
  ding(880, 0.4, 0.14);
  ding(1174.7, 0.55, 0.16);
  ding(1568, 0.7, 0.2);
  ding(2093, 0.88, 0.18);
  coinRain(20, 0.7, 0.03);
  const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093];
  fanfare.forEach((n, i) => {
    tone(n, 0.95 + i * 0.08, 0.3, "triangle", 0.13);
    tone(n * 0.5, 0.95 + i * 0.08, 0.24, "sine", 0.05);
  });
  tone(523.25, 1.6, 1.0, "sine", 0.08);
  tone(783.99, 1.6, 1.05, "triangle", 0.1);
  tone(1046.5, 1.65, 1.1, "sine", 0.12);
  tone(1568, 1.75, 0.9, "sine", 0.09);
  coinRain(14, 1.7, 0.038);
}

function palette(kind: FxKind) {
  if (kind === "lose") {
    return {
      bg: 0x1a0c10,
      accent: 0xd21e32,
      glow: 0xf5a3a8,
      chip: 0x8b1e2d,
    };
  }
  if (kind === "champ") {
    return {
      bg: 0x120e05,
      accent: 0xffd24a,
      glow: 0xffe38a,
      chip: 0xc9a227,
    };
  }
  if (kind === "thirty") {
    return {
      bg: 0x0d1a0f,
      accent: 0xffd24a,
      glow: 0xffe38a,
      chip: 0xd21e32,
    };
  }
  return {
    bg: 0x0a1a13,
    accent: 0xffd24a,
    glow: 0x19c6ff,
    chip: 0xd21e32,
  };
}

function makeChip(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.1, 32),
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.35,
      roughness: 0.35,
      emissive: color,
      emissiveIntensity: 0.12,
    }),
  );
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.035, 10, 36),
    new THREE.MeshStandardMaterial({
      color: 0xf6f1e3,
      metalness: 0.2,
      roughness: 0.5,
    }),
  );
  rim.rotation.x = Math.PI / 2;
  g.add(body, rim);
  return g;
}

function makeDomino(): THREE.Group {
  const g = new THREE.Group();
  const tile = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 1.05, 0.14),
    new THREE.MeshStandardMaterial({
      color: 0xf6f1e3,
      metalness: 0.05,
      roughness: 0.45,
    }),
  );
  const pipMat = new THREE.MeshStandardMaterial({
    color: 0x14231b,
    roughness: 0.6,
  });
  for (const [x, y] of [
    [-0.12, 0.28],
    [0.12, 0.28],
    [0, 0.08],
    [-0.12, -0.28],
    [0.12, -0.28],
  ] as const) {
    const pip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), pipMat);
    pip.position.set(x, y, 0.08);
    g.add(pip);
  }
  g.add(tile);
  return g;
}

function CasinoScene({ kind }: { kind: FxKind }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const colors = palette(kind);
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(colors.bg, 0.045);

    const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 80);
    camera.position.set(0, 2.2, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const key = new THREE.DirectionalLight(colors.glow, 1.35);
    key.position.set(4, 8, 5);
    const fill = new THREE.PointLight(colors.accent, 2.2, 28);
    fill.position.set(-3, 2, 4);
    const rim = new THREE.PointLight(colors.chip, 1.6, 20);
    rim.position.set(2, -1, -2);
    scene.add(ambient, key, fill, rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 64),
      new THREE.MeshStandardMaterial({
        color: colors.bg,
        metalness: 0.7,
        roughness: 0.25,
        emissive: colors.accent,
        emissiveIntensity: kind === "lose" ? 0.04 : 0.08,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.6;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.06, 12, 80),
      new THREE.MeshStandardMaterial({
        color: colors.accent,
        emissive: colors.accent,
        emissiveIntensity: 0.8,
        metalness: 0.9,
        roughness: 0.2,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.45;
    scene.add(ring);

    type Piece = {
      mesh: THREE.Object3D;
      vel: THREE.Vector3;
      spin: THREE.Vector3;
    };
    const pieces: Piece[] = [];
    const chipColors = [colors.chip, colors.accent, 0x0d2118, 0xf6f1e3, 0x19c6ff];

    const count = kind === "champ" ? 28 : kind === "thirty" ? 24 : kind === "win" ? 20 : 12;
    for (let i = 0; i < count; i += 1) {
      const isDomino = i % 4 === 0;
      const mesh = isDomino ? makeDomino() : makeChip(chipColors[i % chipColors.length]);
      mesh.position.set(
        (Math.random() - 0.5) * 5,
        3 + Math.random() * 4,
        (Math.random() - 0.5) * 4,
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      scene.add(mesh);
      pieces.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.08,
          kind === "lose" ? -0.02 - Math.random() * 0.04 : 0.04 + Math.random() * 0.06,
          (Math.random() - 0.5) * 0.06,
        ),
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 0.12,
          (Math.random() - 0.5) * 0.18,
          (Math.random() - 0.5) * 0.1,
        ),
      });
    }

    // Center pedestal orb
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 1),
      new THREE.MeshStandardMaterial({
        color: colors.accent,
        emissive: colors.glow,
        emissiveIntensity: 0.65,
        metalness: 0.85,
        roughness: 0.15,
        wireframe: kind === "lose",
      }),
    );
    orb.position.y = 0.2;
    scene.add(orb);

    let frame = 0;
    let raf = 0;
    const gravity = kind === "lose" ? -0.0035 : -0.0018;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      frame += 1;
      const t = frame * 0.016;

      orb.rotation.y += kind === "lose" ? 0.01 : 0.03;
      orb.rotation.x = Math.sin(t * 1.4) * 0.2;
      orb.position.y = 0.2 + Math.sin(t * 2.2) * 0.12;
      ring.rotation.z += 0.008;
      fill.intensity = 1.8 + Math.sin(t * 4) * 0.5;

      for (const p of pieces) {
        p.vel.y += gravity;
        p.mesh.position.add(p.vel);
        p.mesh.rotation.x += p.spin.x;
        p.mesh.rotation.y += p.spin.y;
        if (p.mesh.position.y < -1.4) {
          p.mesh.position.y = -1.4;
          p.vel.y *= -0.45;
          p.vel.x *= 0.92;
          if (Math.abs(p.vel.y) < 0.02) p.vel.y = 0;
        }
      }

      camera.position.x = Math.sin(t * 0.35) * 0.35;
      camera.lookAt(0, 0.1, 0);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [kind]);

  return <div className="fx-canvas" ref={mountRef} aria-hidden />;
}

export default function MatchFX({
  room,
  myTeamId,
}: {
  room: Room;
  myTeamId: string | null;
}) {
  const primed = useRef(false);
  const seen = useRef({
    logs: new Set<string>(),
    done: new Set<string>(),
    champ: null as string | null,
  });
  const [event, setEvent] = useState<FxEvent | null>(null);

  useEffect(() => {
    const logs = new Set<string>();
    const done = new Set<string>();
    for (const match of room.matches) {
      for (const line of match.log) {
        logs.add(`${match.id}:${line.ts}:${line.delta}:${line.side}`);
      }
      if (match.status === "done") done.add(match.id);
    }
    if (!primed.current) {
      seen.current = { logs, done, champ: room.champion };
      primed.current = true;
      return;
    }

    for (const match of room.matches) {
      for (const line of match.log) {
        const key = `${match.id}:${line.ts}:${line.delta}:${line.side}`;
        if (seen.current.logs.has(key)) continue;
        seen.current.logs.add(key);
        if (typeof line.delta !== "number" || !line.delta) continue;
        if (line.delta === 30) {
          const team = teamById(room, line.side === "A" ? match.teamAId : match.teamBId);
          playCasinoThirty();
          setEvent({
            id: Date.now(),
            kind: "thirty",
            title: "¡+30!",
            subtitle: team ? team.name : "Mesa",
          });
        } else {
          playScoreAdd(line.delta);
        }
      }
      if (match.status === "done" && match.winnerId && !seen.current.done.has(match.id)) {
        seen.current.done.add(match.id);
        const winner = teamById(room, match.winnerId);
        const mine =
          myTeamId && (match.teamAId === myTeamId || match.teamBId === myTeamId);
        if (mine && match.winnerId === myTeamId) {
          playCasinoWin();
          setEvent({
            id: Date.now() + 1,
            kind: "win",
            title: "¡Ganaron!",
            subtitle: winner ? winner.name : "Su grupo",
          });
        } else if (mine) {
          playCasinoLose();
          setEvent({
            id: Date.now() + 1,
            kind: "lose",
            title: "Perdieron la mesa",
            subtitle: winner ? `Ganó ${winner.name}` : "Sigue el torneo",
          });
        } else {
          playCasinoWin();
          setEvent({
            id: Date.now() + 1,
            kind: "win",
            title: "Mesa cerrada",
            subtitle: winner ? `Ganó ${winner.name}` : "Hay ganador",
          });
        }
      }
    }

    if (room.champion && room.champion !== seen.current.champ) {
      seen.current.champ = room.champion;
      const champ = teamById(room, room.champion);
      const mine = myTeamId === room.champion;
      if (mine) playCasinoChamp();
      else if (myTeamId) playCasinoLose();
      else playCasinoChamp();
      setEvent({
        id: Date.now() + 2,
        kind: mine ? "champ" : myTeamId ? "lose" : "champ",
        title: mine ? "¡Campeones del Patio!" : "Campeón de El Patio",
        subtitle: champ ? champ.name : "",
      });
    }
  }, [myTeamId, room]);

  useEffect(() => {
    if (!event) return;
    const ms = event.kind === "champ" ? 4500 : event.kind === "thirty" ? 3800 : 3400;
    const t = window.setTimeout(() => setEvent(null), ms);
    return () => window.clearTimeout(t);
  }, [event]);

  if (!event) return null;

  return (
    <div className={`fx-overlay fx-${event.kind}`} role="status" aria-live="polite">
      <CasinoScene kind={event.kind} />
      <div className="fx-card">
        <p className="fx-kicker">
          {event.kind === "thirty"
            ? "¡PREMIO GORDO!"
            : event.kind === "lose"
              ? "RESULTADO"
              : "EL PATIO"}
        </p>
        <h2>{event.title}</h2>
        {event.subtitle && <p>{event.subtitle}</p>}
      </div>
    </div>
  );
}
