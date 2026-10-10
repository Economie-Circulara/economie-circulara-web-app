import { attachmentRedirect } from "@/features/assistant/attachment-route";
import { requireAssistantUser } from "@/features/assistant/guard";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Deschide (`?descarca=1`: descarca) un atasament propriu din chatul asistentului. */
export async function GET(request: Request, { params }: RouteParams) {
  await requireAssistantUser();
  const { id } = await params;
  const download = new URL(request.url).searchParams.get("descarca") === "1";
  return attachmentRedirect(id, download);
}
