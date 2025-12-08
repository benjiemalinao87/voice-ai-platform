/**
 * Outbound Campaign Component
 * Manage leads and campaigns with CSV upload, webhook integration, and VAPI calling
 */

import { useState, useEffect, useRef } from 'react';
import { 
  Users, Upload, Link2, Trash2, RefreshCw, Search, 
  CheckCircle2, X, Copy, FileSpreadsheet,
  AlertCircle, Play, Pause, 
  Square, Plus, Phone, Clock, Megaphone, Check
} from 'lucide-react';
import { d1Client } from '../lib/d1';

interface Lead {
  id: string;
  workspace_id: string;
  firstname: string | null;
  lastname: string | null;
  phone: string;
  email: string | null;
  lead_source: string | null;
  product: string | null;
  notes: string | null;
  status: string;
  created_at: number;
  updated_at: number;
}

interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  assistant_id: string;
  phone_number_id: string;
  status: string;
  scheduled_at: number | null;
  started_at: number | null;
  completed_at: number | null;
  total_leads: number;
  calls_completed: number;
  calls_answered: number;
  calls_failed: number;
  prompt_template: string | null;
  first_message_template: string | null;
  created_at: number;
  updated_at: number;
}

interface Assistant {
  id: string;
  name: string;
}

interface PhoneNumber {
  id: string;
  number: string;
  name?: string;
}

interface CampaignLead {
  id: string;
  campaign_id: string;
  lead_id: string;
  call_status: string;
  vapi_call_id: string | null;
  call_duration: number | null;
  call_outcome: string | null;
  call_summary: string | null;
  called_at: number | null;
  firstname: string | null;
  lastname: string | null;
  phone: string;
  email: string | null;
  lead_source: string | null;
  product: string | null;
}

type TabType = 'leads' | 'campaigns';

