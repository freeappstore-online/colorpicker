import { useCallback, useEffect, useRef, useState } from "react";
import { Shell } from "./components/Shell";

const PALETTE_KEY = "colorpicker-palette";
const RECENT_KEY = "colorpicker-recent";
const MAX_PALETTE = 28;
const MAX_RECENT = 12;

/* ── Color conversion helpers ── */

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const s1 = s / 100;
  const l1 = l / 100;
  const c = (1 - Math.abs(2 * l1 - 1)) * s1;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l1 - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r1) h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6;
  else if (max === g1) h = ((b1 - r1) / d + 2) / 6;
  else h = ((r1 - g1) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")
  );
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(hex);
}

/* ── localStorage helpers ── */

function loadList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed))
      return parsed.filter((c): c is string => typeof c === "string");
  } catch {
    /* ignore */
  }
  return [];
}

function saveList(key: string, list: string[]) {
  localStorage.setItem(key, JSON.stringify(list));
}

/* ── Clipboard ── */

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

/* ── Components ── */

function SatLightSquare({
  hue,
  sat,
  light,
  onChange,
}: {
  hue: number;
  sat: number;
  light: number;
  onChange: (s: number, l: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const resolve = useCallback(
    (clientX: number, clientY: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const y = clamp((clientY - rect.top) / rect.height, 0, 1);
      // x = saturation (0..100), y = lightness (100..0)
      onChange(Math.round(x * 100), Math.round((1 - y) * 100));
    },
    [onChange],
  );

  useEffect(() => {
    const up = () => {
      dragging.current = false;
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      resolve(e.clientX, e.clientY);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointermove", move);
    };
  }, [resolve]);

  // Map sat/light to cursor position
  const cx = `${sat}%`;
  const cy = `${100 - light}%`;

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        dragging.current = true;
        e.preventDefault();
        resolve(e.clientX, e.clientY);
      }}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1",
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
        cursor: "crosshair",
        touchAction: "none",
        background: `
          linear-gradient(to top, #000, transparent),
          linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))
        `,
        border: "1px solid var(--color-line)",
      }}
    >
      {/* Cursor */}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "3px solid #fff",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.3)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function HueSlider({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (h: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const resolve = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      onChange(Math.round(x * 360));
    },
    [onChange],
  );

  useEffect(() => {
    const up = () => {
      dragging.current = false;
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      e.preventDefault();
      resolve(e.clientX);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointermove", move);
    };
  }, [resolve]);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        dragging.current = true;
        e.preventDefault();
        resolve(e.clientX);
      }}
      style={{
        position: "relative",
        width: "100%",
        height: 24,
        borderRadius: 12,
        cursor: "pointer",
        touchAction: "none",
        background:
          "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
        border: "1px solid var(--color-line)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${(hue / 360) * 100}%`,
          top: "50%",
          width: 20,
          height: 20,
          borderRadius: "50%",
          border: "3px solid #fff",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.3)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          background: `hsl(${hue}, 100%, 50%)`,
        }}
      />
    </div>
  );
}

