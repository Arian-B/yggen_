import { Home, Map, Database, Settings, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

const VerticalNavbar = () => {
  // Mobile menu state reserved for future implementation
  // const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Map, label: 'New Expedition', path: '/create' },
    { icon: Database, label: 'Knowledge Graph', path: '/create' }, 
    { icon: Settings, label: 'Config', path: '/' },
  ];

  return (
    <>
      <nav className="fixed left-0 top-0 h-full w-24 bg-white border-r border-gray-100 z-50 flex flex-col items-center py-10">
        <div className="mb-16">
           <div className="w-10 h-10 border border-black rotate-45 flex items-center justify-center">
              <div className="w-2 h-2 bg-yggen-teal rounded-full" />
           </div>
        </div>

        <div className="flex-1 flex flex-col gap-12 w-full items-center">
            {/* Writing Mode Vertical for minimal text layout */}
            <div className="flex flex-col gap-8 items-center" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
              {navItems.map((item, index) => (
                <Link 
                  key={index} 
                  to={item.path} 
                  className="py-4 text-xs tracking-widest uppercase text-gray-400 hover:text-black hover:border-r-2 hover:border-yggen-teal transition-all duration-300"
                >
                  {item.label}
                </Link>
              ))}
            </div>
        </div>
      </nav>
    </>
  );
};

export default VerticalNavbar;
