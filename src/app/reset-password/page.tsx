import { AuthForm } from "@/components/auth/auth-form";
import { requireUser } from "@/lib/auth";

export default async function ResetPasswordPage() {
  await requireUser();
  return <main className="flex min-h-screen items-center justify-center bg-[#0B1220] px-4 py-12"><AuthForm mode="reset" /></main>;
}
