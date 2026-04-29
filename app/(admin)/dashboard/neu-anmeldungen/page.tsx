import Link from "next/link";

export default function NeueAnmeldungenPage() {
  const items = [
    { id: "1", name: "Max Mustermann", type: "Spieler" },
    { id: "2", name: "Anna Trainer", type: "Trainer" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="fca-eyebrow">Neue Anmeldungen</p>
        <h1 className="text-2xl font-black">Eingänge</h1>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={"/dashboard/neu-anmeldungen/" + item.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50"
          >
            <p className="font-bold">{item.name}</p>
            <p className="text-sm text-slate-500">{item.type}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
