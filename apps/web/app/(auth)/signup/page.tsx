import Link from "next/link";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { SignupForm } from "@/components/auth/signup-form";
import { MagicLinkForm } from "@/components/auth/magic-link-form";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="hero-glow" style={{ top: "-300px", left: "50%", transform: "translateX(-50%)", opacity: 0.5 }} />
      <div className="hero-glow-secondary" style={{ bottom: "-200px", left: "-100px" }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <Link href="/" className="block text-center mb-8">
          <span className="text-2xl font-bold tracking-tight">MCPX</span>
        </Link>

        <div className="glass-strong rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-[var(--text)]">Create your account</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Connect once, access any MCP server
            </p>
          </div>

          <OAuthButtons />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full divider-gradient" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 text-[var(--text-muted)]" style={{ background: "rgba(255,255,255,0.03)" }}>or</span>
            </div>
          </div>

          <SignupForm />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full divider-gradient" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 text-[var(--text-muted)]" style={{ background: "rgba(255,255,255,0.03)" }}>or use magic link</span>
            </div>
          </div>

          <MagicLinkForm />
        </div>

        <p className="text-center text-sm text-[var(--text-muted)] mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--primary)] hover:underline transition-colors duration-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
