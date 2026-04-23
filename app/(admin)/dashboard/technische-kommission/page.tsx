import AdminModulePlaceholder from "@/components/admin/shared/AdminModulePlaceholder";

export default function Page() {
  return (
    <AdminModulePlaceholder
      eyebrow="3. Technische Kommission"
      title="Technische Kommission"
      description="Demo-Modulübersicht für Leistungsplan Aktive, Jugend-Ausbildungsplan, Meetings und Kommunikation HUB."
      links={[
        { title: "3.1 Leistungsplan Aktive", description: "Placeholder für den Leistungsplan der Aktiven.", href: "/dashboard/technische-kommission/leistungsplan-aktive" },
        { title: "3.2 Jugend-Ausbildungsplan", description: "Placeholder für den JOP.", href: "/dashboard/technische-kommission/jugend-ausbildungsplan" },
        { title: "3.3 Meetings", description: "Placeholder für TK-Meetings.", href: "/dashboard/technische-kommission/meetings" },
        { title: "3.4 Kommunikation HUB", description: "Placeholder für TK-Kommunikation.", href: "/dashboard/technische-kommission/kommunikation-hub" },
      ]}
    />
  );
}