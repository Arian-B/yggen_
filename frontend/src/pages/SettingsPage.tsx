import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, ExternalLink, LogOut, User, Mail, Loader2, Trash2, Camera, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAuthHeader } from '../services/api';
import { useTheme, type Theme } from '../context/ThemeContext';

const API_BASE = 'http://localhost:8000/api';

interface ConnectedAccount {
  connected: boolean;
  identifier?: string | null;
}
interface ConnectedAccounts {
  google: ConnectedAccount;
  wikipedia: ConnectedAccount;
  twitter: ConnectedAccount;
}

const PROVIDERS = [
  {
    key: 'google',
    label: 'Google',
    description: 'Sign in with Google and sync your Google profile',
    color: 'text-red-500',
    borderColor: 'border-red-100',
    connectPath: `${API_BASE}/auth/google`,
    logo: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    )
  },
  {
    key: 'wikipedia',
    label: 'Wikipedia',
    description: 'Link your Wikipedia account and show your editing history',
    color: 'text-gray-700',
    borderColor: 'border-gray-200',
    connectPath: `${API_BASE}/auth/wikipedia/connect`,
    logo: (
      <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center text-white font-serif text-xs font-bold">W</div>
    )
  },
  {
    key: 'twitter',
    label: 'X (Twitter)',
    description: 'Connect X to share your expedition discoveries',
    color: 'text-black',
    borderColor: 'border-gray-200',
    connectPath: '#', // Not yet configured — shown as "Coming soon"
    comingSoon: true,
    logo: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.944l7.729-8.835L2.5 2.25h6.944l4.261 5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  }
];

