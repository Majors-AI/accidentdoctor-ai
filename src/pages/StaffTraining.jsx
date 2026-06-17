import { useAuth } from '@/lib/AuthContext';
import AdminTrainingView from '@/components/training/AdminTrainingView';
import StaffTrainingView from '@/components/training/StaffTrainingView';

export default function StaffTraining() {
  const { user } = useAuth();
  const isAdmin = user?.app_role === 'practice_admin';

  return isAdmin ? <AdminTrainingView /> : <StaffTrainingView />;
}