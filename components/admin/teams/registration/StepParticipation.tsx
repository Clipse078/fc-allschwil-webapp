"use client";

import { Trophy, Dumbbell, Star, Smile, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ParticipationType, WizardFormData } from "./types";
import { PARTICIPATION_TYPES } from "./types";

type Props = {
  participationType: WizardFormData["participationType"];
  onParticipationTypeChange: (value: ParticipationType) => void;
};

const TYPE_ICONS: Record<ParticipationType, React.ReactNode> = {
  COMPETITION: <Trophy className="h-5 w-5" />,
  TRAINING: <Dumbbell className="h-5 w-5" />,
  DEVELOPMENT: <Star className="h-5 w-5" />,
  RECREATIONAL: <Smile className="h-5 w-5" />,
  OTHER: <MoreHorizontal className="h-5 w-5" />,
};

/**
 * StepParticipation — Step 4 of the Team registration wizard (TEAM-CREATE-02).
 *
 * User selects how the team participates in this season.
 * Selecting "Wettkampfteam" (COMPETITION) will reveal the Competition step.
 * All other types skip the Competition step.
 *
 * German UI. Provider-independent.
 */
export default function StepParticipation({
  participationType,
  onParticipationTypeChange,
}: Props) {
  return (
    <div
      className="space-y-3"
      role="group"
      aria-labelledby="participation-heading"
    >
      <p id="participation-heading" className="sr-only">
        Teilnahmetyp auswählen
      </p>

      {PARTICIPATION_TYPES.map((type) => {
        const isSelected = participationType === type.value;
        const Icon = TYPE_ICONS[type.value];

        return (
          <label
            key={type.value}
            htmlFor={`participation-${type.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-4 rounded-xl border px-5 py-4",
              "transition-colors hover:bg-[var(--surface-2)]",
              isSelected
                ? "border-[var(--sce-primary)] bg-[color-mix(in_srgb,var(--sce-primary)_4%,transparent)]"
                : "border-[var(--border)] bg-[var(--surface)]",
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                isSelected
                  ? "bg-[color-mix(in_srgb,var(--sce-primary)_12%,transparent)] text-[var(--sce-primary)]"
                  : "bg-[var(--surface-2)] text-[var(--text-3)]",
              )}
              aria-hidden="true"
            >
              {Icon}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  isSelected
                    ? "text-[var(--foreground)]"
                    : "text-[var(--text-2)]",
                )}
              >
                {type.label}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-2)]">
                {type.description}
              </p>
            </div>

            {/* Radio indicator */}
            <div className="mt-1 shrink-0">
              <input
                id={`participation-${type.value}`}
                type="radio"
                name="participationType"
                value={type.value}
                checked={isSelected}
                onChange={() => onParticipationTypeChange(type.value)}
                className="sr-only"
              />
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-[var(--sce-primary)]"
                    : "border-[var(--border-strong)]",
                )}
                aria-hidden="true"
              >
                {isSelected && (
                  <div className="h-2.5 w-2.5 rounded-full bg-[var(--sce-primary)]" />
                )}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
