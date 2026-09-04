import { redirect } from "next/navigation";

/** Legacy alias — canonical add-person flow lives at /people-access/new. */
export default function AdminUsersNewRedirectPage() {
  redirect("/dashboard/admin/people-access/new");
}
