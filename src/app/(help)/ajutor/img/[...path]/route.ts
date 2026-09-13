import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireUser } from "@/features/auth/session";
import { resolveManualImagePath } from "@/features/manual/image-path";

/**
 * Serveste capturile de ecran ale manualului din `docs/manual/img/`. Folderul e in
 * afara lui `public/` intentionat: markdown-ul din `docs/` ramane sursa unica (se
 * citeste si pe GitHub), iar imaginile raman accesibile doar autentificat.
 *
 * `middleware.ts` exclude din matcher caile `.png`, deci guard-ul se face aici.
 * `next/image` nu poate consuma ruta (optimizatorul cere fara cookie-urile
 * userului) - `manual-content.tsx` randeaza `<img>` simplu.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  await requireUser();

  const { path: segments } = await params;
  const file = resolveManualImagePath(segments);
  if (!file) return new NextResponse("Not found", { status: 404 });

  try {
    const bytes = await readFile(file);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/png",
        // Imutabile per deploy; `private` fiindca ruta e autentificata.
        "Cache-Control": "private, max-age=604800, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
