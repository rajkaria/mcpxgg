"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/dashboard/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PhoneVerifyForm() {
  const user = useUser();
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  if (user.phone_verified) {
    return (
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success)] bg-opacity-10">
            <svg className="h-6 w-6 text-[var(--success)]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>
        <p className="text-[var(--text)]">Your phone is verified</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{user.phone_number}</p>
      </div>
    );
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/phone/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setStep("code");
    setCooldown(60);
    setLoading(false);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/phone/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  const handleResend = async () => {
    setError("");
    setCooldown(60);

    await fetch("/api/phone/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });
  };

  if (step === "phone") {
    return (
      <form onSubmit={handleSendCode} className="space-y-4">
        <Input
          id="phone"
          label="Phone number"
          type="tel"
          placeholder="+14155551234"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
        />
        <p className="text-xs text-[var(--text-muted)]">
          Enter your phone number in international format (e.g., +1 for US)
        </p>
        {error && <p className="text-sm text-[var(--error)]">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Send verification code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyCode} className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        We sent a code to <span className="font-medium text-[var(--text)]">{phoneNumber}</span>
      </p>
      <Input
        id="code"
        label="Verification code"
        type="text"
        inputMode="numeric"
        placeholder="123456"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        required
      />
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      <Button type="submit" className="w-full" loading={loading}>
        Verify
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setCode("");
            setError("");
          }}
          className="text-[var(--text-secondary)] hover:text-[var(--text)]"
        >
          Change number
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="text-[var(--primary)] hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
