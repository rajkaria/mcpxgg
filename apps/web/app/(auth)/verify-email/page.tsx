import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-bold text-[var(--text)]">Check your email</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          We sent you a verification link. Click it to verify your email address and complete your signup.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-[var(--primary)] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
