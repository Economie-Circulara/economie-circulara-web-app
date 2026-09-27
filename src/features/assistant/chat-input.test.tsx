import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "./chat-input";

function setup(value = "salut") {
  const onSubmit = vi.fn();
  const onChange = vi.fn();
  render(
    <>
      <label htmlFor="assistant-input">Mesaj</label>
      <ChatInput value={value} onChange={onChange} onSubmit={onSubmit} />
    </>,
  );
  return { onSubmit, onChange, input: screen.getByLabelText("Mesaj") };
}

describe("ChatInput", () => {
  it("e textarea: Enter trimite mesajul", () => {
    const { onSubmit, input } = setup();
    expect(input.tagName).toBe("TEXTAREA");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Shift+Enter NU trimite (lasa randul nou in text)", () => {
    const { onSubmit, input } = setup();
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Enter in timpul compunerii IME nu trimite", () => {
    const { onSubmit, input } = setup();
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("textul multi-linie ajunge intreg in onChange", () => {
    const { onChange, input } = setup("");
    fireEvent.change(input, { target: { value: "rând 1\nrând 2" } });
    expect(onChange).toHaveBeenCalledWith("rând 1\nrând 2");
  });
});
