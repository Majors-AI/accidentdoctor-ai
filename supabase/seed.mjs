// AccidentDoctor.AI — Phase 1 seed
// Run once after applying all three SQL files:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/seed.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const PW = 'TestPass123!';

const USERS = [
  { email: 'super@accidentdoctor.ai',        full_name: 'Platform Admin',      role: 'platform_admin' },
  { email: 'admin@accidentdoctor.ai',         full_name: 'Dr. Patricia Reyes',  role: 'practice_admin' },
  { email: 'provider@accidentdoctor.ai',      full_name: 'Dr. Marcus Webb',     role: 'provider'       },
  { email: 'frontdesk@accidentdoctor.ai',     full_name: 'Sam Ortega',          role: 'front_desk'     },
  { email: 'billing@accidentdoctor.ai',       full_name: 'Lena Park',           role: 'billing_staff'  },
];

async function ensureUser(u) {
  const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 });
  const hit = users.find(x => x.email === u.email);
  let userId;
  if (hit) {
    userId = hit.id;
    console.log(`  ${u.role.padEnd(16)} ${u.email} (exists)`);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: u.email, password: PW, email_confirm: true,
      user_metadata: { full_name: u.full_name, role: u.role },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`  ${u.role.padEnd(16)} ${u.email} (created)`);
  }
  // Upsert profile — handles existing auth users whose profile may be missing
  // after a schema rebuild (handle_new_user trigger only fires on INSERT).
  await db.from('profiles').upsert({
    id: userId, email: u.email, full_name: u.full_name, role: u.role,
    is_platform_admin: u.role === 'platform_admin',
  }, { onConflict: 'id' });
  return userId;
}

// Insert one row and return it; throws on error.
async function ins(table, row) {
  const { data, error } = await db.from(table).insert(row).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data[0];
}

