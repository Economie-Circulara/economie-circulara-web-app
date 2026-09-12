# Plan: font sigur pentru diacritice in PDF-uri

- Adaug un helper comun pentru fonturile PDF care inregistreaza o familie cu suport complet pentru diacritice romanesti.
- Inlocuiesc fonturile standard PDF (`Helvetica` / `Courier`) din aviz, certificat si rapoarte cu familia inregistrata.
- Adaug teste unitare pentru inregistrarea fontului si pentru folosirea familiei comune in exportul PDF.
- Rulez testele relevante, apoi `typecheck` si `lint` daca timpul permite.
