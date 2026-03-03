import { Home, Map, Library, PlusCircle, LogOut, User, Settings } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { icon: Home,       label: 'Home',     path: '/' },
  { icon: PlusCircle, label: 'Explore',  path: '/create' },
  { icon: Library,    label: 'Library',  path: '/library' },
  { icon: Map,        label: 'Map',      path: '#' },
  { icon: User,       label: 'Profile',  path: '/profile' },
  { icon: Settings,   label: 'Settings', path: '/settings' },
];

const VerticalNavbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="fixed left-0 top-0 h-full w-16 bg-white border-r border-gray-100 z-50 flex flex-col items-center py-6">
      {/* Logo */}
      <Link to="/" className="mb-8">
        <div className="w-7 h-7 border border-black rotate-45 flex items-center justify-center hover:border-yggen-teal transition-colors">
          <div className="w-1.5 h-1.5 bg-yggen-teal rounded-full" />
        </div>
      </Link>

      {/* Nav Items */}
      <div className="flex-1 flex flex-col gap-5 items-center">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = path !== '#' && location.pathname === path;
          return (
            <Link
              key={label}
              to={path}
              title={label}
              className={`flex flex-col items-center gap-1 group transition-colors ${isActive ? 'text-black' : 'text-gray-300 hover:text-black'}`}
            >
              <Icon className="w-4 h-4" strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[8px] tracking-widest uppercase">{label}</span>
            </Link>
          );
        })}
      </div>

      {/* User + Logout at bottom */}
      <div className="flex flex-col items-center gap-3 mt-auto">
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.display_name || 'User'}
            title={user.display_name || user.email}
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div title={user?.display_name || user?.email || 'User'}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-gray-400" />
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Sign out"
          className="text-gray-300 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
};

export default VerticalNavbar;
