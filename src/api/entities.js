import { supabase } from '@/lib/supabase';

// base44 entity -> Supabase table (only entities whose tables already exist)
const TABLES = {
  Patient: 'patients',
  PatientChart: 'patient_charts',
  Practice: 'practices',
  Appointment: 'appointments',
  User: 'profiles',
  PatientIntake: 'patient_intakes',
  IntakeLink: 'intake_links',
  PatientAuthorization: 'patient_authorizations',
  TrainingModule: 'training_modules',
  TrainingAssignment: 'training_assignments',
  Document: 'documents',
};
// base44 built-in field names -> Supabase columns
const FIELD_ALIASES = { created_date: 'created_at', updated_date: 'updated_at' };
const col = (f) => FIELD_ALIASES[f] ?? f;

function applySort(q, sort) {
  if (!sort) return q;
  const desc = sort.startsWith('-');
  return q.order(col(desc ? sort.slice(1) : sort), { ascending: !desc });
}

function makeEntity(table) {
  return {
    async list(sort, limit) {
      let q = supabase.from(table).select('*');
      q = applySort(q, sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    async filter(query = {}, sort, limit) {
      let q = supabase.from(table).select('*');
      for (const [k, v] of Object.entries(query)) q = q.eq(col(k), v);
      q = applySort(q, sort);
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
      if (error) throw error; return data;
    },
    async create(obj) {
      const { data, error } = await supabase.from(table).insert(obj).select().single();
      if (error) throw error; return data;
    },
    async update(id, obj) {
      const { data, error } = await supabase.from(table).update(obj).eq('id', id).select().single();
      if (error) throw error; return data;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error; return { id };
    },
  };
}

export const db = {
  entities: Object.fromEntries(Object.entries(TABLES).map(([n, t]) => [n, makeEntity(t)])),
};
