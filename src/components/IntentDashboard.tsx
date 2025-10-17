import { useState, useMemo } from 'react';
import { 
  Brain, 
  Filter, 
  Search, 
  TrendingUp, 
  Users, 
  Calendar,
  MessageSquare,
  BarChart3
} from 'lucide-react';
import { IntentCard } from './IntentCard';
import type { CallIntent } from '../types';

// Mock data for 5 calls with intent analysis
const mockCallIntents: CallIntent[] = [
  {
    id: '1',
    call_id: 'call_001',
    intent: 'Scheduling',
    intent_reasoning: "The lead's response 'Not yet' indicates they are inquiring about the status of their appointment, and the agent's reply provides information on how to reschedule, confirming that the lead's intent is focused on scheduling.",
    mood: 'neutral',
    mood_confidence: 85,
    mood_reasoning: "The lead's response 'Not yet' is factual and does not convey strong emotions or engagement. The conversation remains straightforward without expressions of excitement, dissatisfaction, or curiosity.",
    call_date: '2024-01-15T14:30:00Z',
    duration_seconds: 180,
    language: 'en',
    was_answered: true,
    transcript_excerpt: "Agent: Hi, this is Sarah from Channel Automation. I'm calling to confirm your appointment for tomorrow at 2 PM. Lead: Not yet. Agent: No problem! If you need to reschedule, you can call us back or visit our website.",
    customer_name: 'Erin Farley',
    phone_number: '+1 (316) 299-3145'
  },
  {
    id: '2',
    call_id: 'call_002',
    intent: 'Information',
    intent_reasoning: "The customer is asking detailed questions about pricing and service packages, indicating a strong interest in gathering information before making a decision.",
    mood: 'positive',
    mood_confidence: 92,
    mood_reasoning: "The customer's tone is enthusiastic and engaged, asking follow-up questions and expressing interest in the services offered.",
    call_date: '2024-01-15T16:45:00Z',
    duration_seconds: 420,
    language: 'en',
    was_answered: true,
    transcript_excerpt: "Customer: I'm really interested in your automation services. Can you tell me more about the pricing? Agent: Absolutely! We have several packages starting at $299/month...",
    customer_name: 'Michael Rodriguez',
    phone_number: '+1 (555) 123-4567'
  },
  {
    id: '3',
    call_id: 'call_003',
    intent: 'Complaint',
    intent_reasoning: "The customer is expressing dissatisfaction with a previous service and requesting a refund, clearly indicating a complaint intent.",
    mood: 'negative',
    mood_confidence: 78,
    mood_reasoning: "The customer's tone is frustrated and disappointed, using words like 'disappointed' and 'unacceptable' to express their dissatisfaction.",
    call_date: '2024-01-15T11:20:00Z',
    duration_seconds: 320,
    language: 'es',
    was_answered: true,
    transcript_excerpt: "Cliente: Estoy muy decepcionado con el servicio. No funcionó como prometieron. Agente: Entiendo su frustración. Permíteme revisar su caso...",
    customer_name: 'María González',
    phone_number: '+1 (555) 987-6543'
  },
  {
    id: '4',
    call_id: 'call_004',
    intent: 'Purchase',
    intent_reasoning: "The customer is ready to proceed with a purchase, asking about payment options and next steps, indicating strong purchase intent.",
    mood: 'positive',
    mood_confidence: 88,
    mood_reasoning: "The customer sounds confident and decisive, expressing readiness to move forward with the purchase.",
    call_date: '2024-01-15T09:15:00Z',
    duration_seconds: 240,
    language: 'en',
    was_answered: true,
    transcript_excerpt: "Customer: I've decided to go with the premium package. What are my payment options? Agent: Great choice! We accept all major credit cards...",
    customer_name: 'David Chen',
    phone_number: '+1 (555) 456-7890'
  },
  {
    id: '5',
    call_id: 'call_005',
    intent: 'Support',
    intent_reasoning: "The customer is experiencing technical issues and needs help troubleshooting, indicating a support request intent.",
    mood: 'neutral',
    mood_confidence: 73,
    mood_reasoning: "The customer is calm but slightly frustrated with the technical issue, maintaining a professional tone while seeking assistance.",
    call_date: '2024-01-15T13:10:00Z',
    duration_seconds: 380,
    language: 'en',
    was_answered: true,
    transcript_excerpt: "Customer: I'm having trouble accessing my dashboard. It keeps showing an error message. Agent: I'll help you troubleshoot this. Let's start by checking your login credentials...",
    customer_name: 'Jennifer Smith',
    phone_number: '+1 (555) 321-0987'
  }
];

export function IntentDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIntent, setSelectedIntent] = useState<string>('all');
  const [selectedMood, setSelectedMood] = useState<string>('all');

  // Get unique intents and moods for filter options
  const intents = useMemo(() => {
    const uniqueIntents = [...new Set(mockCallIntents.map(call => call.intent))];
    return uniqueIntents;
  }, []);

  const moods = useMemo(() => {
    const uniqueMoods = [...new Set(mockCallIntents.map(call => call.mood))];
    return uniqueMoods;
  }, []);

  // Filter calls based on search and filters
  const filteredCalls = useMemo(() => {
    return mockCallIntents.filter(call => {
      const matchesSearch = searchTerm === '' || 
        call.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        call.intent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        call.transcript_excerpt.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesIntent = selectedIntent === 'all' || call.intent === selectedIntent;
      const matchesMood = selectedMood === 'all' || call.mood === selectedMood;
      
      return matchesSearch && matchesIntent && matchesMood;
    });
  }, [searchTerm, selectedIntent, selectedMood]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalCalls = mockCallIntents.length;
    const answeredCalls = mockCallIntents.filter(call => call.was_answered).length;
    const avgConfidence = mockCallIntents.reduce((sum, call) => sum + call.mood_confidence, 0) / totalCalls;
    const intentDistribution = intents.map(intent => ({
      intent,
      count: mockCallIntents.filter(call => call.intent === intent).length
    }));

    return {
      totalCalls,
      answeredCalls,
      avgConfidence: Math.round(avgConfidence),
      intentDistribution
    };
  }, [intents]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Call Intent Analysis
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            AI-powered analysis of customer intent and mood from call conversations
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Calls</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalCalls}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Answered</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.answeredCalls}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Confidence</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.avgConfidence}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <BarChart3 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Intent Types</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{intents.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search calls, customers, or intent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Intent Filter */}
          <div className="sm:w-48">
            <select
              value={selectedIntent}
              onChange={(e) => setSelectedIntent(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Intents</option>
              {intents.map(intent => (
                <option key={intent} value={intent}>{intent}</option>
              ))}
            </select>
          </div>

          {/* Mood Filter */}
          <div className="sm:w-48">
            <select
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Moods</option>
              {moods.map(mood => (
                <option key={mood} value={mood} className="capitalize">{mood}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Intent Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Intent Distribution
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats.intentDistribution.map(({ intent, count }) => (
            <div key={intent} className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{count}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{intent}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Call Intent Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Call Analysis ({filteredCalls.length} calls)
          </h3>
        </div>
        
        {filteredCalls.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Brain className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No calls found</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Try adjusting your search terms or filters to find calls.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCalls.map((callIntent) => (
              <IntentCard key={callIntent.id} callIntent={callIntent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
