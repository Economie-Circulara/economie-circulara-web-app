"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import type * as React from "react";
import * as cartLogic from "./cart-logic";
import type { CartLine } from "./types";

const STORAGE_KEY = "lateris-trace:cart:v1";

type CartAction =
  | { type: "add"; line: CartLine }
  | { type: "remove"; itemId: string }
  | { type: "setQuantity"; itemId: string; quantity: number }
  | { type: "replace"; lines: CartLine[] }
  | { type: "clear" };

function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case "add":
      return cartLogic.addLine(state, action.line);
    case "remove":
      return cartLogic.removeLine(state, action.itemId);
    case "setQuantity":
      return cartLogic.setQuantity(state, action.itemId, action.quantity);
    case "replace":
      return action.lines;
    case "clear":
      return [];
    default:
      return state;
  }
}

function readInitialCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    return [];
  }
}

export interface CartContextValue {
  lines: CartLine[];
  addItem: (line: CartLine) => void;
  removeItem: (itemId: string) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  /** Inlocuieste tot cosul (folosit de „Repetă comanda"). */
  replaceCart: (lines: CartLine[]) => void;
  clearCart: () => void;
  totalLines: number;
  totalQuantity: number;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Cosul clientului: stare client-side (nu persista in DB pana la „Trimite
 * comanda"), sincronizata cu `localStorage` ca sa supravietuiasca navigarii intre
 * `/catalog` si `/comenzile-mele` (necesar pentru „Repetă comanda" — vezi
 * `repeat-order-button.tsx`, care apeleaza `replaceCart` apoi navigheaza la
 * `/catalog`). Montat o singura data in `(client)/layout.tsx`.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, dispatch] = useReducer(cartReducer, [], readInitialCart);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // localStorage indisponibil (mod privat/quota) — cosul ramane doar in memorie.
    }
  }, [lines]);

  const addItem = useCallback((line: CartLine) => dispatch({ type: "add", line }), []);
  const removeItem = useCallback((itemId: string) => dispatch({ type: "remove", itemId }), []);
  const setQuantityFn = useCallback(
    (itemId: string, quantity: number) => dispatch({ type: "setQuantity", itemId, quantity }),
    [],
  );
  const replaceCart = useCallback(
    (next: CartLine[]) => dispatch({ type: "replace", lines: next }),
    [],
  );
  const clearCart = useCallback(() => dispatch({ type: "clear" }), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      addItem,
      removeItem,
      setQuantity: setQuantityFn,
      replaceCart,
      clearCart,
      totalLines: cartLogic.totalLines(lines),
      totalQuantity: cartLogic.totalQuantity(lines),
    }),
    [lines, addItem, removeItem, setQuantityFn, replaceCart, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart trebuie folosit in interiorul <CartProvider>.");
  return ctx;
}
