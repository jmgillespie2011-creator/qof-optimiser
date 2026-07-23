-- Seed: QOF indicator library (2025/26 + recent years), sample org hierarchy,
-- sample achievement/prescribing, Accurx templates and QI suggestions.
-- Points/thresholds for 2025/26 reflect published NHS England figures for the
-- headline CVD/lipid + diabetes indicators; extend via the ingestion script.

-- ---------- indicators ----------
insert into qof_indicator (indicator_code, domain, domain_label, title, description) values
 ('CHOL003','cvd','Cardiovascular','Statin / lipid-lowering therapy','% of CHD/PAD/Stroke-TIA/CKD register patients on a statin or documented alternative/exception'),
 ('CHOL004','cvd','Cardiovascular','Cholesterol to target','% with LDL <= 2.0 mmol/L or non-HDL <= 2.6 mmol/L in preceding 12 months'),
 ('HYP008','cvd','Cardiovascular','Hypertension: BP to target (<=79)','% of hypertensive patients aged <=79 with BP <= 140/90'),
 ('AF006','cvd','Cardiovascular','AF: anticoagulation','% of AF patients with CHA2DS2-VASc >=2 treated with anticoagulation'),
 ('DM036','diabetes','Diabetes','HbA1c <= 58 mmol/mol','% of non-frail diabetes patients with HbA1c <= 58 mmol/mol'),
 ('DM034','diabetes','Diabetes','HbA1c <= 75 mmol/mol','% of diabetes patients with HbA1c <= 75 mmol/mol'),
 ('AST012','respiratory','Respiratory','Asthma review','% of asthma patients with a review in the preceding 12 months'),
 ('COPD015','respiratory','Respiratory','COPD review','% of COPD patients with a review including MRC dyspnoea score'),
 ('MH021','mental_health','Mental Health','SMI physical health check','% of severe-mental-illness patients with a full physical health check'),
 ('SMOK004','public_health','Public Health','Smoking cessation support','% of smokers offered support / referral (Very Brief Advice)')
on conflict do nothing;

insert into qof_indicator_year (indicator_code, year, status, points, lower_threshold, upper_threshold, pound_per_point) values
 -- 2025/26 current
 ('CHOL003','2025/26','current',38,70,95,225.49),
 ('CHOL004','2025/26','current',44,20,50,225.49),
 ('HYP008','2025/26','current',31,40,80,225.49),
 ('AF006','2025/26','current',12,40,90,225.49),
 ('DM036','2025/26','current',27,38,90,225.49),
 ('DM034','2025/26','current',4,50,90,225.49),
 ('AST012','2025/26','current',15,45,80,225.49),
 ('COPD015','2025/26','current',9,50,90,225.49),
 ('MH021','2025/26','current',16,40,90,225.49),
 ('SMOK004','2025/26','current',25,40,90,225.49),
 -- prior years (for 3-yr trend); note lower points pre-reweighting
 ('CHOL003','2024/25','current',14,70,95,213.10),
 ('CHOL004','2024/25','current',16,20,40,213.10),
 ('CHOL003','2023/24','current',14,70,95,207.56),
 ('CHOL004','2023/24','current',16,20,40,207.56),
 ('DM036','2024/25','current',21,38,90,213.10),
 ('DM036','2023/24','current',21,38,90,207.56)
on conflict do nothing;

-- ---------- org hierarchy (sample; replaced by ODS ingestion) ----------
insert into organisation (ods_code, org_level, name, list_size) values
 ('ENG','national','England', 62000000),
 ('QE1','icb','NHS Sample ICB', 1200000),
 ('U12345','pcn','Sample PCN', 48000)
on conflict do nothing;
insert into organisation (ods_code, org_level, name, postcode, parent_pcn, parent_icb, list_size) values
 ('A81001','practice','Sample Medical Practice','TS1 2AB','U12345','QE1', 9200),
 ('A81002','practice','Riverside Surgery','TS1 3CD','U12345','QE1', 7100)
on conflict do nothing;

-- ---------- sample achievement (2025/26) ----------
insert into qof_achievement (ods_code, org_level, indicator_code, year, achievement_pct, register_size, points_available) values
 ('A81001','practice','CHOL004','2025/26',34, 1180, 44),
 ('U12345','pcn','CHOL004','2025/26',41, 6100, 44),
 ('QE1','icb','CHOL004','2025/26',45, 150000, 44),
 ('ENG','national','CHOL004','2025/26',47, 6200000, 44),
 ('A81001','practice','CHOL003','2025/26',82, 1180, 38),
 ('U12345','pcn','CHOL003','2025/26',88, 6100, 38),
 ('ENG','national','CHOL003','2025/26',90, 6200000, 38),
 ('A81001','practice','DM036','2025/26',56, 640, 27),
 ('ENG','national','DM036','2025/26',63, 3500000, 27)
