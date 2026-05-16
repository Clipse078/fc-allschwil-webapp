import type { ReactNode } from "react";

type AdminSectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export default function AdminSectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: AdminSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="fca-eyebrow">{eyebrow}</p> : null}
        <h2 className="fca-heading mt-2">{title}</h2>
        {description ? (
          <p className="fca-body-muted mt-3 max-w-2xl">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
