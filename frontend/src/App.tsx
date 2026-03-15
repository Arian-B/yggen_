import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ExpeditionLayout from './layouts/ExpeditionLayout';
import VerticalNavbar from './components/layout/VerticalNavbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GoogleCallback from './pages/GoogleCallback';
import CreateExpedition from './pages/CreateExpedition';
import LearningMode from './pages/LearningMode';
import MapMode from './pages/MapMode';
import Library from './pages/Library';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import { useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Shows navbar for authenticated users on ALL routes (including public landing page)
const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return (
    <>
      {isAuthenticated && <VerticalNavbar />}
      <div
        style={{ paddingLeft: isAuthenticated ? '64px' : 0 }}
        className="transition-colors duration-200"
      >
        {children}
      </div>
    </>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <Router>
        <AppShell>
          <Routes>
            {/* Public routes */}
            <Route path="/login"          element={<LoginPage />} />
            <Route path="/register"       element={<RegisterPage />} />
            <Route path="/auth/callback"  element={<GoogleCallback />} />

            {/* Landing — public but search requires auth */}
            <Route path="/" element={<LandingPage />} />

            {/* Protected expedition routes (ExpeditionLayout already has VerticalNavbar,
                but AppShell's navbar is fixed so we just need the outlet layout) */}
            <Route element={
              <ProtectedRoute>
                <ExpeditionLayout />
              </ProtectedRoute>
            }>
              <Route path="/create"       element={<CreateExpedition />} />
              <Route path="/learn/:id"    element={<LearningMode />} />
              <Route path="/map/:id"      element={<MapMode />} />
              <Route path="/library"      element={<Library />} />
              <Route path="/profile"      element={<ProfilePage />} />
              <Route path="/settings"     element={<SettingsPage />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={
              <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
                <h1 className="text-4xl text-yggen-teal mb-4">404 — LOST IN THE VOID</h1>
                <a href="/" className="underline hover:text-yggen-teal">Return to Safety</a>
              </div>
            } />
          </Routes>
        </AppShell>
      </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

