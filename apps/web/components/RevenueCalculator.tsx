"use client";

/**
 * S6-T24. Interactive revenue calculator for the /developers landing.
 * earnings = calls/month × price/call × devNetFraction(take rate).
 * Take rate default from @mcpxgg/shared (ADR-004: 2.5% = 0.5% insurance +
 * 2.0% treasury, configurable on-chain).
 */

import { useMemo, useState } from "react";
import {
  DEFAULT_TAKE_RATE_BPS,
  DEFAULT_INSURANCE_BPS,
  DEFAULT_TREASURY_BPS,
  devNetFraction,
} from "@mcpxgg/shared";

export function RevenueCalculator() {
  const [callsPerMonth, setCallsPerMonth] = useState(50_000);
  const [pricePerCall, setPricePerCall] = useState(0.01);

  const { gross, dev, platform } = useMemo(() => {
    const g = callsPerMonth * pricePerCall;
    const net = devNetFraction(DEFAULT_TAKE_RATE_BPS);
    return { gross: g, dev: g * net, platform: g * (1 - net) };
  }, [callsPerMonth, pricePerCall]);

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="glass-strong p-8 rounded-2xl">
      <p
        className="text-sm font-medium uppercase tracking-[0.2em] mb-6 text-center"
        style={{ color: "var(--primary)" }}
      >
        Estimate your earnings
      </p>
      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        <div>
          <label className="text-sm font-medium">
            Calls / month: {callsPerMonth.toLocaleString()}
          </label>
          <input
            type="range"
            min={1000}
            max={2_000_000}
            step={1000}
            value={callsPerMonth}
            onChange={(e) => setCallsPerMonth(Number(e.target.value))}
            className="w-full mt-3 accent-[var(--primary)]"
          />
        </div>
        <div>
          <label className="text-sm font-medium">
            Price / call: ${pricePerCall.toFixed(3)} USDsui
          </label>
          <input
            type="range"
            min={0.001}
            max={1}
            step={0.001}
            value={pricePerCall}
            onChange={(e) => setPricePerCall(Number(e.target.value))}
            className="w-full mt-3 accent-[var(--primary)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Gross / month
          </p>
          <p className="text-2xl font-bold mt-1">{fmt(gross)}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Platform ({(DEFAULT_TAKE_RATE_BPS / 100).toFixed(1)}%)
          </p>
          <p className="text-2xl font-bold mt-1">{fmt(platform)}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--success)" }}>
            You earn
          </p>
          <p
            className="text-2xl font-bold mt-1"
            style={{ color: "var(--success)" }}
          >
            {fmt(dev)}
          </p>
        </div>
      </div>

      <p
        className="text-[11px] text-center mt-6"
        style={{ color: "var(--text-muted)" }}
      >
        Take rate is {(DEFAULT_TAKE_RATE_BPS / 100).toFixed(1)}% —{" "}
        {(DEFAULT_INSURANCE_BPS / 100).toFixed(1)}% insurance pool +{" "}
        {(DEFAULT_TREASURY_BPS / 100).toFixed(1)}% treasury — and is
        configurable on-chain (ADR-004). Estimate only.
      </p>
    </div>
  );
}
