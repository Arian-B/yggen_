import { Home, Map, Library, PlusCircle, LogOut, User, Settings } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';

const staticNavItems = [
  { icon: Home,       label: 'Home',     path: '/' },
  { icon: PlusCircle, label: 'Explore',  path: '/create' },
  { icon: Library,    label: 'Library',  path: '/library' },
  { icon: User,       label: 'Profile',  path: '/profile' },
  { icon: Settings,   label: 'Settings', path: '/settings' },
];

const VerticalNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [mapPath, setMapPath] = useState<string | null>(null);

  useEffect(() => {
    const mapMatch = location.pathname.match(/^\/map\/(.+)$/);
    if (mapMatch) { setMapPath(location.pathname); return; }

    const learnMatch = location.pathname.match(/^\/learn\/(.+)$/);
    if (learnMatch) {
      const ctx = localStorage.getItem('wikiyggen_current_expedition');
      if (ctx) {
        try {
          const { expedition_id } = JSON.parse(ctx);
          if (expedition_id) { setMapPath(`/map/${expedition_id}`); return; }
        } catch { /* ignore */ }
      }
      setMapPath(null);
      return;
    }

    setMapPath(null);
  }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isMapActive = location.pathname.startsWith('/map/');

  return (
    <nav className="fixed left-0 top-0 h-full w-16 bg-white dark:bg-zinc-900 border-r border-gray-100 dark:border-zinc-800 z-50 flex flex-col items-center py-6 transition-colors duration-200">
      {/* Logo */}
      <Link to="/" className="mb-8">
        <div className="w-7 h-7 border border-black dark:border-zinc-400 rotate-45 flex items-center justify-center hover:border-yggen-teal transition-colors">
          <div className="w-1.5 h-1.5 bg-yggen-teal rounded-full" />
        </div>
      </Link>

      {/* Static Nav Items */}
      <div className="flex-1 flex flex-col gap-5 items-center">
        {staticNavItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={label}
              to={path}
              title={label}
              className={`flex flex-col items-center gap-1 group transition-colors
                ${isActive
                  ? 'text-black dark:text-white'
                  : 'text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'}`}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[8px] tracking-widest uppercase">{label}</span>
            </Link>
          );
        })}

        {/* Map — context-aware */}
        {mapPath ? (
          <Link
            to={mapPath}
            title="Galaxy Map"
            className={`flex flex-col items-center gap-1 transition-colors
              ${isMapActive
                ? 'text-black dark:text-white'
                : 'text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white'}`}
          >
            <Map className="w-4 h-4" strokeWidth={isMapActive ? 2.5 : 1.5} />
            <span className="text-[8px] tracking-widest uppercase">Map</span>
          </Link>
        ) : (
          <div
            title="Map — open an expedition first"
            className="flex flex-col items-center gap-1 text-gray-400 dark:text-zinc-600 opacity-60 cursor-not-allowed select-none"
          >
            <Map className="w-4 h-4" strokeWidth={1.5} />
            <span className="text-[8px] tracking-widest uppercase">Map</span>
          </div>
        )}
      </div>

      {/* User avatar + logout */}
      <div className="flex flex-col items-center gap-3 mt-auto">
        {user?.avatar_url ? (
          <Link to="/profile">
            <img
              src={user.avatar_url}
              alt={user.display_name || 'User'}
              title={user.display_name || user.email}
              className="w-7 h-7 rounded-full object-cover hover:ring-2 hover:ring-yggen-teal transition-all"
            />
          </Link>
        ) : (
          <Link
            to="/profile"
            title={user?.display_name || user?.email || 'Profile'}
            className="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <User className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-400" />
          </Link>
        )}
        <button
          onClick={handleLogout}
          title="Sign out"
          className="text-gray-500 dark:text-zinc-400 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
};

export default VerticalNavbar;
