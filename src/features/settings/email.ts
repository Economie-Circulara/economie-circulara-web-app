// Fisier separat (fara "use server") ca sa poata fi importat atat din server actions
// ("use server" permite doar export de functii async - vezi action-state.ts) cat si
// dintr-un client component (client-form.tsx), pentru validare identica pe ambele
// parti a adresei de email folosite la invitarea clientului in portal.

/** Validare minimala de format email - server-side (user-actions.ts) si client-side (client-form.tsx). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
