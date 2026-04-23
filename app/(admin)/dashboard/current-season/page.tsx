import AdminModulePlaceholder from "@/components/admin/shared/AdminModulePlaceholder";

export default function Page() {
  return (
    <AdminModulePlaceholder
      eyebrow="4. Current Season"
      title="Current Season"
      description="Modulübersicht für die laufende Saison mit Teams, Planner, Jahresplan, Wochenplan und Tagesplan."
      links={[
        { title: "Teams", description: "Bestehender Teams-Bereich der aktuellen Saison.", href: "/dashboard/teams" },
        { title: "Planner", description: "Bestehender Planner-Einstieg der aktuellen Saison.", href: "/dashboard/planner" },
        { title: "Jahresplan", description: "Bestehender Jahresplan der aktuellen Saison.", href: "/dashboard/planner" },
        { title: "Wochenplan", description: "Bestehender Wochenplan der aktuellen Saison.", href: "/dashboard/planner/week" },
        { title: "Tagesplan", description: "Bestehender Tagesplan der aktuellen Saison.", href: "/dashboard/planner/day" },
      ]}
    />
  );
}