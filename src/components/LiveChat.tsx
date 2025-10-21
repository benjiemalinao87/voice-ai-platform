import { useState } from 'react';
import {
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Clock,
  User,
  Send,
  Paperclip,
  MoreVertical,
  Search,
  Filter,
  CheckCheck,
  Check,
  Tag,
  Star
} from 'lucide-react';

interface Message {
  id: string;
  text: string;
  timestamp: string;
  isInbound: boolean;
  status?: 'sent' | 'delivered' | 'read';
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
  email: string;
  phone: string;
  location: string;
  status: 'online' | 'offline' | 'away';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  tags: string[];
  messages: Message[];
}

// Mock data for 10 contacts
const mockContacts: Contact[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    avatar: 'SJ',
    email: 'sarah.johnson@email.com',
    phone: '+1 (555) 123-4567',
    location: 'New York, NY',
    status: 'online',
    lastMessage: 'Thanks for the quick response!',
    lastMessageTime: '2 min ago',
    unreadCount: 2,
    tags: ['VIP', 'Sales'],
    messages: [
      { id: '1', text: 'Hi! I have a question about your pricing.', timestamp: '10:30 AM', isInbound: true, status: 'read' },
      { id: '2', text: 'Of course! I\'d be happy to help. Which package are you interested in?', timestamp: '10:31 AM', isInbound: false, status: 'read' },
      { id: '3', text: 'I\'m looking at the Enterprise plan. Can you tell me more about the features?', timestamp: '10:33 AM', isInbound: true, status: 'read' },
      { id: '4', text: 'The Enterprise plan includes unlimited users, advanced analytics, priority support, and custom integrations. Would you like to schedule a demo?', timestamp: '10:35 AM', isInbound: false, status: 'read' },
      { id: '5', text: 'Yes, that would be great!', timestamp: '10:37 AM', isInbound: true, status: 'read' },
      { id: '6', text: 'Thanks for the quick response!', timestamp: '10:38 AM', isInbound: true }
    ]
  },
  {
    id: '2',
    name: 'Michael Chen',
    avatar: 'MC',
    email: 'michael.chen@company.com',
    phone: '+1 (555) 234-5678',
    location: 'San Francisco, CA',
    status: 'online',
    lastMessage: 'Perfect, I\'ll send over the documents.',
    lastMessageTime: '15 min ago',
    unreadCount: 0,
    tags: ['Support'],
    messages: [
      { id: '1', text: 'I need help setting up my account.', timestamp: '9:45 AM', isInbound: true, status: 'read' },
      { id: '2', text: 'I can help with that! What specific issue are you encountering?', timestamp: '9:46 AM', isInbound: false, status: 'read' },
      { id: '3', text: 'I can\'t seem to add team members.', timestamp: '9:48 AM', isInbound: true, status: 'read' },
      { id: '4', text: 'You\'ll need to upgrade to a team plan first. Would you like me to walk you through the upgrade process?', timestamp: '9:50 AM', isInbound: false, status: 'read' },
      { id: '5', text: 'Perfect, I\'ll send over the documents.', timestamp: '9:52 AM', isInbound: true, status: 'read' }
    ]
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    avatar: 'ER',
    email: 'emily.r@startup.io',
    phone: '+1 (555) 345-6789',
    location: 'Austin, TX',
    status: 'away',
    lastMessage: 'Can we schedule a call for tomorrow?',
    lastMessageTime: '1 hour ago',
    unreadCount: 1,
    tags: ['Lead', 'Hot'],
    messages: [
      { id: '1', text: 'I saw your demo and I\'m very interested!', timestamp: 'Yesterday', isInbound: true, status: 'read' },
      { id: '2', text: 'That\'s wonderful to hear! What features caught your attention?', timestamp: 'Yesterday', isInbound: false, status: 'read' },
      { id: '3', text: 'The automation workflows look incredible. How easy is it to set up?', timestamp: 'Yesterday', isInbound: true, status: 'read' },
      { id: '4', text: 'It\'s very intuitive! Most customers have their first workflow running in under 10 minutes.', timestamp: 'Yesterday', isInbound: false, status: 'read' },
      { id: '5', text: 'Can we schedule a call for tomorrow?', timestamp: '11:20 AM', isInbound: true }
    ]
  },
  {
    id: '4',
    name: 'David Kim',
    avatar: 'DK',
    email: 'david.kim@enterprise.com',
    phone: '+1 (555) 456-7890',
    location: 'Seattle, WA',
    status: 'offline',
    lastMessage: 'Thank you for your help!',
    lastMessageTime: '3 hours ago',
    unreadCount: 0,
    tags: ['Customer'],
    messages: [
      { id: '1', text: 'My integration stopped working.', timestamp: '8:15 AM', isInbound: true, status: 'read' },
      { id: '2', text: 'Let me check that for you. Which integration is having issues?', timestamp: '8:16 AM', isInbound: false, status: 'read' },
      { id: '3', text: 'The Salesforce integration.', timestamp: '8:18 AM', isInbound: true, status: 'read' },
      { id: '4', text: 'I see the issue. Your API key expired. I\'ve sent you instructions to generate a new one.', timestamp: '8:25 AM', isInbound: false, status: 'delivered' },
      { id: '5', text: 'Thank you for your help!', timestamp: '8:30 AM', isInbound: true, status: 'read' }
    ]
  },
  {
    id: '5',
    name: 'Jennifer Martinez',
    avatar: 'JM',
    email: 'jen.martinez@business.com',
    phone: '+1 (555) 567-8901',
    location: 'Miami, FL',
    status: 'online',
    lastMessage: 'Sounds good, talk soon!',
    lastMessageTime: '5 hours ago',
    unreadCount: 0,
    tags: ['VIP', 'Customer'],
    messages: [
      { id: '1', text: 'I need to add more seats to my plan.', timestamp: '7:00 AM', isInbound: true, status: 'read' },
      { id: '2', text: 'Absolutely! How many additional seats do you need?', timestamp: '7:02 AM', isInbound: false, status: 'read' },
      { id: '3', text: 'We need 5 more seats for our new team members.', timestamp: '7:05 AM', isInbound: true, status: 'read' },
      { id: '4', text: 'Great! I\'ll upgrade your account now. You\'ll see the changes reflected immediately.', timestamp: '7:08 AM', isInbound: false, status: 'read' },
      { id: '5', text: 'Sounds good, talk soon!', timestamp: '7:10 AM', isInbound: true, status: 'read' }
    ]
  },
  {
    id: '6',
    name: 'Robert Taylor',
    avatar: 'RT',
    email: 'robert.t@corp.com',
    phone: '+1 (555) 678-9012',
    location: 'Boston, MA',
    status: 'offline',
    lastMessage: 'I\'ll review and get back to you.',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    tags: ['Lead'],
    messages: [
      { id: '1', text: 'Can you send me a proposal for 50 users?', timestamp: 'Yesterday 3:00 PM', isInbound: true, status: 'read' },
      { id: '2', text: 'Absolutely! I\'ll prepare a custom proposal for your team size.', timestamp: 'Yesterday 3:05 PM', isInbound: false, status: 'read' },
      { id: '3', text: 'How long will it take?', timestamp: 'Yesterday 3:10 PM', isInbound: true, status: 'read' },
      { id: '4', text: 'I\'ll have it ready for you by end of day today.', timestamp: 'Yesterday 3:12 PM', isInbound: false, status: 'delivered' },
      { id: '5', text: 'I\'ll review and get back to you.', timestamp: 'Yesterday 3:15 PM', isInbound: true, status: 'read' }
    ]
  },
  {
    id: '7',
    name: 'Lisa Anderson',
    avatar: 'LA',
    email: 'lisa.a@agency.com',
    phone: '+1 (555) 789-0123',
    location: 'Los Angeles, CA',
    status: 'away',
    lastMessage: 'Great, looking forward to it!',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    tags: ['Sales', 'Hot'],
    messages: [
      { id: '1', text: 'What\'s your onboarding process like?', timestamp: 'Yesterday 2:00 PM', isInbound: true, status: 'read' },
      { id: '2', text: 'We provide a comprehensive onboarding program! It includes training sessions, documentation, and dedicated support.', timestamp: 'Yesterday 2:05 PM', isInbound: false, status: 'read' },
      { id: '3', text: 'How long does onboarding typically take?', timestamp: 'Yesterday 2:10 PM', isInbound: true, status: 'read' },
      { id: '4', text: 'Most teams are fully onboarded within a week. I can schedule a kickoff call for next Monday if that works?', timestamp: 'Yesterday 2:15 PM', isInbound: false, status: 'read' },
      { id: '5', text: 'Great, looking forward to it!', timestamp: 'Yesterday 2:20 PM', isInbound: true, status: 'read' }
    ]
  },
  {
    id: '8',
    name: 'James Wilson',
    avatar: 'JW',
    email: 'james.wilson@tech.com',
    phone: '+1 (555) 890-1234',
    location: 'Denver, CO',
    status: 'online',
    lastMessage: 'That makes sense, thanks!',
    lastMessageTime: '2 days ago',
    unreadCount: 0,
    tags: ['Support'],
    messages: [
      { id: '1', text: 'How do I export my data?', timestamp: '2 days ago 10:00 AM', isInbound: true, status: 'read' },
      { id: '2', text: 'You can export data from the Settings > Data Export section. What format do you need?', timestamp: '2 days ago 10:05 AM', isInbound: false, status: 'read' },
      { id: '3', text: 'CSV would be perfect.', timestamp: '2 days ago 10:10 AM', isInbound: true, status: 'read' },
      { id: '4', text: 'Great! Just select CSV and click Export. The file will be emailed to you within a few minutes.', timestamp: '2 days ago 10:15 AM', isInbound: false, status: 'read' },
      { id: '5', text: 'That makes sense, thanks!', timestamp: '2 days ago 10:20 AM', isInbound: true, status: 'read' }
    ]
  },
  {
    id: '9',
    name: 'Amanda Brown',
    avatar: 'AB',
    email: 'amanda.b@digital.com',
    phone: '+1 (555) 901-2345',
    location: 'Chicago, IL',
    status: 'offline',
    lastMessage: 'Perfect, I\'ll upgrade now.',
    lastMessageTime: '3 days ago',
    unreadCount: 0,
    tags: ['Customer'],
    messages: [
      { id: '1', text: 'What\'s the difference between Pro and Enterprise?', timestamp: '3 days ago 9:00 AM', isInbound: true, status: 'read' },
      { id: '2', text: 'Enterprise includes advanced security features, SSO, custom integrations, and a dedicated account manager.', timestamp: '3 days ago 9:05 AM', isInbound: false, status: 'read' },
      { id: '3', text: 'Do you offer a trial for Enterprise?', timestamp: '3 days ago 9:10 AM', isInbound: true, status: 'read' },
      { id: '4', text: 'Yes! We offer a 14-day trial with full access to all Enterprise features.', timestamp: '3 days ago 9:15 AM', isInbound: false, status: 'read' },
      { id: '5', text: 'Perfect, I\'ll upgrade now.', timestamp: '3 days ago 9:20 AM', isInbound: true, status: 'read' }
    ]
  },
  {
    id: '10',
    name: 'Christopher Lee',
    avatar: 'CL',
    email: 'chris.lee@solutions.com',
    phone: '+1 (555) 012-3456',
    location: 'Portland, OR',
    status: 'online',
    lastMessage: 'Awesome, thank you!',
    lastMessageTime: '1 week ago',
    unreadCount: 0,
    tags: ['Lead', 'Cold'],
    messages: [
      { id: '1', text: 'Do you integrate with Zapier?', timestamp: '1 week ago 4:00 PM', isInbound: true, status: 'read' },
      { id: '2', text: 'Yes! We have a robust Zapier integration with over 100 triggers and actions.', timestamp: '1 week ago 4:05 PM', isInbound: false, status: 'read' },
      { id: '3', text: 'That\'s exactly what I need!', timestamp: '1 week ago 4:10 PM', isInbound: true, status: 'read' },
      { id: '4', text: 'Excellent! Would you like me to send you our integration documentation?', timestamp: '1 week ago 4:15 PM', isInbound: false, status: 'read' },
      { id: '5', text: 'Awesome, thank you!', timestamp: '1 week ago 4:20 PM', isInbound: true, status: 'read' }
    ]
  }
];

