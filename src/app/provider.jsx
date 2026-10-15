import { ToastProvider } from '@/components/ui/toast/toast-provider';
import { AuthProvider } from '@/features/auth';

export function AppProvider({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
