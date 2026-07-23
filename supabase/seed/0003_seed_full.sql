-- FULL 2025/26 QOF indicator library (all domains) + generated sample benchmarks.
-- Reweighted CVD/lipid/diabetes/asthma indicators use EXACT published 2025/26
-- points & thresholds. Continuing indicators use standard published points as a
-- provisional value; the ingestion pipeline overwrites all figures with the
-- authoritative NHS England dataset. Safe to re-run.

-- ---------------- indicators (metadata) ----------------
insert into qof_indicator (indicator_code, domain, domain_label, title, description) values
 ('CHD005','cvd','Cardiovascular','CHD: influenza immunisation','CHD patients who have had an influenza immunisation'),
 ('CHD015','cvd','Cardiovascular','CHD: blood pressure control','CHD patients with BP <= 140/90 (aged 79 and under)'),
 ('CHD016','cvd','Cardiovascular','CHD: blood pressure control (80+)','CHD patients aged 80+ with BP <= 150/90'),
 ('CHOL003','cvd','Cardiovascular','Statin / lipid-lowering therapy','CHD/PAD/Stroke-TIA/CKD register patients on a statin or documented alternative/exception'),
 ('CHOL004','cvd','Cardiovascular','Cholesterol to target','LDL <= 2.0 mmol/L or non-HDL <= 2.6 mmol/L in preceding 12 months'),
 ('HYP008','cvd','Cardiovascular','Hypertension: BP to target (<=79)','Hypertensive patients aged <=79 with BP <= 140/90'),
 ('HYP009','cvd','Cardiovascular','Hypertension: BP to target (80+)','Hypertensive patients aged 80+ with BP <= 150/90'),
 ('STIA007','cvd','Cardiovascular','Stroke/TIA: influenza immunisation','Stroke/TIA patients who have had an influenza immunisation'),
 ('STIA014','cvd','Cardiovascular','Stroke/TIA: BP to target (<=79)','Stroke/TIA patients aged <=79 with BP <= 140/90'),
 ('STIA015','cvd','Cardiovascular','Stroke/TIA: BP to target (80+)','Stroke/TIA patients aged 80+ with BP <= 150/90'),
 ('AF006','cvd','Cardiovascular','AF: anticoagulation','AF patients with CHA2DS2-VASc >=2 treated with anticoagulation'),
 ('AF008','cvd','Cardiovascular','AF: risk assessment','AF patients with a CHA2DS2-VASc score recorded'),
 ('HF003','cvd','Cardiovascular','Heart failure: ACE/ARB','HF due to LVSD treated with ACE-I or ARB'),
 ('HF006','cvd','Cardiovascular','Heart failure: diagnosis confirmed','HF diagnosis confirmed by echo or specialist assessment'),
 ('HF007','cvd','Cardiovascular','Heart failure: review','HF patients with a review in the preceding 12 months'),
 ('HF008','cvd','Cardiovascular','Heart failure: beta-blocker','HF due to LVSD treated with a beta-blocker'),
 ('DM006','diabetes','Diabetes','Diabetes: ACE/ARB for nephropathy','Diabetes with nephropathy/micro-albuminuria on ACE-I or ARB'),
 ('DM012','diabetes','Diabetes','Diabetes: foot examination','Diabetes with a foot examination and risk classification'),
 ('DM014','diabetes','Diabetes','Diabetes: structured education referral','Newly diagnosed diabetes referred to structured education'),
 ('DM020','diabetes','Diabetes','Diabetes: HbA1c control (tight)','Diabetes patients with HbA1c <= 58 mmol/mol (all)'),
 ('DM021','diabetes','Diabetes','Diabetes: HbA1c control (relaxed)','Diabetes patients with HbA1c <= 75 mmol/mol (all)'),
 ('DM034','diabetes','Diabetes','Diabetes: statin therapy','Diabetes patients on a statin (or documented alternative)'),
 ('DM035','diabetes','Diabetes','Diabetes: cholesterol to target','Diabetes patients with LDL/non-HDL to target'),
 ('DM036','diabetes','Diabetes','Diabetes: HbA1c <= 58 (non-frail <=79)','Non-frail diabetes patients aged <=79 with HbA1c <= 58 mmol/mol'),
 ('AST007','respiratory','Respiratory','Asthma: review','Asthma patients with a review in the preceding 12 months'),
 ('AST012','respiratory','Respiratory','Asthma: objective diagnosis','New asthma diagnoses with an objective test recorded'),
 ('COPD010','respiratory','Respiratory','COPD: review with MRC score','COPD review including MRC dyspnoea score'),
 ('DEM004','mental_health','Mental Health','Dementia: care plan review','Dementia patients with a care plan review in the preceding 12 months'),
 ('MH002','mental_health','Mental Health','SMI: comprehensive care plan','Severe mental illness patients with a documented care plan'),
 ('MH003','mental_health','Mental Health','SMI: blood pressure','SMI patients with a record of BP in the preceding 12 months'),
 ('MH006','mental_health','Mental Health','SMI: BMI','SMI patients with a record of BMI in the preceding 12 months'),
 ('MH007','mental_health','Mental Health','SMI: alcohol consumption','SMI patients with alcohol consumption recorded'),
 ('MH011','mental_health','Mental Health','SMI: cervical screening','SMI women with a record of cervical screening'),
 ('MH012','mental_health','Mental Health','SMI: cholesterol','SMI patients with a cholesterol measurement recorded'),
 ('NDH002','diabetes','Diabetes','Non-diabetic hyperglycaemia: review','NDH patients with an annual review / HbA1c'),
 ('BP002','public_health','Public Health','Blood pressure recording','Adults aged 45+ with a BP recorded in the preceding 5 years'),
 ('SMOK001','public_health','Public Health','Smoking status recorded','Patients 15+ with smoking status recorded'),
 ('SMOK004','public_health','Public Health','Smoking cessation support','Smokers offered support / referral (Very Brief Advice)'),
 ('VI001','public_health','Public Health','Childhood immunisations (1 year)','Children reaching 1 year with primary immunisation course'),
 ('VI002','public_health','Public Health','Childhood immunisations (2 years)','Children reaching 2 years with immunisations to schedule'),
 ('VI003','public_health','Public Health','Childhood immunisations (5 years)','Children reaching 5 years with immunisations to schedule'),
 ('VI004','public_health','Public Health','Shingles vaccination','Eligible patients with a shingles vaccination'),
 ('CS005','public_health','Public Health','Cervical screening coverage','Eligible women screened within the recall window'),
 ('CS006','public_health','Public Health','Cervical screening: results actioned','Cervical screening results recorded and actioned')
