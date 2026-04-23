import AdminModulePlaceholder from "@/components/admin/shared/AdminModulePlaceholder";

export default function Page() {
  return (
    <AdminModulePlaceholder
      eyebrow="5. Next Season"
      title="Next Season"
      description="Demo-Modulübersicht für die kommende Saison mit Teams, Planner, Jahresplan, Wochenplan und Tagesplan."
      links={[
        { title: "Teams", description: "Placeholder für Teams der nächsten Saison.", href: "/dashboard/next-season/teams" },
        { title: "Planner", description: "Placeholder für Planner der nächsten Saison.", href: "/dashboard/next-season/planner" },
        { title: "Jahresplan", description: "Placeholder für Jahresplan der nächsten Saison.", href: "/dashboard/next-season/jahresplan" },
        { title: "Wochenplan", description: "Placeholder für Wochenplan der nächsten Saison.", href: "/dashboard/next-season/wochenplan" },
        { title: "Tagesplan", description: "Placeholder für Tagesplan der nächsten Saison.", href: "/dashboard/next-season/tagesplan" },
      ]}
    />
  );
}