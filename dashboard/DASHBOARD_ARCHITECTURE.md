# Dashboard Architecture

**Status:** FROZEN
**Last Updated:** 2026-06-29

---

## Folder Structure

```
dashboard/
├── app/                          # Next.js 15 App Router
│   ├── layout.tsx                # Root layout with providers
│   ├── page.tsx                  # Main dashboard (525 lines)
│   └── globals.css               # Design tokens + CSS variables
│
├── components/
│   ├── ui/                       # Design system primitives
│   │   ├── index.ts              # Barrel re-export
│   │   ├── button.tsx            # Variants: outline, primary, ghost
│   │   ├── avatar.tsx            # Status indicators, image fallback
│   │   ├── badge.tsx             # Variants: default, success, warning, error
│   │   ├── card.tsx              # Card, CardHeader, CardContent, CardFooter
│   │   ├── input.tsx             # Text input
│   │   ├── textarea.tsx          # Multi-line input
│   │   ├── label.tsx             # Form label
│   │   ├── checkbox.tsx          # Radix checkbox wrapper
│   │   ├── radio-group.tsx        # Radix radio group
│   │   ├── switch.tsx            # Radix toggle
│   │   ├── skeleton.tsx           # Loading placeholder
│   │   ├── separator.tsx         # Horizontal divider
│   │   ├── progress.tsx           # Progress bar
│   │   ├── tabs.tsx               # Radix tabs
│   │   ├── dropdown-menu.tsx      # Radix dropdown
│   │   ├── accordion.tsx          # Radix accordion
│   │   ├── dialog.tsx             # Radix dialog
│   │   ├── sheet.tsx              # Radix sheet (slide-out)
│   │   ├── select.tsx             # Radix select
│   │   └── tooltip.tsx            # Radix tooltip
│   │
│   ├── characters/
│   │   └── core/
│   │       └── types.ts          # CharacterEmotion, CharacterDepartment types
│   │
│   ├── shell.tsx                 # Layout shell (sidebar + content)
│   ├── sidebar.tsx               # Department navigation (220px ↔ 72px)
│   ├── department-card.tsx       # Agent card with status/activity
│   ├── character.tsx             # CharacterFace + CharacterWithMessage
│   ├── ceo-briefing.tsx          # CEO briefing panel
│   └── voice-panel.tsx            # Voice assistant interface
│
├── lib/
│   ├── utils.ts                  # cn(), getInitials(), getAvatarColor()
│   ├── tokens.ts                 # Design token constants (colors, shadows)
│   ├── events.ts                 # EventType, EventPayload, emotion mapping
│   └── store-context.tsx         # DashboardStore + React Context hooks
│
├── providers/
│   ├── providers.tsx              # DashboardProvider + Toaster wrapper
│   └── index.ts
│
├── hooks/
│   └── use-toast.ts              # Toast notification system
│
├── SPEC.md                       # Design system specification
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
└── eslint.config.mjs
```

---

## State Management

### DashboardStore (Singleton)

**Location:** `lib/store-context.tsx` (lines 91-366)

```
┌─────────────────────────────────────────────────────────┐
│                    DashboardStore                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │  DashboardState                                 │   │
│  │  ├── ceo: CEOState                              │   │
│  │  │     ├── emotion: CharacterEmotion            │   │
│  │  │     ├── message: string                      │   │
│  │  │     ├── briefings: CEOBriefingItem[]         │   │
│  │  │     └── isListening: boolean                 │   │
│  │  │                                              │   │
│  │  ├── agents: Map<string, AgentState>           │   │
│  │  │     └── [research|marketing|sales|          │   │
│  │  │          automation|website|creative]       │   │
│  │  │                                              │   │
│  │  ├── briefings: CEOBriefingItem[]              │   │
│  │  ├── activities: TeamActivity[]                  │   │
│  │  ├── voiceMessages: VoiceMessage[]             │   │
│  │  ├── isConnected: boolean                       │   │
│  │  └── lastSync: Date                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Methods:                                               │
│  ├── subscribe(listener) → unsubscribe                 │
│  ├── getState() → DashboardState                       │
│  ├── getAgent(id) → AgentState                         │
│  ├── updateAgent(id, updates) → void                  │
│  ├── updateCEO(updates) → void                        │
│  ├── addBriefing(item) → void (max 10)                │
│  ├── addActivity(activity) → void (max 20)           │
│  ├── addVoiceMessage(message) → void                  │
│  ├── on(eventType, callback) → unsubscribe            │
│  ├── emit(event) → void                              │
│  └── processKernelMessage(msg) → void                │
└─────────────────────────────────────────────────────────┘
```

