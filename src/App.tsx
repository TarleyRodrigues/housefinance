// src/App.tsx
import type { ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import ResetPassword from './pages/ResetPassword';

// Componente para proteger rotas (só acessa se estiver logado)
const PrivateRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" role="status" aria-label="Carregando">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate replace to="/login" />;
};

function AppRoutes() {
  const { passwordRecovery, user } = useAuth();
  if (passwordRecovery && user) return <ResetPassword />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-blue-100">
          <AppRoutes />
        </div>
      </HashRouter>
    </AuthProvider>
  );
}
