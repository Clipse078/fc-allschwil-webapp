import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function AdminFormCard({
  eyebrow,
  title,
  description,
  icon,
  children,
  className = "",
}: Props) {
  return (
    <section className={"rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 " + className}>
      <div className="flex items-center justify-between gap-4">
        <div>
          {eyebrow ? <p className="fca-eyebrow">{eyebrow}</p> : null}
          <h3 className="font-black text-slate-900">{title}</h3>
          {description ? (
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
        {icon ? <div className="text-[#0b4aa2]">{icon}</div> : null}
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}
