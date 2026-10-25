-- A new closed study for the combined cabinet; retain every prior frozen study.
begin;
insert into private.studies(id,protocol_version,catalog_version,layout_version,base_config,catalog_snapshot)
select 'almab-factorial-test-v4','candidate-protocol-v4','synthetic-pakistan-catalog-v5','physical-rack-v5',
'{"schemaVersion":2,"budget":600,"markupPercent":25,"placementRule":"upf-or-high","controlLayout":"targets-eye"}',jsonb_agg(product order by (product->>'catalogOrder')::integer)
from private.catalog where version='synthetic-pakistan-catalog-v5';
notify pgrst, 'reload schema';
commit;
