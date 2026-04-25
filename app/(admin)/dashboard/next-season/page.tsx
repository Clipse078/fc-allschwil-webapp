import AdminModulePlaceholder from "@/components/admin/shared/AdminModulePlaceholder";

export default function Page() {
  return (
    <AdminModulePlaceholder
      eyebrow="5. Nächste Saison"
      title="Nächste Saison"
      description="Vorbereitung der kommenden Saison mit Teams, Spielern und Trainern."
      links={[
        { title: "Teams", description: "Teams, Spieler und Trainer für die nächste Saison vorbereiten.", href: "/dashboard/next-season/teams" },
      ]}
    />
  );
}
