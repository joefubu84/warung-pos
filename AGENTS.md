
## PERFORMANCE BEST PRACTICES - NO BLINKING PAGES

For EVERY new page/feature built, follow these rules:

1. **COMPONENT OPTIMIZATION**
   - Use `React.memo` to prevent child re-renders when parent updates.

2. **STATE UPDATES (Only What Changed)**
   - Don't refetch all data on a single item update. Update only that item in state.

3. **DATA FETCHING (No Constant Refetches)**
   - Fetch data once on mount with an empty dependency array `[]`.

4. **REALTIME UPDATES (Don't Re-render All)**
   - Use targeted subscriptions (Supabase realtime/WebSockets).
   - Only update when data actually changes.

5. **CSS TRANSITIONS (Smooth, Not Snap)**
   - Add to every animating element: `transition: all 0.3s ease;`

6. **AVOID POLLING (Use Events Instead)**
   - No `setInterval` polling. Use realtime subscriptions.

7. **LAZY LOADING (Don't Load Everything)**
   - Paginate data, use virtual scrolling, load on demand.

8. **TESTING FOR BLINKING**
   - Open page in browser, perform an action, watch for ANY flicker.
   - If flicker appears -> MUST FIX before deployment.
   - Test 3+ times to confirm smooth.

CHECKLIST FOR EVERY NEW PAGE:
- [ ] No full-page re-render on data update
- [ ] Only changed items update (not entire list)
- [ ] CSS transitions applied (smooth animations)
- [ ] No unnecessary API calls
- [ ] Realtime subscriptions (not polling)
- [ ] React.memo used for list items
- [ ] No blinking when tested 3x
- [ ] Performance acceptable (< 100ms updates)

RULE: If a page blinks, it's not done. Must be smooth, responsive, professional.

## LOVABLE BADGE SUPPRESSION RULE
- **CRITICAL**: Always maintain and enforce global and shell CSS rules to completely hide the Lovable badge (the 'Made with Lovable' floating element) across ALL pages without breaking page layout.
- Ensure `a[href*="lovable.dev"]`, `a[href*="lovable.app"]`, `[id*="lovable"]`, `[class*="lovable-badge"]`, and related wrapper selectors are permanently hidden (`display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; position: absolute !important; top: -9999px !important; z-index: -9999 !important;`).

## MANDATORY SYNCHRONIZATION: GITHUB & SUPABASE
- **CRITICAL**: For EVERY update, bug fix, or feature addition:
  1. **GitHub**: Must commit and push immediately to the `main` branch on GitHub repository (`joefubu84/warung-pos`) after validating with `npm run build`.
  2. **Supabase**: Ensure all database schemas, table records, migrations, and Supabase client configs remain in 100% active synchronization with the live database (`gtmzzblomcvgmwzjalja.supabase.co`). Never hardcode mock items that disconnect from Supabase.

