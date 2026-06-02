import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../App';

export default function Account() {
  const { profile } = useAuth();
  const [practice,  setPractice]  = useState<any>(null);
  const [invoices,  setInvoices]  = useState<any[]>([]);
  const [orders,    setOrders]    = useState<any[]>([]);

  async function load() {
    const { data: pr } = await supabase
      .from('practices').select('*').eq('id', profile?.practice_id).maybeSingle();
    setPractice(pr);
    const { data: inv } = await supabase
      .from('invoices').select('*, invoice_items(*)').order('issued_at', { ascending: false });
    setInvoices(inv ?? []);
    const { data: ord } = await supabase
      .from('document_orders').select('*').order('ordered_at', { ascending: false });
    setOrders(ord ?? []);
  }
  useEffect(() => { load(); }, []);

  async function pay(inv: any) {
    await supabase.from('payments').insert({
      practice_id: practice.id,
      invoice_id: inv.id,
      amount: (inv.amount || 0) + (inv.late_fee || 0),
    });
    await supabase.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', inv.id);
    if (['past_due', 'suspended'].includes(practice.account_status))
      await supabase.from('practices').update({ account_status: 'active' }).eq('id', practice.id);
    load();
  }

  async function cancel() {
    const ends = new Date(Date.now() + 30 * 864e5).toISOString();
    await supabase.from('practices')
      .update({ cancel_notice_at: new Date().toISOString(), access_ends_at: ends })
      .eq('id', practice.id);
    load();
  }

  if (!practice) return <div className="muted">Loading…</div>;

  const statusTag: Record<string, string> = {
    active: 'good', past_due: 'warn', suspended: 'bad', cancelled: 'soft',
  };
  const unpaidOrders = orders.filter(o => !o.billed);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Account &amp; billing</h1>
          <div className="sub">{practice.name} · {practice.plan} plan</div>
        </div>
        <span className={`tag ${statusTag[practice.account_status] ?? 'soft'}`}>
          {(practice.account_status ?? '').replace('_', ' ')}
        </span>
      </div>

      {practice.account_status === 'suspended' && (
        <div className="flag bad">
          <b>Access suspended.</b> An invoice is over 30 days past due.
          Patient charts are locked until payment is made below.
        </div>
      )}
      {practice.account_status === 'past_due' && (
        <div className="flag warn">
          <b>Payment past due.</b> Pay within the grace window to avoid suspension.
        </div>
      )}
      {practice.cancel_notice_at && (
        <div className="flag warn">
          Cancellation requested. Access continues until{' '}
          <b>{new Date(practice.access_ends_at).toLocaleDateString()}</b> (30-day notice).
        </div>
      )}

      <div className="card">
        <h3>Invoices</h3>
        <table>
          <thead>
            <tr><th>Period</th><th>Charges</th><th>Amount</th><th>Due</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {invoices.map(inv => {
              const overdue = inv.status !== 'paid' && new Date(inv.due_at) < new Date();
              return (
                <tr key={inv.id}>
                  <td><b>{inv.period_label}</b></td>
                  <td className="small muted">
                    {(inv.invoice_items ?? []).map((it: any) => it.description).join(', ') || '—'}
                  </td>
                  <td>
                    ${(Number(inv.amount) + Number(inv.late_fee ?? 0)).toLocaleString()}
                    {inv.late_fee > 0 && (
                      <span className="tag bad tiny" style={{ marginLeft: 6 }}>+${inv.late_fee} late</span>
                    )}
                  </td>
                  <td className="small">{new Date(inv.due_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`tag ${inv.status === 'paid' ? 'good' : overdue ? 'bad' : 'gold'}`}>
                      {inv.status === 'paid' ? 'paid' : overdue ? 'overdue' : 'open'}
                    </span>
                  </td>
                  <td>
                    {inv.status !== 'paid' && (
                      <button className="btn oxblood sm" onClick={() => pay(inv)}>Pay now</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="muted">No invoices yet.</td></tr>
            )}
          </tbody>
        </table>
        <p className="muted tiny" style={{ marginTop: 8 }}>
          Billed monthly. Card processing connects via Stripe; "Pay now" records the payment for now.
        </p>
      </div>

      <div className="grid two">
        <div className="card">
          <h3>Document orders</h3>
          <p className="small muted" style={{ marginTop: 0 }}>
            Ordered records are billed on your next cycle.
          </p>
          {orders.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between',
              padding: '6px 0', borderBottom: '1px solid var(--paper-2)' }}>
              <span className="small">{(o.type ?? '').replace(/_/g, ' ')} · ${o.cost}</span>
              <span className={`tag tiny ${o.billed ? 'soft' : 'gold'}`}>
                {o.billed ? 'billed' : 'next cycle'}
              </span>
            </div>
          ))}
          {orders.length === 0 && <span className="muted small">No orders yet.</span>}
          {unpaidOrders.length > 0 && (
            <p className="muted tiny" style={{ marginTop: 8 }}>
              {unpaidOrders.length} order(s) will appear on your next invoice.
            </p>
          )}
        </div>

        <div className="card">
          <h3>Subscription</h3>
          <p className="small">Cancel anytime with 30 days' notice.</p>
          {!practice.cancel_notice_at
            ? <button className="btn ghost sm" onClick={cancel}>
                Request cancellation (30-day notice)
              </button>
            : <span className="tag warn">Cancellation pending</span>}
        </div>
      </div>
    </>
  );
}
