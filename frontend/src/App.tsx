import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ExpeditionLayout from './layouts/ExpeditionLayout';
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

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/auth/callback" element={<GoogleCallback />} />

          {/* Landing is public (search visible, but expedition creation requires auth) */}
          <Route path="/" element={<LandingPage />} />

          {/* Protected expedition routes */}
          <Route element={
            <ProtectedRoute>
              <ExpeditionLayout />
            </ProtectedRoute>
          }>
            <Route path="/create" element={<CreateExpedition />} />
            <Route path="/learn/:id" element={<LearningMode />} />
            <Route path="/map/:id" element={<MapMode />} />
            <Route path="/library" element={<Library />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
              <h1 className="text-4xl text-yggen-teal mb-4">404 — LOST IN THE VOID</h1>
              <a href="/" className="underline hover:text-yggen-teal">Return to Safety</a>
            </div>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
