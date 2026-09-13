# Logo sidebar si homepage pentru utilizatori autentificati

## Scop

Simplificarea co-brandingului din sidebar si pastrarea homepage-ului public accesibil
si dupa autentificare, cu acces rapid catre zona potrivita rolului utilizatorului.

## Pasi

1. Eliminarea textului „Powered by” din footer-ul sidebarului desktop.
2. Centrarea logo-ului Lot cu Lot, marit la 48 px inaltime, intr-un link catre `/`.
3. Eliminarea redirectului automat al utilizatorului autentificat de pe homepage.
4. Afisarea pentru utilizatorul autentificat a unui CTA evident catre pagina rolului
   si pastrarea CTA-ului de autentificare pentru vizitatori.
5. Actualizarea testelor pentru sidebar si homepage, inclusiv destinatia CTA-ului pe
   fiecare categorie de rol.
6. Rularea testelor, typecheck-ului, lint-ului si build-ului, apoi commit.
