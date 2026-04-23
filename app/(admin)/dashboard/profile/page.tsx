export default function ProfilePage() {
  return (
    <div className="rounded-[32px] border border-slate-200 bg-white/90 p-8 shadow-sm backdrop-blur-xl">
      <p className="fca-eyebrow">Profil</p>
      <h1 className="mt-2 font-[var(--font-display)] text-[2rem] font-bold tracking-[-0.04em] text-[#0b4aa2]">
        Persönliche Einstellungen
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        Diese Seite ist als Einstieg für persönliche Einstellungen vorbereitet. Hier folgen später
        Profilbild, persönliche Daten, Sicherheit, Passwort und Benachrichtigungen.
      </p>
    </div>
  );
}