import Link from "next/link";

export default function ArticleNotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6 lg:px-8">
      <p className="text-5xl font-bold text-neutral-200">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-neutral-800">
        Artikel nicht gefunden
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Dieser Artikel existiert nicht oder wurde noch nicht veröffentlicht.
      </p>
      <Link
        href=".."
        className="mt-8 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Zurück zur Übersicht
      </Link>
    </main>
  );
}
