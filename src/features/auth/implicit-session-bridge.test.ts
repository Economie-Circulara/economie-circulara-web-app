import { describe, expect, it, vi } from "vitest";
import { consumeImplicitSession } from "./implicit-session-bridge";

function dependencies(options: { sessionError?: unknown; reject?: boolean } = {}) {
  const events: string[] = [];
  const clearHash = vi.fn(() => events.push("clear"));
  const redirect = vi.fn((path: string) => events.push(`redirect:${path}`));
  const setSession = vi.fn(async () => {
    events.push("session");
    if (options.reject) throw new Error("network error");
    return { error: options.sessionError ?? null };
  });
  return { clearHash, events, redirect, setSession };
}

describe("consumeImplicitSession", () => {
  it("ignora fragmentele care nu apartin Supabase Auth", async () => {
    const deps = dependencies();

    await expect(consumeImplicitSession("#sectiune", deps)).resolves.toBe("ignored");
    expect(deps.clearHash).not.toHaveBeenCalled();
    expect(deps.setSession).not.toHaveBeenCalled();
    expect(deps.redirect).not.toHaveBeenCalled();
  });

  it("sterge tokenurile inainte de validare si continua magic link-ul", async () => {
    const deps = dependencies();

    await expect(
      consumeImplicitSession(
        "#access_token=access-secret&refresh_token=refresh-secret&type=magiclink",
        deps,
      ),
    ).resolves.toBe("authenticated");

    expect(deps.events).toEqual(["clear", "session", "redirect:/"]);
    expect(deps.setSession).toHaveBeenCalledWith({
      access_token: "access-secret",
      refresh_token: "refresh-secret",
    });
  });

  it.each(["recovery", "invite"])(
    "trimite fluxul %s la pagina de setare a parolei",
    async (type) => {
      const deps = dependencies();

      await consumeImplicitSession(`#access_token=access&refresh_token=refresh&type=${type}`, deps);

      expect(deps.redirect).toHaveBeenCalledWith("/set-password");
    },
  );

  it("respinge fragmentele Auth incomplete fara sa transmita un singur token", async () => {
    const deps = dependencies();

    await expect(consumeImplicitSession("#access_token=access-only", deps)).resolves.toBe("failed");

    expect(deps.clearHash).toHaveBeenCalledTimes(1);
    expect(deps.setSession).not.toHaveBeenCalled();
    expect(deps.redirect).toHaveBeenCalledWith("/login?error=auth");
  });

  it("trateaza erorile returnate sau aruncate la validarea sesiunii", async () => {
    const returnedError = dependencies({ sessionError: new Error("invalid") });
    const thrownError = dependencies({ reject: true });
    const hash = "#access_token=access&refresh_token=refresh&type=magiclink";

    await expect(consumeImplicitSession(hash, returnedError)).resolves.toBe("failed");
    await expect(consumeImplicitSession(hash, thrownError)).resolves.toBe("failed");

    expect(returnedError.redirect).toHaveBeenCalledWith("/login?error=auth");
    expect(thrownError.redirect).toHaveBeenCalledWith("/login?error=auth");
  });
});
