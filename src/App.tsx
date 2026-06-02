import { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase, hasSupabase } from './lib/supabase';
import Login from './pages/Login';
import Layout from './components/Layout';
import PatientList from './pages/staff/PatientList';
import ChartDetail from './pages/staff/ChartDetail';
import Referrals from './pages/staff/Referrals';
import NewReferral from './pages/staff/NewReferral';
import Schedule from './pages/staff/Schedule';
import Practices from './pages/admin/Practices';
import Account from './pages/firm/Account';
import Billing from './pages/staff/Billing';

export type PracticeRole =
  | 'front_desk' | 'provider' | 'billing_staff'
  | 'practice_admin' | 'platform_admin';

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: PracticeRole;
  practice_id: string | null;
  is_platform_admin: boolean;
};

type Ctx = { profile: Profile | null; loading: boolean; signOut: () => void };
const AuthCtx = createContext<Ctx>({ profile: null, loading: true, signOut: () => {} });
export const useAuth = () => useContext(AuthCtx);

export const isPracticeStaff = (r?: string) =>
  ['front_desk','provider','billing_staff','practice_admin','platform_admin'].includes(r ?? '');

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading]  = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data as Profile);
    setLoading(false);
  }

  useEffect(() => {
    if (!hasSupabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadProfile(data.session.user.id);
      else setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) loadProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = () => supabase.auth.signOut();

  if (loading) return <div className="auth"><div className="muted">Loading…</div></div>;
  if (!profile) return <Login />;

  const superAdmin = profile.is_platform_admin;

  return (
    <AuthCtx.Provider value={{ profile, loading, signOut }}>
      <Layout>
        <Routes>
          {superAdmin ? (
            <>
              <Route path="/"           element={<Practices />} />
              <Route path="/practices"  element={<Practices />} />
              <Route path="*"           element={<Navigate to="/" />} />
            </>
          ) : (
            <>
              <Route path="/"                element={<PatientList />} />
              <Route path="/patients"        element={<PatientList />} />
              <Route path="/patients/:id"    element={<ChartDetail />} />
              <Route path="/referrals"       element={<Referrals />} />
              <Route path="/referrals/new"   element={<NewReferral />} />
              <Route path="/schedule"        element={<Schedule />} />
              <Route path="/billing"         element={<Billing />} />
              <Route path="/account"         element={<Account />} />
              <Route path="*"                element={<Navigate to="/" />} />
            </>
          )}
        </Routes>
      </Layout>
    </AuthCtx.Provider>
  );
}
