import { useState, useEffect } from 'react';
import { BarChart3, Settings, Bot, Calendar, Moon, Sun, Mic } from 'lucide-react';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { AgentConfig } from './components/AgentConfig';
import { Recordings } from './components/Recordings';
import { agentApi } from './lib/api';
import type { Agent } from './types';

type View = 'dashboard' | 'config' | 'recordings';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    to: new Date().toISOString()
  });

  useEffect(() => {
    loadAgents();
  }, []);

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
      const data = await agentApi.getAll();
      setAgents(data);
      if (data.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Bot className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">CHAU Voice AI</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {agents.length > 0 && (
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Agents</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              )}

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
                  onClick={() => setCurrentView('config')}
                  disabled={!selectedAgentId}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    currentView === 'config'
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Performance Metrics</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {selectedAgent ? `Viewing metrics for ${selectedAgent.name}` : 'Viewing metrics for all agents'}
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

            <PerformanceDashboard
              selectedAgentId={selectedAgentId}
              dateRange={dateRange}
            />
          </div>
        )}

        {currentView === 'recordings' && (
          <Recordings />
        )}

        {currentView === 'config' && selectedAgentId && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Agent Configuration</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Configure voice, behavior, and prompts for your AI agent
              </p>
            </div>

            <AgentConfig agentId={selectedAgentId} />
          </div>
        )}

        {currentView === 'config' && !selectedAgentId && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Settings className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Agent Selected</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Please select an agent from the dropdown above to view and edit its configuration.
            </p>
          </div>
        )}
      </main>

      {/* Floating Dark Mode Toggle */}
      <button
        onClick={toggleDarkMode}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 hover:scale-110 transition-all duration-200"
        aria-label="Toggle dark mode"
        type="button"
      >
        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </div>
  );
}

export default App;
