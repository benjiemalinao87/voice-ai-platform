import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard,
  CalendarRange,
  PhoneCall,
  Sparkles,
  Megaphone,
  Headset,
  SlidersHorizontal,
  Globe, 
  Moon, 
  Sun, 
  LogOut, 
  User,
  ChevronRight,
  ChevronLeft,
  Book,
  ExternalLink,
  BarChart2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type View = 'dashboard' | 'config' | 'recordings' | 'settings' | 'flow' | 'intent' | 'livechat' | 'board' | 'appointments' | 'standalone_dashboard' | 'leads' | 'assistant_analytics';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  embeddingSettings: {
    url: string | null;
    buttonName: string | null;
    isEnabled: boolean;
  };
  setShowEmbeddingModal: (show: boolean) => void;
  setSelectedAgentId: (id: string | undefined) => void;
}

export function Sidebar({ 
  currentView, 
  setCurrentView, 
  darkMode, 
  toggleDarkMode,
  embeddingSettings,
  setShowEmbeddingModal,
  setSelectedAgentId
}: SidebarProps) {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    // Default to true (collapsed) if not saved
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => {
    setIsCollapsed(prev => !prev);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'appointments', label: 'Appointment by AI', icon: CalendarRange },
    { id: 'recordings', label: 'Recordings', icon: PhoneCall },
    { id: 'assistant_analytics', label: 'Assistant Analytics', icon: BarChart2 },
    { id: 'intent', label: 'Intent Analysis', icon: Sparkles },
    { id: 'leads', label: 'Outbound Campaign', icon: Megaphone },
    { 
      id: 'config', 
      label: 'Voice Agents', 
      icon: Headset,
      onClick: () => setSelectedAgentId(undefined) 
    },
    { id: 'settings', label: 'Settings', icon: SlidersHorizontal },
  ];

  return (
    <div 
      className={`flex flex-col h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Logo Section */}
      <div className={`p-6 flex items-center border-b border-gray-200 dark:border-gray-700 relative h-[88px] ${isCollapsed ? 'justify-center' : 'justify-center'}`}>
        {isCollapsed ? (
           <img
            src="https://channelautomation.com/wp-content/uploads/2022/11/logofooter2.png"
            alt="Channel Automation"
            className="h-8 w-8 object-contain object-left overflow-hidden"
          />
        ) : (
          <img
            src="https://channelautomation.com/wp-content/uploads/2022/11/logofooter2.png"
            alt="Channel Automation"
            className="h-8 w-auto object-contain transition-all duration-300"
          />
        )}
        
        <button
          onClick={toggleSidebar}
          className={`absolute -right-3 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 shadow-sm z-10 hover:scale-110 transition-all duration-200`}
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2 scrollbar-hide">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setCurrentView(item.id as View);
              item.onClick?.();
            }}
            title={isCollapsed ? item.label : ''}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
              currentView === item.id
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
            } ${isCollapsed ? 'justify-center' : ''}`}
          >
            <item.icon className={`flex-shrink-0 w-5 h-5 transition-colors ${currentView === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300'}`} />
            
            {!isCollapsed && (
              <>
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
                {currentView === item.id && (
                  <ChevronRight className="w-4 h-4 ml-auto text-blue-600 dark:text-blue-400 opacity-50" />
                )}
              </>
            )}
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            )}
          </button>
        ))}

        {/* Optional Embedding Button */}
        {embeddingSettings.isEnabled && embeddingSettings.buttonName && embeddingSettings.url && (
          <button
            onClick={() => setShowEmbeddingModal(true)}
            title={isCollapsed ? embeddingSettings.buttonName : ''}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-dashed border-blue-200 dark:border-blue-800 group relative ${isCollapsed ? 'justify-center' : ''}`}
          >
            <Globe className="flex-shrink-0 w-5 h-5" />
            {!isCollapsed && (
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">{embeddingSettings.buttonName}</span>
            )}
             {/* Tooltip for collapsed state */}
             {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {embeddingSettings.buttonName}
              </div>
            )}
          </button>
        )}

        {/* Divider */}
        <div className="my-4 border-t border-gray-200 dark:border-gray-700" />

        {/* API Documentation Link */}
        <a
          href="/api-docs"
          target="_blank"
          rel="noopener noreferrer"
          title={isCollapsed ? 'API Documentation' : ''}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200 ${isCollapsed ? 'justify-center' : ''}`}
        >
          <Book className="flex-shrink-0 w-5 h-5 text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
          
          {!isCollapsed && (
            <>
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">API Docs</span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto text-gray-400 dark:text-gray-500" />
            </>
          )}
          
          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              API Docs
            </div>
          )}
        </a>
      </div>

      {/* Bottom Actions Section */}
      <div className={`p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 space-y-4 ${isCollapsed ? 'px-2' : ''}`}>
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          title={isCollapsed ? (darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode') : ''}
          className={`w-full flex items-center rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${isCollapsed ? 'justify-center p-2' : 'justify-between px-4 py-2'}`}
        >
          <span className="flex items-center gap-3">
            {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            {!isCollapsed && (darkMode ? 'Dark Mode' : 'Light Mode')}
          </span>
          {!isCollapsed && (
            <div className={`w-8 h-4 rounded-full relative transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          )}
        </button>

        {/* User Profile */}
        <div className={`flex items-center pt-2 ${isCollapsed ? 'flex-col gap-4 justify-center' : 'justify-between'}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {user?.name || 'User'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500 truncate">
                  {user?.email}
                </span>
              </div>
            </div>
          ) : (
             <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0" title={user?.email}>
                <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          )}
          
          <button
            onClick={logout}
            className={`text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ${isCollapsed ? 'p-2 w-full flex justify-center' : 'p-2'}`}
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
