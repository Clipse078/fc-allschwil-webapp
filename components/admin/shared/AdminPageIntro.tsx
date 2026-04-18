type AdminPageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function AdminPageIntro({
  eyebrow,
  title,
  description,
}: AdminPageIntroProps) {
  return (
    <div>
      <p className="fca-eyebrow">{eyebrow}</p>
      <h2 className="fca-heading mt-2">{title}</h2>
      <p className="fca-body-muted mt-3 max-w-2xl">{description}</p>
    </div>
  );
}
