# Dashboard Changelog

All notable changes to the AgencyForge Dashboard.

---

## [0.1.0] - 2026-06-29

### Added
- Initial dashboard release with Next.js 15 + React 19
- Apple-inspired UI design system (SF Pro-inspired)
- 6 department agents: Research, Marketing, Sales, Automation, Website, Creative
- CEO character with emotional state machine
- CharacterFace component with 10 emotion states (idle, thinking, happy, excited, celebrating, listening, speaking, concerned, error, offline)
- Character animation system (blinking, pulse, glow, sparkles, thinking indicator)
- Voice Panel with command routing to agents
- CEO Briefing panel with time-of-day greetings
- Department cards with status and activity display
- DashboardStore singleton with pub/sub event system
- Event system with 40+ event types
- Emotion-to-event auto-mapping
- 24 shadcn/ui-style design system components
- TailwindCSS 4.0 with CSS variables
- Framer Motion animations
- Toast notification system

### Fixed
- Unescaped quotes in `app/page.tsx:363` (`&ldquo;`/`&rdquo;`)
- Unescaped quotes in `components/ceo-briefing.tsx:199` (`&ldquo;`/`&rdquo;`)
- Unescaped quotes in `components/character.tsx:410` (`&ldquo;`/`&rdquo;`)
- Unescaped quotes in `components/voice-panel.tsx:236` (`"` entities)
- `<img>` element warning in `components/ui/avatar.tsx:78` (eslint-disable comment)
- React Hook naming violation in `lib/store-context.tsx:488` (renamed to `useInitializeDemoData`)
- Missing ESLint configuration (created `eslint.config.mjs`)

### Changed
- Build passes (Next.js 15.5.19)
- TypeScript passes (0 errors)
- Lint passes (0 errors, 0 warnings)
- Architecture frozen (no refactoring allowed)

---

## Architecture Freeze Notice

As of this version, the Dashboard architecture is **frozen**.

**Prohibited:** Refactoring UI components, regenerating existing components, or architectural changes.

**Allowed:**
- Bug fixes
- Performance improvements
- Accessibility improvements
- New features (when explicitly requested)

---

## File Inventory

| File | Status |
|------|--------|
| `app/layout.tsx` | Active |
| `app/page.tsx` | Active |
| `components/character.tsx` | Active |
| `components/ceo-briefing.tsx` | Active |
| `components/department-card.tsx` | Active |
| `components/shell.tsx` | Active |
| `components/sidebar.tsx` | Active |
| `components/voice-panel.tsx` | Active |
| `lib/store-context.tsx` | Active |
| `lib/events.ts` | Active |
| `lib/tokens.ts` | Active |
| `lib/utils.ts` | Active |
| `components/ui/*` | Active (24 components) |

---

## Deprecation Notice

| Item | Deprecated | Replacement |
|------|------------|-------------|
| `npm run lint` | 2026-06-29 | Use ESLint CLI directly |
| `initializeDemoData` | 2026-06-29 | `useInitializeDemoData` |

---

## Known Issues

None.

---

## Coming Soon

- Dark mode support (per SPEC.md line 437)
- External EventBus integration
- Memory system integration
- Kernel WebSocket connection
- Test suite (no test script currently configured)