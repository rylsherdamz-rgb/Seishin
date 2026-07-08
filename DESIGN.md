# Seishin — Design System

## Color Palette
```
#000000  — Primary text, icons, borders
#1a1a1a  — Secondary text, muted elements
#333333  — Tertiary text, disabled
#666666  — Placeholder text, subtle borders
#999999  — Very subtle text, hints
#cccccc  — Dividers, disabled backgrounds
#e5e5e5  — Card backgrounds, secondary surfaces
#ffffff  — Primary background

Destructive only: #ff3b30
```

## Typography
```
Body:      16px, #000, system font
Caption:   14px, #666, system font
Heading:   20px, #000, semibold
Small:     12px, #999, system font
Mono:      System monospace (code blocks)
```

## Spacing Grid (4px base)
`4, 8, 12, 16, 20, 24, 32, 48, 64`

## Component Library

### Button
```
Primary:   bg=#000, text=#fff, h=48, px=24
Secondary: bg=none, border=#000, text=#000, h=48, px=24
Ghost:     bg=none, text=#666, px=0
```

### Card
`bg=#e5e5e5, p=16, border-radius=8`

### Input
`border-bottom=1px #ccc, text=#000, h=44`

### Tab Bar
```
Active:    icon/text = #000 + underline indicator
Inactive:  icon/text = #999
```

### Modal / ActionSheet
`bg=#fff, border-radius=8, rows h=44, divider=#e5e5e5`

## Navigation
```
(tabs)/
  index     → Calendar (month → week → day)
  inbox     → Unified Inbox (notifs + emails + chats)
    chat    → Chat thread (push)
  scan      → Camera/OCR
    result  → OCR review (push)
  agent     → AI Chat + skills + models
  settings  → Config + storage management
```

## Zustand Stores
```typescript
useCalendarStore: events, selectedDate, add/update/delete
useInboxStore: items (notifs+emails+chats), filter, markRead, delete
useChatStore: conversations, sendMessage, deleteConversation
useAgentStore: messages, tools, installedSkills, provider
useSettingsStore: emailConfig, notifFilter, apiKeys, cleanupPolicies
```
