import { AuthForm } from "@/components/auth/auth-form";
import { requireUser } from "@/lib/auth";

export const instant = false;

export default async function ResetPasswordPage() {
  await requireUser();
  return <main className="app-shell flex min-h-screen items-center justify-center px-4 py-12"><AuthForm mode="reset" /></main>;
}
