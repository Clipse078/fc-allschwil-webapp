import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Meetings module: canonical route is now /meetings.
      // Legacy /vereinsleitung/meetings URLs are temporarily redirected here.
      // NOTE: /vereinsleitung/meetings/[slug] is NOT redirected because the new
      // canonical detail route uses cuid IDs (/meetings/[id]), not slugs.
      // Detail-page redirect will be added once slug→id mapping exists in the DB.
      {
        source: "/vereinsleitung/meetings",
        destination: "/meetings",
        permanent: false, // 307 — temporary while migration is in progress
      },
      // Initiatives module: canonical route is now /initiatives.
      {
        source: "/vereinsleitung/initiativen",
        destination: "/initiatives",
        permanent: false, // 307 — temporary while migration is in progress
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