on conflict do nothing;
-- trend points for CHOL004 at the practice
insert into qof_achievement (ods_code, org_level, indicator_code, year, achievement_pct, points_available) values
 ('A81001','practice','CHOL004','2024/25',29,16),
 ('A81001','practice','CHOL004','2023/24',25,16)
on conflict do nothing;

-- ---------- prescribing sample (ezetimibe low use drives the CHOL004 suggestion) ----------
insert into prescribing_measure (ods_code, org_level, measure_id, month, rate, percentile) values
 ('A81001','practice','ezetimibe','2026-05-01', 3.1, 12),
 ('U12345','pcn','ezetimibe','2026-05-01', 6.8, 55),
 ('ENG','national','ezetimibe','2026-05-01', 7.9, 50)
on conflict do nothing;

-- ---------- Accurx templates ----------
insert into accurx_template (id, kind, title, body_markdown, clinical_notes) values
 ('tmpl-ezetimibe','florey_questionnaire','Ezetimibe offer for statin patients not at target',
  E'Our records show you take a statin to protect your heart. Your latest cholesterol is a little higher than we would like.\n\nThere is an additional once-daily tablet called **ezetimibe** that can lower it further. It is well tolerated and taken alongside your statin.\n\n1. Would you like us to arrange ezetimibe? (Yes / No / I would like to discuss first)\n2. Do you have any known allergy to ezetimibe? (Yes / No)\n3. Preferred contact if you have questions? (free text)',
  'Send to: patients on CHD/PAD/Stroke-TIA/CKD register, on a statin, most recent non-HDL > 2.6 / LDL > 2.0, not already on ezetimibe. On "Yes", issue ezetimibe 10mg OD, code lipid-lowering therapy, recheck lipids in 8-12 weeks (drives CHOL004).'),
 ('tmpl-vaccination','batch_sms','Vaccination invitation',
  E'Hello, our records show you are due your **{{vaccine}}** vaccination. Please book here: {{booking_link}}. If you have already had it elsewhere, reply DONE and we will update your record.',
  'Select eligible cohort in Accurx. Record vaccination or decline code on response. Update QOF/public-health registers accordingly.'),
 ('tmpl-smoking-vba','vba_script','Smoking cessation - Very Brief Advice (VBA)',
  E'**ASK:** Do you smoke? Record status.\n**ADVISE:** The best thing you can do for your health is stop smoking; the most effective way is a combination of support + medication.\n**ACT:** Would you like a referral to the local stop-smoking service? (Yes / No)\n\nIf Yes, we will refer you and can arrange medication to help.',
  'Deliver VBA in <30 seconds. On Yes, refer to local service and code referral. Counts toward smoking cessation support indicator.')
on conflict do nothing;

-- ---------- QI suggestions ----------
insert into qi_suggestion (id, indicator_code, title, rationale, evidence_measure_id, trigger_logic, accurx_template_id, priority_weight) values
 ('offer-ezetimibe','CHOL004','Offer ezetimibe to statin patients not yet at cholesterol target',
  'Adding ezetimibe for patients already on a statin but above target is a fast route to more patients hitting LDL <= 2.0 / non-HDL <= 2.6. Especially high-yield where ezetimibe prescribing is below peers.',
  'ezetimibe', '{"achievement_below":"upper_threshold","measure_percentile_below":25}', 'tmpl-ezetimibe', 100),
 ('recall-no-cholesterol','CHOL004','Recall CVD patients with no cholesterol result in 12 months',
  'Patients with no recent lipid result cannot count toward CHOL004. A targeted recall increases the measured denominator and finds untreated patients.',
  null, '{"achievement_below":"upper_threshold"}', 'tmpl-vaccination', 60),
 ('review-statin-declined','CHOL003','Review statin-declined / exception coding',
  'Miscoded declines or missing exception codes reduce apparent CHOL003 achievement. A coding review often recovers points with no new clinical work.',
  null, '{"achievement_below":"upper_threshold"}', null, 40),
 ('dm-hba1c-recall','DM036','Recall non-frail diabetes patients with HbA1c > 58',
  'Structured recall + medication optimisation for non-frail patients above 58 mmol/mol moves the highest-weighted diabetes indicator.',
  null, '{"achievement_below":"upper_threshold"}', 'tmpl-vaccination', 80),
 ('smoking-vba','SMOK004','Deliver Very Brief Advice to recorded smokers',
  'Systematic VBA + referral for coded smokers captures the public-health smoking indicator and supports CVD prevention.',
  null, '{"achievement_below":"upper_threshold"}', 'tmpl-smoking-vba', 70)
on conflict do nothing;
