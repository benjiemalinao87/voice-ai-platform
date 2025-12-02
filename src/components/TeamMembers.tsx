/**
 * Team Members Component
 * Beautiful, clean design matching Twilio's team management UI
 * Supports dark mode with premium aesthetics
 */

import { useState, useEffect } from 'react';
import { Users, UserPlus, Building2, CheckCircle2, Clock, Info, X, Mail, MoreVertical, Trash2, Shield, User, Key } from 'lucide-react';
import { d1Client } from '../lib/d1';
import { useAuth } from '../contexts/AuthContext';
import { useVapi } from '../contexts/VapiContext';

interface Workspace {
  id: string;
  name: string;
  owner_user_id: string;
  role: string;
  status: string;
  created_at: number;
  updated_at: number;
}

interface Member {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  joinedAt: number | null;
}

interface WorkspaceWithMembers {
  workspace: { id: string; name: string };
  members: Member[];
}

// Avatar color generator (consistent colors for same initials)
const getAvatarColor = (initials: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-teal-500',
  ];
  const index = initials.charCodeAt(0) % colors.length;
  return colors[index];
};

const getInitials = (name: string | null, email: string): string => {
  if (name) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
};

const formatRole = (role: string): string => {
  if (role === 'owner') return 'Team Admin';
  if (role === 'admin') return 'Admin';
  return 'Member';
};

