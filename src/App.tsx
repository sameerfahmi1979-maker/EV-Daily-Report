import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { Dashboard } from './components/Dashboard';
import { StagingBanner, logStagingWarningOnce } from './components/StagingBanner';
import InvoiceVerificationPage from './components/InvoiceVerificationPage';

function App() {
  const [showLogin, setShowLogin] = useState(true);
  const isStaging = import.meta.env.VITE_APP_ENV === 'staging';

  // Public invoice verification: ?verify=<token> bypasses login entirely —
  // scanning the QR code on an invoice must work for anyone, logged in or not.
  const verifyToken = new URLSearchParams(window.location.search).get('verify');

  useEffect(() => {
    logStagingWarningOnce();
    if (isStaging && typeof document !== 'undefined') {
      if (!document.title.includes('(Staging)')) {
        document.title = `${document.title} (Staging)`;
      }
    }
  }, [isStaging]);

  const toggleForm = () => {
    setShowLogin(!showLogin);
  };

  if (verifyToken) {
    return (
      <ThemeProvider>
        <InvoiceVerificationPage token={verifyToken} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
    <AuthProvider>
      <StagingBanner />
      <ProtectedRoute
        fallback={
          showLogin ? (
            <LoginForm onToggleForm={toggleForm} />
          ) : (
            <RegisterForm onToggleForm={toggleForm} />
          )
        }
      >
        <Dashboard />
      </ProtectedRoute>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
