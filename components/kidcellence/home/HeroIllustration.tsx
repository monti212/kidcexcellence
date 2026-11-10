import { Icon } from "@/components/kidcellence/Icon";

// Hero artwork from the design: caregiver and child on the teal disc, with two
// floating trust notes. Purely decorative apart from the svg's accessible name.
export function HeroIllustration() {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox="0 0 520 500" style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Illustration of a caregiver walking hand in hand with a child">
        <circle cx="270" cy="260" r="215" fill="#54b2bf" />
        <circle cx="430" cy="90" r="46" fill="#ffcc2f" />
        <circle cx="110" cy="400" r="60" fill="#fff5d3" />
        <polygon points="90,110 95,122 108,123 98,131 101,144 90,137 79,144 82,131 72,123 85,122" fill="#f05a3c" />
        <polygon points="455,330 459,339 469,340 461,346 464,356 455,351 446,356 449,346 441,340 451,339" fill="#ffffff" />
        <ellipse cx="275" cy="455" rx="170" ry="16" fill="#000000" opacity=".1" />
        <path d="M222 210 C190 222 178 290 176 340 L170 448 L196 448 L210 360 L226 448 L252 448 L256 340 C256 290 250 222 222 210 Z" fill="#f05a3c" />
        <path d="M176 340 L256 340 L262 420 L170 420 Z" fill="#3f3e44" />
        <rect x="208" y="186" width="26" height="30" rx="10" fill="#8a5a3c" />
        <circle cx="221" cy="160" r="38" fill="#8a5a3c" />
        <path d="M183 158 C183 120 260 110 259 160 C250 140 215 132 192 150 Z" fill="#2b2a2f" />
        <circle cx="221" cy="112" r="16" fill="#2b2a2f" />
        <path d="M246 240 C268 270 284 300 300 318" stroke="#8a5a3c" strokeWidth="16" strokeLinecap="round" fill="none" />
        <path d="M318 300 C298 306 292 340 292 370 L296 446 L316 446 L322 392 L330 446 L350 446 L352 370 C352 340 344 306 318 300 Z" fill="#ffcc2f" />
        <rect x="306" y="282" width="22" height="24" rx="8" fill="#6d452e" />
        <circle cx="318" cy="258" r="30" fill="#6d452e" />
        <path d="M288 252 C292 222 346 222 348 254 C340 240 312 236 296 250 Z" fill="#2b2a2f" />
        <circle cx="289" cy="234" r="10" fill="#2b2a2f" />
        <circle cx="347" cy="234" r="10" fill="#2b2a2f" />
        <path d="M346 330 C360 300 378 280 392 258" stroke="#6d452e" strokeWidth="12" strokeLinecap="round" fill="none" />
        <path d="M392 258 C384 230 396 196 400 170" stroke="#3f3e44" strokeWidth="2" fill="none" />
        <ellipse cx="404" cy="140" rx="30" ry="36" fill="#f4fbfc" />
        <path d="M398 175 L410 175 L404 182 Z" fill="#f4fbfc" />
      </svg>

      <div style={{ position: "absolute", left: 0, top: 56, background: "#ffffff", borderRadius: 18, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 14px 34px rgba(30,30,40,.14)" }}>
        <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#f4fbfc", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="shieldCheck" size={22} color="#2a7b86" strokeWidth={2.2} />
        </span>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <strong style={{ fontSize: 14 }}>Documents reviewed</strong>
          <span style={{ fontSize: 13, color: "#686973" }}>Checklist per category</span>
        </span>
      </div>

      <div style={{ position: "absolute", right: 0, bottom: 70, background: "#ffffff", borderRadius: 18, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 14px 34px rgba(30,30,40,.14)" }}>
        <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff5d3", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="message" size={22} color="#3f3e44" strokeWidth={2} />
        </span>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <strong style={{ fontSize: 14 }}>Message providers directly</strong>
          <span style={{ fontSize: 13, color: "#686973" }}>No middleman, no call centre</span>
        </span>
      </div>
    </div>
  );
}
