-- ICB map wiring: add ONS code column, seed verified real ICBs (April 2023) so the
-- choropleth colours, and point the demo practice at a real ICB. Safe to re-run.
-- The choropleth matches on ICB23CDH (3-char ODS code) = organisation.ods_code,
-- which is exactly what the QOF roll-up produces, so real ingestion colours all 42.

alter table organisation add column if not exists ons_code text;  -- ICB23CD e.g. E54000008

-- verified April-2023 ICBs (ICB23CDH / ICB23CD / name)
insert into organisation (ods_code, org_level, name, ons_code, list_size) values
 ('QYG','icb','NHS Cheshire and Merseyside ICB','E54000008', 2700000),
 ('QNC','icb','NHS Staffordshire and Stoke-on-Trent ICB','E54000010', 1150000),
 ('QOC','icb','NHS Shropshire, Telford and Wrekin ICB','E54000011', 500000),
 ('QJM','icb','NHS Lincolnshire ICB','E54000013', 780000)
on conflict (ods_code) do update set ons_code=excluded.ons_code, name=excluded.name, org_level='icb';

-- keep the generic sample ICB but give it an ONS code too (Cheshire & Merseyside neighbour placeholder is not set)
update organisation set ons_code = ons_code where org_level='icb';

-- point the demo practice + PCN at a real ICB so "compare vs ICB" and the map align
update organisation set parent_icb='QYG' where ods_code in ('A81001','A81002','U12345');

-- generate sample achievement for these ICBs across every 2025/26 indicator
insert into qof_achievement (ods_code, org_level, indicator_code, year, achievement_pct, points_available)
select o.code, 'icb', iy.indicator_code, '2025/26',
       greatest(20, least(96, 55 + (abs(hashtext(o.code||iy.indicator_code)) % 40) - 12)),
       iy.points
from (values ('QYG'),('QNC'),('QOC'),('QJM')) as o(code)
cross join qof_indicator_year iy
where iy.year='2025/26'
on conflict (ods_code, indicator_code, year) do nothing;

-- second practice achievement (so PCN drill-down shows a full breakdown)
insert into qof_achievement (ods_code, org_level, indicator_code, year, achievement_pct, points_available)
select 'A81002','practice', iy.indicator_code, '2025/26',
       greatest(15, least(97, 48 + (abs(hashtext('A81002'||iy.indicator_code)) % 44) - 12)),
       iy.points
from qof_indicator_year iy where iy.year='2025/26'
on conflict (ods_code, indicator_code, year) do nothing;
