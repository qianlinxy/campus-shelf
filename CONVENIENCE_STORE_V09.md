# Campus convenience store v0.9

The revised scenario excludes complete lunches. From v0.8, remove biryani, standalone chapati and plain paratha; retain 47 existing snack, fruit, dairy, drink and takeaway choices. Add 28 candidates, for 75 unique buying choices.

## Added candidates

- Shelf (13): TUC salted crackers, Click/Zeera biscuits, Peanut Pik, Marie, potato sticks, Kurkure, Cheetos, roasted corn nuts, chewing gum, Kaju/cashews, Masala chana, Namkeen daal, cake rusk.
- Snack counter (7): muffin, doughnut, brownie, egg sandwich, Dahi bhallay, Samosa chaat, sweet Doodh patti milk tea.
- Drinks fridge (5): chilled coffee milk drink, sweet lassi, salted lassi, takeaway banana milkshake, takeaway mango milkshake.
- Freezer (3): ice cream cup, ice cream cone, Kulfi.

Target-campus stock and purchase frequency still require photographs and local review. Names are candidates, not a claim that every school stocks every item. Milkshakes are represented as ready-to-go cold cups. Photographs should determine actual packaging, recipes, storage and availability. Prepared dairy/egg snacks should also receive a local holding/storage review before the scenario is frozen.

Total display membership: shelf39, fridge16, snack counter17, freezer3. Chinese, English and Urdu are available throughout. The category previously called Meals now reads Ready-to-eat snacks. Horizontal pan, close view and local-name search remain available.

## Research integrity

All prices, weights, nutrient values, NOVA flags, artwork and popularity ranks remain synthetic demonstration data. Unchanged SKUs retain their old prices. New mixed snacks/recipes remain unknown NOVA; packaged candidate NOVA flags also require ingredient review. Do not interpret this revision as a Delphi result or a field-confirmed catalogue.

All eight P/O/L arms retain identical inventory, units, fixture widths and facings. Position changes swap heights within a fixed area. Price changes apply only to provisionally classified NOVA4 products. Cold drinks never move to the dry shelf, and ice cream never moves out of its freezer. Three freezer products do not yet provide a meaningful alternative-food contrast within that area; pilot review must decide the final frozen inventory and the estimand before formal recruitment.

Catalogue v5, layout physical-rack-v4, closed technical study almab-factorial-test-v3. Previous catalogues, frozen studies, participant profiles and receipts are retained. Old cohorts require their archived frontend, not automatic reassignment.

## Backend upgrade

- Fresh Supabase: migrations001–008 once, in order. Already at007: only008_convenience_store_catalog.sql.
- Fresh CloudBase: reviewed cloudbase/01_install.sql, never over an existing schema.
- Existing CloudBase v0.7: cloudbase/02_campus_catalog_upgrade.sql, then03_convenience_store_upgrade.sql. Already v0.8: only03.
- The new study and enrolment remain closed. Publishing the static page does not apply SQL or connect authentication.
- Server basket validation now accepts up to the frozen catalogue size; interaction event batches retain their separate50-event limit.

## Verification

Automated tests cover historical catalogue preservation, all eight75-item layouts, fixed chilled/frozen membership, unchanged prices, per-piece toffee arithmetic, frozen-food totals, database allocation, save/restore, permissions and75-item exports for both backend adapters. Local browser checks cover75 cards, four areas, three languages, search, ice cream purchases, label hiding and price changes without relocation.

Full local suite:119 passed,0 failed. On this memory-constrained run: node --liftoff-only --test --test-concurrency=1 tests/*.test.cjs. Earlier default runs exhausted system memory before completing; no test was skipped.
