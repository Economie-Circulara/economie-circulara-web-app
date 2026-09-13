/**
 * Un punct de plecare al organizatiei (statie de betoane / depozit) - originea
 * folosita la calculul rutelor de livrare. Vezi 0024_route_planning.sql.
 */
export interface OrganizationSite {
  id: string;
  organizationId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  geocodedAt: string | null;
  isDefault: boolean;
  createdAt: string;
}
