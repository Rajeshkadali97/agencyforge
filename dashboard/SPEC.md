# AgencyForge Design System — Specification

## 1. Concept & Vision

AgencyForge is the operating system for an AI Creative Agency. The design language must embody the precision of Apple's engineering discipline, the spatial elegance of Linear, the efficiency of Raycast, the clarity of Arc Browser, the warmth of Notion, and the sophistication of the Vercel Dashboard. Every pixel must earn its place. The UI should feel like a premium instrument—calm, confident, and completely in control. It should feel as timeless as a well-crafted Apple product, yet forward-looking enough to represent the future of AI-driven creative work.

## 2. Design Language

### Aesthetic Direction
Inspired by the intersection of Japanese minimalism and Silicon Valley precision. Clean surfaces with intentional negative space. Typography that breathes. Interactions that feel physical but effortless. The aesthetic is **understated luxury**—not flashy or attention-seeking, but quietly impressive in its refinement.

### Color Palette

#### Neutrals
| Token | Hex | Usage |
|-------|-----|-------|
| `--neutral-0` | `#FFFFFF` | Primary background |
| `--neutral-50` | `#FAFAFA` | Secondary backgrounds, cards |
| `--neutral-100` | `#F5F5F7` | Subtle borders, dividers |
| `--neutral-200` | `#E5E5E7` | Disabled states, tertiary borders |
| `--neutral-300` | `#D1D1D6` | Placeholder text, icons |
| `--neutral-400` | `#A1A1A6` | Secondary text |
| `--neutral-500` | `#6E6E73` | Muted text |
| `--neutral-600` | `#48484A` | Tertiary text |
| `--neutral-700` | `#3A3A3C` | Secondary headings |
| `--neutral-800` | `#2C2C2E` | Primary text |
| `--neutral-900` | `#1D1D1F` | Headings |
| `--neutral-950` | `#000000` | Pure black accents |

#### Semantic Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--primary` | `#1D1D1F` | Primary actions, key UI elements |
| `--primary-foreground` | `#FFFFFF` | Text on primary |
| `--secondary` | `#F5F5F7` | Secondary surfaces |
| `--secondary-foreground` | `#1D1D1F` | Text on secondary |
| `--muted` | `#F5F5F7` | Subdued backgrounds |
| `--muted-foreground` | `#6E6E73` | Subdued text |
| `--accent` | `#F5F5F7` | Hover states, subtle highlights |
| `--accent-foreground` | `#1D1D1F` | Text on accent |
| `--destructive` | `#DC2626` | Errors, destructive actions |
| `--destructive-foreground` | `#FFFFFF` | Text on destructive |
| `--border` | `#E5E5E7` | Default borders |
| `--input` | `#E5E5E7` | Input borders |
| `--ring` | `#1D1D1F` | Focus rings |

#### Status Colors (subtle, not garish)
| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#16A34A` | Success states |
| `--success-muted` | `#F0FDF4` | Success backgrounds |
| `--warning` | `#CA8A04` | Warning states |
| `--warning-muted` | `#FEFCE8` | Warning backgrounds |
| `--error` | `#DC2626` | Error states |
| `--error-muted` | `#FEF2F2` | Error backgrounds |
| `--info` | `#0284C7` | Informational |
| `--info-muted` | `#F0F9FF` | Info backgrounds |

#### Sidebar & Navigation
| Token | Hex | Usage |
|-------|-----|-------|
| `--sidebar` | `#FAFAFA` | Sidebar background |
| `--sidebar-border` | `#E5E5E7` | Sidebar borders |
| `--sidebar-foreground` | `#1D1D1F` | Sidebar text |
| `--sidebar-accent` | `#F5F5F7` | Sidebar hover |
| `--sidebar-accent-foreground` | `#1D1D1F` | Sidebar hover text |
| `--sidebar-selected` | `#F0F0F2` | Selected item |
| `--sidebar-selected-foreground` | `#1D1D1F` | Selected text |

### Typography

#### Font Stack
- **Primary**: `Inter` — Clean, geometric, highly legible at all sizes
- **Mono**: `JetBrains Mono` — For code and technical content
- **Fallback**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

