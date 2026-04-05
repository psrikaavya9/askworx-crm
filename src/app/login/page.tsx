"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Eye, EyeOff, LogIn, Building2, Mail, Phone,
  Lock, Loader2, ShieldCheck, ArrowLeft, Monitor,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ---------------------------------------------------------------------------
// Step types
// ---------------------------------------------------------------------------

type Step =
  | { name: "credentials" }
  | { name: "otp"; mfaPendingToken: string };

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------

export default function LoginPage() {
  const router = useRouter();
  const { login, verifyOtp, isLoggedIn, isLoading } = useAuth();

  // ── Step state ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>({ name: "credentials" });

  // ── Credentials step ───────────────────────────────────────────────────────
  const [mode,       setMode]       = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);

  // ── OTP step ───────────────────────────────────────────────────────────────
  const [otp,         setOtp]         = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [error,      setError]      = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect only once the auth check is complete AND the session is confirmed valid.
  // While isLoading is true we show a spinner; we never redirect speculatively.
  // This prevents a redirect loop where a stale-but-valid refresh cookie causes
  // isLoggedIn to flicker true before /api/auth/me rejects the inactive session.
  useEffect(() => {
    if (!isLoading && isLoggedIn) router.replace("/dashboard");
  }, [isLoading, isLoggedIn, router]);

  // Reset form to credentials step whenever we land on the login page fresh
  // (handles the case where a previous OTP flow left state behind)
  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      setStep({ name: "credentials" });
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoggedIn]);

  // Focus OTP input when step changes
  useEffect(() => {
    if (step.name === "otp") otpRef.current?.focus();
  }, [step]);

  // ── Submit: credentials ────────────────────────────────────────────────────

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await login(identifier.trim(), password, mode === "phone");

      switch (result.status) {
        case "success":
          router.replace("/dashboard");
          break;

        case "mfa_required":
          setStep({ name: "otp", mfaPendingToken: result.mfaPendingToken });
          setOtp("");
          break;

        case "force_password_reset":
        case "password_expired":
          setError(
            result.status === "password_expired"
              ? "Your password has expired. Please contact your administrator to reset it."
              : "Your administrator has required a password change. Please contact support."
          );
          break;
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit: OTP ─────────────────────────────────────────────────────────────

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (step.name !== "otp") return;

    setError(null);
    setSubmitting(true);

    try {
      await verifyOtp(step.mfaPendingToken, otp.trim(), trustDevice);
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── OTP input: digits only, max 6 ──────────────────────────────────────────

  const handleOtpChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);
  };

  // ── Loading splash ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  // ── Shared shell ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 px-4">
      <div className="w-full max-w-md">

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-2xl mb-4 shadow-lg shadow-purple-500/25">
            {step.name === "otp"
              ? <ShieldCheck className="w-8 h-8 text-white" />
              : <Building2 className="w-8 h-8 text-white" />
            }
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ASKworX</h1>
          <p className="text-slate-400 text-sm mt-1">
            {step.name === "otp" ? "Two-factor verification" : "Sign in to your workspace"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* ── STEP: credentials ── */}
          {step.name === "credentials" && (
            <>
              {/* Mode toggle */}
              <div className="flex rounded-lg bg-white/5 p-1 mb-6">
                <button
                  type="button"
                  onClick={() => { setMode("email"); setIdentifier(""); setError(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 text-sm py-2 rounded-md font-medium transition-all ${
                    mode === "email"
                      ? "bg-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Mail className="w-4 h-4" /> Email
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("phone"); setIdentifier(""); setError(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 text-sm py-2 rounded-md font-medium transition-all ${
                    mode === "phone"
                      ? "bg-purple-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Phone className="w-4 h-4" /> Phone
                </button>
              </div>

              <form onSubmit={handleCredentialsSubmit} className="space-y-5">

                {/* Identifier */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    {mode === "email" ? "Email address" : "Phone number"}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      {mode === "email"
                        ? <Mail className="w-4 h-4 text-slate-400" />
                        : <Phone className="w-4 h-4 text-slate-400" />
                      }
                    </div>
                    <input
                      type={mode === "email" ? "email" : "tel"}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={mode === "email" ? "you@askworx.com" : "+91 98765 43210"}
                      required
                      autoComplete={mode === "email" ? "email" : "tel"}
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-200 transition"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition shadow-lg shadow-purple-500/20"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                    : <><LogIn className="w-4 h-4" /> Sign In</>
                  }
                </button>
              </form>
            </>
          )}

          {/* ── STEP: OTP ── */}
          {step.name === "otp" && (
            <>
              <p className="text-slate-300 text-sm mb-6 text-center">
                Enter the 6-digit code sent to your registered device.
              </p>

              <form onSubmit={handleOtpSubmit} className="space-y-5">

                {/* OTP input */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Verification code
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      ref={otpRef}
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      value={otp}
                      onChange={(e) => handleOtpChange(e.target.value)}
                      placeholder="000000"
                      required
                      maxLength={6}
                      autoComplete="one-time-code"
                      className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm tracking-[0.4em] font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Trust device */}
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                  />
                  <span className="text-sm text-slate-400 leading-snug">
                    <span className="flex items-center gap-1.5 text-slate-300 font-medium mb-0.5">
                      <Monitor className="w-3.5 h-3.5" /> Trust this device for 30 days
                    </span>
                    Skip verification on future logins from this browser.
                  </span>
                </label>

                {/* Error */}
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || otp.length !== 6}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition shadow-lg shadow-purple-500/20"
                >
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
                    : <><ShieldCheck className="w-4 h-4" /> Verify Code</>
                  }
                </button>

                {/* Back to login — clears all OTP state */}
                <button
                  type="button"
                  onClick={() => {
                    setStep({ name: "credentials" });
                    setOtp("");
                    setError(null);
                    setTrustDevice(false);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          ASKworX CRM/ERP · Internal System
        </p>
      </div>
    </div>
  );
}