export function Leads() {
  const [activeTab, setActiveTab] = useState<TabType>('leads');
  
  // Leads state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsPage, setLeadsPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const pageSize = 20;

  // Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  
  // Assistants and phone numbers for campaign creation
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
  const [showCampaignDetailModal, setShowCampaignDetailModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignLeads, setCampaignLeads] = useState<CampaignLead[]>([]);
  const [campaignLeadsLoading, setCampaignLeadsLoading] = useState(false);
  const [showAddLeadsModal, setShowAddLeadsModal] = useState(false);
  const [availableLeadsForCampaign, setAvailableLeadsForCampaign] = useState<Lead[]>([]);
  const [selectedLeadsToAdd, setSelectedLeadsToAdd] = useState<Set<string>>(new Set());
  const [addingLeadsToCampaign, setAddingLeadsToCampaign] = useState(false);
  const [showEditCampaignModal, setShowEditCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<{ name: string; assistant_id: string; phone_number_id: string; prompt_template: string; first_message_template: string }>({ name: '', assistant_id: '', phone_number_id: '', prompt_template: '', first_message_template: '' });
  const [updatingCampaign, setUpdatingCampaign] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    imported: number;
    failed: number;
    errors: string[];
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Delete/Action states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedCampaignId, setCopiedCampaignId] = useState<string | null>(null);

  // Helper to copy campaign ID
  const handleCopyCampaignId = async (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(campaignId);
    setCopiedCampaignId(campaignId);
    setTimeout(() => setCopiedCampaignId(null), 2000);
  };

  // Create campaign state
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    assistant_id: '',
    phone_number_id: '',
    prompt_template: '',
    first_message_template: '',
    scheduled_at: ''
  });
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [campaignStep, setCampaignStep] = useState(1); // 1: Basic Info, 2: Templates, 3: Schedule

  // Load both leads and campaigns count on initial mount
  useEffect(() => {
    loadLeads();
    loadCampaigns();
  }, []);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'leads') {
      loadLeads(false);
    } else {
      loadCampaigns();
      loadAssistantsAndPhones();
    }
  }, [activeTab]);

  const loadLeads = async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLeadsLoading(true);
        setLeadsPage(1);
      }
      
      const currentPage = append ? leadsPage : 1;
      const response = await d1Client.getLeads({
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
      });
      
      const newLeads = response.leads || [];
      
      if (append) {
        setLeads(prev => [...prev, ...newLeads]);
      } else {
        setLeads(newLeads);
      }
      
      setLeadsTotal(response.total || 0);
      setHasMore(newLeads.length === pageSize && (currentPage * pageSize) < (response.total || 0));
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLeadsLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreLeads = async () => {
    if (loadingMore || !hasMore) return;
    setLeadsPage(prev => prev + 1);
  };

  // Load more when page changes (for infinite scroll)
  useEffect(() => {
    if (leadsPage > 1) {
      loadLeads(true);
    }
  }, [leadsPage]);

  // Handle scroll for infinite loading
  const handleScroll = () => {
    if (!tableContainerRef.current || loadingMore || !hasMore) return;
    
    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadMoreLeads();
    }
  };

  const loadCampaigns = async () => {
    try {
      setCampaignsLoading(true);
      const response = await d1Client.getCampaigns();
      setCampaigns(response.campaigns || []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadAssistantsAndPhones = async () => {
    try {
      const [assistantsRes, phonesRes] = await Promise.all([
        // Force fresh fetch from VAPI (bypass cache) for campaigns
        d1Client.request('/api/assistants?nocache=true', { method: 'GET' }),
        d1Client.request('/api/vapi/phone-numbers', { method: 'GET' }).catch(() => ({ phoneNumbers: [] }))
      ]);
      setAssistants(assistantsRes.assistants || []);
      setPhoneNumbers(phonesRes.phoneNumbers || []);
    } catch (error) {
      console.error('Error loading assistants/phones:', error);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    setDeletingId(leadId);
    try {
      await d1Client.deleteLead(leadId);
      await loadLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Failed to delete lead');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    setDeletingId(campaignId);
    try {
      await d1Client.deleteCampaign(campaignId);
      await loadCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('Failed to delete campaign');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartCampaign = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      await d1Client.startCampaign(campaignId);
      await loadCampaigns();
    } catch (error: any) {
      console.error('Error starting campaign:', error);
      alert(error.message || 'Failed to start campaign');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    setActionLoading(campaignId);
    try {
      await d1Client.pauseCampaign(campaignId);
      await loadCampaigns();
    } catch (error: any) {
      console.error('Error pausing campaign:', error);
      alert(error.message || 'Failed to pause campaign');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to cancel this campaign?')) return;
    
    setActionLoading(campaignId);
    try {
      await d1Client.cancelCampaign(campaignId);
      await loadCampaigns();
    } catch (error: any) {
      console.error('Error cancelling campaign:', error);
      alert(error.message || 'Failed to cancel campaign');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewCampaign = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowCampaignDetailModal(true);
    setCampaignLeadsLoading(true);
    try {
      const response = await d1Client.getCampaignLeads(campaign.id);
      setCampaignLeads(response.leads || []);
    } catch (error) {
      console.error('Error loading campaign leads:', error);
      setCampaignLeads([]);
    } finally {
      setCampaignLeadsLoading(false);
    }
  };

  const handleOpenAddLeadsModal = async () => {
    setShowAddLeadsModal(true);
    setSelectedLeadsToAdd(new Set());
    try {
      // Load all leads
      const response = await d1Client.getLeads({ limit: 100, offset: 0 });
      // Filter out leads already in the campaign
      const existingLeadIds = new Set(campaignLeads.map(cl => cl.lead_id));
      const available = (response.leads || []).filter(l => !existingLeadIds.has(l.id));
      setAvailableLeadsForCampaign(available);
    } catch (error) {
      console.error('Error loading available leads:', error);
      setAvailableLeadsForCampaign([]);
    }
  };

  const handleAddLeadsToCampaign = async () => {
    if (!selectedCampaign || selectedLeadsToAdd.size === 0) return;
    
    setAddingLeadsToCampaign(true);
    try {
      const addedCount = selectedLeadsToAdd.size;
      await d1Client.addLeadsToCampaign(selectedCampaign.id, Array.from(selectedLeadsToAdd));
      // Refresh campaign leads
      const response = await d1Client.getCampaignLeads(selectedCampaign.id);
      setCampaignLeads(response.leads || []);
      // Update selected campaign stats immediately
      setSelectedCampaign({ 
        ...selectedCampaign, 
        total_leads: selectedCampaign.total_leads + addedCount 
      });
      // Refresh campaigns list in background
      loadCampaigns();
      setShowAddLeadsModal(false);
      setSelectedLeadsToAdd(new Set());
    } catch (error: any) {
      console.error('Error adding leads to campaign:', error);
      alert(error.message || 'Failed to add leads');
    } finally {
      setAddingLeadsToCampaign(false);
    }
  };

  const toggleLeadToAdd = (leadId: string) => {
    const newSelected = new Set(selectedLeadsToAdd);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeadsToAdd(newSelected);
  };

  const handleOpenEditCampaign = () => {
    if (!selectedCampaign) return;
    loadAssistantsAndPhones();
    setEditingCampaign({
      name: selectedCampaign.name,
      assistant_id: selectedCampaign.assistant_id,
      phone_number_id: selectedCampaign.phone_number_id,
      prompt_template: selectedCampaign.prompt_template || '',
      first_message_template: selectedCampaign.first_message_template || ''
    });
    setShowEditCampaignModal(true);
  };

  const handleUpdateCampaign = async () => {
    if (!selectedCampaign || !editingCampaign.name || !editingCampaign.assistant_id || !editingCampaign.phone_number_id) {
      alert('Please fill in all required fields');
      return;
    }

    setUpdatingCampaign(true);
    try {
      await d1Client.updateCampaign(selectedCampaign.id, {
        name: editingCampaign.name,
        assistant_id: editingCampaign.assistant_id,
        phone_number_id: editingCampaign.phone_number_id,
        prompt_template: editingCampaign.prompt_template || null,
        first_message_template: editingCampaign.first_message_template || null
      });
      // Refresh campaigns and update selected campaign
      await loadCampaigns();
      setSelectedCampaign({
        ...selectedCampaign,
        name: editingCampaign.name,
        assistant_id: editingCampaign.assistant_id,
        phone_number_id: editingCampaign.phone_number_id,
        prompt_template: editingCampaign.prompt_template || null,
        first_message_template: editingCampaign.first_message_template || null
      });
      setShowEditCampaignModal(false);
    } catch (error: any) {
      console.error('Error updating campaign:', error);
      alert(error.message || 'Failed to update campaign');
    } finally {
      setUpdatingCampaign(false);
    }
  };

  const handleRetryFailedLeads = async () => {
    if (!selectedCampaign) return;
    
    try {
      // Reset failed leads back to pending
      await d1Client.request(`/api/campaigns/${selectedCampaign.id}/retry-failed`, { method: 'POST' });
      // Refresh campaign leads
      const response = await d1Client.getCampaignLeads(selectedCampaign.id);
      setCampaignLeads(response.leads || []);
      await loadCampaigns();
      alert('Failed leads have been reset to pending. You can now restart the campaign.');
    } catch (error: any) {
      console.error('Error retrying failed leads:', error);
      alert(error.message || 'Failed to retry leads');
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getCallStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'calling': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getOutcomeColor = (outcome: string | null) => {
    if (!outcome) return 'text-gray-500';
    switch (outcome) {
      case 'answered': return 'text-green-600 dark:text-green-400';
      case 'no-answer': return 'text-yellow-600 dark:text-yellow-400';
      case 'busy': return 'text-orange-600 dark:text-orange-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-500 dark:text-gray-400';
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.name || !newCampaign.assistant_id || !newCampaign.phone_number_id) {
      alert('Please fill in all required fields');
      return;
    }

    setCreatingCampaign(true);
    try {
      const scheduled_at = newCampaign.scheduled_at 
        ? Math.floor(new Date(newCampaign.scheduled_at).getTime() / 1000)
        : undefined;

      const response = await d1Client.createCampaign({
        name: newCampaign.name,
        assistant_id: newCampaign.assistant_id,
        phone_number_id: newCampaign.phone_number_id,
        scheduled_at,
        prompt_template: newCampaign.prompt_template || null,
        first_message_template: newCampaign.first_message_template || null
      });

      // Add selected leads to campaign
      if (selectedLeadIds.size > 0) {
        await d1Client.addLeadsToCampaign(response.id, Array.from(selectedLeadIds));
      }

      setShowCreateCampaignModal(false);
      setCampaignStep(1);
      setNewCampaign({ name: '', assistant_id: '', phone_number_id: '', prompt_template: '', first_message_template: '', scheduled_at: '' });
      setSelectedLeadIds(new Set());
      await loadCampaigns();
      setActiveTab('campaigns');
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      alert(error.message || 'Failed to create campaign');
    } finally {
      setCreatingCampaign(false);
    }
  };

  const loadWebhook = async () => {
    setWebhookLoading(true);
    try {
      const response = await d1Client.getLeadsWebhook();
      setWebhookUrl(response.webhookUrl);
    } catch (error) {
      console.error('Error loading webhook:', error);
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleOpenWebhookModal = () => {
    setShowWebhookModal(true);
    loadWebhook();
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const leads: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const lead: any = {};

      headers.forEach((header, index) => {
        lead[header] = values[index] || '';
      });

      leads.push(lead);
    }

    return leads;
  };

  const handleFileSelect = (file: File) => {
    setUploadFile(file);
    setUploadResult(null);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      const text = await uploadFile.text();
      const leads = parseCSV(text);

      if (leads.length === 0) {
        setUploadResult({
          success: false,
          imported: 0,
          failed: 0,
          errors: ['No valid data found in CSV'],
          message: 'No valid data found in CSV'
        });
        return;
      }

      const response = await d1Client.uploadLeads(leads);
      setUploadResult(response);

      if (response.imported > 0) {
        await loadLeads();
      }
    } catch (error: any) {
      setUploadResult({
        success: false,
        imported: 0,
        failed: 0,
        errors: [error.message || 'Upload failed'],
        message: error.message || 'Upload failed'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].name.endsWith('.csv')) {
      handleFileSelect(files[0]);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeadIds);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeadIds(newSelected);
  };

  const toggleAllLeads = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (lead.firstname?.toLowerCase().includes(search)) ||
      (lead.lastname?.toLowerCase().includes(search)) ||
      (lead.phone?.toLowerCase().includes(search)) ||
      (lead.email?.toLowerCase().includes(search)) ||
      (lead.lead_source?.toLowerCase().includes(search)) ||
      (lead.product?.toLowerCase().includes(search))
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'running': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'completed': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Megaphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Outbound Campaign</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage leads and run AI-powered calling campaigns
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('leads')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'leads'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Leads ({leadsTotal})
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
            activeTab === 'campaigns'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Phone className="w-4 h-4" />
          Campaigns ({campaigns.length})
        </button>
      </div>

      {/* Leads Tab */}
      {activeTab === 'leads' && (
        <>
          {/* Leads Actions */}
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center gap-3">
              {selectedLeadIds.size > 0 && (
                <button
                  onClick={() => {
                    loadAssistantsAndPhones();
                    setShowCreateCampaignModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Megaphone className="w-4 h-4" />
                  Create Campaign ({selectedLeadIds.size})
                </button>
              )}
              <button
                onClick={handleOpenWebhookModal}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <Link2 className="w-4 h-4" />
                Webhook URL
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload CSV
              </button>
              <button
                onClick={() => loadLeads(false)}
                className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${leadsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Leads Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {leadsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No leads yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Upload a CSV file or use the webhook to add contacts</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Upload CSV
                </button>
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Sticky Header */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left w-10">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0}
                            onChange={toggleAllLeads}
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[130px]">Phone</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[180px]">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[100px]">Source</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[120px]">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[200px]">Notes</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[80px]">Status</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">Actions</th>
                      </tr>
                    </thead>
                  </table>
                </div>
                
                {/* Scrollable Body */}
                <div 
                  ref={tableContainerRef}
                  onScroll={handleScroll}
                  className="overflow-y-auto overflow-x-auto max-h-[500px]"
                >
                  <table className="w-full">
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-4 py-3 w-10">
                            <input
                              type="checkbox"
                              checked={selectedLeadIds.has(lead.id)}
                              onChange={() => toggleLeadSelection(lead.id)}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap min-w-[120px]">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {[lead.firstname, lead.lastname].filter(Boolean).join(' ') || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400 min-w-[130px]">
                            {lead.phone}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400 min-w-[180px]">
                            {lead.email || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400 min-w-[100px]">
                            {lead.lead_source || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400 min-w-[120px]">
                            {lead.product || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 min-w-[200px] max-w-[250px]">
                            <span className="truncate block" title={lead.notes || ''}>
                              {lead.notes || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap min-w-[80px]">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              lead.status === 'new' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                              lead.status === 'contacted' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              lead.status === 'qualified' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {lead.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right w-20">
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              disabled={deletingId === lead.id}
                              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {/* Loading More Indicator */}
                  {loadingMore && (
                    <div className="flex items-center justify-center py-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Loading more...</span>
                    </div>
                  )}
                  
                  {/* End of List */}
                  {!hasMore && leads.length > 0 && (
                    <div className="text-center py-3 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                      All {leadsTotal} leads loaded
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer Stats */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {leads.length} of {leadsTotal} leads
                {hasMore && <span className="text-gray-400 dark:text-gray-500 ml-2">• Scroll down to load more</span>}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <>
          {/* Campaigns Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => {
                loadAssistantsAndPhones();
                setShowCreateCampaignModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </button>
            <button
              onClick={loadCampaigns}
              className="p-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${campaignsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Campaigns Grid */}
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Megaphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No campaigns yet</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first campaign to start calling leads</p>
              <button
                onClick={() => {
                  loadAssistantsAndPhones();
                  setShowCreateCampaignModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Campaign
              </button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((campaign) => (
                <div 
                  key={campaign.id} 
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  onClick={() => handleViewCampaign(campaign)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{campaign.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                        <button
                          onClick={(e) => handleCopyCampaignId(e, campaign.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-700 rounded transition-colors"
                          title="Copy Campaign ID for API"
                        >
                          {copiedCampaignId === campaign.id ? (
                            <>
                              <Check className="w-3 h-3 text-green-500" />
                              <span className="text-green-600 dark:text-green-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>ID</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCampaign(campaign.id); }}
                      disabled={deletingId === campaign.id}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title="Delete campaign"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{campaign.total_leads}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Leads</p>
                    </div>
                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{campaign.calls_answered}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Answered</p>
                    </div>
                    <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">{campaign.calls_completed}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Called</p>
                    </div>
                    <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">{campaign.calls_failed}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {campaign.total_leads > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.round((campaign.calls_completed / campaign.total_leads) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${(campaign.calls_completed / campaign.total_leads) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {(campaign.status === 'draft' || campaign.status === 'scheduled' || campaign.status === 'paused') && (
                      <button
                        onClick={() => handleStartCampaign(campaign.id)}
                        disabled={actionLoading === campaign.id || campaign.total_leads === 0}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <Play className="w-4 h-4" />
                        {campaign.status === 'paused' ? 'Resume' : 'Start'}
                      </button>
                    )}
                    {campaign.status === 'running' && (
                      <button
                        onClick={() => handlePauseCampaign(campaign.id)}
                        disabled={actionLoading === campaign.id}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                    )}
                    {(campaign.status === 'running' || campaign.status === 'paused') && (
                      <button
                        onClick={() => handleCancelCampaign(campaign.id)}
                        disabled={actionLoading === campaign.id}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        title="Cancel campaign"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                    {campaign.scheduled_at && (
                      <p className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Scheduled: {formatDate(campaign.scheduled_at)}
                      </p>
                    )}
                    <p>Created: {formatDate(campaign.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Upload Leads CSV</h3>
              <button
                onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadResult(null); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Expected CSV Format</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 font-mono">
                    firstname,lastname,phone,email,lead_source,product,notes
                  </p>
                </div>
              </div>
            </div>

            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                uploadFile ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file); }} />
              {uploadFile ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{uploadFile.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-900 dark:text-gray-100 font-medium">Drop CSV file here or click to browse</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Supports .csv files</p>
                </>
              )}
            </div>

            {uploadResult && (
              <div className={`mt-4 p-3 rounded-lg ${uploadResult.imported > 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                <div className="flex items-start gap-2">
                  {uploadResult.imported > 0 ? <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" /> : <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
                  <div>
                    <p className={`font-medium ${uploadResult.imported > 0 ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>{uploadResult.message}</p>
                    {uploadResult.errors.length > 0 && (
                      <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                        {uploadResult.errors.map((error, i) => <li key={i}>{error}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowUploadModal(false); setUploadFile(null); setUploadResult(null); }} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
              <button onClick={handleUpload} disabled={!uploadFile || uploading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{uploading ? 'Uploading...' : 'Upload'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Leads Webhook</h3>
              <button onClick={() => setShowWebhookModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Send leads to this webhook URL from external systems.</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Webhook URL</label>
              <div className="flex gap-2">
                <input type="text" value={webhookLoading ? 'Loading...' : webhookUrl} readOnly className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm" />
                <button onClick={copyToClipboard} disabled={webhookLoading || !webhookUrl} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50">
                  {copied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Example JSON Payload</p>
              <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">{`{
  "firstname": "John",
  "lastname": "Doe",
  "phone": "+14151234567",
  "email": "john@example.com",
  "lead_source": "Website",
  "product": "Product A"
}`}</pre>
            </div>
            <button onClick={() => setShowWebhookModal(false)} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Done</button>
          </div>
        </div>
      )}

      {/* Create Campaign Modal - Stepper Design */}
      {showCreateCampaignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full shadow-2xl overflow-hidden">
            {/* Header with Close */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create Campaign</h3>
              <button onClick={() => { setShowCreateCampaignModal(false); setCampaignStep(1); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Stepper Indicator */}
            <div className="px-6 pt-4">
              <div className="flex items-center justify-between mb-2">
                {[
                  { step: 1, label: 'Basic Info' },
                  { step: 2, label: 'Templates' },
                  { step: 3, label: 'Review' }
                ].map((item, idx) => (
                  <div key={item.step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                        campaignStep >= item.step 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}>
                        {campaignStep > item.step ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          item.step
                        )}
                      </div>
                      <span className={`text-xs mt-1 ${campaignStep >= item.step ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        {item.label}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div className={`h-1 flex-1 mx-2 rounded ${campaignStep > item.step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step Content - Scrollable */}
            <div className="p-6 max-h-[400px] overflow-y-auto">
              {/* Step 1: Basic Info */}
              {campaignStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Campaign Name *</label>
                    <input
                      type="text"
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                      placeholder="e.g., December Follow-ups"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Voice Agent *</label>
                    <select
                      value={newCampaign.assistant_id}
                      onChange={(e) => setNewCampaign({ ...newCampaign, assistant_id: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select an agent...</option>
                      {assistants.map((a) => (
                        <option key={a.id} value={a.vapi_assistant_id || a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number *</label>
                    <select
                      value={newCampaign.phone_number_id}
                      onChange={(e) => setNewCampaign({ ...newCampaign, phone_number_id: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a phone number...</option>
                      {phoneNumbers.map((p) => (
                        <option key={p.id} value={p.id}>{p.number} {p.name ? `(${p.name})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {selectedLeadIds.size > 0 && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>{selectedLeadIds.size}</strong> leads selected for this campaign
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: First Message Template */}
              {campaignStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">First Message</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">How should the AI greet the lead? This personalizes the opening line only - the assistant's full prompt is preserved.</p>
                    
                    <div className="space-y-2 mb-3">
                      {[
                        { label: 'Simple Greeting', value: 'Hello, is this {firstname}?', desc: 'Quick and direct' },
                        { label: 'Product Inquiry', value: 'Hi {firstname}, this is regarding your inquiry about {product}.', desc: 'Mention what they asked about' },
                        { label: 'Professional Intro', value: "Hello {firstname}, I'm calling from our team about your recent interest. Do you have a moment?", desc: 'Polite and professional' },
                        { label: 'With Notes Context', value: "Hi {firstname}, I'm reaching out because {notes}. Do you have a quick moment?", desc: 'Use lead notes in greeting' },
                      ].map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => setNewCampaign({ ...newCampaign, first_message_template: t.value })}
                          className={`w-full p-3 text-left rounded-lg border transition-all ${
                            newCampaign.first_message_template === t.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{t.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</p>
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        value={newCampaign.first_message_template}
                        onChange={(e) => setNewCampaign({ ...newCampaign, first_message_template: e.target.value })}
                        placeholder="Or write your own custom message..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <span className="font-medium">Available placeholders:</span> {'{firstname}'}, {'{lastname}'}, {'{product}'}, {'{notes}'}, {'{lead_source}'}
                    </p>
                  </div>

                  {/* Custom Prompt Template (Advanced) */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Custom AI Prompt (Optional)</label>
                      <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">Advanced</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Override the assistant's default prompt for outbound calls. Leave empty to use the assistant's original prompt.</p>
                    
                    {/* Prompt Templates */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { label: 'Sales Rep', desc: 'Friendly sales conversation', value: 'You are a friendly sales representative. The customer\'s name is {firstname}. They are interested in {product}. Context: {notes}\n\nBe conversational, helpful, and focus on understanding their needs. Keep responses brief and natural.' },
                        { label: 'Follow-up', desc: 'Check in on previous interest', value: 'You are following up with {firstname} about their interest in {product}. Notes from previous conversation: {notes}\n\nBe warm and reference any previous interactions. Ask if they have questions or need more information.' },
                        { label: 'Appointment', desc: 'Schedule a meeting', value: 'You are calling {firstname} to schedule an appointment regarding {product}. Context: {notes}\n\nBe professional and efficient. Offer available time slots and confirm their contact details.' },
                        { label: 'Support', desc: 'Help with an issue', value: 'You are a customer support representative helping {firstname} with {product}. Issue details: {notes}\n\nBe empathetic and solution-focused. Listen carefully and resolve their concerns.' },
                      ].map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => setNewCampaign({ ...newCampaign, prompt_template: t.value })}
                          className={`p-3 text-left rounded-lg border transition-all ${
                            newCampaign.prompt_template === t.value
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{t.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</p>
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={newCampaign.prompt_template}
                      onChange={(e) => setNewCampaign({ ...newCampaign, prompt_template: e.target.value })}
                      placeholder="Or write your own custom prompt..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <span className="font-medium">Available placeholders:</span> {'{firstname}'}, {'{lastname}'}, {'{product}'}, {'{notes}'}, {'{lead_source}'}
                    </p>
                    {newCampaign.prompt_template && (
                      <button
                        type="button"
                        onClick={() => setNewCampaign({ ...newCampaign, prompt_template: '' })}
                        className="mt-2 px-3 py-1.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                      >
                        Clear prompt
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-xs text-green-700 dark:text-green-300">
                      <strong>✓ Lead data injected automatically</strong> — Name, product, and notes are passed to the AI whether you use a custom prompt or the assistant's default.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {campaignStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Campaign</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{newCampaign.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Agent</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {assistants.find(a => (a.vapi_assistant_id || a.id) === newCampaign.assistant_id)?.name || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {phoneNumbers.find(p => p.id === newCampaign.phone_number_id)?.number || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Leads</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedLeadIds.size}</span>
                    </div>
                  </div>

                  {newCampaign.first_message_template && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Opening Message</p>
                      <p className="text-sm text-blue-900 dark:text-blue-100">{newCampaign.first_message_template}</p>
                    </div>
                  )}

                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                    <p className="text-xs text-green-700 dark:text-green-300">
                      ✓ Lead data (name, product, notes) will be passed to the assistant automatically
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Schedule (Optional)</label>
                    <input
                      type="datetime-local"
                      value={newCampaign.scheduled_at}
                      onChange={(e) => setNewCampaign({ ...newCampaign, scheduled_at: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave empty to start manually</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Navigation */}
            <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              {campaignStep === 1 ? (
                <button 
                  onClick={() => { setShowCreateCampaignModal(false); setCampaignStep(1); }} 
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              ) : (
                <button 
                  onClick={() => setCampaignStep(campaignStep - 1)} 
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Back
                </button>
              )}
              
              {campaignStep < 3 ? (
                <button 
                  onClick={() => setCampaignStep(campaignStep + 1)} 
                  disabled={campaignStep === 1 && (!newCampaign.name || !newCampaign.assistant_id || !newCampaign.phone_number_id)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              ) : (
                <button 
                  onClick={handleCreateCampaign} 
                  disabled={creatingCampaign}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingCampaign ? 'Creating...' : 'Create Campaign'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campaign Detail Modal */}
      {showCampaignDetailModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{selectedCampaign.name}</h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusColor(selectedCampaign.status)}`}>
                    {selectedCampaign.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(selectedCampaign.status === 'draft' || selectedCampaign.status === 'paused') && (
                    <button
                      onClick={handleOpenEditCampaign}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Edit Settings
                    </button>
                  )}
                  {campaignLeads.some(l => l.call_status === 'failed') && (
                    <button
                      onClick={handleRetryFailedLeads}
                      className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-sm rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
                    >
                      Retry Failed
                    </button>
                  )}
                  <button
                    onClick={() => { setShowCampaignDetailModal(false); setSelectedCampaign(null); setCampaignLeads([]); }}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Campaign Stats */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedCampaign.total_leads}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Leads</p>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{selectedCampaign.calls_answered}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Answered</p>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{selectedCampaign.calls_completed}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Calls Made</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{selectedCampaign.calls_failed}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
                </div>
              </div>
            </div>

            {/* Leads List */}
            <div className="flex-1 overflow-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Campaign Leads</h4>
                {(selectedCampaign.status === 'draft' || selectedCampaign.status === 'paused') && (
                  <button
                    onClick={handleOpenAddLeadsModal}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Leads
                  </button>
                )}
              </div>
              
              {campaignLeadsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : campaignLeads.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No leads in this campaign
                </div>
              ) : (
                <div className="space-y-3">
                  {campaignLeads.map((lead) => (
                    <div key={lead.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {[lead.firstname, lead.lastname].filter(Boolean).join(' ') || 'Unknown'}
                            </span>
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getCallStatusColor(lead.call_status)}`}>
                              {lead.call_status}
                            </span>
                            {lead.call_outcome && (
                              <span className={`text-xs font-medium ${getOutcomeColor(lead.call_outcome)}`}>
                                {lead.call_outcome}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {lead.phone}
                            </span>
                            {lead.call_duration !== null && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(lead.call_duration)}
                              </span>
                            )}
                            {lead.called_at && (
                              <span>Called: {formatDate(lead.called_at)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Call Summary */}
                      {lead.call_summary && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            <span className="font-medium text-gray-700 dark:text-gray-300">Summary: </span>
                            {lead.call_summary}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <button
                onClick={() => { setShowCampaignDetailModal(false); setSelectedCampaign(null); setCampaignLeads([]); }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {showEditCampaignModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-3xl w-full shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Campaign</h3>
              <button onClick={() => setShowEditCampaignModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Campaign Name *</label>
                    <input
                      type="text"
                      value={editingCampaign.name}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 text-sm"
                      placeholder="Enter campaign name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assistant *</label>
                    <select
                      value={editingCampaign.assistant_id}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, assistant_id: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 text-sm"
                    >
                      <option value="">Select an assistant</option>
                      {assistants.map((a) => (
                        <option key={a.id} value={a.vapi_assistant_id || a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number *</label>
                    <select
                      value={editingCampaign.phone_number_id}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, phone_number_id: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 text-sm"
                    >
                      <option value="">Select a phone number</option>
                      {phoneNumbers.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.number} {p.name && `(${p.name})`}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Message</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {[
                        { label: 'Simple', value: 'Hello, is this {firstname}?' },
                        { label: 'Product', value: 'Hi {firstname}, this is regarding your inquiry about {product}.' },
                        { label: 'Notes', value: "Hi {firstname}, I'm reaching out because {notes}. Do you have a quick moment?" },
                      ].map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => setEditingCampaign({ ...editingCampaign, first_message_template: t.value })}
                          className={`px-2 py-1 text-xs rounded-full transition-all ${
                            editingCampaign.first_message_template === t.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={editingCampaign.first_message_template}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, first_message_template: e.target.value })}
                      placeholder="Custom first message..."
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 text-sm"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use: {'{firstname}'}, {'{product}'}, {'{notes}'}
                    </p>
                  </div>
                </div>

                {/* Right Column - Custom Prompt */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Custom AI Prompt</label>
                    <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">Optional</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Override assistant's default prompt. Leave empty to use original.</p>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Sales', value: 'You are a friendly sales representative. The customer\'s name is {firstname}. They are interested in {product}. Context: {notes}\n\nBe conversational and helpful. Keep responses brief.' },
                      { label: 'Follow-up', value: 'You are following up with {firstname} about their interest in {product}. Notes: {notes}\n\nBe warm and ask if they have questions.' },
                      { label: 'Appointment', value: 'You are calling {firstname} to schedule an appointment regarding {product}. Context: {notes}\n\nBe professional and offer time slots.' },
                      { label: 'Support', value: 'You are helping {firstname} with {product}. Issue: {notes}\n\nBe empathetic and solution-focused.' },
                    ].map((t) => (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => setEditingCampaign({ ...editingCampaign, prompt_template: t.value })}
                        className={`p-2 text-left rounded-lg border transition-all ${
                          editingCampaign.prompt_template === t.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <p className="font-medium text-xs text-gray-900 dark:text-gray-100">{t.label}</p>
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={editingCampaign.prompt_template}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, prompt_template: e.target.value })}
                    placeholder="Or write your own custom prompt..."
                    rows={5}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-gray-100 text-sm"
                  />
                  
                  {editingCampaign.prompt_template && (
                    <button
                      type="button"
                      onClick={() => setEditingCampaign({ ...editingCampaign, prompt_template: '' })}
                      className="px-3 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                    >
                      Clear prompt
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-xs text-green-700 dark:text-green-300">
                  ✓ Lead data (name, product, notes) is automatically passed to your assistant
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowEditCampaignModal(false)} className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm">Cancel</button>
              <button 
                onClick={handleUpdateCampaign} 
                disabled={updatingCampaign || !editingCampaign.name || !editingCampaign.assistant_id || !editingCampaign.phone_number_id} 
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {updatingCampaign ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Leads to Campaign Modal */}
      {showAddLeadsModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add Leads to Campaign</h3>
                <button
                  onClick={() => { setShowAddLeadsModal(false); setSelectedLeadsToAdd(new Set()); }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Select leads to add to "{selectedCampaign.name}"
              </p>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {availableLeadsForCampaign.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No available leads to add. All leads are already in this campaign.
                </div>
              ) : (
                <div className="space-y-2">
                  {availableLeadsForCampaign.map((lead) => (
                    <div
                      key={lead.id}
                      onClick={() => toggleLeadToAdd(lead.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedLeadsToAdd.has(lead.id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedLeadsToAdd.has(lead.id)}
                          onChange={() => toggleLeadToAdd(lead.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {[lead.firstname, lead.lastname].filter(Boolean).join(' ') || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {lead.phone} {lead.email && `• ${lead.email}`}
                          </p>
                        </div>
                        {lead.product && (
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                            {lead.product}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAddLeadsModal(false); setSelectedLeadsToAdd(new Set()); }}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddLeadsToCampaign}
                  disabled={addingLeadsToCampaign || selectedLeadsToAdd.size === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingLeadsToCampaign ? 'Adding...' : `Add ${selectedLeadsToAdd.size} Lead${selectedLeadsToAdd.size !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
