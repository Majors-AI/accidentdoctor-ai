window.AD_Data = (function() {

  var patients = [
    { id: 'pt1', full_name: 'Maria Reyes',      dob: '1988-03-14', phone: '(310) 555-0182', email: 'maria.reyes@email.com',    address: '1422 W 58th St, Los Angeles, CA 90062', health_insurer: 'Kaiser Permanente' },
    { id: 'pt2', full_name: 'James Okonkwo',    dob: '1975-11-29', phone: '(213) 555-0334', email: 'j.okonkwo@gmail.com',       address: '887 N Vermont Ave, Los Angeles, CA 90029', health_insurer: 'Anthem Blue Cross' },
    { id: 'pt3', full_name: 'Sofia Lindqvist',  dob: '1993-07-05', phone: '(626) 555-0091', email: 'sofia.l@outlook.com',       address: '234 Oak Knoll Ave, Pasadena, CA 91101', health_insurer: null },
    { id: 'pt4', full_name: 'Kevin Park',        dob: '1966-02-18', phone: '(818) 555-0467', email: 'kpark66@yahoo.com',         address: '5501 Laurel Canyon Blvd, Valley Village, CA 91607', health_insurer: 'UnitedHealth' },
    { id: 'pt5', full_name: 'Denise Fuentes',   dob: '2001-09-30', phone: '(323) 555-0788', email: 'dfuentes@email.com',        address: '3120 W Pico Blvd, Los Angeles, CA 90019', health_insurer: 'Medi-Cal' },
  ];

  var charts = [
    {
      id: 'c1', patient_id: 'pt1', status: 'in_treatment', payer_type: 'pi_lien',
      date_of_injury: '2025-11-04', mechanism_of_injury: 'motor_vehicle_accident',
      body_regions_affected: ['cervical', 'lumbar'],
      injury_description: 'Rear-end collision at highway speed. Patient reports persistent neck stiffness and lower back pain radiating into left leg.',
      referring_attorney_name: 'David Kim', referring_law_firm: 'Kim & Associates',
      lien_on_file: true, lien_amount: 45000,
      total_billed: 8200, total_paid: 0, total_balance: 8200,
      hipaa_authorization_signed: true, hipaa_signed_at: '2025-11-10T14:30:00Z',
      consent_share_with_firm: true, consent_granted_at: '2025-11-10T14:31:00Z', consent_revoked_at: null,
      discharge_status: null, discharge_date: null, al_case_ref: 'KIM-2025-441',
      primary_provider_id: 'prov1', updated_at: '2026-05-28T10:00:00Z',
    },
    {
      id: 'c2', patient_id: 'pt2', status: 'intake_scheduled', payer_type: 'workers_comp',
      date_of_injury: '2026-01-15', mechanism_of_injury: 'slip_and_fall',
      body_regions_affected: ['thoracic', 'right_shoulder'],
      injury_description: 'Slipped on wet floor at workplace. Reported immediately. Shoulder MRI ordered.',
      wc_claim_number: 'WC-2026-00882', wc_employer: 'Pacific Logistics Inc.', wc_carrier: 'State Comp Insurance Fund',
      wc_adjuster_name: 'Karen Wu', wc_adjuster_phone: '(800) 555-0210', wc_auth_status: 'pending',
      total_billed: 0, total_paid: 0, total_balance: 0,
      hipaa_authorization_signed: false, consent_share_with_firm: false,
      discharge_status: null, discharge_date: null, al_case_ref: null,
      primary_provider_id: 'prov1', updated_at: '2026-01-20T09:00:00Z',
    },
    {
      id: 'c3', patient_id: 'pt3', status: 'treatment_complete', payer_type: 'pi_lien',
      date_of_injury: '2025-08-22', mechanism_of_injury: 'motor_vehicle_accident',
      body_regions_affected: ['cervical'],
      injury_description: 'T-bone collision. Cervical strain grade II. Full course of treatment completed.',
      referring_attorney_name: 'Patricia Moss', referring_law_firm: 'Moss Law Group',
      lien_on_file: true, lien_amount: 28000,
      total_billed: 11400, total_paid: 11400, total_balance: 0,
      hipaa_authorization_signed: true, hipaa_signed_at: '2025-08-30T11:00:00Z',
      consent_share_with_firm: true, consent_granted_at: '2025-08-30T11:05:00Z', consent_revoked_at: null,
      discharge_status: 'complete', discharge_date: '2026-03-14',
      primary_provider_id: 'prov2', updated_at: '2026-03-14T16:00:00Z',
    },
    {
      id: 'c4', patient_id: 'pt4', status: 'referral_received', payer_type: 'health_insurance',
      date_of_injury: '2026-02-03', mechanism_of_injury: 'sports_injury',
      body_regions_affected: ['lumbar', 'left_hip'],
      injury_description: 'Acute lumbar strain during recreational basketball. Insurance pre-auth required.',
      total_billed: 0, total_paid: 0, total_balance: 0,
      hipaa_authorization_signed: true, hipaa_signed_at: '2026-02-05T09:30:00Z',
      consent_share_with_firm: false, discharge_status: null,
      primary_provider_id: 'prov1', updated_at: '2026-02-05T09:30:00Z',
    },
    {
      id: 'c5', patient_id: 'pt5', status: 'treatment_paused', payer_type: 'pip_medpay',
      date_of_injury: '2025-12-19', mechanism_of_injury: 'motor_vehicle_accident',
      body_regions_affected: ['cervical', 'thoracic', 'lumbar'],
      injury_description: 'Multi-region strain from multi-vehicle accident on I-405. PIP limits approaching.',
      total_billed: 4800, total_paid: 2500, total_balance: 2300,
      hipaa_authorization_signed: true, hipaa_signed_at: '2025-12-22T10:00:00Z',
      consent_share_with_firm: false, discharge_status: null,
      primary_provider_id: 'prov2', updated_at: '2026-04-10T14:00:00Z',
    },
  ];

  var providers = [
    { id: 'prov1', full_name: 'Dr. Aisha Obi', role: 'provider' },
    { id: 'prov2', full_name: 'Dr. Marcus Chen', role: 'provider' },
  ];

  var appointments = {
    c1: [
      { id: 'a1', chart_id: 'c1', scheduled_at: '2026-05-28T09:00:00', duration_minutes: 45, visit_type: 'follow_up',         status: 'completed', reminder_status: 'sent', twilio_message_sid: 'SM9a2b3c4d' },
      { id: 'a2', chart_id: 'c1', scheduled_at: '2026-06-02T10:30:00', duration_minutes: 45, visit_type: 'chiropractic',      status: 'scheduled',  reminder_status: null },
      { id: 'a3', chart_id: 'c1', scheduled_at: '2026-06-09T09:00:00', duration_minutes: 45, visit_type: 'physical_therapy', status: 'scheduled',  reminder_status: null },
    ],
    c2: [
      { id: 'a4', chart_id: 'c2', scheduled_at: '2026-01-28T14:00:00', duration_minutes: 60, visit_type: 'initial_evaluation', status: 'scheduled', reminder_status: null },
    ],
    c3: [
      { id: 'a5', chart_id: 'c3', scheduled_at: '2026-01-10T11:00:00', duration_minutes: 45, visit_type: 'chiropractic',   status: 'completed', reminder_status: 'sent' },
      { id: 'a6', chart_id: 'c3', scheduled_at: '2026-02-14T11:00:00', duration_minutes: 45, visit_type: 'chiropractic',   status: 'completed', reminder_status: 'sent' },
      { id: 'a7', chart_id: 'c3', scheduled_at: '2026-03-11T11:00:00', duration_minutes: 45, visit_type: 'follow_up',      status: 'completed', reminder_status: 'sent' },
    ],
    c4: [], c5: [],
  };

  var visitNotes = {
    c1: [
      {
        id: 'n1', chart_id: 'c1', visit_date: '2026-05-28', status: 'signed',
        provider: { full_name: 'Dr. Aisha Obi' },
        signed_at: '2026-05-28T11:30:00Z', signed_by: 'prov1',
        subjective: 'Patient reports 4/10 neck pain, improved from initial 7/10. Some stiffness in the morning. Lower back pain 5/10, radiating into left leg intermittently.',
        objective: 'ROM cervical: flexion 50°, extension 45°, rotation L/R 60°/55°. Lumbar flexion 65°. SLR negative bilateral. Paraspinal muscle tension palpable L4-S1.',
        assessment: 'Cervical strain improving. Lumbar radiculopathy — continuing to improve with conservative care.',
        plan: 'Continue 3x/week chiro + PT. Ice/heat protocol at home. Reassess in 4 weeks.',
        appointment_id: 'a1',
        charges: [
          { id: 'ch1', cpt_code: '98941', description: 'Chiropractic manipulation, 3–4 regions', units: 1, fee_amount: 180, status: 'billed' },
          { id: 'ch2', cpt_code: '97110', description: 'Therapeutic exercises', units: 2, fee_amount: 65, status: 'billed' },
          { id: 'ch3', cpt_code: '97012', description: 'Mechanical traction', units: 1, fee_amount: 55, status: 'billed' },
        ],
      },
      {
        id: 'n2', chart_id: 'c1', visit_date: '2026-05-14', status: 'signed',
        provider: { full_name: 'Dr. Aisha Obi' },
        signed_at: '2026-05-14T12:00:00Z', signed_by: 'prov1',
        subjective: 'Patient reporting 5/10 overall pain. Neck tightness worse after sitting at desk. Lower back aching with prolonged standing.',
        objective: 'Cervical ROM slightly limited on right rotation (50°). Lumbar flexion 60°. No new neurological findings.',
        assessment: 'Improving but guarded. Continue current treatment plan.',
        plan: 'Chiropractic + PT 3x/week. Added massage for cervical region.',
        appointment_id: null,
        charges: [
          { id: 'ch4', cpt_code: '98941', description: 'Chiropractic manipulation, 3–4 regions', units: 1, fee_amount: 180, status: 'billed' },
          { id: 'ch5', cpt_code: '97124', description: 'Massage therapy', units: 1, fee_amount: 75, status: 'pending' },
        ],
      },
    ],
    c2: [],
    c3: [
      {
        id: 'n3', chart_id: 'c3', visit_date: '2026-03-11', status: 'signed',
        provider: { full_name: 'Dr. Marcus Chen' },
        signed_at: '2026-03-11T14:00:00Z', signed_by: 'prov2',
        subjective: 'Patient reports minimal pain (1/10). Full neck ROM restored. Cleared for discharge.',
        objective: 'Cervical ROM WNL. No tenderness on palpation. Neurological exam normal.',
        assessment: 'Resolution of cervical strain. MMI reached.',
        plan: 'Discharge patient. Home exercise program provided. Return PRN.',
        appointment_id: 'a7',
        charges: [
          { id: 'ch6', cpt_code: '98940', description: 'Chiropractic manipulation, 1–2 regions', units: 1, fee_amount: 140, status: 'paid' },
          { id: 'ch7', cpt_code: '99213', description: 'Office visit, established patient', units: 1, fee_amount: 185, status: 'paid' },
        ],
      },
    ],
    c4: [], c5: [],
  };

  var treatmentPlans = {
    c1: { id: 'tp1', chart_id: 'c1', frequency: '3x/week', planned_visits: 36, modalities: ['Chiropractic', 'Physical therapy', 'Massage'], goals: 'Pain reduction to 0–2/10, full ROM restoration, return to pre-injury activities.', status: 'active' },
    c3: { id: 'tp2', chart_id: 'c3', frequency: '2x/week', planned_visits: 24, modalities: ['Chiropractic'], goals: 'Full cervical ROM, pain-free ADLs.', status: 'completed' },
  };

  var ledger = {
    c1: [
      { id: 'l1', chart_id: 'c1', entry_date: '2026-05-28', entry_type: 'charge',  amount: 490,  memo: 'CPT charges — visit 05/28',    created_by: 'prov1' },
      { id: 'l2', chart_id: 'c1', entry_date: '2026-05-14', entry_type: 'charge',  amount: 255,  memo: 'CPT charges — visit 05/14',    created_by: 'prov1' },
    ],
    c3: [
      { id: 'l3', chart_id: 'c3', entry_date: '2026-03-11', entry_type: 'charge',  amount: 325,  memo: 'Final visit charges', created_by: 'prov2' },
      { id: 'l4', chart_id: 'c3', entry_date: '2026-04-02', entry_type: 'payment', amount: -325, memo: 'Settlement payment — Moss Law Group', created_by: 'prov2' },
    ],
    c2: [], c4: [], c5: [],
  };

  var reductions = {
    c1: [], c2: [], c3: [], c4: [], c5: [],
  };

  var dischargePackages = {
    c3: {
      id: 'dp1', chart_id: 'c3', status: 'complete',
      visit_count: 18, date_first_visit: '2025-09-02', date_last_visit: '2026-03-11',
      total_billed: 11400, total_paid: 11400, total_balance: 0,
      diagnosis_summary: 'Cervical strain grade II, C4–C6. Fully resolved with conservative chiropractic care.',
      treatment_summary: 'Patient completed 18 chiropractic visits over 6 months. Excellent response to manipulation and home exercise program.',
    },
  };

  var accessLog = {
    c1: [
      { id: 'al1', actor: { full_name: 'Dr. Aisha Obi' }, actor_role: 'provider', action: 'view_chart',   created_at: '2026-05-28T09:05:00Z' },
      { id: 'al2', actor: { full_name: 'Admin User' },     actor_role: 'practice_admin', action: 'view_chart', created_at: '2026-05-27T16:30:00Z' },
    ],
  };

  var payerBadge = {
    pi_lien:          { label: 'PI Lien',       cls: 'gold' },
    workers_comp:     { label: "Workers' Comp", cls: 'ink'  },
    health_insurance: { label: 'Health Ins',    cls: 'good' },
    pip_medpay:       { label: 'PIP/MedPay',    cls: 'warn' },
    cash:             { label: 'Cash',           cls: 'soft' },
  };

  var statusTag = {
    referral_received:  'soft',
    intake_scheduled:   'gold',
    intake_complete:    'gold',
    in_treatment:       'good',
    treatment_paused:   'warn',
    treatment_complete: 'ink',
    discharged:         'soft',
    records_requested:  'soft',
    records_sent:       'soft',
    closed:             'soft',
  };

  function getChart(id) {
    var c = charts.find(function(x) { return x.id === id; });
    if (!c) return null;
    var pt = patients.find(function(p) { return p.id === c.patient_id; });
    var prov = providers.find(function(p) { return p.id === c.primary_provider_id; });
    return Object.assign({}, c, { patients: pt, provider: prov });
  }

  function getChartList() {
    return charts.map(function(c) {
      var pt = patients.find(function(p) { return p.id === c.patient_id; });
      var prov = providers.find(function(p) { return p.id === c.primary_provider_id; });
      return Object.assign({}, c, { patients: pt, provider: prov });
    }).sort(function(a, b) { return b.updated_at > a.updated_at ? 1 : -1; });
  }

  return {
    patients, charts, providers, appointments, visitNotes,
    treatmentPlans, ledger, reductions, dischargePackages, accessLog,
    payerBadge, statusTag,
    getChart, getChartList,
  };
})();
