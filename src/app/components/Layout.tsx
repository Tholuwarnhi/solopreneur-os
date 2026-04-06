import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import {
  Home,
  DollarSign,
  Users,
  Briefcase,
  FileText,
  Target,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  Camera,
  Pen,
} from 'lucide-react';
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/finance', label: 'Finance', icon: DollarSign },
  { path: '/clients', label: 'Clients', icon: Users },
  { path: '/projects', label: 'Projects', icon: Briefcase },
  { path: '/invoice', label: 'Invoices', icon: FileText },
  { path: '/scanner', label: 'Scanner', icon: Camera },
  { path: '/signature', label: 'Signatures', icon: Pen },
  { path: '/goals', label: 'Goals', icon: Target },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const { user, logout } = useAuth();

  const userName =
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "User";

  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 18
      ? "Good afternoon"
      : "Good evening";

  const handleLogout = () => {
    logout(); // ✅ important
    navigate('/login');
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ backgroundColor: '#FAFAF8' }}>
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 flex flex-col`}
        style={{ backgroundColor: '#0F1B2D' }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: '#10B981' }}
              >
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-white">Solopreneur OS</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <Menu className="w-5 h-5 text-white" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-3 mb-2 rounded-xl transition-all ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-white/60 hover:bg-white/5 hover:text-white/80 transition-all"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8">
          <div>
            <p className="text-xl font-semibold" style={{ color: '#0F1B2D' }}>
              {greeting}, {userName}!
            </p>
            <p className="text-sm text-gray-500">
              {new Date().toDateString()}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5" style={{ color: '#0F1B2D' }} />
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ backgroundColor: '#10B981' }}
              ></span>
            </button>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium" style={{ color: '#0F1B2D' }}>
                  {userName}
                </p>
                <p className="text-xs text-gray-500">Solopreneur</p>
              </div>

              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white"
                style={{ backgroundColor: '#10B981' }}
              >
                {userName[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}