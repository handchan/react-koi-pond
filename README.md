# react-koi-pond

A beautiful, interactive koi pond canvas animation for React. Features realistic top-down koi fish with spine-based movement, lily pads with blooming flowers, click-to-ripple interaction, and fish that scatter when startled.

## Install

```bash
npm install react-koi-pond
```

## Quick Start

```tsx
import { KoiPond } from "react-koi-pond";

export default function App() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <KoiPond />
    </div>
  );
}
```

The component fills its parent container. Click the water to create ripples and scare nearby fish.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `fishCount` | `number` | `9` | Number of koi fish |
| `fishSize` | `[number, number]` | `[50, 80]` | Fish body length range in px `[min, max]` |
| `speed` | `number` | `1` | Swimming speed multiplier |
| `varieties` | `KoiVariety[]` | built-in set | Custom koi color varieties (replaces defaults) |
| `waterColor` | `[string, string, string]` | `["#1a3a4a", "#0f2b3a", "#0a1f2e"]` | Pond water gradient `[top, middle, bottom]` |
| `lilyPadCount` | `number` | random 4–6 | Number of lily pads |
| `showLilyPads` | `boolean` | `true` | Show lily pads |
| `bloomChance` | `number` | `0.45` | Probability (0–1) that each lily pad has a flower |
| `showVignette` | `boolean` | `true` | Show vignette overlay |
| `scareRadius` | `number` | `200` | Click scare radius in px |
| `rippleSize` | `number` | `140` | Ripple max radius in px |
| `className` | `string` | — | Additional CSS class on the canvas |
| `style` | `CSSProperties` | — | Additional inline styles on the canvas |

## Custom Varieties

You can define your own koi color patterns:

```tsx
import { KoiPond, KoiVariety } from "react-koi-pond";

const myVarieties: KoiVariety[] = [
  {
    base: "#ffffff",
    sheen: "rgba(255,255,255,0.08)",
    patches: [
      { t: 0.2, offset: 0, rx: 0.25, ry: 0.7, color: "#cc3300" },
      { t: 0.6, offset: 0.2, rx: 0.15, ry: 0.5, color: "#cc3300" },
    ],
  },
];

<KoiPond varieties={myVarieties} />;
```

### Patch Properties

| Property | Type | Description |
|----------|------|-------------|
| `t` | `number` | Position along body 0–1 (0 = head, 1 = tail) |
| `offset` | `number` | Lateral offset from spine, -1 (left) to 1 (right) |
| `rx` | `number` | Patch width along body, relative to body length |
| `ry` | `number` | Patch height across body, relative to local body width |
| `color` | `string` | CSS color string |

## Examples

### Minimal pond

```tsx
<KoiPond fishCount={3} showLilyPads={false} />
```

### Dark theme

```tsx
<KoiPond waterColor={["#0d1b2a", "#081420", "#050e18"]} />
```

### Full-screen hero section

```tsx
<section style={{ position: "relative", width: "100%", height: "100vh" }}>
  <KoiPond />
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
    }}
  >
    <h1 style={{ color: "white", fontSize: "4rem" }}>Welcome</h1>
  </div>
</section>
```

## License

MIT
