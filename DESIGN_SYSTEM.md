# Design System

## Typography

### Font Family
- **Primary**: Inter (loaded from Google Fonts)
- **Weights**: 300, 400, 500, 600, 700

## Color Palette

### Primary Theme Colors
- **Teal (Accent)**: `#66A9A2`
  - Use: `bg-teal`, `text-teal`, `border-teal`
  - Or: `bg-accent`, `text-accent`

- **Teal Strong**: `#18716A`
  - Use: `bg-teal-strong`, `text-teal-strong`
  - Or: `bg-accent-strong`, `text-accent-strong`

- **Background Secondary**: `#E8F4F2`
  - Use: `bg-secondary` (adapts to light/dark mode)

### Supporting Colors
- **Yellow/Highlight**: `#FFD26A`
  - Use: `bg-yellow`, `text-yellow`

- **Red/Danger**: `#EF4444`
  - Use: `bg-danger`, `text-danger`
  - Or: `bg-destructive`, `text-destructive`

- **Blue/Info**: `#2563EB`
  - Use: `bg-info`, `text-info`

### Adaptive Colors
The following colors automatically adapt to light/dark mode:
- `bg-background` / `text-foreground`
- `bg-card` / `text-card-foreground`
- `bg-primary` / `text-primary-foreground`
- `bg-secondary` / `text-secondary-foreground`
- `bg-muted` / `text-muted-foreground`
- `bg-accent` / `text-accent-foreground`
- `bg-destructive` / `text-destructive-foreground`

## Usage Examples

```tsx
// Primary teal button
<button className="bg-teal text-white">Click me</button>

// Strong teal for emphasis
<button className="bg-teal-strong text-white">Important</button>

// Using semantic colors (adapts to dark mode)
<div className="bg-background text-foreground">
  Content
</div>

// Highlight with yellow
<span className="bg-yellow text-black">Highlight</span>

// Error state
<div className="bg-danger text-white">Error message</div>
```

