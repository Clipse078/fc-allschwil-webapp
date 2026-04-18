const DECISIONS = [
  {
    date: "10. Apr 2025",
    title: "Budget 2025/26 genehmigt",
    tag: "Finanzen",
  },
  {
    date: "05. Apr 2025",
    title: "Neuer Ausrüstervertrag unterschrieben",
    tag: "Infrastruktur",
  },
  {
    date: "28. Mär 2025",
    title: "Junioren-Camps Daten fixiert",
    tag: "Sport",
  },
];

function getTagClass(tag: string) {
  switch (tag) {
    case "Finanzen":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Infrastruktur":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Sport":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function VereinsleitungDecisionsCard() {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div>
        <h3 className="text-[1.08rem] font-semibold text-slate-900">
          Letzte Entscheidungen
        </h3>
      </div>

      <div className="mt-4 space-y-0">
        {DECISIONS.map((decision, index) => (
          <div key={`${decision.date}-${decision.title}`} className="relative pl-6">
            {index !== DECISIONS.length - 1 ? (
              <div className="absolute left-[7px] top-5 h-[calc(100%+8px)] w-px bg-slate-200" />
            ) : null}

            <div className="absolute left-0 top-1.5 h-[14px] w-[14px] rounded-full border border-slate-300 bg-white" />

            <div className={index === 0 ? "pb-4" : "py-4"}>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                {decision.date}
              </p>

              <p className="mt-2 text-sm font-semibold leading-5 text-slate-900">
                {decision.title}
              </p>

              <span
                className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getTagClass(
                  decision.tag,
                )}`}
              >
                {decision.tag}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
