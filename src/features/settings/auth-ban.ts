import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Durata "ban"-ului Supabase Auth pentru un cont dezactivat (~100 de ani). Supabase
 * nu are "ban permanent" explicit; reactivarea trimite `none`.
 */
const BAN_FOREVER = "876000h";

/**
 * Blocheaza (`banned = true`) sau deblocheaza logarea unor conturi direct in Supabase
 * Auth (migrarea 0035 - dezactivare utilizator / arhivare client). Best-effort: sursa
 * de adevar ramane `profiles.status` (garda din middleware/`requireUser` + `app.role()`
 * in RLS); ban-ul doar face ca logarea sa fie refuzata din start si sa invalideze
 * refresh token-urile. O eroare aici NU anuleaza dezactivarea - se jurnalizeaza.
 * Intoarce `true` daca toate conturile au fost actualizate.
 */
export async function setAuthUsersBanned(userIds: string[], banned: boolean): Promise<boolean> {
  if (userIds.length === 0) return true;

  let allOk = true;
  try {
    const admin = createAdminClient();
    for (const id of userIds) {
      const { error } = await admin.auth.admin.updateUserById(id, {
        ban_duration: banned ? BAN_FOREVER : "none",
      });
      if (error) {
        allOk = false;
        console.error(
          `[auth-ban] nu am putut ${banned ? "bloca" : "debloca"} contul ${id}:`,
          error,
        );
      }
    }
  } catch (err) {
    console.error("[auth-ban] clientul admin Supabase nu e disponibil:", err);
    return false;
  }
  return allOk;
}

/** Id-urile utilizatorilor-client legati de o firma-client (clientul admin - operatorul nu vede profilele). */
export async function listClientUserIds(clientId: string): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("profiles").select("id").eq("client_id", clientId);
    if (error) return [];
    return (data ?? []).map((row) => row.id);
  } catch {
    return [];
  }
}
