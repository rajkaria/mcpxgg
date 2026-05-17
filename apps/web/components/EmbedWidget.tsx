"use client";

/**
 * S7-T25: live `<mcpx-call>` embed example, used on the landing page and on
 * every marketplace server detail page. This is the *exact* third-party
 * integration surface — one CDN script + one custom element — rendered
 * inside mcpx.gg itself so visitors see (and can copy) the real thing.
 *
 * The widget is `@mcpxgg/widget`; we load its published CDN bundle rather
 * than bundling it into the Next app so this page demonstrates the true
 * zero-build embed. `NEXT_PUBLIC_WIDGET_CDN_URL` overrides the source for
 * local/preview testing (e.g. point it at the locally built bundle).
 */

import { useEffect, useState } from "react";

const WIDGET_CDN =
  process.env.NEXT_PUBLIC_WIDGET_CDN_URL ??
  "https://unpkg.com/@mcpxgg/widget/dist/mcpx-widget.esm.js";

// Minimal typing so TSX accepts the custom element.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "mcpx-call": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          server: string;
          tool: string;
          prefill?: string;
          theme?: string;
          label?: string;
        },
        HTMLElement
      >;
    }
  }
}

export function EmbedWidget({
  server,
  tool,
  prefill,
  theme = "auto",
  label,
}: {
  server: string;
  tool: string;
  prefill?: Record<string, unknown>;
  theme?: "light" | "dark" | "auto";
  label?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ID = "mcpx-widget-cdn";
    if (document.getElementById(ID)) {
      setReady(true);
      return;
    }
    const s = document.createElement("script");
    s.id = ID;
    s.type = "module";
    s.src = WIDGET_CDN;
    s.onload = () => setReady(true);
    s.onerror = () => setReady(false);
    document.head.appendChild(s);
  }, []);

  const snippet = `<script type="module"
  src="${WIDGET_CDN}"></script>

<mcpx-call server="${server}" tool="${tool}"${
    prefill ? `\n  prefill='${JSON.stringify(prefill)}'` : ""
  }></mcpx-call>`;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        {ready ? (
          <mcpx-call
            server={server}
            tool={tool}
            theme={theme}
            {...(prefill ? { prefill: JSON.stringify(prefill) } : {})}
            {...(label ? { label } : {})}
          />
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading embeddable widget…
          </p>
        )}
      </div>
      <details className="text-xs" style={{ color: "var(--text-muted)" }}>
        <summary className="cursor-pointer">Copy the embed code</summary>
        <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 mt-2 text-xs">
          {snippet}
        </pre>
      </details>
    </div>
  );
}
