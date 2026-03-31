<instructions>
## 🚨 MANDATORY: CHANGELOG TRACKING 🚨

You MUST maintain this file to track your work across messages. This is NON-NEGOTIABLE.

---

## INSTRUCTIONS

- **MAX 5 lines** per entry - be concise but informative
- **Include file paths** of key files modified or discovered
- **Note patterns/conventions** found in the codebase
- **Sort entries by date** in DESCENDING order (most recent first)
- If this file gets corrupted, messy, or unsorted -> re-create it. 
- CRITICAL: Updating this file at the END of EVERY response is MANDATORY.
- CRITICAL: Keep this file under 300 lines. You are allowed to summarize, change the format, delete entries, etc., in order to keep it under the limit.

</instructions>

<changelog>
## 2026-03-31
- Refined `src/pages/Matches.tsx` and `src/index.css` after visual QA against Figma node `205:271`
- Replaced the scaled title block with coordinate-anchored hero pieces and switched the empty state to placeholder shells
- Added frame-specific assets in `public/figma-assets/` for title triangles and underline to keep desktop alignment tighter to Figma

## 2026-03-23
- Rewrote `NavigationBarSection.jsx` to fix failed font-warning replacements
- Replaced `Base_Neue_Trial-Expanded`, `Base_Neue_Trial-ExpandedBold`, `Base_Neue_Trial-Regular` with `Base_Neue_Trial-Bold`
- All font-warning classes removed; `font-bold` corrected on LVL pill paragraph
</changelog>
