import { redirect } from 'next/navigation';

// User administration is organization-scoped. Redirect to the organization
// list, which links into each customer's member management panel.
export default function AdminUsersPage() {
  redirect('/admin/organizations');
}
