/**
 * Initiatives list page — legacy route at /vereinsleitung/initiativen.
 *
 * A 307 redirect to /initiatives is live in next.config.ts.
 * This page is kept for direct-render fallback only. It renders the legacy
 * mock component; real initiative data is at /initiatives (canonical route).
 *
 * TODO(decoupling): Remove this file once all old links have been updated
 * and the redirect has been promoted to 308 (permanent).
 */
import VereinsleitungInitiativenList from "@/components/admin/vereinsleitung/VereinsleitungInitiativenList";

export default function VereinsleitungInitiativenPage() {
  return <VereinsleitungInitiativenList />;
}
