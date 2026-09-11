# Full Game Shell Page Overrides

> **PROJECT:** Shadow Requiem
> **Generated:** 2026-09-11 15:59:07
> **Page Type:** General

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- No overrides — use Master colors

### Component Overrides

- Avoid: Show loading spinner for 10s+
- Avoid: Force all chips into one clipped row or hide overflow values
- Avoid: Default keyboard for all inputs

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Tonal elevation (overlay colors instead of strong shadows), pill-shaped buttons and chips (borderRadius 999), emphasized easing Easing.bezier(0.2,0,0,1), state layers (pressed overlays 10–15% opacity), Reanimated-filled label float for inputs, HapticFeedback on FAB/toggles
- AI Interaction: Stream text response token by token
- Layout: Wrap the collection or use an operable +n disclosure for hidden overflow values
- Forms: Use inputmode attribute
