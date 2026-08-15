import { NextResponse } from "next/server";
import { applyAction } from "@/lib/actions";
import { getRoom, saveRoom } from "@/lib/db";
import { publicRoom } from "@/lib/tournament";
import type { ActionName, ActionPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

function adminFrom(request: Request, bodyAdmin?: string): string {
  return (
    request.headers.get("x-admin-code") ||
    bodyAdmin ||
    ""
  )
    .trim()
    .toUpperCase();
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const { code } = await ctx.params;
    const room = await getRoom(code);
    if (!room) {
      return NextResponse.json({ error: "No se encontró esa sala." }, { status: 404 });
    }
    const isAdmin = adminFrom(request) === room.adminCode;
    return NextResponse.json({ room: publicRoom(room, isAdmin), isAdmin });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer la sala.";
    if (message === "NO_DATABASE") {
      return NextResponse.json(
        { error: "Falta la base de datos. Conecta Neon o Upstash en Vercel." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { code } = await ctx.params;
    const body = (await request.json()) as {
      action: ActionName;
      payload?: ActionPayload;
      adminCode?: string;
      memberId?: string;
    };
    const expectedUpdatedAt = Number(request.headers.get("x-room-updated") || "") || undefined;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const room = await getRoom(code);
      if (!room) {
        return NextResponse.json({ error: "No se encontró esa sala." }, { status: 404 });
      }
      const isAdmin = adminFrom(request, body.adminCode) === room.adminCode;
      const member = room.members.find((m) => m.id === body.memberId);
      const casAt = attempt === 0 && expectedUpdatedAt ? expectedUpdatedAt : room.updatedAt;
      const result = applyAction(room, body.action, body.payload || {}, {
        isAdmin,
        member,
      });
      const saved = await saveRoom(result.room, casAt);
      if (!saved) continue;
      return NextResponse.json({
        room: publicRoom(result.room, isAdmin),
        isAdmin,
        memberId: result.memberId || body.memberId,
      });
    }
    return NextResponse.json(
      { error: "La sala se actualizó al mismo tiempo. Intenta de nuevo." },
      { status: 409 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudo guardar.";
    if (message === "NO_DATABASE") {
      return NextResponse.json(
        { error: "Falta la base de datos. Conecta Neon o Upstash en Vercel." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
