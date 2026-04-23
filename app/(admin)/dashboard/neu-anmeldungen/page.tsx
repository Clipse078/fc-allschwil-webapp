import AdminModulePlaceholder from "@/components/admin/shared/AdminModulePlaceholder";

export default function Page() {
  return (
    <AdminModulePlaceholder
      eyebrow="7. Neu Anmeldungen"
      title="Neu Anmeldungen"
      description="Demo-Modulübersicht für neue Trainers, neue Players und neue Vereinsfunktionäre."
      links={[
        { title: "Neue Trainers", description: "Placeholder für neue Traineranmeldungen.", href: "/dashboard/neu-anmeldungen/neue-trainers" },
        { title: "Neue Players", description: "Placeholder für neue Spieleranmeldungen.", href: "/dashboard/neu-anmeldungen/neue-players" },
        { title: "Neue Vereinsfunktionäre", description: "Placeholder für neue Vereinsfunktionär-Anmeldungen.", href: "/dashboard/neu-anmeldungen/neue-vereinsfunktionaere" },
      ]}
    />
  );
}