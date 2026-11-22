"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const titles: Record<AuthMode, string> = {
  login: "Welcome back",
  signup: "Create your account",
  forgot: "Reset your password",
  reset: "Choose a new password",
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const callbackUrl = `${window.location.origin}/auth/callback`;

      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: displayName.trim() },
            emailRedirectTo: `${callbackUrl}?next=/account`,
          },
        });
        if (authError) throw authError;

        if (data.session) {
          router.replace("/account");
          router.refresh();
        } else {
          setMessage(
            "Your account request was received. Check your email for the verification link before signing in.",
          );
        }
      } else if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        router.replace("/account");
        router.refresh();
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(
          email,
          { redirectTo: `${callbackUrl}?next=/reset-password` },
        );
        if (authError) throw authError;
        setMessage("If an account exists for that email, a password-reset link has been sent.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({
          password,
        });
        if (authError) throw authError;
        setMessage("Your password has been updated. You can now continue to your account.");
        router.replace("/account");
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/account`,
        },
      });
      if (authError) throw authError;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google sign-in could not be started.");
      setBusy(false);
    }
  }

  const needsPassword = mode !== "forgot";
  const needsEmail = mode !== "reset";

  return (
    <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl shadow-black/20 sm:p-8">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
        EM ROUNDS with PK
      </p>
      <h1 className="text-2xl font-bold tracking-tight text-white">{titles[mode]}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {mode === "signup" && "Create a learner account to access your personal learning space."}
        {mode === "login" && "Sign in to continue your emergency medicine learning."}
        {mode === "forgot" && "Enter your account email and we’ll send a reset link if it is registered."}
        {mode === "reset" && "Use a strong password you have not used elsewhere."}
      </p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <label className="block text-sm font-medium text-slate-200">
            Full name
            <input required autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none transition focus:border-cyan-400" />
          </label>
        )}
        {needsEmail && (
          <label className="block text-sm font-medium text-slate-200">
            Email address
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none transition focus:border-cyan-400" />
          </label>
        )}
        {needsPassword && (
          <label className="block text-sm font-medium text-slate-200">
            {mode === "reset" ? "New password" : "Password"}
            <input required type="password" minLength={8} autoComplete={mode === "reset" ? "new-password" : mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none transition focus:border-cyan-400" />
            {mode !== "login" && <span className="mt-1 block text-xs text-slate-500">Use at least 8 characters.</span>}
          </label>
        )}

        {error && <p role="alert" className="rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="rounded-lg border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">{message}</p>}

        <button disabled={busy} type="submit" className="w-full rounded-lg bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}
        </button>
      </form>

      {(mode === "login" || mode === "signup") && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-slate-700" />OR<span className="h-px flex-1 bg-slate-700" /></div>
          <button type="button" disabled={busy} onClick={handleGoogleSignIn} className="w-full rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:opacity-60">Continue with Google</button>
        </>
      )}

      <div className="mt-6 flex flex-wrap justify-between gap-3 text-sm text-slate-400">
        {mode === "login" && <><Link className="hover:text-cyan-300" href="/forgot-password">Forgot password?</Link><Link className="hover:text-cyan-300" href="/signup">Create an account</Link></>}
        {mode === "signup" && <Link className="hover:text-cyan-300" href="/login">Already have an account? Sign in</Link>}
        {mode === "forgot" && <Link className="hover:text-cyan-300" href="/login">Back to sign in</Link>}
        {mode === "reset" && <Link className="hover:text-cyan-300" href="/login">Back to sign in</Link>}
      </div>
    </section>
  );
}