async function main() {
  // ---- Users ----------------------------------------------------------------
  console.log('Users:');
  const ids = {};
  for (const u of USERS) ids[u.email] = await ensureUser(u);

  // ---- Practice -------------------------------------------------------------
  console.log('Practice:');
  let prac;
  const { data: existing } = await db.from('practices').select().limit(1);
  if (existing.length) {
    prac = existing[0];
    console.log('  using existing practice:', prac.name);
  } else {
    prac = await ins('practices', {
      name: 'Desert Spine & Wellness (Demo)',
      npi: '1234567890',
      specialty: 'chiropractic',
      city: 'Tempe', state: 'AZ', zip: '85281',
      phone: '480-555-0100', fax: '480-555-0101',
      data_security_agreed: true,
      allow_platform_metrics: true,
      marketing_source: 'AccidentLawyer.AI Referral',
    });
    console.log('  created:', prac.name);
  }

  const staffIds = [
    ids['admin@accidentdoctor.ai'],
    ids['provider@accidentdoctor.ai'],
    ids['frontdesk@accidentdoctor.ai'],
    ids['billing@accidentdoctor.ai'],
  ];
  await db.from('profiles').update({ practice_id: prac.id }).in('id', staffIds);
  await db.from('profiles').update({ is_platform_admin: true }).eq('id', ids['super@accidentdoctor.ai']);

  const provId    = ids['provider@accidentdoctor.ai'];
  const billingId = ids['billing@accidentdoctor.ai'];

  // ---- Patients -------------------------------------------------------------
  console.log('Patients:');

  const pat1 = await ins('patients', {
    practice_id: prac.id,
    full_name: 'Carlos Rivera', email: 'carlos.rivera@example.com',
    phone: '602-555-0201', dob: '1988-07-15',
    health_insurer: 'BCBS AZ',
    al_patient_ref: 'AL-PAT-00142',
    referral_firm_name: 'Gonzalez & Shaw PI Law',
  });

  const pat2 = await ins('patients', {
    practice_id: prac.id,
    full_name: 'Aisha Thompson', email: 'aisha.thompson@example.com',
    phone: '480-555-0312', dob: '1995-03-22',
    referral_firm_name: 'Thompson & Lee Attorneys',
  });

  const pat3 = await ins('patients', {
    practice_id: prac.id,
    full_name: 'Robert Kim', email: 'robert.kim@example.com',
    phone: '623-555-0418', dob: '1975-11-03',
    health_insurer: 'ICW Group',
  });

  console.log('  created 3 patients');

  // ---- Patient charts -------------------------------------------------------
  console.log('Charts:');

  // PI-lien, active treatment — has signed notes + ledger entries
  const chart1 = await ins('patient_charts', {
    practice_id: prac.id, patient_id: pat1.id, primary_provider_id: provId,
    status: 'in_treatment',
    date_of_injury: '2026-04-18',
    mechanism_of_injury: 'mva_rear_end',
    injury_description: 'Rear-ended at traffic signal; cervical and lumbar strain.',
    body_regions_affected: ['cervical', 'lumbar'],
    payer_type: 'pi_lien',
    referring_attorney_name: 'Maria Gonzalez',
    referring_law_firm: 'Gonzalez & Shaw PI Law',
    al_case_ref: 'AL-CASE-00892',
    lien_on_file: true,
    lien_amount: 12000,
    total_billed: 415,
    total_balance: 415,
  });

  // PI-lien, intake complete — no notes yet; first appointment upcoming
  const chart2 = await ins('patient_charts', {
    practice_id: prac.id, patient_id: pat2.id, primary_provider_id: provId,
    status: 'intake_complete',
    date_of_injury: '2026-05-10',
    mechanism_of_injury: 'slip_and_fall',
    injury_description: 'Slip on wet grocery-store floor; right shoulder and knee.',
    body_regions_affected: ['right_shoulder', 'right_knee'],
    payer_type: 'pi_lien',
    referring_attorney_name: 'James Lee',
    referring_law_firm: 'Thompson & Lee Attorneys',
    lien_on_file: false,
  });

  // Workers' comp — WC fields populated; signed initial-eval note
  const chart3 = await ins('patient_charts', {
    practice_id: prac.id, patient_id: pat3.id, primary_provider_id: provId,
    status: 'in_treatment',
    date_of_injury: '2026-03-05',
    mechanism_of_injury: 'work_related_lift',
    injury_description: 'Lifting injury; lumbar disc herniation L4-L5 with radiculopathy.',
    body_regions_affected: ['lumbar', 'left_leg'],
    payer_type: 'workers_comp',
    wc_claim_number: 'WC-2026-00441',
    wc_employer: 'Valley Logistics LLC',
    wc_carrier: 'ICW Group',
    wc_adjuster_name: 'Sandra Mills',
    wc_adjuster_phone: '602-555-0900',
    wc_auth_status: 'authorized',
    total_billed: 200,
    total_balance: 200,
  });

  console.log('  created 3 charts (2 pi_lien, 1 workers_comp)');

  // ---- Treatment plans ------------------------------------------------------
  console.log('Treatment plans:');

  await ins('treatment_plans', {
    chart_id: chart1.id, created_by: provId,
    diagnosis_codes: ['M54.2', 'M54.5'],
    planned_visits: 24,
    frequency: '3x/week x 4 wks, then 2x/week x 4 wks',
    modalities: ['chiropractic_manipulation', 'soft_tissue_therapy', 'electrical_stimulation'],
    goals: 'Reduce pain to 2/10 or less; restore full cervical and lumbar ROM.',
    status: 'active',
  });

  await ins('treatment_plans', {
    chart_id: chart3.id, created_by: provId,
    diagnosis_codes: ['M51.16', 'M54.42'],
    planned_visits: 20,
    frequency: '2x/week x 10 wks',
    modalities: ['chiropractic_manipulation', 'flexion_distraction', 'mechanical_traction'],
    goals: 'Resolve radiculopathy; achieve full duty return-to-work.',
    wc_auth_required: true,
    wc_auth_number: 'AUTH-2026-7791',
    wc_auth_visits_authorized: 20,
    wc_auth_expiry: '2026-09-30',
    status: 'active',
  });

  console.log('  created 2 treatment plans');

  // ---- Appointments ---------------------------------------------------------
  console.log('Appointments:');

  const apt1 = await ins('appointments', {
    chart_id: chart1.id, practice_id: prac.id, provider_id: provId,
    scheduled_at: '2026-05-12T09:00:00Z',
    visit_type: 'initial_eval', status: 'completed',
    confirmed_at: '2026-05-11T14:00:00Z', reminder_status: 'sent',
  });

  const apt2 = await ins('appointments', {
    chart_id: chart1.id, practice_id: prac.id, provider_id: provId,
    scheduled_at: '2026-05-19T09:00:00Z',
    visit_type: 'follow_up', status: 'completed',
    confirmed_at: '2026-05-18T12:00:00Z', reminder_status: 'sent',
  });

  // Upcoming — reminder queued
  await ins('appointments', {
    chart_id: chart1.id, practice_id: prac.id, provider_id: provId,
    scheduled_at: '2026-06-05T09:00:00Z',
    visit_type: 'follow_up', status: 'scheduled', reminder_status: 'queued',
  });

  // Chart2 first appointment (intake)
  await ins('appointments', {
    chart_id: chart2.id, practice_id: prac.id, provider_id: provId,
    scheduled_at: '2026-06-10T11:00:00Z',
    visit_type: 'initial_eval', status: 'scheduled', reminder_status: 'queued',
  });

  const apt3 = await ins('appointments', {
    chart_id: chart3.id, practice_id: prac.id, provider_id: provId,
    scheduled_at: '2026-05-15T10:00:00Z',
    visit_type: 'initial_eval', status: 'completed',
    confirmed_at: '2026-05-14T10:00:00Z', reminder_status: 'sent',
  });

  console.log('  created 5 appointments');

  // ---- Visit notes + CPT charges -------------------------------------------
  console.log('Visit notes and charges:');

  // Chart1 / apt1 — PI lien initial eval, signed
  const note1 = await ins('visit_notes', {
    appointment_id: apt1.id, chart_id: chart1.id, provider_id: provId,
    visit_date: '2026-05-12',
    subjective: 'Patient reports 7/10 neck pain and 6/10 low back pain following MVA on 4/18/2026. Worsened by prolonged sitting. Disrupted sleep.',
    objective: 'Cervical ROM: flexion 35 deg (nl 50), extension 40 deg (nl 60). Lumbar ROM: flexion 60 deg (nl 90). Positive cervical compression. Bilateral paraspinal guarding noted.',
    assessment: 'Cervicalgia (M54.2) and acute lumbar strain (M54.5) secondary to MVA. Significant ROM deficits consistent with soft-tissue injury.',
    plan: 'Spinal manipulation cervical and lumbar regions. Soft-tissue therapy bilateral paraspinals. Patient tolerated well. Plan: 3x/week per treatment plan.',
    diagnosis_codes: ['M54.2', 'M54.5'],
    status: 'signed', signed_at: '2026-05-12T11:30:00Z', signed_by: provId,
  });

  const { error: ce1 } = await db.from('charges').insert([
    { visit_note_id: note1.id, chart_id: chart1.id, cpt_code: '98941', description: 'CMT 3-4 regions', units: 1, fee_amount: 120, status: 'billed' },
    { visit_note_id: note1.id, chart_id: chart1.id, cpt_code: '97140', description: 'Manual therapy',  units: 2, fee_amount: 90,  status: 'billed' },
    { visit_note_id: note1.id, chart_id: chart1.id, cpt_code: '97010', description: 'Hot/cold packs',  units: 1, fee_amount: 25,  status: 'billed' },
  ]);
  if (ce1) throw new Error('charges note1: ' + ce1.message);

  await ins('billing_ledger', {
    chart_id: chart1.id, practice_id: prac.id,
    entry_date: '2026-05-12', entry_type: 'charge', amount: 235,
    reference_type: 'charge', memo: 'Initial eval: 98941 + 97140x2 + 97010',
    created_by: provId,
  });

  // Chart1 / apt2 — follow-up, signed
  const note2 = await ins('visit_notes', {
    appointment_id: apt2.id, chart_id: chart1.id, provider_id: provId,
    visit_date: '2026-05-19',
    subjective: 'Patient reports improvement: neck 5/10, low back 4/10. Sleeping better.',
    objective: 'Cervical ROM: flexion 42 deg, extension 48 deg. Lumbar ROM: flexion 72 deg. Decreased paraspinal guarding.',
    assessment: 'Cervicalgia (M54.2) and lumbar strain (M54.5) improving with conservative care.',
    plan: 'Continued spinal manipulation and soft-tissue therapy. Added electrical stimulation for residual muscle spasm. Continue per treatment plan.',
    diagnosis_codes: ['M54.2', 'M54.5'],
    status: 'signed', signed_at: '2026-05-19T10:45:00Z', signed_by: provId,
  });

  const { error: ce2 } = await db.from('charges').insert([
    { visit_note_id: note2.id, chart_id: chart1.id, cpt_code: '98941', description: 'CMT 3-4 regions',       units: 1, fee_amount: 120, status: 'billed' },
    { visit_note_id: note2.id, chart_id: chart1.id, cpt_code: '97014', description: 'E-stim unattended',     units: 1, fee_amount: 35,  status: 'billed' },
    { visit_note_id: note2.id, chart_id: chart1.id, cpt_code: '97010', description: 'Hot/cold packs',        units: 1, fee_amount: 25,  status: 'billed' },
  ]);
  if (ce2) throw new Error('charges note2: ' + ce2.message);

  await ins('billing_ledger', {
    chart_id: chart1.id, practice_id: prac.id,
    entry_date: '2026-05-19', entry_type: 'charge', amount: 180,
    reference_type: 'charge', memo: 'Follow-up: 98941 + 97014 + 97010',
    created_by: provId,
  });

  // Chart3 / apt3 — WC initial eval, signed
  const note3 = await ins('visit_notes', {
    appointment_id: apt3.id, chart_id: chart3.id, provider_id: provId,
    visit_date: '2026-05-15',
    subjective: 'Patient reports 8/10 low back pain radiating to left leg since lifting injury 3/5/2026. Numbness and tingling in L4 distribution. Unable to perform job duties.',
    objective: 'Lumbar ROM severely limited: flexion 30 deg, extension 15 deg. Positive SLR left at 45 deg. Diminished L4 reflex. MRI confirms L4-L5 disc herniation with left foraminal stenosis.',
    assessment: 'Lumbar disc herniation L4-L5 (M51.16) with left L4 radiculopathy (M54.42). Work-related injury; WC claim WC-2026-00441 on file.',
    plan: 'Flexion-distraction technique L4-L5. Mechanical traction 15 min. Ice post-treatment. WC auth AUTH-2026-7791 on file for 20 visits. Next visit: 5/17.',
    diagnosis_codes: ['M51.16', 'M54.42'],
    status: 'signed', signed_at: '2026-05-15T11:00:00Z', signed_by: provId,
    // fee_schedule_amount is null — WC fee schedule data loads in Phase 3
  });

  const { error: ce3 } = await db.from('charges').insert([
    { visit_note_id: note3.id, chart_id: chart3.id, cpt_code: '98942', description: 'CMT 5 regions',     units: 1, fee_amount: 145, status: 'billed' },
    { visit_note_id: note3.id, chart_id: chart3.id, cpt_code: '97012', description: 'Mechanical traction', units: 1, fee_amount: 55,  status: 'billed' },
  ]);
  if (ce3) throw new Error('charges note3: ' + ce3.message);

  await ins('billing_ledger', {
    chart_id: chart3.id, practice_id: prac.id,
    entry_date: '2026-05-15', entry_type: 'charge', amount: 200,
    reference_type: 'charge', memo: 'WC initial eval: 98942 + 97012',
    created_by: provId,
  });

  console.log('  created 3 signed notes, 7 charges, 3 ledger entries');

  // ---- Integrations ---------------------------------------------------------
  await db.from('integrations').upsert([
    { practice_id: prac.id, provider: 'twilio',    connected: false, config: {} },
    { practice_id: prac.id, provider: 'sendgrid',  connected: false, config: {} },
    { practice_id: prac.id, provider: 'al_bridge', connected: false, config: { mode: 'mock' } },
  ], { onConflict: 'practice_id,provider' });
  console.log('Integrations: 3 seeded (all disconnected)');

  // ---- SaaS billing ---------------------------------------------------------
  const inv = await ins('invoices', {
    practice_id: prac.id, period_label: 'May 2026', amount: 299, status: 'open',
  });
  await ins('invoice_items', {
    invoice_id: inv.id, kind: 'subscription',
    description: 'Standard plan — May 2026', amount: 299,
  });
  console.log('SaaS billing: 1 open invoice');

  // ---- Summary --------------------------------------------------------------
  console.log('\nDone. Logins (password: TestPass123!):');
  USERS.forEach(u => console.log(`  ${u.role.padEnd(16)} ${u.email}`));
}

main().catch(e => { console.error(e); process.exit(1); });
