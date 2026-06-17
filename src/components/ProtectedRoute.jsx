import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

// Supabase-backed route gate. While the session is resolving, show a spinner;
// once resolved, render the nested routes for an authenticated user, or send an
// unauthenticated user to /login exactly once. `replace` keeps it out of history
// and there is no ever-growing ?from_url query param (the old 431-loop cause).
export default function ProtectedRoute({ fallback = <DefaultFallback /> }) {
  const { user, loading } = useAuth();

  if (loading) return fallback;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
