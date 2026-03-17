## 2024-03-17 - O(1) Lookups for Vinted Constants
**Learning:** Found that `apps/control-center/src/lib` contains several files (brands.ts, colors.ts, sizes.ts, categories.ts, regions.ts) that export O(N) lookup functions for constants (like `BRANDS.find(b => b.id === id)`). These functions are heavily used in the Next.js app, especially in formatting and component rendering.
**Action:** Replaced O(N) array scans with O(1) `Object.create(null)` map lookups to significantly speed up frontend item/monitor rendering.
