import { useEffect, useState } from "react";
import { Shell } from "./components/Shell";

const STORAGE_KEY = "colorpicker-saved";
const MAX_SAVED = 20;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function loadSaved(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((c): c is string => typeof c === "string");
  } catch {
    // ignore
  }
  return [];
}

function savePalette(colors: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
}

export default function App() {
  const [color, setColor] = useState("#2563eb");
  const [saved, setSaved] = useState<string[]>(loadSaved);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    savePalette(saved);
  }, [saved]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  const [r, g, b] = hexToRgb(color);
  const [h, s, l] = rgbToHsl(r, g, b);

  const hex = color.toUpperCase();
  const rgbStr = `rgb(${r}, ${g}, ${b})`;
  const hslStr = `hsl(${h}, ${s}%, ${l}%)`;

  const handleSave = () => {
    if (saved.includes(color)) return;
    const next = [color, ...saved].slice(0, MAX_SAVED);
    setSaved(next);
  };

  const handleDelete = (c: string) => {
    setSaved(saved.filter((s) => s !== c));
  };

  const handleCopy = (label: string, value: string) => {
    copyText(value);
    setCopied(label);
  };

  const btnStyle: React.CSSProperties = {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: "0.75rem",
    color: "var(--ink)",
    cursor: "pointer",
    fontSize: "0.75rem",
    padding: "0.25rem 0.5rem",
  };

  return (
    <Shell>
      <h1
        className="text-3xl font-bold mb-6"
        style={{ fontFamily: "Fraunces, serif" }}
      >
        Color Picker
      </h1>

      <div className="flex flex-col gap-6 max-w-lg">
        {/* Preview swatch */}
        <div
          style={{
            background: color,
            borderRadius: "1.25rem",
            height: "10rem",
            border: "1px solid var(--line)",
          }}
        />

        {/* Color input */}
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{
              width: "3rem",
              height: "3rem",
              border: "1px solid var(--line)",
              borderRadius: "0.75rem",
              cursor: "pointer",
              padding: 0,
              background: "none",
            }}
          />
          <span className="font-semibold text-lg" style={{ color: "var(--ink)" }}>
            {hex}
          </span>
        </div>

        {/* Color values */}
        <div
          className="flex flex-col gap-2"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "1.25rem",
            padding: "1rem",
          }}
        >
          {([
            ["HEX", hex],
            ["RGB", rgbStr],
            ["HSL", hslStr],
          ] as const).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold"
                  style={{ color: "var(--muted)", width: "2.5rem" }}
                >
                  {label}
                </span>
                <span className="text-sm font-mono" style={{ color: "var(--ink)" }}>
                  {value}
                </span>
              </div>
              <button
                onClick={() => handleCopy(label, value)}
                style={btnStyle}
              >
                {copied === label ? "Copied!" : "Copy"}
              </button>
            </div>
          ))}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saved.includes(color)}
          style={{
            background: saved.includes(color) ? "var(--line)" : "var(--accent)",
            color: saved.includes(color) ? "var(--muted)" : "#fff",
            border: "none",
            borderRadius: "0.75rem",
            padding: "0.625rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: saved.includes(color) ? "default" : "pointer",
          }}
        >
          {saved.includes(color) ? "Already Saved" : "Save Color"}
        </button>

        {/* Saved palette */}
        {saved.length > 0 && (
          <div>
            <h2
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--muted)" }}
            >
              Saved Colors ({saved.length}/{MAX_SAVED})
            </h2>
            <div className="flex flex-wrap gap-2">
              {saved.map((c) => (
                <div
                  key={c}
                  className="relative group"
                  style={{ width: "2.5rem", height: "2.5rem" }}
                >
                  <button
                    onClick={() => setColor(c)}
                    title={c.toUpperCase()}
                    style={{
                      background: c,
                      border: c === color ? "2px solid var(--ink)" : "1px solid var(--line)",
                      borderRadius: "0.75rem",
                      width: "100%",
                      height: "100%",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(c);
                    }}
                    className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center"
                    style={{
                      width: "1.125rem",
                      height: "1.125rem",
                      borderRadius: "50%",
                      background: "var(--error)",
                      color: "#fff",
                      border: "none",
                      fontSize: "0.625rem",
                      lineHeight: 1,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