export function LiveChat() {
  const [selectedContact, setSelectedContact] = useState<Contact>(mockContacts[0]);
  const [messageInput, setMessageInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredContact, setHoveredContact] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getTagColor = (tag: string) => {
    switch (tag.toLowerCase()) {
      case 'vip':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'sales':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'support':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800';
      case 'lead':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'hot':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'customer':
        return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-600';
    }
  };

  const filteredContacts = mockContacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      // In a real app, this would send the message
      console.log('Sending message:', messageInput);
      setMessageInput('');
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Column 1: Sidebar with Search & Filters */}
      <div className="w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <MessageCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Live Chat</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{mockContacts.length} conversations</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative group mb-4">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all duration-300 hover:border-gray-400 dark:hover:border-gray-500"
          />
        </div>

        {/* Filter Button */}
        <button className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-300 mb-6">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filter by Tags</span>
        </button>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 text-center border border-blue-100 dark:border-blue-800/30">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">3</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Unread</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-3 text-center border border-green-100 dark:border-green-800/30">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">4</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Online</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-lg p-3 text-center border border-purple-100 dark:border-purple-800/30">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">10</p>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Total</p>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Conversations</p>
        </div>

        {/* Contact List - Scrollable */}
        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-2">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              onMouseEnter={() => setHoveredContact(contact.id)}
              onMouseLeave={() => setHoveredContact(null)}
              className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden ${
                selectedContact.id === contact.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 dark:border-blue-400'
                  : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
              }`}
              style={{
                transform: hoveredContact === contact.id ? 'translateX(4px)' : 'translateX(0)',
              }}
            >
              {/* Gradient overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, transparent 50%)',
                }}
              />

              <div className="relative flex items-start gap-3">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm group-hover:scale-110 transition-transform duration-300">
                    {contact.avatar}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(contact.status)} rounded-full border-2 border-white dark:border-gray-800`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{contact.name}</h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0">{contact.lastMessageTime}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate mb-2">{contact.lastMessage}</p>

                  {/* Tags */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getTagColor(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Unread Badge */}
                {contact.unreadCount > 0 && (
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{contact.unreadCount}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Column 2: Messages */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {selectedContact.avatar}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(selectedContact.status)} rounded-full border-2 border-white dark:border-gray-800`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedContact.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{selectedContact.status}</p>
              </div>
            </div>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900/50">
          {selectedContact.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isInbound ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2 duration-300`}
            >
              <div className={`max-w-[70%] ${message.isInbound ? 'order-1' : 'order-2'}`}>
                <div
                  className={`group relative rounded-2xl px-4 py-3 transition-all duration-300 ${
                    message.isInbound
                      ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white hover:shadow-lg'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  <div className={`flex items-center gap-1 mt-1 ${message.isInbound ? 'justify-start' : 'justify-end'}`}>
                    <span className={`text-xs ${message.isInbound ? 'text-gray-500 dark:text-gray-400' : 'text-blue-100'}`}>
                      {message.timestamp}
                    </span>
                    {!message.isInbound && (
                      <div>
                        {message.status === 'read' && <CheckCheck className="w-3 h-3 text-blue-100" />}
                        {message.status === 'delivered' && <CheckCheck className="w-3 h-3 text-blue-200" />}
                        {message.status === 'sent' && <Check className="w-3 h-3 text-blue-200" />}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="flex items-end gap-3">
            <button className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-300 hover:scale-110">
              <Paperclip className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex-1 relative">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your message..."
                rows={1}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none transition-all duration-300 hover:border-gray-400 dark:hover:border-gray-500"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-110 disabled:hover:scale-100"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Column 3: User Details */}
      <div className="w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col overflow-hidden">
        {/* User Profile */}
        <div className="text-center mb-6">
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto group-hover:scale-110 transition-transform duration-300">
              {selectedContact.avatar}
            </div>
            <div className={`absolute bottom-0 right-0 w-6 h-6 ${getStatusColor(selectedContact.status)} rounded-full border-4 border-white dark:border-gray-800`} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{selectedContact.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mb-4">{selectedContact.status}</p>

          {/* Tags */}
          <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
            {selectedContact.tags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-300 hover:scale-105 ${getTagColor(tag)}`}
              >
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </span>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 justify-center">
            <button className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-300 hover:scale-110">
              <Phone className="w-5 h-5" />
            </button>
            <button className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl hover:bg-green-200 dark:hover:bg-green-900/50 transition-all duration-300 hover:scale-110">
              <Mail className="w-5 h-5" />
            </button>
            <button className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-all duration-300 hover:scale-110">
              <Star className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contact Information */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Contact Information</p>

            <div className="space-y-3">
              <div className="group p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Email</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{selectedContact.email}</p>
                  </div>
                </div>
              </div>

              <div className="group p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Phone className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Phone</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedContact.phone}</p>
                  </div>
                </div>
              </div>

              <div className="group p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Location</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedContact.location}</p>
                  </div>
                </div>
              </div>

              <div className="group p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                    <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Last Active</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedContact.lastMessageTime}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Summary */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Activity Summary</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-3 text-center border border-blue-100 dark:border-blue-800/30">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedContact.messages.length}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mt-1">Messages</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-3 text-center border border-green-100 dark:border-green-800/30">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedContact.tags.length}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mt-1">Tags</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
