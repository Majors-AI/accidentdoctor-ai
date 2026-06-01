import { supabase } from './supabase';

// Replace with real Twilio call via edge function once creds are configured.
// No real SMS is sent — returns a deterministic MOCK SID and records it on the appointment row.
export async function sendSmsReminder(
  appointmentId: string,
  _phone: string,
  _message: string,
): Promise<{ sid: string; error?: string }> {
  const mockSid = `MOCK-${Date.now()}`;

  const { error } = await supabase
    .from('appointments')
    .update({
      reminder_status: 'sent',
      reminder_sent_at: new Date().toISOString(),
      twilio_message_sid: mockSid,
    })
    .eq('id', appointmentId);

  if (error) return { sid: mockSid, error: error.message };
  return { sid: mockSid };
}
