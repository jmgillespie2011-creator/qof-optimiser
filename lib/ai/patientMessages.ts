// Tailored, copy-ready patient messages per QOF indicator, with an NHS resource
// link. Generic templates only ([first name] / [booking link] / [Practice name])
// — no patient data. The link is appended to the copied text and shown as a
// clickable "learn more" on the page.

export type PatientMessage = {
  message: string;
  resource_url: string;
  resource_label: string;
};

export const INDICATOR_MESSAGES: Record<string, PatientMessage> = {
  // --- Childhood & adult immunisations (each is a different vaccine/age) ---
  VI001: {
    message:
      "Hi [first name], our records show your baby may be due their routine 8-week to 8-month vaccinations (the 6-in-1), which protect against serious illnesses including whooping cough, diphtheria and tetanus. Please book here: [booking link], or reply if they've had them elsewhere. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/vaccinations/6-in-1-infant-vaccine/",
    resource_label: "NHS: 6-in-1 vaccine",
  },
  VI002: {
    message:
      "Hi [first name], our records show your child may be due their first MMR vaccine (measles, mumps and rubella), usually given around 12–18 months. Measles is serious and spreading again — this free vaccine is the best protection. Please book here: [booking link], or reply if they've had it elsewhere. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/vaccinations/mmr-vaccine/",
    resource_label: "NHS: MMR vaccine",
  },
  VI003: {
    message:
      "Hi [first name], our records show your child may be due their pre-school booster (4-in-1) and second MMR vaccine, usually given around age 3–5 before starting school. Please book here: [booking link], or reply if they've had them elsewhere. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/vaccinations/4-in-1-preschool-booster-vaccine/",
    resource_label: "NHS: pre-school booster",
  },
  VI004: {
    message:
      "Hi [first name], you may be eligible for the free NHS shingles vaccine. Shingles can cause a painful, long-lasting rash, and the vaccine greatly reduces your risk. Please book here: [booking link], or reply if you've already had it. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/vaccinations/shingles-vaccination/",
    resource_label: "NHS: shingles vaccine",
  },

  // --- Cervical screening ---
  CS005: {
    message:
      "Hi [first name], your NHS cervical screening (smear test) is due. It's a quick test that helps prevent cervical cancer by catching changes early. Please book here: [booking link], or reply if you've had it done elsewhere or would like to talk it through. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/cervical-screening/",
    resource_label: "NHS: cervical screening",
  },
  CS006: {
    message:
      "Hi [first name], your NHS cervical screening (smear test) is due. Screening is still important at your age — it helps prevent cervical cancer by picking up changes early. Please book here: [booking link], or reply if you've had it elsewhere. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/cervical-screening/",
    resource_label: "NHS: cervical screening",
  },

  // --- Blood pressure ---
  BP002: {
    message:
      "Hi [first name], we don't have a recent blood pressure reading for you. High blood pressure often has no symptoms but raises the risk of heart attack and stroke. If you have a home monitor, submit a reading here: [link] — otherwise reply and we'll arrange a check. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/high-blood-pressure-hypertension/",
    resource_label: "NHS: high blood pressure",
  },
  HYP008: {
    message:
      "Hi [first name], your blood pressure check is due so we can make sure it's well controlled. Keeping it in range lowers your risk of heart attack and stroke. Please submit a home reading here: [link], or book a check: [booking link]. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/high-blood-pressure-hypertension/",
    resource_label: "NHS: high blood pressure",
  },

  // --- Smoking ---
  SMOK004: {
    message:
      "Hi [first name], stopping smoking is the single best thing you can do for your health, and free NHS help makes you far more likely to succeed. We'd like to offer you support — reply YES and we'll arrange a referral, or book here: [booking link]. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/better-health/quit-smoking/",
    resource_label: "NHS: quit smoking",
  },

  // --- Lipids / CVD ---
  CHOL003: {
    message:
      "Hi [first name], because of your heart or circulation condition, we'd like to review your cholesterol-lowering treatment to lower your risk of heart attack and stroke. Please book a phone or face-to-face review here: [booking link], or reply with any questions. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/high-cholesterol/",
    resource_label: "NHS: high cholesterol",
  },
  CHOL004: {
    message:
      "Hi [first name], we'd like to check your cholesterol is at target to protect your heart and circulation. This may mean a blood test or a medication review. Please book here: [booking link], or reply if you'd prefer not to. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/high-cholesterol/",
    resource_label: "NHS: high cholesterol",
  },

  // --- Diabetes / respiratory / MH / LD reviews ---
  DM014: {
    message:
      "Hi [first name], following your recent diabetes diagnosis we'd like to book you onto a free NHS diabetes education course. It helps you understand and manage your diabetes with confidence. Reply YES to be referred, or book here: [booking link]. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/type-2-diabetes/",
    resource_label: "NHS: type 2 diabetes",
  },
  AST007: {
    message:
      "Hi [first name], your annual asthma review is due. It's a chance to check your inhaler technique, control and action plan so your asthma stays well managed. Please book here: [booking link], or reply if you need a different time. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/asthma/",
    resource_label: "NHS: asthma",
  },
  AF006: {
    message:
      "Hi [first name], because of your atrial fibrillation we'd like to review your stroke-risk and whether treatment could lower it. Please book a review here: [booking link], or reply with any questions. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/atrial-fibrillation/",
    resource_label: "NHS: atrial fibrillation",
  },
  MH021: {
    message:
      "Hi [first name], you're due your annual physical health check. It's a supportive appointment to check things like your blood pressure, weight and bloods, and help you stay well. Please book here: [booking link], or reply and we'll help you arrange it. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/mental-health/",
    resource_label: "NHS: mental health",
  },
  LD004: {
    message:
      "Hi [first name], you're due your free annual health check. It's a longer appointment to check your health and make any adjustments that help you. Please book here: [booking link], or reply and we'll support you to arrange it. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/conditions/learning-disabilities/annual-health-checks/",
    resource_label: "NHS: annual health checks",
  },
  DEP004: {
    message:
      "Hi [first name], following your recent appointment we'd like to check in on how you're doing. A short review helps us make sure your treatment and support are working for you. Please book here: [booking link], or reply if you'd like us to call. Thank you, [Practice name].",
    resource_url: "https://www.nhs.uk/mental-health/conditions/depression-in-adults/",
    resource_label: "NHS: depression",
  },
};

// Full copy text = the message with the resource link appended.
export function fullPatientText(m: PatientMessage): string {
  return `${m.message}\n\nLearn more: ${m.resource_url}`;
}