const SettingsPage = () => {
  const { user, logout, updateAvatar } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<ConnectedAccounts | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Parse URL params for connection feedback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const username = params.get('username');
    const error = params.get('error');

    if (connected) {
      setSuccessMsg(`Successfully connected ${connected}${username ? ` as @${username}` : ''}!`);
      window.history.replaceState({}, '', '/settings');
      loadAccounts();
    }
    if (error) {
      const msgs: Record<string, string> = {
        wikipedia_cancelled: 'Wikipedia connection was cancelled.',
        wikipedia_token_failed: 'Wikipedia connection failed. Try again.',
        wikipedia_no_profile: 'Could not fetch your Wikipedia profile.',
        wikipedia_server_error: 'Server error connecting Wikipedia.'
      };
      setErrorMsg(msgs[error] || 'Connection failed.');
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/connected-accounts`, {
        headers: getAuthHeader()
      });
      if (res.ok) setAccounts(await res.json());
    } catch { /* non-critical */ }
    finally { setLoadingAccounts(false); }
  };

  useEffect(() => { loadAccounts(); }, []);

  const handleDisconnect = async (provider: string) => {
    setDisconnecting(provider);
    try {
      const res = await fetch(`${API_BASE}/auth/connected-accounts/${provider}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      if (res.ok) {
        setSuccessMsg(`${provider} disconnected.`);
        loadAccounts();
      }
    } catch { /* no-op */ }
    finally { setDisconnecting(null); }
  };

  const handleConnect = (provider: typeof PROVIDERS[0]) => {
    if (provider.comingSoon) return;
    if (provider.key === 'wikipedia') {
      const token = localStorage.getItem('wikiyggen_token');
      window.location.href = `${provider.connectPath}?_token=${token}`;
    } else {
      window.location.href = provider.connectPath;
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleAvatarUpload = async () => {
    if (!selectedFile) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      const res = await fetch(`${API_BASE}/auth/avatar`, {
        method: 'POST',
        headers: getAuthHeader(),  // Bearer token only, no Content-Type (browser sets multipart boundary)
        body: form
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      updateAvatar(data.avatar_url);
      setPreviewUrl(null);
      setSelectedFile(null);
      setSuccessMsg('Profile picture updated!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Upload failed.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const avatarLetter = (user?.display_name || user?.email || 'U')[0].toUpperCase();
  const displayAvatar = previewUrl || user?.avatar_url;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-black dark:text-zinc-100 transition-colors duration-200">
      <div className="max-w-xl mx-auto px-6 pt-16 pb-24">

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold tracking-tighter mb-1">Settings</h1>
          <p className="text-sm text-black dark:text-zinc-400">Manage your account and connected services</p>
        </div>

        {/* Feedback banners */}
        <AnimatePresence>
          {successMsg && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {successMsg}
              <button onClick={() => setSuccessMsg('')} className="ml-auto"><XCircle className="w-3.5 h-3.5" /></button>
            </motion.div>
          )}
          {errorMsg && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm">
              <XCircle className="w-4 h-4 shrink-0" />
              {errorMsg}
              <button onClick={() => setErrorMsg('')} className="ml-auto"><XCircle className="w-3.5 h-3.5" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Appearance — theme picker */}
        <section className="mb-10 pb-10 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-xs uppercase tracking-widest text-black dark:text-zinc-550 mb-5">Appearance</h2>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'light',  label: 'Light',  Icon: Sun },
              { value: 'dark',   label: 'Dark',   Icon: Moon },
              { value: 'system', label: 'System', Icon: Monitor },
            ] as { value: Theme; label: string; Icon: any }[]).map(({ value, label, Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex flex-col items-center gap-2 py-4 border text-xs font-medium tracking-wide transition-all
                    ${ active
                      ? 'border-yggen-teal text-yggen-teal bg-yggen-dim-teal'
                      : 'border-gray-200 dark:border-zinc-700 text-black dark:text-zinc-400 hover:border-gray-400 dark:hover:border-zinc-500'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Profile card */}
        <section className="mb-10 pb-10 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-xs uppercase tracking-widest text-black dark:text-zinc-550 mb-5">Profile</h2>

          <div className="flex items-start gap-5">
            {/* Avatar + upload overlay */}
            <div className="relative group shrink-0">
              {displayAvatar ? (
                <img src={displayAvatar} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center text-2xl font-bold">
                  {avatarLetter}
                </div>
              )}
              {/* Camera overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Name + email + upload controls */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-3.5 h-3.5 text-black dark:text-zinc-400" />
                <span className="text-sm font-medium">{user?.display_name || 'Explorer'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-black dark:text-zinc-400" />
                <span className="text-sm text-black dark:text-zinc-450">{user?.email}</span>
              </div>

              {/* Upload controls — shown only when a file is selected */}
              {selectedFile && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-zinc-400 truncate max-w-[140px]">{selectedFile.name}</span>
                  <button
                    onClick={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="text-xs px-3 py-1.5 bg-yggen-teal text-white hover:shadow-[0_0_12px_#00ADB5] transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {uploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    {uploadingAvatar ? 'Uploading...' : 'Save photo'}
                  </button>
                  <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                    className="text-xs text-zinc-400 hover:text-red-400 transition-colors">
                    Cancel
                  </button>
                </div>
              )}
              {!selectedFile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 text-xs text-zinc-600 dark:text-zinc-400 hover:text-yggen-teal dark:hover:text-yggen-teal transition-colors underline underline-offset-2"
                >
                  Change profile picture
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Connected Accounts */}
        <section className="mb-10 pb-10 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-xs uppercase tracking-widest text-black dark:text-zinc-550 mb-5">Connected Accounts</h2>
          <p className="text-xs text-black dark:text-zinc-400 mb-6 leading-relaxed">
            Link external accounts to enhance your profile, enable single sign-on, and unlock platform-specific features.
          </p>

          {loadingAccounts ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading accounts...
            </div>
          ) : (
            <div className="space-y-3">
              {PROVIDERS.map(provider => {
                const info = accounts?.[provider.key as keyof ConnectedAccounts];
                const isConnected = info?.connected;

                return (
                  <motion.div
                    key={provider.key}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className={`flex items-center justify-between px-4 py-4 border ${provider.borderColor} ${provider.comingSoon ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {provider.logo}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{provider.label}</span>
                          {provider.comingSoon && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 uppercase tracking-widest">Soon</span>
                          )}
                          {isConnected && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-green-50 border border-green-200 text-green-600 uppercase tracking-widest">Connected</span>
                          )}
                        </div>
                        {isConnected && info?.identifier ? (
                          <div className="text-xs text-black dark:text-zinc-450 mt-0.5">{info.identifier}</div>
                        ) : (
                          <div className="text-xs text-black dark:text-zinc-450 mt-0.5">{provider.description}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {!provider.comingSoon && isConnected && (
                        <button
                          onClick={() => handleDisconnect(provider.key)}
                          disabled={disconnecting === provider.key}
                          title="Disconnect"
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          {disconnecting === provider.key
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      )}
                      {!provider.comingSoon && !isConnected && (
                        <button
                          onClick={() => handleConnect(provider)}
                          className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-black hover:text-black transition-all uppercase tracking-widest"
                        >
                          Connect
                        </button>
                      )}
                      {isConnected && (
                        <ExternalLink className="w-3.5 h-3.5 text-gray-300" />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>

        {/* Danger zone */}
        <section>
          <h2 className="text-xs uppercase tracking-widest text-black dark:text-zinc-550 mb-5">Account</h2>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-black dark:text-zinc-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out of wikiyggen_
          </button>
        </section>

      </div>
    </div>
  );
};

export default SettingsPage;
