# Recipe View & Edit IA Alignment

## Context

The view and edit pages for recipes currently have inconsistent section ordering. A user reading a recipe sees **ingredients → instructions**, but when they open the same recipe to edit it, the form presents **instructions → ingredients** — the opposite order. This creates cognitive friction when switching between the two modes.

## Current Layout Comparison

| # | View (RecipeDetail)        | Edit (RecipeFormPage)              |
|---|----------------------------|------------------------------------|
| 1 | Cover photo                | Name field                         |
| 2 | Title + type/day badges    | Type + Day fields                  |
| 3 | Ingredients                | URL field                          |
| 4 | Instructions               | Cover photo upload                 |
| 5 | —                          | **Instructions** ← wrong position  |
| 6 | —                          | **Ingredients** ← wrong position   |

## Target Layout (both pages)

1. Recipe metadata (name / type / day / URL)
2. Cover photo
3. Ingredients
4. Instructions

The view page already follows this order. Only the edit page needs to change.

## Change Required

**File:** `frontend/src/components/RecipeFormPage.tsx`

In the `formBody` JSX (around line 640), swap the order of the `<Textarea>` (instructions) and `{ingredientSection}` so that `ingredientSection` comes first and the instructions textarea comes last.

### Before
```tsx
<Textarea … />          {/* instructions */}
{ingredientSection}
```

### After
```tsx
{ingredientSection}
<Textarea … />          {/* instructions */}
```

No other changes needed — the `ingredientSection` variable and the textarea are already self-contained, so swapping them in the JSX is the complete fix.

## Verification

1. Open `/recipes/new` — confirm order is: Name → Type/Day → URL → Cover → Ingredients → Instructions
2. Open an existing recipe's edit page — confirm same order
3. Open the corresponding view page — confirm Ingredients still precedes Instructions
4. Save the form — confirm no data is lost or mis-mapped (ingredients and instructions are stored independently via separate API calls, so the visual order change has no backend impact)
