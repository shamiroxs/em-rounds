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
            emailRedirectTo: `${callbackUrl}?next=/learn`,
          },
        });
        if (authError) throw authError;

        if (data.session) {
          router.replace("/learn");
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
        router.replace("/learn");
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
        router.replace("/learn");
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
          redirectTo: `${window.location.origin}/auth/callback?next=/learn`,
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
    <section className="auth-card">
      <p className="eyebrow mb-3">
        EM ROUNDS with PK
      </p>
      <h1 className="auth-title">{titles[mode]}</h1>
      <p className="body-copy mt-2 text-sm">
        {mode === "signup" && "Create a learner account to access your personal learning space."}
        {mode === "login" && "Sign in to continue your emergency medicine learning."}
        {mode === "forgot" && "Enter your account email and we’ll send a reset link if it is registered."}
        {mode === "reset" && "Use a strong password you have not used elsewhere."}
      </p>

      <form className="form-stack mt-7" onSubmit={handleSubmit}>
        {mode === "signup" && (
          <label className="field-label">
            Full name
            <input required autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="field-input mt-2" />
          </label>
        )}
        {needsEmail && (
          <label className="field-label">
            Email address
            <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field-input mt-2" />
          </label>
        )}
        {needsPassword && (
          <label className="field-label">
            {mode === "reset" ? "New password" : "Password"}
            <input required type="password" minLength={8} autoComplete={mode === "reset" ? "new-password" : mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="field-input mt-2" />
            {mode !== "login" && <span className="field-hint">Use at least 8 characters.</span>}
          </label>
        )}

        {error && <p role="alert" className="error-box">{error}</p>}
        {message && <p role="status" className="success-box">{message}</p>}

        <button disabled={busy} type="submit" className="primary-button w-full">
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}
        </button>
      </form>

      {(mode === "login" || mode === "signup") && (
        <>
          <div className="divider-row">
  <span className="divider-line" />
  OR
  <span className="divider-line" />
</div>
          <button
            type="button"
            disabled={busy}
            onClick={handleGoogleSignIn}
            className="secondary-button google-button w-full text-sm"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0"
            >
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.5-1.14 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.54-5.17 3.54-8.87z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.01c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.26v3.11C3.23 21.3 7.28 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.28c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.61H1.26A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.02-3.11z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.28 0 3.23 2.7 1.26 6.61l4.02 3.11c.95-2.85 3.6-4.96 6.72-4.96z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </>
      )}

      <div className="auth-links">
        {mode === "login" && <><Link className="text-link" href="/forgot-password">Forgot password?</Link><Link className="text-link" href="/signup">Create an account</Link></>}
        {mode === "signup" && <Link className="text-link" href="/login">Already have an account? Sign in</Link>}
        {mode === "forgot" && <Link className="text-link" href="/login">Back to sign in</Link>}
        {mode === "reset" && <Link className="text-link" href="/login">Back to sign in</Link>}
      </div>
    </section>
  );
}
