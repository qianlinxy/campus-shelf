# v0.8 campus adaptation verification

Local verification on 24 October 2026; all foods, weights, prices, nutrient values, NOVA classifications and illustrations remain provisional synthetic examples.

Automated checks cover the unchanged legacy catalogue and revised 50-item catalogue, independent P/O/L changes, fixed fixture membership, per-piece toffee arithmetic, both Supabase and CloudBase SQL adapters, server-side receipt units, administrator export schema and preserved historical catalogue values. The full suite passes 113 tests.

Browser checks on the local page:

- Three fixtures render once, with 26 shelf / 11 fridge / 13 counter products, total50.
- Cold drinks and energy drink render in the separate fridge. Biryani and a cheese sandwich render at the counter; standalone cheese and the confusing mango entry are absent.
- English search for “kishmish” returns only “Kishmish (raisins).” Alias search preserves the original positions of all foods.
- Two clicks on the single-toffee item show quantity2, “1 pc · 5g,” and PKR20. Detail view shows one piece, 5g and 20.5kcal per piece; nutrients remain per100g.
- Switching to labels off and +25% preserves all50 fixture/tier/column assignments, removes nutrient lights, and changes the single-toffee price to PKR12.50.
- Chinese, English and Urdu navigation labels work; Urdu is RTL. At390 CSS px, there is no whole-page horizontal overflow; only the store window pans.
- Store-area buttons, horizontal navigation and camera motion remain usable. The final browser console contains no JS errors.
- [Screenshot: separate fridge and counter](qa-v08-fixtures.png). Viewport overrides were reset after mobile testing.

No real participant data, live CloudBase/Supabase installation, email/SMS delivery or GitHub publication was used for these checks. The source and website ZIPs are ready for upload after the matching database version is installed. Photographs and local review are still required before treating the catalogue as field-verified research material.
