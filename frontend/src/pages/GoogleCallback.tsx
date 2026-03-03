/**
 * GoogleCallback — handles the redirect from our backend after Google OAuth.
 * Backend redirects to /auth/callback#token=xxx&user_id=yyy&display_name=zzz
 * We parse the hash, store the JWT, and redirect to the app.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:8000/api';

const GoogleCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const hash = window.location.hash.substring(1); // remove #
    const params = new URLSearchParams(hash);
    const token = params.get('token');
    const user_id = params.get('user_id');
    const display_name = params.get('display_name') || '';

    if (!token || !user_id) {
      navigate('/login?error=callback_failed');
      return;
    }

    // Fetch full user profile with the token
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(user => {
        login(token, {
          user_id: user.user_id,
          email: user.email,
          display_name: user.display_name || display_name,
          avatar_url: user.avatar_url,
          total_xp: user.total_xp,
          level: user.level
        });
        navigate('/');
      })
      .catch(() => navigate('/login?error=callback_failed'));
  }, [login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-yggen-teal animate-pulse text-xs tracking-widest uppercase">
        Completing sign in...
      </div>
    </div>
  );
};

export default GoogleCallback;
