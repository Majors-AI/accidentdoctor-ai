import { useState } from 'react';
import { supabase, hasSupabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('attorney@accidentdoctor.ai');
  const [pw, setPw] = useState('TestPass123!');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function go() {
    setErr(''); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  }

  return (
    <div className="auth">
      <div className="box">
        <div className="brand">Accident Doctor<span style={{color:'var(--oxblood)'}}>.ai</span>
          <small>Case Intelligence</small></div>
        <h1>Sign in</h1>
        <p className="muted small" style={{marginTop:0}}>Personal-injury case management.</p>

        {!hasSupabase && <div className="banner">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your
          .env file (Supabase → Settings → API), then run the seed.
        </div>}
        {hasSupabase && <div className="banner">
          Seeded logins (password <b>TestPass123!</b>):
          provider@ · frontdesk@ · billing@ · admin@ · super@ accidentdoctor.ai
        </div>}

        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()} />
        {err && <div className="err">{err}</div>}
        <button className="btn oxblood" style={{width:'100%',marginTop:18}} disabled={busy||!hasSupabase} onClick={go}>
          {busy?'Signing in…':'Sign in'}
        </button>
      </div>
    </div>
  );
}