#### Type Scale
| Token | Font | Size | Weight | Line Height | Letter Spacing |
|-------|------|------|--------|-------------|----------------|
| `--text-xs` | Inter | 11px | 400 | 16px | 0.01em |
| `--text-sm` | Inter | 13px | 400 | 20px | 0.01em |
| `--text-sm-medium` | Inter | 13px | 500 | 20px | 0.01em |
| `--text-base` | Inter | 15px | 400 | 24px | 0 |
| `--text-base-medium` | Inter | 15px | 500 | 24px | 0 |
| `--text-lg` | Inter | 17px | 400 | 28px | -0.01em |
| `--text-lg-medium` | Inter | 17px | 500 | 28px | -0.01em |
| `--text-xl` | Inter | 20px | 500 | 28px | -0.02em |
| `--text-2xl` | Inter | 24px | 500 | 32px | -0.02em |
| `--text-3xl` | Inter | 30px | 500 | 36px | -0.02em |
| `--text-4xl` | Inter | 38px | 500 | 40px | -0.03em |
| `--text-5xl` | Inter | 48px | 500 | 48px | -0.03em |

#### Headings
| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| `h1` | 38px | 600 | 40px |
| `h2` | 30px | 600 | 36px |
| `h3` | 24px | 600 | 32px |
| `h4` | 20px | 600 | 28px |
| `h5` | 17px | 600 | 24px |
| `h6` | 15px | 600 | 20px |

### Spacing Scale

