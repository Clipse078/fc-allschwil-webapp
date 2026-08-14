"use client";

import { Mail, Phone, Calendar, MapPin, User } from "lucide-react";
import type { PersonDetail } from "@/lib/people/queries";

type PersonContactTabProps = {
  person: PersonDetail;
  canManage: boolean;
  canDelete: boolean;
};

function ContactField({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--muted)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
          {label}
        </p>
        {value ? (
          href ? (
            <a
              href={href}
              className="mt-0.5 text-sm font-medium text-[var(--sce-primary)] hover:underline"
            >
              {value}
            </a>
          ) : (
            <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">{value}</p>
          )
        ) : (
          <p className="mt-0.5 text-sm italic text-[var(--muted)]">Nicht erfasst</p>
        )}
      </div>
    </div>
  );
}

function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function PersonContactTab({ person }: PersonContactTabProps) {
  const hasAddress = person.street || person.city || person.postalCode;
  const hasGuardian = person.guardianFirstName || person.guardianEmail;

  return (
    <div className="space-y-6">
      {/* Contact */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="divide-y divide-[var(--border)] px-4">
          <ContactField
            icon={<Mail className="h-4 w-4" />}
            label="E-Mail"
            value={person.email}
            href={person.email ? `mailto:${person.email}` : undefined}
          />
          <ContactField
            icon={<Phone className="h-4 w-4" />}
            label="Telefon"
            value={person.phone}
            href={person.phone ? `tel:${person.phone}` : undefined}
          />
          <ContactField
            icon={<Calendar className="h-4 w-4" />}
            label="Geburtsdatum"
            value={formatDate(person.dateOfBirth)}
          />
        </div>
      </div>

      {/* Address */}
      {hasAddress ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Adresse
          </h3>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4">
            <div className="divide-y divide-[var(--border)]">
              {person.street ? (
                <ContactField
                  icon={<MapPin className="h-4 w-4" />}
                  label="Strasse"
                  value={`${person.street}${person.houseNumber ? " " + person.houseNumber : ""}`}
                />
              ) : null}
              {(person.postalCode || person.city) ? (
                <ContactField
                  icon={<MapPin className="h-4 w-4" />}
                  label="Ort"
                  value={[person.postalCode, person.city, person.country].filter(Boolean).join(" ")}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Guardian */}
      {hasGuardian ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Erziehungsberechtigte/r
          </h3>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4">
            <div className="divide-y divide-[var(--border)]">
              {(person.guardianFirstName || person.guardianLastName) ? (
                <ContactField
                  icon={<User className="h-4 w-4" />}
                  label="Name"
                  value={[person.guardianFirstName, person.guardianLastName].filter(Boolean).join(" ")}
                />
              ) : null}
              {person.guardianEmail ? (
                <ContactField
                  icon={<Mail className="h-4 w-4" />}
                  label="E-Mail"
                  value={person.guardianEmail}
                  href={`mailto:${person.guardianEmail}`}
                />
              ) : null}
              {person.guardianPhone ? (
                <ContactField
                  icon={<Phone className="h-4 w-4" />}
                  label="Telefon"
                  value={person.guardianPhone}
                  href={`tel:${person.guardianPhone}`}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
