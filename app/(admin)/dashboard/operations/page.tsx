import AdminModulePlaceholder from "@/components/admin/shared/AdminModulePlaceholder";

export default function Page() {
  return (
    <AdminModulePlaceholder
      eyebrow="2. Operations & Organisation"
      title="Operations & Organisation"
      description="Demo-Modulübersicht für Finanzen, Material, Media, Aktivitäten / Events, Business Club, Archiv, Meetings und Kommunikation HUB."
      links={[
        { title: "2.1 Finanzen", description: "Placeholder für Finanzmodul.", href: "/dashboard/operations/finance" },
        { title: "2.2 Material", description: "Placeholder für Materialmodul.", href: "/dashboard/operations/material" },
        { title: "2.3 Media", description: "Placeholder für Media-Modul.", href: "/dashboard/operations/media" },
        { title: "2.4 Aktivitäten / Events", description: "Placeholder für Aktivitäten / Events.", href: "/dashboard/operations/aktivitaeten-events" },
        { title: "2.5 Business Club", description: "Placeholder für Business Club.", href: "/dashboard/operations/business-club" },
        { title: "2.6 Archiv", description: "Placeholder für Archiv.", href: "/dashboard/operations/archiv" },
        { title: "2.7 Meetings", description: "Placeholder für Operations-Meetings.", href: "/dashboard/operations/meetings" },
        { title: "2.8 Kommunikation HUB", description: "Placeholder für Operations-Kommunikation.", href: "/dashboard/operations/kommunikation-hub" },
      ]}
    />
  );
}