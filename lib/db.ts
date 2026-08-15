import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";
import type { Room } from "./types";

export type StorageKind = "neon" | "upstash" | "file" | "missing";

function postgresUrl(): string | null {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
}

export function storageKind(): StorageKind {
  if (postgresUrl()) return "neon";
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return "upstash";
  }
  if (!process.env.VERCEL) return "file";
  return "missing";
}

let neonReady = false;

async function neonSql() {
  const url = postgresUrl();
  if (!url) throw new Error("NO_DATABASE");
  const sql = neon(url);
  if (!neonReady) {
    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `;
    neonReady = true;
  }
  return sql;
}

const filePath = path.join(process.cwd(), ".data", "rooms.json");

function readFileStore(): Record<string, Room> {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, Room>;
  } catch {
    return {};
  }
}

function writeFileStore(data: Record<string, Room>): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data));
}

async function upstash(body: unknown): Promise<{ result: unknown }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("NO_DATABASE");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("No se pudo hablar con Redis.");
  return res.json() as Promise<{ result: unknown }>;
}

export async function getRoom(code: string): Promise<Room | null> {
  const key = code.trim().toUpperCase();
  const kind = storageKind();
  if (kind === "missing") throw new Error("NO_DATABASE");

  if (kind === "neon") {
    const sql = await neonSql();
    const rows = await sql`SELECT data FROM rooms WHERE code = ${key}`;
    if (!rows[0]) return null;
    const data = rows[0].data;
    return (typeof data === "string" ? JSON.parse(data) : data) as Room;
  }

  if (kind === "upstash") {
    const out = await upstash(["GET", `room:${key}`]);
    if (!out.result) return null;
    return JSON.parse(String(out.result)) as Room;
  }

  const data = readFileStore();
  return data[key] || null;
}

export async function saveRoom(room: Room, expectedUpdatedAt?: number): Promise<boolean> {
  const key = room.code.toUpperCase();
  room.code = key;
  const previous = room.updatedAt;
  room.updatedAt = Date.now();
  const kind = storageKind();
  if (kind === "missing") throw new Error("NO_DATABASE");

  if (kind === "neon") {
    const sql = await neonSql();
    if (expectedUpdatedAt != null) {
      const rows = await sql`
        UPDATE rooms
        SET data = ${JSON.stringify(room)}::jsonb, updated_at = ${room.updatedAt}
        WHERE code = ${key} AND updated_at = ${expectedUpdatedAt}
        RETURNING code
      `;
      if (rows.length === 0) {
        room.updatedAt = previous;
        return false;
      }
      return true;
    }
    await sql`
      INSERT INTO rooms (code, data, updated_at)
      VALUES (${key}, ${JSON.stringify(room)}::jsonb, ${room.updatedAt})
      ON CONFLICT (code)
      DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
    `;
    return true;
  }

  if (kind === "upstash") {
    if (expectedUpdatedAt != null) {
      const current = await getRoom(key);
      if (!current || current.updatedAt !== expectedUpdatedAt) {
        room.updatedAt = previous;
        return false;
      }
    }
    await upstash(["SET", `room:${key}`, JSON.stringify(room)]);
    return true;
  }

  const data = readFileStore();
  if (expectedUpdatedAt != null) {
    const current = data[key];
    if (!current || current.updatedAt !== expectedUpdatedAt) {
      room.updatedAt = previous;
      return false;
    }
  }
  data[key] = room;
  writeFileStore(data);
  return true;
}