Based on a 4px grid for consistency and rhythm.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-0` | 0px | None |
| `--space-1` | 4px | Tight gaps, icon padding |
| `--space-2` | 8px | Compact spacing |
| `--space-3` | 12px | Small gaps |
| `--space-4` | 16px | Default gap |
| `--space-5` | 20px | Medium spacing |
| `--space-6` | 24px | Section gaps |
| `--space-8` | 32px | Large gaps |
| `--space-10` | 40px | XL spacing |
| `--space-12` | 48px | 2XL spacing |
| `--space-16` | 64px | 3XL spacing |
| `--space-20` | 80px | 4XL spacing |
| `--space-24` | 96px | Section separation |
| `--space-32` | 128px | Major sections |

### Radius System

Consistent border radius creating a cohesive visual language.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | 0px | Sharp, technical elements |
| `--radius-sm` | 4px | Small chips, tags |
| `--radius-md` | 6px | Buttons, inputs |
| `--radius-lg` | 8px | Cards, panels |
| `--radius-xl` | 12px | Large cards, modals |
| `--radius-2xl` | 16px | Featured cards |
| `--radius-full` | 9999px | Pills, avatars |

### Shadows

Layered shadows for depth and hierarchy. Each shadow is designed to feel soft and natural, like light filtering through frosted glass.

#### Elevation Scale
| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-none` | none | No shadow |
| `--shadow-px` | `0 0 0 1px rgba(0,0,0,0.04)` | Subtle border alternative |
| `--shadow-xs` | `0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04)` | Cards at rest |
| `--shadow-sm` | `0 0 0 1px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | Elevated elements |
| `--shadow-md` | `0 0 0 1px rgba(0,0,0,0.04), 0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)` | Dropdowns, popovers |
| `--shadow-lg` | `0 0 0 1px rgba(0,0,0,0.04), 0 10px 15px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04)` | Modals, overlays |
| `--shadow-xl` | `0 0 0 1px rgba(0,0,0,0.04), 0 20px 25px rgba(0,0,0,0.08), 0 10px 10px rgba(0,0,0,0.04)` | Floating elements |
| `--shadow-2xl` | `0 0 0 1px rgba(0,0,0,0.04), 0 25px 50px rgba(0,0,0,0.12)` | Prominent overlays |

#### Glass Effect
| Token | Value | Usage |
|-------|-------|-------|
| `--glass-bg` | `rgba(255, 255, 255, 0.8)` | Glass background |
| `--glass-border` | `rgba(255, 255, 255, 0.2)` | Glass borders |
| `--glass-shadow` | `0 8px 32px rgba(0, 0, 0, 0.08)` | Glass depth |

### Motion Rules

Motion must feel natural, physical, and purposeful. Never decorative.

#### Durations
| Token | Value | Usage |
|-------|-------|-------|
| `--duration-instant` | 50ms | Immediate feedback |
| `--duration-fast` | 100ms | Micro-interactions |
| `--duration-normal` | 200ms | Default transitions |
| `--duration-slow` | 300ms | Emphasis transitions |
| `--duration-slower` | 500ms | Dramatic reveals |

#### Easings
| Token | Value | Usage |
|-------|-------|-------|
| `--ease-default` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | General purpose |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Elements entering |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Elements leaving |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bouncy, playful |
| `--ease-smooth` | `cubic-bezier(0.65, 0, 0.35, 1)` | Smooth, fluid |

#### Animation Patterns
- **Fade**: `opacity: 0 → 1`, `200ms ease-out`
- **Scale**: `scale(0.95) → scale(1)`, `200ms ease-out`
- **Slide Up**: `translateY(4px) → translateY(0)`, `200ms ease-out`
- **Slide Down**: `translateY(-4px) → translateY(0)`, `200ms ease-out`
- **Hover Lift**: `translateY(-1px)` + `shadow-md`, `150ms ease-out`
- **Press**: `scale(0.98)`, `50ms ease-in`

## 3. Layout & Structure

### Page Structure
- **Sidebar**: Fixed 240px width, collapsible to 64px icon rail
- **Main Content**: Fluid, max-width 1440px centered
- **Content Grid**: 12-column with 24px gutters
- **Section Spacing**: 64px between major sections, 32px within sections

### Responsive Breakpoints
| Breakpoint | Width | Columns | Sidebar |
|------------|-------|---------|---------|
| `sm` | 640px | 4 | Collapsed |
| `md` | 768px | 8 | Collapsed |
| `lg` | 1024px | 12 | Expanded |
| `xl` | 1280px | 12 | Expanded |
| `2xl` | 1536px | 12 | Expanded |

### Grid System
- Container max-width: `1440px`
- Container padding: `24px` (mobile), `32px` (tablet), `48px` (desktop)
- Column gap: `24px`
- Row gap: `24px`

## 4. Component Inventory

### Button

#### Variants
| Variant | Description | Use Case |
|---------|-------------|----------|
| `primary` | Solid dark background | Primary actions, CTAs |
| `secondary` | Light gray background | Secondary actions |
| `ghost` | No background, hover shows | Tertiary actions, toolbars |
| `outline` | Border only | Alternate to ghost |
| `destructive` | Red background | Destructive actions |
| `link` | Text only with underline hover | Inline links |

#### Sizes
| Size | Height | Padding | Text | Radius |
|------|--------|---------|------|--------|
| `xs` | 28px | 8px 12px | 11px | 4px |
| `sm` | 32px | 8px 14px | 13px | 6px |
| `md` | 38px | 10px 18px | 15px | 6px |
| `lg` | 44px | 12px 24px | 17px | 8px |
| `xl` | 52px | 14px 32px | 17px | 8px |

#### States
- **Default**: Base styling
- **Hover**: Subtle lift (`translateY(-1px)`), increased shadow
- **Active/Pressed**: Scale `0.98`, no shadow
- **Disabled**: Opacity `0.4`, cursor `not-allowed`
- **Loading**: Spinner replaces icon, text dimmed

### Card

#### Base Card
- Background: `--neutral-0`
- Border: `1px solid --neutral-100`
- Border-radius: `12px`
- Padding: `24px`
- Shadow: `--shadow-xs`

#### Card Variants
| Variant | Description |
|---------|-------------|
| `default` | Standard bordered card |
| `elevated` | Shadow instead of border |
| `glass` | Glassmorphism effect |
| `outline` | Border only, no shadow |
| `muted` | Gray background for inactive states |

#### Interactive Card
- Hover: `translateY(-2px)`, `shadow-sm`
- Transition: `200ms ease-out`

### Input

#### Base Input
- Height: `38px`
- Padding: `10px 14px`
- Border: `1px solid --neutral-200`
- Border-radius: `6px`
- Font: `15px`
- Placeholder: `--neutral-400`

#### Input States
- **Default**: Gray border
- **Focus**: `--primary` border, `--ring` ring
- **Error**: `--error` border
- **Disabled**: Background `--neutral-100`, opacity `0.6`

### Avatar

#### Avatar Sizes
| Size | Dimension | Font Size | Border Radius |
|------|-----------|-----------|--------------|
| `xs` | 24px | 10px | Full |
| `sm` | 32px | 12px | Full |
| `md` | 40px | 14px | Full |
| `lg` | 48px | 16px | Full |
| `xl` | 64px | 20px | Full |
| `2xl` | 80px | 24px | Full |

#### Avatar Variants
| Variant | Description |
|---------|-------------|
| `image` | User image |
| `initials` | Initials with background |
| `icon` | Icon placeholder |

#### Avatar Colors (for initials)
Rotating palette for variety without color chaos:
- `--avatar-1`: `#E8F5E9` / `#1D1D1F`
- `--avatar-2`: `#E3F2FD` / `#1D1D1F`
- `--avatar-3`: `#F3E5F5` / `#1D1D1F`
- `--avatar-4`: `#FFF3E0` / `#1D1D1F`
- `--avatar-5`: `#E0F7FA` / `#1D1D1F`
- `--avatar-6`: `#FCE4EC` / `#1D1D1F`

