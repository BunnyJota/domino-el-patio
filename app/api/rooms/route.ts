import { NextResponse } from "next/server";
import { storageKind } from "@/lib/db";
import { saveRoom } from "@/lib/db";
import { createRoom } from "@/lib/tournament";
import type { RoomMode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ storage: storageKind() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      mode?: RoomMode;
      target?: number;
    };
    const room = createRoom({
      name: (body.name || "Torneo El Patio").trim(),
      mode: body.mode === "equipos" ? "equipos" : "individual",
      target: Number(body.target) || 200,
    });
    const ok = await saveRoom(room);
    if (!ok) {
      return NextResponse.json({ error: "No se pudo crear la sala." }, { status: 500 });
    }
    return NextResponse.json({ room, adminCode: room.adminCode });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear la sala.";
    if (message === "NO_DATABASE") {
      return NextResponse.json(
        {
          error:
            "Falta la base de datos. En Vercel conecta Neon (DATABASE_URL) o Upstash Redis.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