### React Hooks

| Hook | Returns | Usage |
|------|---------|-------|
| `useDashboardStore()` | DashboardStore instance | Direct store access |
| `useDashboardState()` | DashboardState | Full state subscription |
| `useAgent(id)` | AgentState | Single agent state |
| `useAllAgents()` | AgentState[] | All agents array |
| `useCEO()` | CEOState | CEO state |
| `useBriefings()` | CEOBriefingItem[] | Briefing list |
| `useActivities()` | TeamActivity[] | Activity feed |
| `useVoiceMessages()` | VoiceMessage[] | Voice history |

---

## Component Hierarchy

```
AgentShell
├── Sidebar (department navigation)
│   └── [CEO, Research, Marketing, Sales, Automation, Website, Creative]
│
└── Main Content (app/page.tsx)
    ├── Header (date/time)
    │
    ├── AnimatePresence (view transitions)
    │   ├── Headquarters View
    │   │   ├── CEOSection
    │   │   │   └── CharacterFace (automation, idle)
    │   │   │
    │   │   ├── DepartmentGrid (6 cards)
    │   │   │   └── DepartmentCard × 6
    │   │   │       └── CharacterFace (department, emotion)
    │   │   │
    │   │   ├── CEOBriefing (panel)
    │   │   │   ├── CharacterFace (ceo, emotion, size=xl)
    │   │   │   └── BriefingItem × N
    │   │   │
    │   │   ├── AgentMessages (inline)
    │   │   │   └── CharacterWithMessage × 6
    │   │   │
    │   │   └── VoicePanel
    │   │       ├── CharacterFace (automation, listening/idle)
    │   │       ├── VoiceMessageBubble × N
    │   │       ├── TypingIndicator
    │   │       └── Input + Send button
    │   │
    │   └── DepartmentWorkspace
    │       └── CharacterFace (selected department)
    │
    └── [Other sections...]
```

---

## Event System

### Event Architecture

**Internal pub/sub pattern** in `store-context.tsx` (lines 266-310)

```typescript
// Subscribe to events
const unsubscribe = store.on('deal:won', (event) => {
  console.log('Deal won:', event.payload);
});

// Emit events
store.emit({
  type: 'deal:won',
  source: 'sales',
  payload: { amount: 50000, client: 'Acme Corp' },
  timestamp: new Date()
});

// Auto-emotion mapping (events.ts lines 356-393)
emotionFromEvent['deal:won'] → 'celebrating'
emotionFromEvent['workflow:failed'] → 'error'
```

### EventType Categories

| Category | Events |
|----------|--------|
| Research | `lead:found`, `research:completed`, `research:progress` |
| Sales | `proposal:generated`, `proposal:opened`, `proposal:signed`, `deal:won`, `deal:lost` |
| Website | `website:completed`, `website:deployed`, `website:approval_requested` |
| Creative | `design:completed`, `assets:uploaded`, `brand:refreshed` |
| Automation | `workflow:started`, `workflow:completed`, `workflow:failed`, `invoice:delivered` |
| Agent Status | `agent:busy`, `agent:idle`, `agent:thinking`, `agent:speaking`, `agent:error`, `agent:offline`, `agent:online` |
| Voice | `voice:started`, `voice:stopped`, `voice:command`, `voice:response` |
| CEO | `briefing:morning`, `briefing:urgent`, `alert:critical`, `approval:required` |
| Revenue | `revenue:updated`, `lead:qualified`, `opportunity:created` |

---

## Memory Integrations

**Status:** Not implemented in Dashboard

The Dashboard does not currently integrate with any memory system. The `processKernelMessage()` handler exists but expects messages from an external kernel process.

---

## CEO Briefing Flow

