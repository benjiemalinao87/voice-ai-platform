import { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  Tag,
  MessageSquare,
  Star,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Plus,
  Filter,
  Search
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  avatar: string;
  email: string;
  phone: string;
  company: string;
  value: string;
  lastContact: string;
  nextFollowUp: string;
  tags: string[];
  priority: 'high' | 'medium' | 'low';
  notes: string;
  stage: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
}

const mockContacts: Contact[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    avatar: 'SJ',
    email: 'sarah.j@techcorp.com',
    phone: '+1 (555) 123-4567',
    company: 'TechCorp Inc.',
    value: '$50,000',
    lastContact: '2 days ago',
    nextFollowUp: 'Tomorrow at 2 PM',
    tags: ['Enterprise', 'Hot Lead'],
    priority: 'high',
    notes: 'Interested in Enterprise plan. Needs demo for team.',
    stage: 'new'
  },
  {
    id: '2',
    name: 'Michael Chen',
    avatar: 'MC',
    email: 'mchen@startup.io',
    phone: '+1 (555) 234-5678',
    company: 'Startup.io',
    value: '$25,000',
    lastContact: '1 week ago',
    nextFollowUp: 'Friday at 10 AM',
    tags: ['Startup', 'Warm'],
    priority: 'medium',
    notes: 'Follow up on pricing discussion.',
    stage: 'contacted'
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    avatar: 'ER',
    email: 'emily.r@digital.com',
    phone: '+1 (555) 345-6789',
    company: 'Digital Solutions',
    value: '$75,000',
    lastContact: '3 days ago',
    nextFollowUp: 'Next Monday',
    tags: ['Enterprise', 'Decision Maker'],
    priority: 'high',
    notes: 'Waiting for budget approval from CFO.',
    stage: 'qualified'
  },
  {
    id: '4',
    name: 'David Kim',
    avatar: 'DK',
    email: 'dkim@enterprise.com',
    phone: '+1 (555) 456-7890',
    company: 'Enterprise Co.',
    value: '$100,000',
    lastContact: '5 days ago',
    nextFollowUp: 'Today at 3 PM',
    tags: ['Enterprise', 'VIP'],
    priority: 'high',
    notes: 'Sent custom proposal. Awaiting response.',
    stage: 'proposal'
  },
  {
    id: '5',
    name: 'Jennifer Martinez',
    avatar: 'JM',
    email: 'jen.m@business.com',
    phone: '+1 (555) 567-8901',
    company: 'Business Corp.',
    value: '$40,000',
    lastContact: '1 day ago',
    nextFollowUp: 'Thursday',
    tags: ['Mid-Market', 'Hot Lead'],
    priority: 'high',
    notes: 'In final negotiations on contract terms.',
    stage: 'negotiation'
  },
  {
    id: '6',
    name: 'Robert Taylor',
    avatar: 'RT',
    email: 'rtaylor@agency.com',
    phone: '+1 (555) 678-9012',
    company: 'Creative Agency',
    value: '$30,000',
    lastContact: '2 weeks ago',
    nextFollowUp: 'No follow-up scheduled',
    tags: ['SMB', 'Cold'],
    priority: 'low',
    notes: 'Not responsive to emails.',
    stage: 'contacted'
  },
  {
    id: '7',
    name: 'Lisa Anderson',
    avatar: 'LA',
    email: 'lisa.a@consulting.com',
    phone: '+1 (555) 789-0123',
    company: 'Anderson Consulting',
    value: '$60,000',
    lastContact: 'Yesterday',
    nextFollowUp: 'Next week',
    tags: ['Consulting', 'Qualified'],
    priority: 'medium',
    notes: 'Requested technical documentation.',
    stage: 'qualified'
  },
  {
    id: '8',
    name: 'James Wilson',
    avatar: 'JW',
    email: 'jwilson@tech.com',
    phone: '+1 (555) 890-1234',
    company: 'Wilson Tech',
    value: '$90,000',
    lastContact: '3 days ago',
    nextFollowUp: 'Tuesday',
    tags: ['Enterprise', 'Contract Review'],
    priority: 'high',
    notes: 'Legal team reviewing contract.',
    stage: 'negotiation'
  },
  {
    id: '9',
    name: 'Amanda Brown',
    avatar: 'AB',
    email: 'abrown@software.com',
    phone: '+1 (555) 901-2345',
    company: 'Software Inc.',
    value: '$120,000',
    lastContact: 'Today',
    nextFollowUp: 'Closed',
    tags: ['Enterprise', 'Won'],
    priority: 'high',
    notes: 'Contract signed! Onboarding scheduled.',
    stage: 'closed-won'
  },
  {
    id: '10',
    name: 'Christopher Lee',
    avatar: 'CL',
    email: 'clee@retail.com',
    phone: '+1 (555) 012-3456',
    company: 'Retail Solutions',
    value: '$15,000',
    lastContact: '3 weeks ago',
    nextFollowUp: 'Closed',
    tags: ['SMB', 'Lost'],
    priority: 'low',
    notes: 'Chose competitor due to price.',
    stage: 'closed-lost'
  },
  {
    id: '11',
    name: 'Patricia Davis',
    avatar: 'PD',
    email: 'pdavis@finance.com',
    phone: '+1 (555) 111-2222',
    company: 'Finance Group',
    value: '$80,000',
    lastContact: '4 days ago',
    nextFollowUp: 'This week',
    tags: ['Finance', 'Warm'],
    priority: 'medium',
    notes: 'Preparing proposal for board meeting.',
    stage: 'proposal'
  },
  {
    id: '12',
    name: 'Thomas White',
    avatar: 'TW',
    email: 'twhite@media.com',
    phone: '+1 (555) 222-3333',
    company: 'Media Corp',
    value: '$35,000',
    lastContact: '1 hour ago',
    nextFollowUp: 'Tomorrow',
    tags: ['Media', 'Hot Lead'],
    priority: 'high',
    notes: 'Just had discovery call. Very interested.',
    stage: 'new'
  }
];

