# Catalog client: afisarea imaginilor produselor/abonamentelor

## Problema
In `/catalog` (portal client) cardurile afisau mereu placeholder-ul "foto produs",
desi `listCatalogItems` citea deja `image_url` (bucket public `item-images`, 0021).
`ProductCard` din `catalog-view.tsx` nu folosea `item.imageUrl`.

## Solutie
- Componenta noua `ProductImage` (`src/features/client-portal/product-image.tsx`):
  `<img>` cu `object-contain` daca exista URL; placeholder "foto produs" daca nu
  exista SAU daca imaginea nu se incarca (`onError`).
- `ProductCard` o foloseste.
- Test unitar (`product-image.test.tsx`): cu URL / fara URL / eroare de incarcare.

## Impact asistent AI
`none` - schimbare strict de UI in portalul clientului.