function ColorSwatch({
  color,
  active,
  onClick,
  onRemove,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div style={{ position: "relative" }} className="group">
      <button
        onClick={onClick}
        title={color.toUpperCase()}
        style={{
          background: color,
          border: active
            ? "2.5px solid var(--color-ink)"
            : "1.5px solid var(--color-line)",
          borderRadius: "var(--radius-btn)",
          width: 36,
          height: 36,
          cursor: "pointer",
          padding: 0,
          transition: "border-color 0.15s",
        }}
      />
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center"
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#e11d48",
            color: "#fff",
            border: "none",
            fontSize: 11,
            lineHeight: 1,
            cursor: "pointer",
            padding: 0,
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
}

/* ── Main App ── */

export default function App() {
  const [hue, setHue] = useState(220);
  const [sat, setSat] = useState(80);
  const [light, setLight] = useState(55);
  const [hexInput, setHexInput] = useState("");
  const [palette, setPalette] = useState<string[]>(() => loadList(PALETTE_KEY));
  const [recent, setRecent] = useState<string[]>(() => loadList(RECENT_KEY));
  const [copied, setCopied] = useState<string | null>(null);

  const [r, g, b] = hslToRgb(hue, sat, light);
  const hex = rgbToHex(r, g, b);
  const hexUp = hex.toUpperCase();
  const rgbStr = `rgb(${r}, ${g}, ${b})`;
  const hslStr = `hsl(${hue}, ${sat}%, ${light}%)`;

  // Keep hexInput in sync when changed via picker
  const prevHex = useRef(hex);
  useEffect(() => {
    if (hex !== prevHex.current) {
      setHexInput(hex.toUpperCase());
      prevHex.current = hex;
    }
  }, [hex]);

  // Initialize hexInput on mount
  useEffect(() => {
    setHexInput(hex.toUpperCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist
  useEffect(() => saveList(PALETTE_KEY, palette), [palette]);
  useEffect(() => saveList(RECENT_KEY, recent), [recent]);

  // Copied toast
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  const handleSLChange = useCallback((s: number, l: number) => {
    setSat(s);
    setLight(l);
  }, []);

  const handleHueChange = useCallback((h: number) => {
    setHue(h);
  }, []);

  const setFromHex = (h: string) => {
    const rgb = hexToRgb(h);
    if (!rgb) return;
    const [rr, gg, bb] = rgb;
    const [hh, ss, ll] = rgbToHsl(rr, gg, bb);
    setHue(hh);
    setSat(ss);
    setLight(ll);
  };

  const handleHexInput = (val: string) => {
    let v = val;
    if (!v.startsWith("#")) v = "#" + v;
    setHexInput(v);
    if (isValidHex(v)) {
      setFromHex(v);
    }
  };

  const addToRecent = () => {
    const next = [hex, ...recent.filter((c) => c !== hex)].slice(0, MAX_RECENT);
    setRecent(next);
  };

  const handleCopy = (label: string, value: string) => {
    copyText(value);
    setCopied(label);
    addToRecent();
  };

  const handleSaveToPalette = () => {
    if (palette.includes(hex)) return;
    const next = [hex, ...palette].slice(0, MAX_PALETTE);
    setPalette(next);
    addToRecent();
  };

  const handleRemoveFromPalette = (c: string) => {
    setPalette(palette.filter((x) => x !== c));
  };

  const handleSwatchClick = (c: string) => {
    setFromHex(c);
    setHexInput(c.toUpperCase());
  };

  return (
    <Shell>
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Title */}
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.75rem",
            fontWeight: 700,
            margin: 0,
          }}
        >
          Color Picker
        </h1>

        {/* Preview swatch with sat/light square */}
        <SatLightSquare
          hue={hue}
          sat={sat}
          light={light}
          onChange={handleSLChange}
        />

        {/* Hue slider */}
        <HueSlider hue={hue} onChange={handleHueChange} />

        {/* Color preview bar */}
        <div
          style={{
            height: 56,
            borderRadius: "var(--radius-card)",
            background: hex,
            border: "1px solid var(--color-line)",
          }}
        />

        {/* Hex input */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexInput(e.target.value)}
            maxLength={7}
            spellCheck={false}
            placeholder="#000000"
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              fontSize: "0.95rem",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              background: "var(--color-panel)",
              color: "var(--color-ink)",
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius-btn)",
              outline: "none",
            }}
          />
          <button
            onClick={handleSaveToPalette}
            disabled={palette.includes(hex)}
            style={{
              background: palette.includes(hex)
                ? "var(--color-line)"
                : "var(--color-accent)",
              color: palette.includes(hex) ? "var(--color-muted)" : "#fff",
              border: "none",
              borderRadius: "var(--radius-btn)",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: palette.includes(hex) ? "default" : "pointer",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-body)",
            }}
          >
            {palette.includes(hex) ? "Saved" : "Save"}
          </button>
        </div>

        {/* Color values */}
        <div
          style={{
            background: "var(--color-panel)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-card)",
            padding: "0.75rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {(
            [
              ["HEX", hexUp],
              ["RGB", rgbStr],
              ["HSL", hslStr],
            ] as const
          ).map(([label, value]) => (
            <button
              key={label}
              onClick={() => handleCopy(label, value)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "none",
                border: "none",
                padding: "6px 4px",
                borderRadius: "var(--radius-btn)",
                cursor: "pointer",
                color: "var(--color-ink)",
                width: "100%",
              }}
              className="hover:opacity-70"
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "var(--color-muted)",
                    width: 30,
                    textAlign: "left",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {value}
                </span>
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color:
                    copied === label
                      ? "var(--color-accent)"
                      : "var(--color-muted)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {copied === label ? "Copied!" : "Copy"}
              </span>
            </button>
          ))}
        </div>

        {/* Saved palette */}
        {palette.length > 0 && (
          <section>
            <h2
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--color-muted)",
                margin: "0 0 8px",
                fontFamily: "var(--font-body)",
              }}
            >
              Saved Palette
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {palette.map((c) => (
                <ColorSwatch
                  key={c}
                  color={c}
                  active={c === hex}
                  onClick={() => handleSwatchClick(c)}
                  onRemove={() => handleRemoveFromPalette(c)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Recent colors */}
        {recent.length > 0 && (
          <section>
            <h2
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--color-muted)",
                margin: "0 0 8px",
                fontFamily: "var(--font-body)",
              }}
            >
              Recent Colors
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {recent.map((c) => (
                <ColorSwatch
                  key={c}
                  color={c}
                  active={c === hex}
                  onClick={() => handleSwatchClick(c)}
                />
              ))}
            </div>
          </section>
        )}

        {/* FreeAppStore link — mobile only (desktop has it in sidebar) */}
        <div
          className="md:hidden"
          style={{
            textAlign: "center",
            padding: "16px 0 8px",
          }}
        >
          <a
            href="https://freeappstore.online"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--color-muted)",
              fontSize: "0.75rem",
              textDecoration: "none",
              fontFamily: "var(--font-body)",
            }}
          >
            Part of FreeAppStore — free forever
          </a>
        </div>
      </div>
    </Shell>
  );
}

export { App };
