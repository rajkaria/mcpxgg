/**
 * S8-T16 — animated stablecoin-flow diagram. Pure SVG + CSS animation
 * (the dash-offset + a CSS keyframe already in globals.css family), no
 * runtime deps, no JS. Visualizes a single tool call settling atomically:
 *
 *   Agent → Gateway → x402 settle PTB → { Dev vault, Treasury, Insurance }
 *
 * Decorative: marked aria-hidden, with a text fallback for screen readers
 * provided by the caller's surrounding copy.
 */

const STROKE = "rgba(129,140,248,0.35)";

function Node({
  x,
  y,
  w,
  label,
  sub,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={48}
        rx={10}
        fill="rgba(255,255,255,0.03)"
        stroke={accent ?? "rgba(255,255,255,0.10)"}
      />
      <text
        x={x + w / 2}
        y={sub ? y + 21 : y + 28}
        textAnchor="middle"
        fontSize="13"
        fontWeight={600}
        fill="#f8fafc"
      >
        {label}
      </text>
      {sub && (
        <text
          x={x + w / 2}
          y={y + 36}
          textAnchor="middle"
          fontSize="10"
          fill="#94a3b8"
        >
          {sub}
        </text>
      )}
    </g>
  );
}

function FlowPath({ d, delay }: { d: string; delay: number }) {
  return (
    <>
      <path d={d} fill="none" stroke={STROKE} strokeWidth={1.5} />
      <circle r="3.5" fill="#818cf8">
        <animateMotion
          dur="2.6s"
          begin={`${delay}s`}
          repeatCount="indefinite"
          path={d}
          keyPoints="0;1"
          keyTimes="0;1"
          calcMode="spline"
          keySplines="0.4 0 0.2 1"
        />
      </circle>
    </>
  );
}

export function StablecoinFlow() {
  return (
    <svg
      viewBox="0 0 720 320"
      className="w-full h-auto"
      role="img"
      aria-label="A tool call flows from an agent through the gateway and the x402 facilitator, which settles it atomically in USDsui into the developer vault, treasury, and insurance pool."
    >
      <defs>
        <linearGradient id="flow-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Source column */}
      <Node x={16} y={136} w={120} label="AI Agent" sub="Claude · Cursor" />
      <Node
        x={196}
        y={136}
        w={120}
        label="Gateway"
        sub="meters the call"
        accent="rgba(129,140,248,0.4)"
      />
      <Node
        x={376}
        y={136}
        w={130}
        label="x402 settle"
        sub="one atomic PTB"
        accent="rgba(129,140,248,0.55)"
      />

      {/* Sink column */}
      <Node
        x={566}
        y={40}
        w={140}
        label="Dev vault"
        sub="97.5%"
        accent="rgba(52,211,153,0.45)"
      />
      <Node
        x={566}
        y={136}
        w={140}
        label="Treasury"
        sub="2.0%"
        accent="rgba(96,165,250,0.45)"
      />
      <Node
        x={566}
        y={232}
        w={140}
        label="Insurance"
        sub="0.5%"
        accent="rgba(251,191,36,0.45)"
      />

      {/* Flows */}
      <FlowPath d="M136 160 H196" delay={0} />
      <FlowPath d="M316 160 H376" delay={0.4} />
      <FlowPath d="M506 160 C 536 160, 536 64, 566 64" delay={0.9} />
      <FlowPath d="M506 160 H566" delay={1.0} />
      <FlowPath d="M506 160 C 536 160, 536 256, 566 256" delay={1.1} />

      <text
        x={571}
        y={300}
        fontSize="11"
        fill="#64748b"
      >
        + permanent CallReceipt minted on Sui
      </text>
    </svg>
  );
}
