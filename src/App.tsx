import { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Calendar } from 'lucide-react';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { AgentConfig } from './components/AgentConfig';
import { Recordings } from './components/Recordings';
import { FlowBuilder } from './components/FlowBuilder';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { LandingPage } from './components/LandingPage';
import { IntentDashboard } from './components/IntentDashboard';
import { LiveChat } from './components/LiveChat';
import { BoardView } from './components/BoardView';
import { LiveCallFeed } from './components/LiveCallFeed';
import { VoiceAgentsList } from './components/VoiceAgentsList';
import { CreateAgentModal } from './components/CreateAgentModal';
import { WhatsNew } from './components/WhatsNew';
import { AppointmentsByAI } from './components/AppointmentsByAI';
import { EmbeddingModal } from './components/EmbeddingModal';
import { StandaloneDashboard } from './components/StandaloneDashboard';
import { AgentFlowCreator } from './components/AgentFlowCreator';
import { Leads } from './components/Leads';
import { Sidebar, View } from './components/Sidebar';
import { AssistantAnalytics } from './components/AssistantAnalytics';
import ApiDocs from './components/ApiDocs';
import { useAuth } from './contexts/AuthContext';
import { useVapi } from './contexts/VapiContext';
import { agentApi } from './lib/api';
import { d1Client } from './lib/d1';
import type { Agent, AgentCreateData } from './types';

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const { vapiClient, selectedOrgId, selectedWorkspaceId, setSelectedWorkspaceId } = useVapi();

  // Check URL for special routes
  const isLandingPage = window.location.pathname === '/landing';
  const isApiDocs = window.location.pathname === '/api-docs';
  const isFlowBuilder = window.location.pathname === '/flow-builder';
  const isAgentCreator = window.location.pathname === '/agents/create';
  const isAgentEditor = window.location.pathname.startsWith('/agents/edit/');
  const editAgentId = isAgentEditor ? window.location.pathname.split('/agents/edit/')[1] : undefined;
  const isAssistantAnalytics = window.location.pathname === '/assistants';

  const [currentView, setCurrentView] = useState<View>(() => {
    // Always default to dashboard on initial mount
    // We'll restore saved view only after authentication is confirmed
    if (isFlowBuilder) return 'flow';
    return 'dashboard';
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [wideView, setWideView] = useState(() => {
    const saved = localStorage.getItem('wideView');
    // Default to true (wide mode) if not set
    return saved === null ? true : saved === 'true';
  });
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString()
  });
  const [embeddingSettings, setEmbeddingSettings] = useState<{
    url: string | null;
    buttonName: string | null;
    isEnabled: boolean;
  }>({ url: null, buttonName: null, isEnabled: false });
  const [showEmbeddingModal, setShowEmbeddingModal] = useState(false);

  // Reload agents when API client, selected org, or workspace changes
  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
      loadEmbeddingSettings();
    }
  }, [vapiClient, selectedOrgId, selectedWorkspaceId, isAuthenticated]);

  // Listen for embedding settings updates
  useEffect(() => {
    const handleEmbeddingUpdate = () => {
      loadEmbeddingSettings();
    };
    window.addEventListener('embeddingSettingsUpdated', handleEmbeddingUpdate);
    return () => {
      window.removeEventListener('embeddingSettingsUpdated', handleEmbeddingUpdate);
    };
  }, []);

  const loadEmbeddingSettings = async () => {
    try {
      const settings = await d1Client.getEmbeddingSettings();
      setEmbeddingSettings(settings);
    } catch (error) {
      console.error('Error loading embedding settings:', error);
      setEmbeddingSettings({ url: null, buttonName: null, isEnabled: false });
    }
  };

  // Save current view to localStorage when it changes
  useEffect(() => {
    if (isAuthenticated && currentView !== 'flow') {
      localStorage.setItem('currentView', currentView);
    }
  }, [currentView, isAuthenticated]);

  // Track if we've handled initial auth state (to distinguish fresh login from page refresh)
  const hasHandledInitialAuth = useRef(false);
  const prevAuthenticatedRef = useRef(isAuthenticated);
  // Track if there was a token on mount (indicates page refresh vs fresh login)
  const hadTokenOnMount = useRef(!!localStorage.getItem('auth_token'));

  // Handle view restoration and login redirect
  useEffect(() => {
    // Skip on initial mount if still loading
    if (isLoading) return;

    if (isAuthenticated) {
      // Check if this is a transition from unauthenticated to authenticated
      const wasUnauthenticated = !prevAuthenticatedRef.current;

      if (!hasHandledInitialAuth.current) {
        // First time handling authentication
        hasHandledInitialAuth.current = true;

        if (hadTokenOnMount.current) {
          // Page refresh scenario - restore saved view if exists
          const savedView = localStorage.getItem('currentView');
          if (savedView && ['dashboard', 'config', 'recordings', 'settings', 'intent', 'livechat', 'board', 'appointments', 'standalone_dashboard', 'leads'].includes(savedView) && currentView !== savedView) {
            setCurrentView(savedView as View);
          }
        } else {
          // Fresh login - always go to dashboard
          localStorage.removeItem('currentView');
          setCurrentView('dashboard');
        }
      } else if (wasUnauthenticated) {
        // User just logged in (transition from false to true after initial handling)
        // This handles the case where user logs in after being logged out
        localStorage.removeItem('currentView');
        setCurrentView('dashboard');
      }
      prevAuthenticatedRef.current = true;
    } else {
      // User logged out
      hasHandledInitialAuth.current = false;
      prevAuthenticatedRef.current = false;
      hadTokenOnMount.current = false;
      localStorage.removeItem('currentView');
      if (currentView !== 'dashboard' && currentView !== 'flow') {
        setCurrentView('dashboard');
      }
    }
  }, [isAuthenticated, isLoading, currentView]);


  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  const loadAgents = async () => {
    try {
      // IMPORTANT: Pass user-specific vapiClient and filter options to ensure data isolation
      const data = await agentApi.getAll(vapiClient, selectedOrgId ? { orgId: selectedOrgId } : undefined);
      setAgents(data);
      // Don't auto-select first agent - let users start with "All Agents"
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const handleCreateAgent = async (agentData: AgentCreateData, webhookUrl?: string) => {
    if (!vapiClient) {
      throw new Error('API client not initialized');
    }

    try {
      const newAgent = await agentApi.create(agentData, vapiClient, webhookUrl);
      setShowCreateAgentModal(false);

      // Reload agents list from VAPI to get real-time data
      await loadAgents();

      // Select the newly created agent
      setSelectedAgentId(newAgent.id);
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!vapiClient) {
      throw new Error('API client not initialized');
    }

    try {
      await agentApi.delete(agentId, vapiClient);

      // Clear selection if the deleted agent was selected
      if (selectedAgentId === agentId) {
        setSelectedAgentId(undefined);
      }

      // Reload agents list from VAPI to get real-time data
      await loadAgents();
    } catch (error) {
      console.error('Error deleting agent:', error);
      alert('Failed to delete agent. Please try again.');
    }
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  // Landing page is public - render without auth check
  if (isLandingPage) {
    return <LandingPage />;
  }

  // API docs page is public - render without auth check
  if (isApiDocs) {
    return <ApiDocs />;
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // If flow builder route, render only that
  if (isFlowBuilder) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900">
        <FlowBuilder />

        {/* Floating Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-110 transition-all duration-200 z-50"
          aria-label="Toggle dark mode"
          type="button"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    );
  }

  // If agent creator route, render the visual flow creator
  if (isAgentCreator) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <AgentFlowCreator
          onBack={() => {
            window.location.href = '/';
          }}
          onSuccess={() => {
            // Navigate back - page reload will trigger agents list refresh
            window.location.href = '/';
          }}
        />

        {/* Floating Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-110 transition-all duration-200 z-50"
          aria-label="Toggle dark mode"
          type="button"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    );
  }

  // If agent editor route, render the visual flow creator in edit mode
  if (isAgentEditor && editAgentId) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <AgentFlowCreator
          editAgentId={editAgentId}
          onBack={() => {
            window.location.href = '/';
          }}
          onSuccess={() => {
            // Navigate back - page reload will trigger agents list refresh
            window.location.href = '/';
          }}
        />

        {/* Floating Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-110 transition-all duration-200 z-50"
          aria-label="Toggle dark mode"
          type="button"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    );
  }

  // If assistant analytics route, render the analytics page
  if (isAssistantAnalytics) {
    return (
      <div className={`h-screen flex bg-gray-50 dark:bg-gray-900 overflow-hidden ${darkMode ? 'dark' : ''}`}>
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          embeddingSettings={embeddingSettings}
          setShowEmbeddingModal={setShowEmbeddingModal}
          setSelectedAgentId={setSelectedAgentId}
        />
        <main className="flex-1 overflow-y-auto">
          <AssistantAnalytics />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* What's New Announcement */}
      <WhatsNew />

      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        embeddingSettings={embeddingSettings}
        setShowEmbeddingModal={setShowEmbeddingModal}
        setSelectedAgentId={setSelectedAgentId}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className={`${wideView ? 'w-full' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300`}>
          {currentView === 'dashboard' && (
            <div className="space-y-6">
              {/* Dashboard Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Performance Metrics</h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Viewing metrics for all agents
                  </p>
                </div>

                {/* Only keep date range selector here */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <select
                    aria-label="Date range"
                    defaultValue="14"
                    onChange={(e) => {
                      const days = parseInt(e.target.value);
                      setDateRange({
                        from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                        to: new Date().toISOString()
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="7">Last 7 days</option>
                    <option value="14">Last 14 days</option>
                  </select>
                </div>
              </div>

              <LiveCallFeed />

              <PerformanceDashboard
                selectedAgentId={undefined}
                dateRange={dateRange}
              />
            </div>
          )}

          {currentView === 'appointments' && (
            <AppointmentsByAI />
          )}

          {currentView === 'recordings' && (
            <Recordings />
          )}

          {currentView === 'intent' && (
            <div className="space-y-6">
              <IntentDashboard />
            </div>
          )}

          {currentView === 'leads' && (
            <Leads />
          )}

          {currentView === 'livechat' && (
            <LiveChat />
          )}

          {currentView === 'board' && (
            <BoardView />
          )}

          {currentView === 'config' && selectedAgentId && selectedAgent && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => setSelectedAgentId(undefined)}
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                    >
                      ← Back to Agents
                    </button>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Agent Configuration</h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Configure voice, behavior, and prompts for {selectedAgent.name}
                  </p>
                </div>
              </div>

              <AgentConfig agentId={selectedAgentId} />
            </div>
          )}

          {currentView === 'config' && (!selectedAgentId || selectedAgentId === '') && (
            <VoiceAgentsList
              agents={agents}
              onSelectAgent={(agentId) => setSelectedAgentId(agentId)}
              onCreateAgent={() => setShowCreateAgentModal(true)}
              onDeleteAgent={handleDeleteAgent}
            />
          )}

          {currentView === 'settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Configure your API credentials and preferences
                </p>
              </div>

              <Settings wideView={wideView} onWideViewChange={setWideView} />
            </div>
          )}
        </div>
      </main>

      {currentView === 'standalone_dashboard' && (
        <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="fixed top-4 right-4 z-50 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-md transition-colors"
          >
            Exit Demo
          </button>
          <StandaloneDashboard />
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreateAgentModal && (
        <CreateAgentModal
          onClose={() => setShowCreateAgentModal(false)}
          onCreate={handleCreateAgent}
        />
      )}

      {/* Embedding Modal */}
      {showEmbeddingModal && embeddingSettings.url && (
        <EmbeddingModal
          isOpen={showEmbeddingModal}
          onClose={() => setShowEmbeddingModal(false)}
          initialUrl={embeddingSettings.url || ''}
          initialButtonName={embeddingSettings.buttonName || ''}
          onUrlSaved={(url, buttonName) => {
            setEmbeddingSettings({ ...embeddingSettings, url, buttonName });
            loadEmbeddingSettings();
          }}
        />
      )}
    </div>
  );
}

export default App;
