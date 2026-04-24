"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

const PAGE_SIZE = 6;
const PAGE_DURATION_MS = 15000;
const SPONSOR_INTERVAL_MS = 60000;
const SPONSOR_DURATION_MS = 8000;

type InfoboardSponsor = {
  id: string;
  displayName: string;
  companyName: string | null;
  tier: string;
  logoUrl: string | null;
};

type InfoboardRotatorProps = {
  children: ReactNode[];
  sponsors: InfoboardSponsor[];
};

function getSponsorLogoClass(tier: string) {
  if (tier === "MAIN") return "max-h-56 max-w-[760px]";
  if (tier === "GOLD") return "max-h-48 max-w-[680px]";
  return "max-h-40 max-w-[600px]";
}

function getTierLabel(tier: string) {
  if (tier === "MAIN") return "Hauptsponsor";
  if (tier === "GOLD") return "Gold Sponsor";
  if (tier === "SILVER") return "Silber Sponsor";
  if (tier === "BRONZE") return "Bronze Sponsor";
  return "Business Club Partner";
}

export default function InfoboardRotator({ children, sponsors }: InfoboardRotatorProps) {
  const [page, setPage] = useState(0);
  const [showSponsor, setShowSponsor] = useState(false);
  const [sponsorIndex, setSponsorIndex] = useState(0);

  const items = useMemo(() => children.filter(Boolean), [children]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const hasSponsors = sponsors.length > 0;

  useEffect(() => {
    setPage(0);
  }, [totalPages]);

  useEffect(() => {
    if (totalPages <= 1) return;

    const interval = setInterval(() => {
      setPage((current) => (current + 1) % totalPages);
    }, PAGE_DURATION_MS);

    return () => clearInterval(interval);
  }, [totalPages]);

  useEffect(() => {
    if (!hasSponsors) return;

    const interval = setInterval(() => {
      setSponsorIndex((current) => (current + 1) % sponsors.length);
      setShowSponsor(true);

      window.setTimeout(() => {
        setShowSponsor(false);
      }, SPONSOR_DURATION_MS);
    }, SPONSOR_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [hasSponsors, sponsors.length]);

  const start = page * PAGE_SIZE;
  const visible = items.slice(start, start + PAGE_SIZE);
  const sponsor = sponsors[sponsorIndex];

  if (showSponsor && sponsor) {
    return (
      <div className="col-span-full flex h-full min-h-[620px] animate-[fadeIn_700ms_ease-out] items-center justify-center rounded-[36px] border border-white/10 bg-white text-center text-slate-950 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-red-600">
            FC Allschwil bedankt sich bei
          </p>
          <p className="mt-8 text-3xl font-black uppercase tracking-[0.22em] text-slate-400">
            {getTierLabel(sponsor.tier)}
          </p>
          {sponsor.logoUrl ? (
            <div className="mt-8 flex justify-center">
              <img
                src={sponsor.logoUrl}
                alt={sponsor.displayName}
                className={`${getSponsorLogoClass(sponsor.tier)} object-contain`}
              />
            </div>
          ) : (
            <h2 className="mt-5 animate-[softZoom_900ms_ease-out] text-8xl font-black uppercase tracking-tight text-[#0b4aa2]">
              {sponsor.displayName}
            </h2>
          )}
          {sponsor.logoUrl ? (
            <h2 className="mt-8 text-5xl font-black uppercase tracking-tight text-[#0b4aa2]">
              {sponsor.displayName}
            </h2>
          ) : null}

          {sponsor.companyName ? (
            <p className="mt-5 text-4xl font-bold text-slate-500">{sponsor.companyName}</p>
          ) : null}
          <p className="mt-8 text-3xl font-bold text-slate-500">
            Gemeinsam für unseren Verein
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes softZoom {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      <div className="contents animate-[fadeIn_500ms_ease-out]">{visible}</div>
    </>
  );
}