### Badge / Status Indicator

#### Badge Variants
| Variant | Background | Text | Use |
|---------|------------|------|-----|
| `default` | `--neutral-100` | `--neutral-700` | Neutral labels |
| `primary` | `--primary` | White | Key labels |
| `success` | `--success-muted` | `--success` | Success |
| `warning` | `--warning-muted` | `--warning` | Warning |
| `error` | `--error-muted` | `--error` | Error |
| `info` | `--info-muted` | `--info` | Info |

#### Status Dot
| Status | Color | Animation |
|--------|-------|-----------|
| `online` | `--success` | Pulse |
| `away` | `--warning` | None |
| `busy` | `--error` | None |
| `offline` | `--neutral-300` | None |

### Notification / Toast

#### Toast Variants
| Variant | Left Border | Icon |
|---------|-------------|------|
| `default` | None | None |
| `success` | 3px `--success` | Check circle |
| `warning` | 3px `--warning` | Alert triangle |
| `error` | 3px `--error` | X circle |
| `info` | 3px `--info` | Info |

#### Toast Anatomy
- Padding: `16px`
- Border-radius: `8px`
- Background: `--neutral-0`
- Shadow: `--shadow-lg`
- Gap between icon and text: `12px`

### Dropdown Menu

- Background: `--neutral-0`
- Border: `1px solid --neutral-100`
- Border-radius: `8px`
- Shadow: `--shadow-lg`
- Padding: `6px`
- Item height: `36px`
- Item padding: `8px 12px`
- Separator: `1px solid --neutral-100`, margin `6px`

### Tooltip

- Background: `--neutral-900`
- Text: `--neutral-0`
- Padding: `6px 10px`
- Border-radius: `4px`
- Font: `12px`
- Shadow: `--shadow-md`

### Skeleton

- Background: `linear-gradient(90deg, --neutral-100 25%, --neutral-50 50%, --neutral-100 75%)`
- Background-size: `200% 100%`
- Animation: `shimmer 1.5s infinite`
- Border-radius: Matches element type

## 5. Technical Approach

### Stack
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui (customized)
- **Animation**: Framer Motion
- **Icons**: Lucide React

### Project Structure
```
dashboard/
├── app/
│   ├── layout.tsx              # Root layout with fonts, providers
│   └── globals.css             # Global styles, Tailwind base
├── components/
│   └── ui/                     # Design system components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── dropdown-menu.tsx
│       ├── tooltip.tsx
│       ├── skeleton.tsx
│       ├── toast.tsx
│       ├── separator.tsx
│       ├── progress.tsx
│       ├── tabs.tsx
│       ├── accordion.tsx
│       ├── dialog.tsx
│       ├── sheet.tsx
│       ├── select.tsx
│       ├── checkbox.tsx
│       ├── radio-group.tsx
│       ├── switch.tsx
│       ├── textarea.tsx
│       ├── label.tsx
│       └── index.ts            # Re-export all
├── lib/
│   ├── utils.ts                # cn() utility, classnames
│   └── tokens.ts               # Design token constants
├── hooks/
│   └── use-toast.ts            # Toast hook
├── providers/
│   └── providers.tsx           # Client providers (Toaster, etc.)
└── SPEC.md
```

### Design Token Implementation
Tokens implemented as:
1. CSS custom properties in `globals.css`
2. TypeScript constants in `lib/tokens.ts`
3. Tailwind theme extension in `tailwind.config.ts`

### Build Requirements
- All components must be reusable and composable
- Zero duplicate styles—all styling via Tailwind utilities or CSS variables
- Full TypeScript types for all props
- ARIA labels and accessibility support
- Dark mode support (future phase)

## 6. Implementation Notes

### No Gradients Policy
The entire design system avoids gradients. Solid, flat colors only. This creates a clean, professional look that works in all contexts.

### Shadow Philosophy
Shadows are used sparingly and should feel natural, like elements floating above the page. Avoid stacking multiple shadows. Prefer the elevation system consistently.

### Animation Principles
- All animations serve a purpose (feedback, orientation, delight)
- Motion should never block user interaction
- Respect `prefers-reduced-motion`
- Keep durations short—never over 500ms for UI transitions

### Accessibility
- Minimum contrast ratio: 4.5:1 for text
- Focus indicators visible and styled
- All interactive elements have hover/focus/active states
- Semantic HTML throughout