on conflict (indicator_code) do update set title=excluded.title, description=excluded.description, domain=excluded.domain, domain_label=excluded.domain_label;

-- ---------------- 2025/26 points & thresholds ----------------
-- EXACT published 2025/26 figures for reweighted indicators:
insert into qof_indicator_year (indicator_code, year, status, points, lower_threshold, upper_threshold, pound_per_point) values
 ('CHD015','2025/26','current',33,40,90,225.49),
 ('CHD016','2025/26','current',14,46,90,225.49),
 ('CHOL003','2025/26','current',38,70,95,225.49),
 ('CHOL004','2025/26','current',44,20,50,225.49),
 ('HYP008','2025/26','current',38,40,85,225.49),
 ('HYP009','2025/26','current',14,40,85,225.49),
 ('STIA014','2025/26','current',8,40,90,225.49),
 ('STIA015','2025/26','current',6,46,90,225.49),
 ('DM036','2025/26','current',27,38,90,225.49),
 ('DM034','2025/26','current',4,50,90,225.49),
 ('DM035','2025/26','current',2,50,90,225.49),
 ('AST012','2025/26','current',15,45,80,225.49)
on conflict (indicator_code, year) do update set points=excluded.points, lower_threshold=excluded.lower_threshold, upper_threshold=excluded.upper_threshold, status='current';

-- Continuing indicators (provisional standard points; overwritten by ingestion):
insert into qof_indicator_year (indicator_code, year, status, points, lower_threshold, upper_threshold, pound_per_point) values
 ('CHD005','2025/26','current',7,40,70,225.49),
 ('STIA007','2025/26','current',5,40,70,225.49),
 ('AF006','2025/26','current',12,40,70,225.49),
 ('AF008','2025/26','current',12,40,70,225.49),
 ('HF003','2025/26','current',6,40,80,225.49),
 ('HF006','2025/26','current',6,40,80,225.49),
 ('HF007','2025/26','current',9,40,90,225.49),
 ('HF008','2025/26','current',6,40,80,225.49),
 ('DM006','2025/26','current',3,38,80,225.49),
 ('DM012','2025/26','current',4,50,90,225.49),
 ('DM014','2025/26','current',11,40,90,225.49),
 ('DM020','2025/26','current',10,40,80,225.49),
 ('DM021','2025/26','current',10,40,80,225.49),
 ('AST007','2025/26','current',6,45,80,225.49),
 ('COPD010','2025/26','current',9,40,90,225.49),
 ('DEM004','2025/26','current',6,35,70,225.49),
 ('MH002','2025/26','current',6,40,90,225.49),
 ('MH003','2025/26','current',4,40,90,225.49),
 ('MH006','2025/26','current',4,40,90,225.49),
 ('MH007','2025/26','current',4,40,90,225.49),
 ('MH011','2025/26','current',5,40,90,225.49),
 ('MH012','2025/26','current',4,40,90,225.49),
 ('NDH002','2025/26','current',10,40,90,225.49),
 ('BP002','2025/26','current',15,50,90,225.49),
 ('SMOK001','2025/26','current',10,40,90,225.49),
 ('SMOK004','2025/26','current',25,40,90,225.49),
 ('VI001','2025/26','current',18,50,95,225.49),
 ('VI002','2025/26','current',18,50,95,225.49),
 ('VI003','2025/26','current',12,50,95,225.49),
 ('VI004','2025/26','current',2,50,95,225.49),
 ('CS005','2025/26','current',7,45,80,225.49),
 ('CS006','2025/26','current',2,45,80,225.49)
