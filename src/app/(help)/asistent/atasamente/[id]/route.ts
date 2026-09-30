import { requireRole } from "@/features/auth/session";
import { ASSISTANT_ROLES } from "@/features/assistant/access";
import { attachmentRedirect } from "@/features/assistant/attachment-route";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Deschide (`?descarca=1`: descarca) un atasament propriu din chatul asistentului. */
export async function GET(request: Request, { params }: RouteParams) {
  await requireRole(ASSISTANT_ROLES);
  const { id } = await params;
  const download = new URL(request.url).searchParams.get("descarca") === "1";
  return attachmentRedirect(id, download);
}
