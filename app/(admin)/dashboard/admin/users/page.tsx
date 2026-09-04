import { redirect } from "next/navigation";

/** Legacy alias — canonical People & Access overview lives at /people-access. */
export default function AdminUsersRedirectPage() {
  redirect("/dashboard/admin/people-access");
}
