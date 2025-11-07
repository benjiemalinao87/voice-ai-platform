import { useState, useEffect } from 'react';
import { BarChart3, Settings as SettingsIcon, Calendar, Moon, Sun, Mic, Brain, Bot } from 'lucide-react';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { AgentConfig } from './components/AgentConfig';
import { Recordings } from './components/Recordings';
import { FlowBuilder } from './components/FlowBuilder';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { IntentDashboard } from './components/IntentDashboard';
import { LiveChat } from './components/LiveChat';
import { BoardView } from './components/BoardView';
import { LiveCallFeed } from './components/LiveCallFeed';
import { VoiceAgentsList } from './components/VoiceAgentsList';
import { CreateAgentModal } from './components/CreateAgentModal';
import { WhatsNew } from './components/WhatsNew';
import { useAuth } from './contexts/AuthContext';
import { useVapi } from './contexts/VapiContext';
import { agentApi } from './lib/api';
import type { Agent } from './types';

type View = 'dashboard' | 'config' | 'recordings' | 'settings' | 'flow' | 'intent' | 'livechat' | 'board';

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const { vapiClient, selectedOrgId, selectedWorkspaceId, setSelectedWorkspaceId } = useVapi();

  // Check URL for flow builder route
  const isFlowBuilder = window.location.pathname === '/flow-builder';

  const [currentView, setCurrentView] = useState<View>(isFlowBuilder ? 'flow' : 'dashboard');
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
    return saved === 'true';
  });
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString()
  });

  // Reload agents when VAPI client, selected org, or workspace changes
  useEffect(() => {
    if (isAuthenticated) {
      loadAgents();
    }
  }, [vapiClient, selectedOrgId, selectedWorkspaceId, isAuthenticated]);


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

  const handleCreateAgent = async (agentData: Omit<Agent, 'id' | 'created_at' | 'updated_at' | 'api_key'>, webhookUrl?: string) => {
    if (!vapiClient) {
      throw new Error('VAPI client not initialized');
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
      throw new Error('VAPI client not initialized');
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

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* What's New Announcement */}
      <WhatsNew />

      {/* Fixed Header */}
      <nav className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <img
                  src="https://channelautomation.com/wp-content/uploads/2022/11/logofooter2.png"
                  alt="Channel Automation"
                  className="h-8 w-auto object-contain"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setCurrentView('dashboard')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                        currentView === 'dashboard'
                          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      <BarChart3 className="w-4 h-4" />
                      Dashboard
                    </button>
                    {/* <button
                      onClick={() => setCurrentView('board')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                        currentView === 'board'
                          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      <Columns className="w-4 h-4" />
                      Pipeline
                    </button> */}
                    <button
                      onClick={() => setCurrentView('recordings')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                        currentView === 'recordings'
                          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                      Recordings
                    </button>
                    <button
                      onClick={() => setCurrentView('intent')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                        currentView === 'intent'
                          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      <Brain className="w-4 h-4" />
                      Intent Analysis
                    </button>
                    {/* <button
                      onClick={() => setCurrentView('livechat')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                        currentView === 'livechat'
                          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      Live Chat
                    </button> */}
                    <button
                      onClick={() => {
                        setCurrentView('config');
                        // Always clear selected agent when clicking Voice Agents tab to show the list
                        setSelectedAgentId(undefined);
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                        currentView === 'config'
                          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      <Bot className="w-4 h-4" />
                      Voice Agents
                    </button>
                    <button
                      onClick={() => setCurrentView('settings')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
                        currentView === 'settings'
                          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                    >
                      <SettingsIcon className="w-4 h-4" />
                      Settings
                    </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className={`${wideView ? 'w-full' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-all duration-300`}>
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Performance Metrics</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Viewing metrics for all agents
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <select
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

        {currentView === 'recordings' && (
          <Recordings />
        )}

        {currentView === 'intent' && (
          <div className="space-y-6">
            <IntentDashboard />
          </div>
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

      {/* Floating Dark Mode Toggle */}
      <button
        onClick={toggleDarkMode}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-110 transition-all duration-200 z-50"
        aria-label="Toggle dark mode"
        type="button"
      >
        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Create Agent Modal */}
      {showCreateAgentModal && (
        <CreateAgentModal
          onClose={() => setShowCreateAgentModal(false)}
          onCreate={handleCreateAgent}
        />
      )}
    </div>
  );
}

export default App;
