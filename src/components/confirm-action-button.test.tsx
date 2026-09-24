import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmActionButton } from "./confirm-action-button";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  refresh.mockReset();
});

function renderButton(action = vi.fn().mockResolvedValue({ error: null }), reasonLabel?: string) {
  render(
    <ConfirmActionButton
      triggerLabel="Arhivează"
      title="Arhivezi acest material?"
      description="Nu mai apare în liste, dar istoricul rămâne."
      confirmLabel="Da, arhivează"
      reasonLabel={reasonLabel}
      action={action}
    />,
  );
  return action;
}

describe("ConfirmActionButton", () => {
  it("NU executa actiunea la click pe buton - doar deschide dialogul de confirmare", () => {
    const action = renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Arhivează" }));

    expect(screen.getByText("Arhivezi acest material?")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("'Renunță' inchide dialogul fara sa execute actiunea", () => {
    const action = renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Arhivează" }));
    fireEvent.click(screen.getByRole("button", { name: "Renunță" }));

    expect(screen.queryByText("Arhivezi acest material?")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("confirmarea executa actiunea si reincarca pagina", async () => {
    const action = renderButton();
    fireEvent.click(screen.getByRole("button", { name: "Arhivează" }));
    fireEvent.click(screen.getByRole("button", { name: "Da, arhivează" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(action).toHaveBeenCalledWith(undefined);
  });

  it("afiseaza eroarea intoarsa de actiune si ramane deschis", async () => {
    const action = vi.fn().mockResolvedValue({ error: "Nu ai acces." });
    renderButton(action);
    fireEvent.click(screen.getByRole("button", { name: "Arhivează" }));
    fireEvent.click(screen.getByRole("button", { name: "Da, arhivează" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nu ai acces.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("cu motiv obligatoriu: confirmarea e dezactivata pana se completeaza motivul", async () => {
    const action = renderButton(undefined, "Motivul anulării");
    fireEvent.click(screen.getByRole("button", { name: "Arhivează" }));

    const confirm = screen.getByRole("button", { name: "Da, arhivează" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Motivul anulării"), {
      target: { value: "  introdus de două ori  " },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(action).toHaveBeenCalledWith("introdus de două ori"));
  });
});
