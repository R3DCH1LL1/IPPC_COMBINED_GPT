import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TOKENS = {
  light: {
    pageBg: "#f3ead7",
    btnBg: "#1f1a13",
    btnText: "#fff8ea",
    btnRing: "rgba(116,82,42,0.18)",
  },
  dark: {
    pageBg: "#16110a",
    btnBg: "#e2a64a",
    btnText: "#16110a",
    btnRing: "rgba(240,199,108,0.22)",
  },
};

const EASING = "cubic-bezier(0.76, 0, 0.24, 1)";

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

export function CurtainThemeButton({
  theme = "dark",
  onThemeChange,
  size = 38,
  duration = 550,
  label = false,
  className = "",
}) {
  const [phase, setPhase] = useState("idle");
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [portalTarget, setPortalTarget] = useState(null);
  const curtainColorRef = useRef(TOKENS[theme]?.pageBg || TOKENS.dark.pageBg);
  const isDark = theme === "dark";
  const t = TOKENS[theme] || TOKENS.dark;

  useEffect(() => {
    if (typeof document === "undefined") return;
    setPortalTarget(document.body);
    const root = document.documentElement;
    const body = document.body;
    root.classList.toggle("dark", isDark);
    root.classList.toggle("light", !isDark);
    root.classList.toggle("theme-dark", isDark);
    root.classList.toggle("theme-light", !isDark);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    if (body) {
      body.classList.toggle("dark", isDark);
      body.classList.toggle("light", !isDark);
      body.classList.toggle("theme-dark", isDark);
      body.classList.toggle("theme-light", !isDark);
      body.dataset.theme = theme;
    }
  }, [isDark, theme]);

  const toggle = useCallback(() => {
    if (phase !== "idle") return;
    const next = isDark ? "light" : "dark";
    curtainColorRef.current = TOKENS[next].pageBg;
    setPhase("falling");

    window.setTimeout(() => {
      onThemeChange?.(next);
      setPhase("rising");
      window.setTimeout(() => setPhase("idle"), duration + 60);
    }, duration);
  }, [duration, isDark, onThemeChange, phase]);

  const scale = pressed ? 0.96 : hovered ? 1.06 : 1;
  const curtainStyle = {
    position: "fixed",
    inset: 0,
    background: curtainColorRef.current,
    transformOrigin: "top",
    transform: phase === "falling" ? "scaleY(1)" : "scaleY(0)",
    transition: phase !== "idle" ? `transform ${duration}ms ${EASING}` : "none",
    zIndex: 2147483000,
    pointerEvents: "none",
  };

  const btnStyle = {
    width: label ? "auto" : size,
    minWidth: size,
    height: size,
    borderRadius: 999,
    transform: `scale(${scale})`,
    background: t.btnBg,
    color: t.btnText,
    boxShadow: `0 0 0 1.5px ${t.btnRing}`,
  };

  return (
    <>
      {portalTarget ? createPortal(<div aria-hidden="true" className="curtain-theme-overlay" style={curtainStyle} />, portalTarget) : null}
      <button
        className={`curtain-theme-button ${label ? "with-label" : ""} ${className}`}
        style={btnStyle}
        onClick={toggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setPressed(false);
        }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={isDark}
        type="button"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
        {label && <span>{isDark ? "Dusk" : "Dawn"} theme</span>}
      </button>
    </>
  );
}
