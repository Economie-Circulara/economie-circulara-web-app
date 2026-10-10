import { describe, expect, it } from "vitest";
import {
  CLIENT_NAV,
  STAFF_NAV,
  STAFF_NAV_FLUX,
  filterStaffNav,
  flattenNavEntries,
  navForRole,
  type AppRole,
} from "./nav-config";

const hrefs = (entries: Parameters<typeof flattenNavEntries>[0]) =>
  flattenNavEntries(entries)
    .map((item) => item.href)
    .sort();

describe("organizarea `flux` a meniului", () => {
  it("contine exact aceleasi pagini ca meniul standard (doar alta grupare)", () => {
    expect(hrefs(STAFF_NAV_FLUX)).toEqual(hrefs(STAFF_NAV));
  });

  it.each<AppRole>(["admin", "operator", "client"])(
    "rolul %s vede aceleasi pagini in ambele organizari",
    (role) => {
      expect(hrefs(navForRole(role, "flux"))).toEqual(hrefs(navForRole(role, "standard")));
    },
  );

  it("pastreaza rolurile canonice (operatorul nu vede setarile)", () => {
    const operatorHrefs = hrefs(navForRole("operator", "flux"));
    expect(operatorHrefs).not.toContain("/setari");
    expect(operatorHrefs).toContain("/productie");
  });

  it("schimba ordinea/gruparea vizibila", () => {
    const flux = navForRole("admin", "flux");
    const standard = navForRole("admin", "standard");
    expect(flux.map((e) => e.label)).not.toEqual(standard.map((e) => e.label));
    expect(navForRole("client", "flux")[0]?.label).toBe("Comenzile mele");
    expect(navForRole("client")[0]?.label).toBe(CLIENT_NAV[0]?.label);
  });
});

describe("asistentul AI in meniu", () => {
  it.each<AppRole>(["admin", "operator"])("staff-ul (%s) are asistentul", (role) => {
    expect(hrefs(navForRole(role))).toContain("/asistent");
  });

  it.each(["standard", "flux"] as const)("clientul nu are asistentul (%s)", (layout) => {
    const clientHrefs = hrefs(navForRole("client", layout));
    expect(clientHrefs).not.toContain("/asistent");
    expect(clientHrefs).toContain("/ajutor");
  });
});

describe("paginile modulelor optionale", () => {
  const nav = [
    { label: "Comenzi", href: "/comenzi", icon: "orders", roles: ["admin", "operator"] },
    {
      key: "g",
      label: "Grup",
      items: [
        {
          label: "Flotă",
          href: "/flota",
          icon: "deliveries",
          roles: ["admin", "operator"],
          module: "fleet",
        },
      ],
    },
  ] satisfies Parameters<typeof filterStaffNav>[0];

  it("ascunde pagina (si grupul ramas gol) cand modulul nu e activ", () => {
    expect(hrefs(filterStaffNav(nav, "admin", []))).toEqual(["/comenzi"]);
    expect(filterStaffNav(nav, "admin", []).map((e) => e.label)).toEqual(["Comenzi"]);
  });

  it("arata pagina cand modulul e activ, tot filtrata pe rol", () => {
    expect(hrefs(filterStaffNav(nav, "operator", ["fleet"]))).toEqual(["/comenzi", "/flota"]);
    expect(hrefs(filterStaffNav(nav, "client", ["fleet"]))).toEqual([]);
  });
});
