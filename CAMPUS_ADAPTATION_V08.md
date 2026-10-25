# Campus catalogue revision · v0.8

This revision follows the local campus feedback supplied on 24 October 2026. It keeps 50 buying choices and retains Chinese, English and Urdu.

| Feedback | Implemented change |
|---|---|
| Cheese is usually eaten in a sandwich or burger | Standalone cheddar replaced by a cheese sandwich. The new product has a new SKU, portion, illustration and provisional nutrient values; the old cheese values were not reused. |
| Biryani is a better canteen option than chicken curry | Added a plate of chicken biryani at the canteen counter. No chicken curry is offered in this catalogue. |
| Drinks should be separate from food shelves | A separate blue drinks-and-dairy fridge contains cold drinks, energy drinks, milk, lassi and dahi. Hot tea stays at the canteen counter. |
| “Mango chips” is unsuitable | The old entry was actually named “Fresh mango pieces,” but that confusing candidate was removed. Its place in the 50-item catalogue is used for biryani. Banana chips were not added. |
| Toffees are purchased singly | One buying unit is one wrapped toffee. Students can use +/− to buy one or two pieces. Basket weight, price, energy and export quantity scale by pieces. |
| Familiar names help | “Kishmish (raisins)” is displayed in English, “کشمش” in Urdu. Search accepts kishmish, raisins, kismis, کشمش and 葡萄干. Existing dahi, lassi, chana and bun kebab names remain. |

The store has 26 foods on the shelf, 11 in the drinks-and-dairy fridge and 13 at the canteen counter. Zone buttons move the viewpoint without hiding or relocating other products. Horizontal dragging, swiping and close view remain available.

## Buying units and provisional prices

All unchanged SKUs keep their existing example prices. The cheese-sandwich and biryani candidates retain the prices of the catalogue slots they replace (PKR150 and PKR160 respectively); neither price is a field measurement.

The toffee example changes from 25g/PKR50 per packet to a provisional 5g/PKR10 per piece, preserving the old synthetic price per gram. Two pieces mean 10g, PKR20 and 41kcal in the example. With the candidate NOVA4 +25% condition, two pieces cost PKR25. The 5g weight and piece price need verification from the actual product and shop.

Photos should show the front, ingredients/nutrition, net weight or piece count, and selling price. Prices, portion sizes, images and nutrient values can then be updated together. New mixed meals have unknown NOVA pending recipe/ingredient review; their old replacement foods' NOVA values were not carried over.

## Factorial design

P/O/L still define eight conditions. Each condition has the same 50 foods, buying units, fixture dimensions and two illustrative facings per SKU. Price and label changes do not change positions. The position contrast swaps target/comparator heights **within each fixed zone**, rather than moving refrigerated products onto the dry shelf.

This makes fixture membership part of the frozen scenario. The placement estimand is now the effect of changing heights within the shelf, fridge and counter. Label rules and the distinction between the NOVA4-only price target and the combined placement target remain unchanged.

## Versioning and deployment

- Catalogue: `synthetic-pakistan-catalog-v4`; layout: `physical-rack-v3`.
- New closed test study: `almab-factorial-test-v2`, protocol `candidate-protocol-v2`.
- Supabase: new projects run migrations001–007; existing projects that already completed006 run only007.
- CloudBase: `cloudbase/01_install.sql` is regenerated for a fresh environment. If v0.7 was already installed, use the additive `cloudbase/02_campus_catalog_upgrade.sql`; do not reinstall01 over existing tables.
- Historical v2/v3 catalogues, existing participant profiles, allocations and completed receipts are retained. Existing v1-study participants need the archived v0.7 frontend; do not silently move them into this revised study. Existing profiles from an old catalogue are deliberately rejected by the new frontend.
- Preview browser storage uses a new key, preserving earlier local experiences under their old key. Asset URLs use content hashes to avoid mixing a new catalogue with cached old layout code.
- Both enrolment and tasks remain closed by default. No live database migration or GitHub publication was performed in this revision.

Technical validation is recorded in [QA_V08.md](QA_V08.md).
