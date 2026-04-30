type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PageBreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export function PageBreadcrumbs({ items }: PageBreadcrumbsProps) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs font-medium text-slate-500">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? <span className="text-slate-300">/</span> : null}
            {item.href && !isLast ? (
              <a href={item.href} className="transition hover:text-slate-900">
                {item.label}
              </a>
            ) : (
              <span className={isLast ? "text-slate-900" : ""}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