export function TeamMembers() {
  const { user } = useAuth();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useVapi();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [showMemberMenu, setShowMemberMenu] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ email: string; temporaryPassword: string } | null>(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    // Sync selected workspace from VapiContext
    if (selectedWorkspaceId && workspaces.length > 0) {
      const ws = workspaces.find(w => w.id === selectedWorkspaceId);
      if (ws) {
        setSelectedWorkspace(ws);
        setCurrentUserRole(ws.role);
      }
    } else if (!selectedWorkspaceId) {
      // If no workspace selected, default to first workspace for viewing
      if (workspaces.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(workspaces[0]);
        setCurrentUserRole(workspaces[0].role);
      }
    }
  }, [selectedWorkspaceId, workspaces]);

  useEffect(() => {
    if (selectedWorkspace) {
      loadMembers(selectedWorkspace.id);
      setCurrentUserRole(selectedWorkspace.role);
    }
  }, [selectedWorkspace]);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const response = await d1Client.getWorkspaces();
      setWorkspaces(response.workspaces || []);
      if (response.workspaces && response.workspaces.length > 0) {
        setSelectedWorkspace(response.workspaces[0]);
      }
    } catch (error: any) {
      console.error('Error loading workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (workspaceId: string) => {
    try {
      setLoadingMembers(true);
      const response = await d1Client.getWorkspaceMembers(workspaceId);
      setMembers(response.members || []);
    } catch (error: any) {
      console.error('Error loading members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleInvite = async () => {
    if (!selectedWorkspace || !inviteEmail.trim()) return;

    setInviting(true);
    setInviteError('');
    setGeneratedCredentials(null);

    try {
      const result = await d1Client.inviteWorkspaceMember(selectedWorkspace.id, inviteEmail.trim(), inviteRole);

      // Check if credentials were generated (new user created)
      if (result.credentials) {
        setGeneratedCredentials(result.credentials);
        // Don't close modal yet - show credentials first
      } else {
        // Existing user was added
        setShowInviteModal(false);
        setInviteEmail('');
        setInviteRole('member');
      }

      // Reload members
      await loadMembers(selectedWorkspace.id);
    } catch (error: any) {
      setInviteError(error.message || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const canManageTeam = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOwner = currentUserRole === 'owner';

  // Auto-select workspace if user only has one
  useEffect(() => {
    if (workspaces.length === 1 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId, setSelectedWorkspaceId]);

  // Ensure we're using the current workspace - MUST be before early return
  useEffect(() => {
    if (workspaces.length > 0) {
      const currentWorkspace = workspaces[0];
      if (currentWorkspace && currentWorkspace.id !== selectedWorkspaceId) {
        setSelectedWorkspace(currentWorkspace);
        setSelectedWorkspaceId(currentWorkspace.id);
      }
    }
  }, [workspaces, selectedWorkspaceId, setSelectedWorkspaceId]);

  if (workspaces.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <Building2 className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          No Workspace
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Your workspace should have been created automatically. Please contact support if you see this message.
        </p>
      </div>
    );
  }

  // Use the first (and only) workspace
  const currentWorkspace = workspaces[0];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Team Members</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your team members and permissions</p>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        {/* General Section */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            General Information
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            View your team's information and members
          </p>

          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Team name
            </label>
            <div className="relative">
              <input
                type="text"
                value={selectedWorkspace?.name || ''}
                readOnly={!canManageTeam}
                disabled={!canManageTeam}
                className={`w-full px-4 py-3 border rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 ${canManageTeam
                    ? 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700'
                    : 'border-gray-200 dark:border-gray-700 cursor-not-allowed'
                  }`}
                placeholder="Enter team name"
              />
              {!canManageTeam && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Info className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
              )}
            </div>
            {!canManageTeam && (
              <div className="mt-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <p className="text-sm text-orange-800 dark:text-orange-300">
                  You cannot make changes to the team name as you are not an admin
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Team Members Section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                Team Members
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {members.length} {members.length === 1 ? 'member' : 'members'} in this team
              </p>
            </div>
            <div className="flex items-center gap-3">
              {canManageTeam && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Member
                </button>
              )}
            </div>
          </div>

          {loadingMembers ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No members yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const initials = getInitials(member.name, member.email);
                const avatarColor = getAvatarColor(initials);
                const isPending = member.status === 'pending';
                const isActive = member.status === 'active';

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {/* Avatar */}
                      <div className={`w-12 h-12 ${avatarColor} rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0`}>
                        {initials}
                      </div>

                      {/* Name and Email */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {member.name || member.email}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {member.email}
                        </p>
                      </div>

                      {/* Role */}
                      <div className="hidden sm:block">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatRole(member.role)}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                              ACTIVE
                            </span>
                          </>
                        )}
                        {isPending && (
                          <>
                            <Clock className="w-4 h-4 text-orange-500" />
                            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                              PENDING
                            </span>
                          </>
                        )}
                      </div>

                      {/* Actions Menu - Only for owners/admins, and not for the owner */}
                      {canManageTeam && member.role !== 'owner' && (
                        <div className="relative">
                          <button
                            onClick={() => setShowMemberMenu(showMemberMenu === member.id ? null : member.id)}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </button>

                          {showMemberMenu === member.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowMemberMenu(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                                <button
                                  onClick={async () => {
                                    if (!selectedWorkspace) return;
                                    const newRole = member.role === 'admin' ? 'member' : 'admin';
                                    setChangingRole(member.id);
                                    try {
                                      await d1Client.updateWorkspaceMemberRole(selectedWorkspace.id, member.id, newRole);
                                      await loadMembers(selectedWorkspace.id);
                                    } catch (error: any) {
                                      alert(error.message || 'Failed to update role');
                                    } finally {
                                      setChangingRole(null);
                                      setShowMemberMenu(null);
                                    }
                                  }}
                                  disabled={changingRole === member.id || currentUserRole !== 'owner'}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                                >
                                  {member.role === 'admin' ? (
                                    <>
                                      <User className="w-4 h-4" />
                                      Change to Member
                                    </>
                                  ) : (
                                    <>
                                      <Shield className="w-4 h-4" />
                                      Change to Admin
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!selectedWorkspace) return;
                                    if (!confirm(`Reset password for ${member.name || member.email}? A new password will be sent to their email.`)) return;
                                    setResettingPassword(member.id);
                                    try {
                                      const result = await d1Client.resetMemberPassword(selectedWorkspace.id, member.id);
                                      alert(result.message || 'Password reset successfully. An email with the new password has been sent.');
                                    } catch (error: any) {
                                      alert(error.message || 'Failed to reset password');
                                    } finally {
                                      setResettingPassword(null);
                                      setShowMemberMenu(null);
                                    }
                                  }}
                                  disabled={resettingPassword === member.id}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                                >
                                  <Key className="w-4 h-4" />
                                  Reset Password
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!selectedWorkspace) return;
                                    if (!confirm(`Remove ${member.name || member.email} from this workspace?`)) return;
                                    setRemovingMember(member.id);
                                    try {
                                      await d1Client.removeWorkspaceMember(selectedWorkspace.id, member.id);
                                      await loadMembers(selectedWorkspace.id);
                                    } catch (error: any) {
                                      alert(error.message || 'Failed to remove member');
                                    } finally {
                                      setRemovingMember(null);
                                      setShowMemberMenu(null);
                                    }
                                  }}
                                  disabled={removingMember === member.id}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 disabled:opacity-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Remove Member
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Invite Team Member
              </h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteError('');
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="member">Member</option>
                  {isOwner && <option value="admin">Admin</option>}
                </select>
              </div>

              {inviteError && (
                <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-300">{inviteError}</p>
                </div>
              )}

              {generatedCredentials && (
                <div className="px-4 py-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                      Account Created Successfully!
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Email</p>
                      <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100 break-all">
                        {generatedCredentials.email}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-green-200 dark:border-green-700">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Temporary Password</p>
                      <p className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100 break-all select-all">
                        {generatedCredentials.temporaryPassword}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-green-800 dark:text-green-300 mt-2">
                    📋 Share these credentials with the user. They can login immediately.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                {generatedCredentials ? (
                  <button
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteEmail('');
                      setInviteError('');
                      setInviteRole('member');
                      setGeneratedCredentials(null);
                    }}
                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                  >
                    Done
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setShowInviteModal(false);
                        setInviteEmail('');
                        setInviteError('');
                      }}
                      disabled={inviting}
                      className="flex-1 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleInvite}
                      disabled={inviting || !inviteEmail.trim()}
                      className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {inviting ? 'Inviting...' : 'Send Invitation'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

