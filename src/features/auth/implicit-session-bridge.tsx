"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface ImplicitSessionDependencies {
  clearHash: () => void;
  redirect: (path: string) => void;
  setSession: (tokens: {
    access_token: string;
    refresh_token: string;
  }) => Promise<{ error: unknown }>;
}

export type ImplicitSessionResult = "ignored" | "authenticated" | "failed";

function isAuthFragment(params: URLSearchParams): boolean {
  return ["access_token", "refresh_token", "error", "error_code", "error_description"].some((key) =>
    params.has(key),
  );
}

/**
 * Compatibilitate pentru linkurile Supabase generate prin fluxul implicit.
 *
 * Fragmentul nu ajunge la server. Il eliminam inainte de orice operatie asincrona,
 * apoi lasam browser client-ul SSR sa valideze tokenurile si sa le persiste in cookies.
 */
export async function consumeImplicitSession(
  hash: string,
  dependencies: ImplicitSessionDependencies,
): Promise<ImplicitSessionResult> {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  if (!isAuthFragment(params)) return "ignored";

  dependencies.clearHash();

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (params.has("error") || params.has("error_code") || !accessToken || !refreshToken) {
    dependencies.redirect("/login?error=auth");
    return "failed";
  }

  try {
    const { error } = await dependencies.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      dependencies.redirect("/login?error=auth");
      return "failed";
    }
  } catch {
    dependencies.redirect("/login?error=auth");
    return "failed";
  }

  const type = params.get("type");
  dependencies.redirect(type === "recovery" || type === "invite" ? "/set-password" : "/");
  return "authenticated";
}

/** Ruleaza o singura data in browser; nu randeaza si nu expune tokenurile in DOM. */
export function ImplicitSessionBridge() {
  useEffect(() => {
    void consumeImplicitSession(window.location.hash, {
      clearHash() {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
      },
      redirect(path) {
        window.location.replace(path);
      },
      async setSession(tokens) {
        return createClient().auth.setSession(tokens);
      },
    });
  }, []);

  return null;
}