const stages = [
  { id: 'new', label: 'New Leads', color: 'blue', icon: Star },
  { id: 'contacted', label: 'Contacted', color: 'purple', icon: MessageSquare },
  { id: 'qualified', label: 'Qualified', color: 'indigo', icon: CheckCircle },
  { id: 'proposal', label: 'Proposal Sent', color: 'orange', icon: AlertCircle },
  { id: 'negotiation', label: 'Negotiation', color: 'yellow', icon: TrendingUp },
  { id: 'closed-won', label: 'Closed Won', color: 'green', icon: CheckCircle },
  { id: 'closed-lost', label: 'Closed Lost', color: 'red', icon: XCircle }
];

export function BoardView() {
  const [contacts, setContacts] = useState<Contact[]>(mockContacts);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedContact, setDraggedContact] = useState<Contact | null>(null);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'low':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-600';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-600';
    }
  };

  const getTagColor = (tag: string) => {
    const colors = [
      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'
    ];
    const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const getStageColor = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.color || 'gray';
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getContactsByStage = (stageId: string) => {
    return filteredContacts.filter(contact => contact.stage === stageId);
  };

  const handleDragStart = (contact: Contact) => {
    setDraggedContact(contact);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setHoveredColumn(stageId);
  };

  const handleDrop = (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    if (draggedContact) {
      setContacts(prev =>
        prev.map(contact =>
          contact.id === draggedContact.id
            ? { ...contact, stage: newStage as Contact['stage'] }
            : contact
        )
      );
    }
    setDraggedContact(null);
    setHoveredColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedContact(null);
    setHoveredColumn(null);
  };

  const totalValue = contacts.reduce((sum, contact) => {
    const value = parseFloat(contact.value.replace(/[$,]/g, ''));
    return sum + value;
  }, 0);

  const wonValue = contacts
    .filter(c => c.stage === 'closed-won')
    .reduce((sum, contact) => {
      const value = parseFloat(contact.value.replace(/[$,]/g, ''));
      return sum + value;
    }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            Pipeline Board
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Visualize and manage your sales pipeline
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 cursor-pointer overflow-hidden relative hover:shadow-lg">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Total Contacts</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 group-hover:scale-105 transition-transform duration-300">{contacts.length}</p>
            </div>
          </div>
        </div>

        <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 cursor-pointer overflow-hidden relative hover:shadow-lg">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Pipeline Value</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 group-hover:scale-105 transition-transform duration-300">${(totalValue / 1000).toFixed(0)}K</p>
            </div>
          </div>
        </div>

        <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 cursor-pointer overflow-hidden relative hover:shadow-lg">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Won Deals</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 group-hover:scale-105 transition-transform duration-300">${(wonValue / 1000).toFixed(0)}K</p>
            </div>
          </div>
        </div>

        <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 cursor-pointer overflow-hidden relative hover:shadow-lg">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20" />
          <div className="relative flex items-center gap-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <Star className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Win Rate</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 group-hover:scale-105 transition-transform duration-300">
                {((wonValue / totalValue) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search contacts, companies, or emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all duration-300 hover:border-gray-400 dark:hover:border-gray-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-300 hover:scale-105">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filters</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105">
          <Plus className="w-4 h-4" />
          <span className="font-medium">Add Contact</span>
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const StageIcon = stage.icon;
          const stageContacts = getContactsByStage(stage.id);
          const stageValue = stageContacts.reduce((sum, contact) => {
            const value = parseFloat(contact.value.replace(/[$,]/g, ''));
            return sum + value;
          }, 0);

          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-900/50 rounded-xl border-2 transition-all duration-300 ${
                hoveredColumn === stage.id
                  ? 'border-blue-500 dark:border-blue-400 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Column Header */}
              <div className={`p-4 border-b border-gray-200 dark:border-gray-700 bg-${stage.color}-50 dark:bg-${stage.color}-900/20 rounded-t-xl`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 bg-${stage.color}-100 dark:bg-${stage.color}-900/30 rounded-lg`}>
                      <StageIcon className={`w-4 h-4 text-${stage.color}-600 dark:text-${stage.color}-400`} />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{stage.label}</h3>
                  </div>
                  <span className="px-2 py-1 bg-white dark:bg-gray-800 rounded-full text-xs font-bold text-gray-700 dark:text-gray-300">
                    {stageContacts.length}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                  ${(stageValue / 1000).toFixed(0)}K
                </p>
              </div>

              {/* Cards Container */}
              <div className="p-3 space-y-3 min-h-[500px] max-h-[calc(100vh-28rem)] overflow-y-auto">
                {stageContacts.map((contact) => (
                  <div
                    key={contact.id}
                    draggable
                    onDragStart={() => handleDragStart(contact)}
                    onDragEnd={handleDragEnd}
                    className={`group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 cursor-move transition-all duration-300 hover:shadow-lg overflow-hidden relative ${
                      draggedContact?.id === contact.id ? 'opacity-50' : ''
                    }`}
                    style={{
                      transform: draggedContact?.id === contact.id ? 'rotate(2deg)' : 'rotate(0)',
                    }}
                  >
                    {/* Gradient overlay */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, transparent 50%)',
                      }}
                    />

                    {/* Top accent border */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 bg-${stage.color}-500 transition-all duration-300`}
                      style={{
                        transform: 'scaleX(0)',
                        transformOrigin: 'left',
                      }}
                    />

                    <div className="relative">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {contact.avatar}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{contact.name}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{contact.company}</p>
                          </div>
                        </div>
                        <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>

                      {/* Value */}
                      <div className="mb-3 p-2 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-100 dark:border-green-800/30">
                        <p className="text-lg font-bold text-green-600 dark:text-green-400">{contact.value}</p>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(contact.priority)}`}>
                          {contact.priority.toUpperCase()}
                        </span>
                        {contact.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTagColor(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Notes */}
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {contact.notes}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>{contact.lastContact}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                          <Calendar className="w-3 h-3" />
                          <span className="truncate max-w-[100px]">{contact.nextFollowUp}</span>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex gap-2 mt-3">
                        <button className="flex-1 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-300 hover:scale-105">
                          <Phone className="w-3 h-3 mx-auto" />
                        </button>
                        <button className="flex-1 p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-all duration-300 hover:scale-105">
                          <Mail className="w-3 h-3 mx-auto" />
                        </button>
                        <button className="flex-1 p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all duration-300 hover:scale-105">
                          <MessageSquare className="w-3 h-3 mx-auto" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
