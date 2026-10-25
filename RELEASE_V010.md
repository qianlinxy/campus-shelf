# v0.10: combined chilled and frozen cabinet

The75-item catalogue, portions, prices and nutrient examples are unchanged. The store now has three fixtures:39 shelf foods, one19-item cold cabinet, and17 snack-counter foods. The cold cabinet contains16 chilled products on levels1–3 and three frozen products on level4. Separate compartment headings, glazed panels, handles and a horizontal divider identify the two storage areas in Chinese, English and Urdu.

## Placement constraints

Frozen products always occupy the same bottom-tier slots, including in category/popularity previews and all eight factorial conditions. They are outside the position-factor contrast. Their prices and labels still follow the assigned condition.

Within the upper three chilled tiers, the intervention prioritizes comparator candidates at eye level (L2) and target products at the lowest chilled level (L3). Control reverses these priorities. Where the preferred tier fills, the remaining products share the upper tier (L1); further overflow uses remaining chilled capacity. This capacity rule is identical in both arms. It does not imply that every target product can fit on a single lower tier. The frozen tier is never used as overflow. Shelf and snack-counter placement retain their prior four-tier behavior.

The two-level chilled placement contrast and fixed freezer must be included in the formal intervention specification before recruitment. Prices, nutritional traffic lights and NOVA flags remain provisional; this revision is a layout change, not new evidence or a completed Delphi consensus.

## Versions and upgrade

Catalogue remains synthetic-pakistan-catalog-v5. Layout is physical-rack-v5; new closed technical study almab-factorial-test-v4, protocol candidate-protocol-v4. Earlier studies, participants and completed records remain unchanged. The new frontend rejects tasks with an earlier layout version; use the archived frontend for those cohorts. The legacy fixed-pilot flow is also retained for archived frontends; this layout should be used only with the new factorial study ID.

Supabase already at008: run009_combined_cold_cabinet.sql once. CloudBase already at v0.9: run04_combined_cold_cabinet_upgrade.sql once. Earlier installations must apply preceding migrations in order. Only an empty environment should use the regenerated01_install.sql. No live SQL or enrolment changes are part of the static website publication.

## Verification

121 automated tests pass, including every factorial condition, the frozen-slot invariant across all layout modes, confined chilled placement, unchanged75-item inventory, monetary totals, server allocation, saves, permissions and exports for both backend adapters. Browser visual verification is recorded separately with the publication result.
