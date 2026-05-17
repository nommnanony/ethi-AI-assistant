# Natively AI Assistant - Premium Cyberpunk UI

## Project Overview
- **Project name**: Natively AI Desktop Assistant
- **Type**: AI Coding Assistant Desktop UI (Electron-based)
- **Core functionality**: Futuristic AI coding interface inspired by Cursor AI, Claude Code with cyberpunk aesthetics
- **Target users**: Developers seeking premium AI-powered coding assistance

## UI/UX Specification

### Color Palette
- **Background Primary**: `#0d1117` (Deep space black)
- **Background Secondary**: `#161b22` (Card surfaces)
- **Background Tertiary**: `#21262d` (Elevated surfaces)
- **Border Subtle**: `#30363d`
- **Border Accent**: `#3d444d`
- **Text Primary**: `#f0f6fc`
- **Text Secondary**: `#8b949e`
- **Text Muted**: `#6e7681`
- **Accent Cyan**: `#58a6ff`
- **Accent Purple**: `#a371f7`
- **Accent Green**: `#3fb950`
- **Accent Orange**: `#d29922`
- **Accent Pink**: `#db61a2`
- **Neon Cyan**: `#00d9ff`
- **Neon Purple**: `#bd93f9`
- **Neon Pink**: `#ff79c6`

### Typography
- **Primary Font**: "Inter", system-ui, sans-serif
- **Monospace Font**: "JetBrains Mono", "Fira Code", monospace
- **Heading Sizes**: h1: 24px, h2: 20px, h3: 16px, h4: 14px
- **Body Size**: 14px base, 13px small
- **Line Height**: 1.5 for body, 1.3 for headings

### Spacing System
- **Base unit**: 4px
- **Scale**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- **Border Radius**: sm: 4px, md: 6px, lg: 8px, xl: 12px, 2xl: 16px

### Visual Effects
- **Glassmorphism**: backdrop-blur: 20px, bg opacity 0.7-0.8
- **Glow Effects**: box-shadow with cyan/purple rgba
- **Gradients**: Linear gradients for accents and borders
- **Animations**: 200-300ms ease-out transitions, staggered reveals

## Layout Structure

### 1. Left Sidebar (56px collapsed, 240px expanded)
- **Width**: 56px collapsed, 240px expanded
- **Background**: `#0d1117` with subtle border
- **Sections**:
  - Workspace Explorer (file tree with icons)
  - AI Agents List (persona icons)
  - Chat History (conversation list)
  - Collapse toggle at bottom
- **Icons**: Lucide icons, cyan accent on hover
- **Animations**: Smooth expand/collapse (300ms)

### 2. Top Bar (48px height)
- **Background**: Glassmorphism (`#161b22/80` with blur)
- **Border**: Bottom border `#30363d`
- **Elements**:
  - Model selector dropdown (left) - Shows current model with icon
  - Active provider indicator - Badge showing "Ollama", "OpenAI", etc.
  - API/Local toggle switch (pill style)
  - Settings icon (gear)
  - Profile avatar with dropdown
- **Spacing**: 12px horizontal padding

### 3. Main Chat Area (flexible width)
- **Background**: `#0d1117`
- **Message Bubbles**:
  - User: Right-aligned, purple gradient background
  - AI: Left-aligned, `#161b22` background with border
- **Code Blocks**:
  - Dark background `#21262d`
  - Syntax highlighting colors
  - Copy button on hover
  - Language badge top-right
- **Streaming Animation**: Blinking cursor, fade-in text
- **Tool Cards**: Inline cards showing tool execution
- **MCP Status Badges**: Small badges showing connected services

### 4. Bottom Input Area (64px height)
- **Background**: Glassmorphism with top border
- **Elements**:
  - Rounded textarea with placeholder
  - Attach file button (left)
  - Voice input button (left)
  - Agent selector dropdown (center-right)
  - Send button (right) with glow animation on hover
  - Command shortcuts row: `/`, `@`, `#` buttons
- **Placeholder**: "Ask anything or type / for commands..."

### 5. Right Panel (320px width, collapsible)
- **Background**: `#0d1117` with left border
- **Tabs**:
  - Terminal (tabbed interface)
  - File Preview
  - AI Reasoning (thinking process)
  - Token Usage (mini graphs)
  - Real-time Logs
- **Terminal**: Monospace font, green output, scrollable
- **Resize handle**: Draggable divider

## Component States

### Buttons
- Default: `#21262d` background
- Hover: `#30363d` background, slight glow
- Active: `#388bfd` accent
- Disabled: 50% opacity

### Inputs
- Default: `#0d1117` bg, `#30363d` border
- Focus: `#58a6ff` border, subtle glow
- Error: `#f85149` border

### List Items
- Default: Transparent
- Hover: `#161b22` bg
- Selected: `#21262d` bg with left accent border

## Animations

### Page Load
- Staggered fade-in for sidebar items (50ms delay each)
- Top bar slides down (200ms)
- Main content fades in (300ms)

### Interactions
- Button hover: Scale 1.02, 150ms
- Icon hover: Color change to cyan, 150ms
- Panel expand/collapse: 300ms ease-out
- Message appear: Slide up + fade, 200ms

### Micro-interactions
- Typing indicator: 3 dots pulsing
- Loading: Spinning ring
- Success: Checkmark with scale pop

## Acceptance Criteria

1. All 5 layout sections render correctly
2. Dark theme with cyberpunk accents throughout
3. Smooth animations on all interactions
4. Glassmorphism effects visible on top bar and input
5. Code blocks display with syntax highlighting
6. Responsive panel resizing works
7. Icons display correctly (Lucide)
8. No console errors on load
9. Clean unused files removed7