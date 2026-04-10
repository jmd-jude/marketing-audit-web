# Color Palette & Brand Style

**This is the single source of truth for all colors and brand-specific styles.**

---

## Canvas

| Property | Value |
|----------|-------|
| Canvas background | `#F0EDE6` |

---

## Shape Colors (Semantic)

Colors encode meaning, not decoration. Each semantic purpose has a fill/stroke pair.
Text on all light fills should be `#1A1A1A`.

| Semantic Purpose | Fill | Stroke |
|------------------|------|--------|
| Primary/Neutral | `#F5D5C8` | `#D4532A` |
| Secondary | `#FAE8E0` | `#B8431C` |
| Tertiary | `#FDF3EF` | `#E8754F` |
| Start/Trigger | `#FEF3C7` | `#B45309` |
| End/Success | `#D6EDDA` | `#2D6A4F` |
| Warning/Reset | `#FEE2E2` | `#DC2626` |
| Decision | `#FDE68A` | `#92400E` |
| AI/LLM | `#EDE9FE` | `#6D28D9` |
| Inactive/Disabled | `#E5E0D6` | `#BBB` (use dashed stroke) |
| Error | `#FECACA` | `#B91C1C` |

**Rule**: Fills are light enough for `#1A1A1A` text to sit on them at any size. Strokes are dark enough to define shape boundaries clearly.

---

## Text Colors (Hierarchy)

| Level | Color | Use For |
|-------|-------|---------|
| Title | `#1A1A1A` | Section headings, major labels |
| Subtitle | `#D4532A` | Subheadings, secondary labels, callouts |
| Body/Detail | `#555555` | Descriptions, annotations, metadata |
| On light fills | `#1A1A1A` | Text inside light-colored shapes |
| On dark fills | `#F0EDE6` | Text inside dark-colored shapes (navy/charcoal) |

---

## Evidence Artifact Colors

| Artifact | Background | Text Color |
|----------|-----------|------------|
| Code snippet | `#1C2333` | Syntax-colored (language-appropriate) |
| JSON/data example | `#1C2333` | `#E8754F` |

---

## Default Stroke & Line Colors

| Element | Color |
|---------|-------|
| Arrows | `#D4532A` for primary flow; `#555555` for structural/secondary |
| Structural lines (dividers, trees, timelines) | `#555555` |
| Marker dots (fill + stroke) | `#D4532A` fill, `#B8431C` stroke |

---

## Typography Notes

When the renderer supports font selection:
- **Labels/headings**: DM Sans (or system sans-serif)
- **Monospace annotations**: JetBrains Mono
- **Avoid** italic or thin weights — they lose legibility at diagram scale