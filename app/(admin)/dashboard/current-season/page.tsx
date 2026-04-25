import AdminModulePlaceholder from "@/components/admin/shared/AdminModulePlaceholder";

export default function Page() {
  return (
    <AdminModulePlaceholder
      eyebrow="4. Aktuelle Saison"
      title="Aktuelle Saison"
      description="Modulübersicht für die laufende Saison mit Teams, Jahresplan, Wochenplan, Platzreservation und Infoboard."
      links={[
        { title: "Teams", description: "Teams, Spieler und Trainer der aktuellen Saison verwalten.", href: "/dashboard/teams" },
        { title: "Jahresplan", description: "Langfristige Saisonplanung öffnen.", href: "/dashboard/planner" },
        { title: "Wochenplan", description: "Operative Wochenplanung öffnen.", href: "/dashboard/planner/week" },
        { title: "Platz reservieren", description: "Platzreservationen erfassen und prüfen.", href: "/dashboard/planner/reserve" },
        { title: "Infoboard", description: "Infoboard verwalten und Live-Ansicht öffnen.", href: "/dashboard/infoboard" },
      ]}
    />
  );
}
