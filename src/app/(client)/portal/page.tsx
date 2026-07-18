import { redirect } from "next/navigation";

export const metadata = { title: "Portal — Lateris Trace" };

/** `/portal` e doar ruta „acasa” a rolului client (vezi `homePathForRole`) — redirect la catalog. */
export default function PortalPage() {
  redirect("/catalog");
}