on conflict (indicator_code, year) do update set points=excluded.points, lower_threshold=excluded.lower_threshold, upper_threshold=excluded.upper_threshold, status='current';

-- ---------------- generated sample achievement (all indicators x org levels) ----------------
-- deterministic pseudo-random so the whole app is populated for the demo practice.
insert into qof_achievement (ods_code, org_level, indicator_code, year, achievement_pct, points_available)
select o.code, o.lvl::org_level, iy.indicator_code, '2025/26',
       greatest(12, least(98, 50 + (abs(hashtext(o.code||iy.indicator_code)) % 46) - 12 + o.bump)),
       iy.points
from (values ('A81001','practice',0),('U12345','pcn',6),('QE1','icb',9),('ENG','national',11)) as o(code,lvl,bump)
cross join qof_indicator_year iy
where iy.year='2025/26'
on conflict (ods_code, indicator_code, year) do nothing;

-- ---------------- practice 3-year trend for every indicator ----------------
insert into qof_achievement (ods_code, org_level, indicator_code, year, achievement_pct)
select a.ods_code, 'practice', a.indicator_code, yr.year,
       greatest(8, a.achievement_pct - yr.drop)
from qof_achievement a
cross join (values ('2024/25',4),('2023/24',9)) as yr(year,drop)
where a.ods_code='A81001' and a.org_level='practice' and a.year='2025/26'
on conflict (ods_code, indicator_code, year) do nothing;

-- ---------------- extra Accurx template + QI suggestions across domains ----------------
insert into accurx_template (id, kind, title, body_markdown, clinical_notes) values
 ('tmpl-bp-recall','florey_questionnaire','Home blood pressure recall',
  E'Hello, we would like an up-to-date blood pressure reading for you. If you have a home monitor, please reply with your latest reading. Otherwise, please book a free BP check here: {{booking_link}}.',
  'Send to hypertension/CVD patients with no BP in the last 12 months. Record the reading; brings patients into the numerator for BP indicators (HYP008/CHD015/STIA014).')
on conflict (id) do nothing;

insert into qi_suggestion (id, indicator_code, title, rationale, evidence_measure_id, trigger_logic, accurx_template_id, priority_weight) values
 ('hyp-bp-recall','HYP008','Recall hypertensive patients with no recent BP','Patients with no BP recorded in 12 months cannot count toward the target. A batch recall lifts the measured denominator quickly.', null, '{"achievement_below":"upper_threshold"}', 'tmpl-bp-recall', 85),
 ('chd-bp-recall','CHD015','Recall CHD patients for blood pressure review','CHD BP control is a high-value CVD indicator; recall and optimise antihypertensives for those above target.', null, '{"achievement_below":"upper_threshold"}', 'tmpl-bp-recall', 75),
 ('dm-hba1c-tight','DM020','Optimise therapy for diabetes patients with HbA1c > 58','Structured medication review for patients above 58 mmol/mol moves both DM020 and DM036.', null, '{"achievement_below":"upper_threshold"}', 'tmpl-vaccination', 60),
 ('ast-review','AST007','Batch-invite asthma patients overdue a review','Asthma review completion drives AST007; a questionnaire pre-collects control (ACT) before the appointment.', null, '{"achievement_below":"upper_threshold"}', 'tmpl-vaccination', 55),
 ('bp-recording','BP002','Recall adults 45+ with no BP in 5 years','A simple recall for a one-off BP recording captures this public-health indicator.', null, '{"achievement_below":"upper_threshold"}', 'tmpl-bp-recall', 50),
 ('vi-childhood','VI001','Invite carers of children due immunisations','Batch invitation + reminder improves childhood immunisation uptake toward the upper threshold.', null, '{"achievement_below":"upper_threshold"}', 'tmpl-vaccination', 65),
 ('cs-screening','CS005','Invite women overdue cervical screening','Targeted invitation for those outside the recall window lifts screening coverage.', null, '{"achievement_below":"upper_threshold"}', 'tmpl-vaccination', 60)
on conflict (id) do nothing;
