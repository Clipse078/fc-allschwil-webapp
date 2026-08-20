import { Badge } from "@/components/ui/Badge";
import { PageShell, PageHeader, PageBreadcrumbs } from "@/components/ui/page";
import { FinanzenTabNav } from "@/components/finanzen/FinanzenTabNav";
import { RechnungenView } from "@/components/finanzen/RechnungenView";

export default function RechnungenPage() {
  return (
    <PageShell>
      <PageBreadcrumbs
        items={[
          { label: "Vereinsleitung", href: "/vereinsleitung" },
          { label: "Finanzen", href: "/vereinsleitung/finanzen" },
          { label: "Rechnungen" },
        ]}
      />

      <PageHeader
        eyebrow="Finanzen"
        title="Fakturierung & Rechnungen"
        description="Rechnungen für Mitglieder, Sponsoren und Partner — interaktive Demo-Ansicht."
        badge={<Badge variant="warning">In Entwicklung</Badge>}
      />

      <FinanzenTabNav />

      <RechnungenView />
    </PageShell>
  );
}