```
┌──────────────────────────────────────────────┐
│               CEOBriefing Component           │
│  Props:                                       │
│  ├── briefings: CEOBriefingItem[]            │
│  ├── ceoEmotion: CharacterEmotion            │
│  ├── ceoMessage: string                       │
│  └── onBriefingClick?: (briefing) => void    │
└──────────────────────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │   getTimeOfDay()       │
         │   morning/afternoon/   │
         │   evening/night        │
         └────────────────────────┘
                      │
                      ▼
    ┌─────────────────────────────────┐
    │     briefings.length === 0?     │
    └─────────────────────────────────┘
            │                │
           YES               NO
            │                │
            ▼                ▼
    ┌──────────────┐  ┌───────────────────┐
    │ Empty State  │  │ Briefing List     │
    │ "All caught  │  │                   │
    │  up"         │  │ CEO_GREETINGS[    │
    │              │  │   timeOfDay]      │
    │ CharacterFace│  │                   │
    │ (ceo, idle,  │  │ CharacterFace     │
    │  size=lg)    │  │ (ceo, emotion,    │
    │              │  │  size=xl)         │
    └──────────────┘  │                   │
                       │ "View Briefing"  │
                       │ "Ask CEO" buttons │
                       │                   │
                       │ BriefingItem × N  │
                       │  ├── AlertCircle  │
                       │  │   (if urgent)  │
                       │  ├── Clock        │
                       │  │   (if normal)  │
                       │  ├── briefing.text│
                       │  └── agent + time │
                       └───────────────────┘
```

---

## Voice Panel Flow

```
┌──────────────────────────────────────────────┐
│              VoicePanel Component             │
│  Props:                                       │
│  ├── messages: VoiceMessage[]                 │
│  ├── onSendMessage: (text) => void           │
│  ├── onToggleListening: () => void           │
│  └── isListening: boolean                    │
└──────────────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
   ┌─────────────┐         ┌─────────────┐
   │ Collapsed   │         │  Expanded   │
   │ Header View │         │  Full Panel │
   └─────────────┘         └─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
            ┌─────────────┐             ┌─────────────┐
            │ messages    │             │ messages    │
            │  === 0      │             │  > 0        │
            └─────────────┘             └─────────────┘
                    │                           │
                    ▼                           │
            ┌─────────────┐                    │
            │ Empty State │                    │
            │ "Start a    │                    │
            │  conversation"                   │
            │             │                    │
            │ "Try: 'Find │                    │
            │  dentists   │                    │
            │  in Texas'" │                    │
            └─────────────┘                    │
                                               ▼
                                    ┌─────────────────────┐
                                    │ messages.map()      │
                                    │ VoiceMessageBubble  │
                                    │ ├── CharacterFace   │
                                    │ │   (for agents)    │
                                    │ └── Bubble + time   │
                                    └─────────────────────┘
                                               │
                                               ▼
                                    ┌─────────────────────┐
                                    │ TypingIndicator     │
                                    │ (if processing)    │
                                    │ ├── CharacterFace   │
                                    │ │   (thinking)     │
                                    │ └── Animated dots   │
                                    └─────────────────────┘
```

### Command Routing (lines 146-163)

| Keyword | Routes To |
|---------|-----------|
| find, search, research | Research |
| design, creative, brand | Creative |
| website, web, deploy | Website |
| sales, proposal, deal | Sales |
| automate, workflow, invoice | Automation |
| marketing, campaign | Marketing |
| (default) | CEO |

---

## Character Animation Flow

```
┌─────────────────────────────────────────────────────────┐
│                  CharacterFace Component                 │
│  Props: department, emotion, size, showStatus, compact  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
            ┌───────────────────────────┐
            │   emotionConfig[emotion]  │
            │   ├── eyebrows: number    │
            │   ├── eyes: 'open'|'half' │
            │   ├── mouth: string       │
            │   ├── glow: string        │
            │   └── pulse: boolean      │
            └───────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   Eyebrows  │ │    Eyes     │ │    Mouth    │
    │ transform:  │ │  - blinking │ │   shape     │
    │  rotate(Y°) │ │  - emotion  │ │  (SVG path) │
    └─────────────┘ └─────────────┘ └─────────────┘
                            │
                            ▼
            ┌───────────────────────────┐
            │   Animation Effects       │
            │   ├── pulse (scale)        │
            │   ├── glow (box-shadow)   │
            │   ├── thinking (gear)      │
            │   └── sparkles (✨)        │
            └───────────────────────────┘
```

### Emotion States

| Emotion | Eyebrows | Eyes | Mouth | Glow | Pulse |
|---------|----------|------|-------|------|-------|
| idle | 0 | open | neutral | gray | No |
| thinking | -8 | half | neutral | blue | Yes |
| happy | 5 | happy | smile | green | No |
| excited | 8 | happy | wide | green | No |
| celebrating | 10 | happy | wide | green | Yes |
| listening | 0 | open | neutral | blue | No |
| speaking | 0 | half | open | dark | Yes |
| concerned | -12 | half | neutral | yellow | No |
| error | -15 | half | frown | red | Yes |
| offline | 0 | closed | frown | gray | No |

### Blinking Logic

```
scheduleBlink():
├── Skip if emotion: sleeping, offline, thinking
├── Wait random(2000-6000ms)
├── Set isBlinking = true
├── Wait 150ms
└── Set isBlinking = false
```

---

## Extension Points

### 1. Adding New Event Types

**File:** `lib/events.ts`

```typescript
// Add to EventType union (lines 15-60)
| "custom:event"

// Add to emotionFromEvent map (lines 356-393)
"custom:event": "happy"
```

### 2. Adding New Departments

**Files:**
- `lib/events.ts` - Add department to CharacterDepartment type
- `lib/store-context.tsx` - Add to initialAgents (line 65-72)
- `components/character.tsx` - Add to departmentColors (line 193-201)

### 3. Adding New Agent States

**File:** `lib/store-context.tsx`

```typescript
// Extend AgentState interface (line 46-62)
interface AgentState {
  id: string;
  name: string;
  department: string;
  emotion: CharacterEmotion;
  message: string;
  status: 'online' | 'busy' | 'idle' | 'offline';
  activeTask?: string;
  health: number; // 0-100
  // Add new field here
}
```

### 4. Adding New Character Emotions

**File:** `components/character.tsx`

```typescript
// Add to emotionConfig (lines 15-37)
const emotionConfig: Record<CharacterEmotion, EmotionConfig> = {
  // ... existing emotions
  newEmotion: {
    eyebrows: 0,
    eyes: 'open',
    mouth: 'neutral',
    glow: 'gray',
    pulse: false
  }
}
```

### 5. Adding New Voice Commands

**File:** `components/voice-panel.tsx`

```typescript
// Add to handleSend() routing (lines 146-163)
if (text.includes("keyword")) {
  setProcessingAgent({ name: "AgentName", id: "agentId" });
}
```

### 6. Adding New UI Components

**Location:** `components/ui/`

Follow shadcn/ui patterns:
- Use Radix UI primitives
- Export from `components/ui/index.ts`
- Use design tokens from `lib/tokens.ts`

---

## Design Tokens

**Location:** `lib/tokens.ts`

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | HSL with CSS variables | Buttons, links |
| `--secondary` | HSL with CSS variables | Secondary actions |
| `--muted` | HSL with CSS variables | Backgrounds |
| `--accent` | HSL with CSS variables | Highlights |
| `--destructive` | HSL with CSS variables | Errors |
| `--border` | HSL with CSS variables | Borders |
| `--ring` | HSL with CSS variables | Focus rings |

---

## Kernel Message Protocol

**File:** `lib/store-context.tsx` (lines 313-365)

Incoming messages from kernel:

```typescript
interface KernelMessage {
  type: 'agent_update' | 'briefing' | 'activity' | 'voice_response';
  payload: AgentUpdatePayload | BriefingPayload | ActivityPayload | VoicePayload;
}

// Handler mapping
'agent_update' → store.updateAgent(id, updates)
'briefing' → store.addBriefing(item)
'activity' → store.addActivity(activity)
'voice_response' → store.addVoiceMessage(message)
```

---

## Performance Considerations

| Component | Optimization |
|-----------|--------------|
| CharacterFace | Memoized emotion config lookup |
| VoicePanel | Scroll-to-bottom on new messages |
| DepartmentCard | Lazy animation with Framer Motion |
| Shell | CSS-based layout (no JS) |

---

## Accessibility

- Focus rings on interactive elements
- Semantic HTML structure
- ARIA labels on icon-only buttons
- Keyboard navigation support
- Color contrast following WCAG 2.1 AA