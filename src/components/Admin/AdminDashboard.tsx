import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Shield,
  Users,
  Package,
  FileText,
  MessageCircle,
  Activity,
  UserX,
  Search,
  Filter,
  MoreVertical,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  // Check if user has admin privileges
  if (!user || !['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin'].includes(user.role)) {
    return (
      <div className="text-center py-12">
        <Shield className="h-16 w-16 text-red-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">Access Denied</h3>
        <p className="text-slate-600">You don't have permission to access the admin dashboard.</p>
      </div>
    )
  }

  // Fetch system statistics
  const { data: systemStats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery<any>({
    queryKey: ['admin-system-stats'],
    queryFn: async () => {
      console.log('[Admin Dashboard] Fetching system stats...')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }
      
      const { data, error } = await supabase.functions.invoke('admin-management', {
        body: { action: 'get_system_stats' },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      console.log('[Admin Dashboard] Stats response:', { data, error })
      
      if (error) {
        console.error('[Admin Dashboard] Stats error:', error)
        throw new Error(error.message || 'Failed to fetch system stats')
      }
      return data.data
    },
    enabled: !!user && ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin'].includes(user.role),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
    retry: (failureCount, error: any) => {
      console.log('[Admin Dashboard] Stats query retry:', failureCount, error.message)
      return failureCount < 3
    }
  })

  // Fetch all users
  const { data: allUsers = [], isLoading: usersLoading, error: usersError } = useQuery<any[]>({
    queryKey: ['admin-all-users', searchTerm, roleFilter],
    queryFn: async () => {
      console.log('[Admin Dashboard] Fetching all users...')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }
      
      const { data, error } = await supabase.functions.invoke('admin-management', {
        body: { action: 'get_all_users' },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      console.log('[Admin Dashboard] Users response:', { data, error })
      
      if (error) {
        console.error('[Admin Dashboard] Users error:', error)
        throw error
      }
      
      let filteredUsers = data.data || []
      
      // Apply client-side filtering for search and role
      if (searchTerm) {
        filteredUsers = filteredUsers.filter((user: any) => 
          user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }
      
      if (roleFilter !== 'all') {
        filteredUsers = filteredUsers.filter((user: any) => user.role?.toLowerCase() === roleFilter.toLowerCase())
      }
      
      console.log('[Admin Dashboard] Filtered users count:', filteredUsers.length)
      return filteredUsers
    },
    enabled: !!user && ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin'].includes(user.role) && activeTab === 'users',
    refetchInterval: 30000 // Auto-refresh every 30 seconds
  })

  // Fetch system logs
  const { data: systemLogs = [], isLoading: logsLoading, error: logsError } = useQuery<any[]>({
    queryKey: ['admin-system-logs'],
    queryFn: async () => {
      console.log('[Admin Dashboard] Fetching system logs...')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }
      
      const { data, error } = await supabase.functions.invoke('admin-management', {
        body: { action: 'get_system_logs' },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      console.log('[Admin Dashboard] System logs response:', { data, error })
      
      if (error) {
        console.error('[Admin Dashboard] System logs error:', error)
        throw error
      }
      
      const activities = data.data?.activities || []
      console.log('[Admin Dashboard] Parsed activities:', activities)
      return activities
    },
    enabled: !!user && ['SUPER_ADMIN', 'ADMIN', 'super_admin', 'admin'].includes(user.role) && activeTab === 'logs',
    refetchInterval: 15000, // Auto-refresh every 15 seconds for logs
    retry: (failureCount, error: any) => {
      console.log('[Admin Dashboard] System logs retry:', failureCount, error.message)
      return failureCount < 3
    }
  })

  // Update user role mutation
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ targetUserId, newRole, reason }: { targetUserId: string, newRole: string, reason: string }) => {
      console.log('[Admin Dashboard] Updating user role:', { targetUserId, newRole, reason })
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }
      
      const { data, error } = await supabase.functions.invoke('admin-management', {
        body: {
          action: 'update_user_role',
          targetUserId,
          newRole: newRole,
          reason
        },
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      console.log('[Admin Dashboard] Role update response:', { data, error })
      
      if (error) {
        console.error('[Admin Dashboard] Role update error:', error)
        throw new Error(error.message || 'Failed to update user role')
      }
      return data
    },
    onSuccess: (data) => {
      console.log('[Admin Dashboard] Role update successful:', data)
      toast.success('User role updated successfully')
      // Invalidate and refetch queries to update UI
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-system-stats'] })
      queryClient.invalidateQueries({ queryKey: ['admin-system-logs'] })
    },
    onError: (error: any) => {
      console.error('[Admin Dashboard] Role update failed:', error)
      toast.error(error.message || 'Failed to update user role')
    }
  })

  const handleRoleUpdate = (userId: string, newRole: string) => {
    const reason = prompt('Please provide a reason for this role change:')
    if (!reason || reason.trim().length < 5) {
      toast.error('A detailed reason (minimum 5 characters) is required for role changes')
      return
    }
    
    if (window.confirm(`Are you sure you want to update this user's role to ${newRole}?`)) {
      updateUserRoleMutation.mutate({ targetUserId: userId, newRole: newRole, reason: reason.trim() })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleColor = (role: string) => {
    const normalizedRole = (role || 'user').toLowerCase()
    switch (normalizedRole) {
      case 'super_admin': return 'bg-purple-100 text-purple-700'
      case 'admin': return 'bg-red-100 text-red-700'
      case 'contributor': return 'bg-blue-100 text-blue-700'
      case 'user':
      case 'requester': return 'bg-slate-100 text-slate-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const getRoleDisplayName = (role: string) => {
    const normalizedRole = (role || 'user').toLowerCase()
    switch (normalizedRole) {
      case 'super_admin': return 'Super Admin'
      case 'admin': return 'Admin'
      case 'contributor': return 'Contributor'
      case 'user':
      case 'requester': return 'User'
      default: return 'User'
    }
  }

  const isFounder = (userProfile: any) => {
    return userProfile?.profile_info?.is_founder === true || userProfile?.role_hierarchy_level === 5
  }

  const canManageUser = (targetUser: any) => {
    if (isFounder(targetUser)) return false // Founders cannot be managed
    if (targetUser.id === user.id) return false // Can't manage yourself
    
    const currentLevel = user.role_hierarchy_level || 1
    const targetLevel = targetUser.role_hierarchy_level || 1
    
    return currentLevel > targetLevel
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'logs', label: 'System Activity Logs', icon: Activity }
  ]

  if (statsError) {
    console.error('Stats error:', statsError)
  }
  if (usersError) {
    console.error('Users error:', usersError)
  }
  if (logsError) {
    console.error('Logs error:', logsError)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-600">Platform administration and management</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-red-600" />
          <span className="text-sm font-medium text-red-600">
            {(user.role || '').toLowerCase() === 'super_admin' ? 'Super Administrator' : 'Administrator'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl p-1 shadow-sm border border-slate-200 inline-flex">
        {tabs.map((tab) => {
          const IconComponent = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-xl text-sm font-medium transition-colors flex items-center ${
                activeTab === tab.id
                  ? 'bg-red-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <IconComponent className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* System Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {statsLoading ? (
                      <div className="w-8 h-6 bg-slate-200 rounded animate-pulse"></div>
                    ) : (
                      systemStats?.totalUsers || 0
                    )}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Resources</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {statsLoading ? (
                      <div className="w-8 h-6 bg-slate-200 rounded animate-pulse"></div>
                    ) : (
                      systemStats?.totalResources || 0
                    )}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <Package className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Requests</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {statsLoading ? (
                      <div className="w-8 h-6 bg-slate-200 rounded animate-pulse"></div>
                    ) : (
                      systemStats?.totalRequests || 0
                    )}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <FileText className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Messages</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {statsLoading ? (
                      <div className="w-8 h-6 bg-slate-200 rounded animate-pulse"></div>
                    ) : (
                      systemStats?.totalMessages || 0
                    )}
                  </p>
                </div>
                <div className="bg-orange-100 p-3 rounded-lg">
                  <MessageCircle className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Role Distribution and Recent Activity */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">User Role Distribution</h3>
              {statsLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-2 bg-slate-200 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(systemStats?.roleDistribution || {}).map(([role, count]: [string, any]) => (
                    <div key={role} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getRoleColor(role)}`}>
                          {getRoleDisplayName(role)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Admin Activity */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Admin Activity</h3>
              {statsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : (() => {
                console.log('[AdminDashboard] systemStats:', systemStats);
                console.log('[AdminDashboard] recentActivity:', systemStats?.recentActivity);
                
                const activities = systemStats?.recentActivity || [];
                console.log('[AdminDashboard] activities array:', activities);
                
                return activities && activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity: any, index: number) => {
                      console.log('[AdminDashboard] rendering activity:', activity);
                      return (
                        <div key={activity.id || index} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
                          <div className="bg-red-100 p-2 rounded-lg flex-shrink-0">
                            <Activity className="h-4 w-4 text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                            <p className="text-xs text-slate-500">{formatDate(activity.timestamp)}</p>
                            {activity.details?.reason && (
                              <p className="text-xs text-slate-600 mt-1 truncate">{activity.details.reason}</p>
                            )}
                            {activity.details?.newValue && activity.details?.oldValue && (
                              <p className="text-xs text-blue-600 mt-1">
                                {activity.details.oldValue} → {activity.details.newValue}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No recent admin activity found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Role changes and admin actions will appear here
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="contributor">Contributor</option>
                <option value="user">User</option>
              </select>
              
              <div className="flex items-center justify-end">
                <span className="text-sm text-slate-600">
                  {allUsers.length} user{allUsers.length !== 1 ? 's' : ''} found
                </span>
              </div>
            </div>
          </div>

          {/* Users List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {usersLoading ? (
              <div className="p-6">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center space-x-4">
                      <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                      </div>
                      <div className="w-20 h-6 bg-slate-200 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : allUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">User</th>
                      <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Role</th>
                      <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Joined</th>
                      <th className="text-left py-3 px-6 text-sm font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {allUsers.map((userItem: any) => (
                      <tr key={userItem.id} className="hover:bg-slate-50">
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-blue-600">
                                {(userItem.name || userItem.email)?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 flex items-center">
                                {userItem.name || 'Unnamed User'}
                                {isFounder(userItem) && (
                                  <span className="ml-2 inline-flex px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                                    Founder
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-slate-500 truncate">{userItem.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(userItem.role)}`}>
                            {getRoleDisplayName(userItem.role)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-sm text-slate-600">{formatDate(userItem.created_at)}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-2">
                            {canManageUser(userItem) && (
                              <select
                                value={userItem.role}
                                onChange={(e) => handleRoleUpdate(userItem.id, e.target.value)}
                                className="px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                                disabled={updateUserRoleMutation.isPending}
                              >
                                <option value="user">User</option>
                                <option value="contributor">Contributor</option>
                                <option value="admin">Admin</option>
                                {(user.role_hierarchy_level || 0) >= 4 && (
                                  <option value="super_admin">Super Admin</option>
                                )}
                              </select>
                            )}
                            {userItem.id === user.id && (
                              <span className="text-xs text-slate-500">(You)</span>
                            )}
                            {isFounder(userItem) && (
                              <span className="text-xs text-purple-600">(Protected)</span>
                            )}
                            {updateUserRoleMutation.isPending && (
                              <RefreshCw className="h-4 w-4 text-slate-400 animate-spin" />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No users found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* System Activity Logs Tab */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">System Activity Logs</h3>
                <p className="text-sm text-slate-600">Comprehensive activity tracking across the platform</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 text-xs text-slate-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Live Updates</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {logsError ? (
              <div className="text-center py-12">
                <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-3" />
                <p className="text-lg font-medium text-red-600 mb-1">Failed to Load System Logs</p>
                <p className="text-sm text-red-500">Error: {(logsError as any)?.message || 'Unknown error'}</p>
                <button 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-system-logs'] })}
                  className="mt-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : logsLoading ? (
              <div className="p-6">
                <div className="space-y-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-start space-x-4">
                      <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : systemLogs.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {systemLogs.map((log: any) => (
                  <div key={log.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start space-x-4">
                      {/* Activity Type Icon */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        log.type === 'admin_activity' 
                          ? log.severity === 'warning' ? 'bg-red-100' : 'bg-purple-100'
                          : log.type === 'user_activity'
                          ? 'bg-blue-100'
                          : 'bg-slate-100'
                      }`}>
                        {log.type === 'admin_activity' ? (
                          <Shield className={`h-4 w-4 ${
                            log.severity === 'warning' ? 'text-red-600' : 'text-purple-600'
                          }`} />
                        ) : log.type === 'user_activity' ? (
                          <Users className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Activity className="h-4 w-4 text-slate-600" />
                        )}
                      </div>
                      
                      {/* Activity Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">
                            {log.action || 'Unknown Action'}
                          </p>
                          <span className="text-xs text-slate-500">
                            {log.timestamp ? formatDate(log.timestamp) : 'Unknown Time'}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-slate-500">By:</span>
                            <span className="text-xs font-medium text-slate-700">{log.user_name || 'Unknown User'}</span>
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              getRoleColor(log.user_role)
                            }`}>
                              {getRoleDisplayName(log.user_role)}
                            </span>
                          </div>
                          
                          {log.target_name && (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-slate-500">Target:</span>
                              <span className="text-xs font-medium text-slate-700">{log.target_name}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-1">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              log.type === 'admin_activity' ? 'bg-purple-50 text-purple-700' :
                              log.type === 'user_activity' ? 'bg-blue-50 text-blue-700' :
                              'bg-slate-50 text-slate-700'
                            }`}>
                              {(log.type || 'system').replace('_', ' ').toUpperCase()}
                            </span>
                          </div>

                          {log.severity === 'warning' && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        
                        {/* Additional Details */}
                        {log.details && (Object.keys(log.details).length > 0) && (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 flex items-center space-x-1">
                              <Eye className="h-3 w-3" />
                              <span>View Details</span>
                            </summary>
                            <div className="mt-2 p-3 bg-slate-50 rounded-lg border">
                              {log.details.reason && (
                                <div className="mb-2">
                                  <span className="text-xs font-medium text-slate-600">Reason:</span>
                                  <p className="text-xs text-slate-800 mt-1">{log.details.reason}</p>
                                </div>
                              )}
                              {log.details.old_value && (
                                <div className="mb-2">
                                  <span className="text-xs font-medium text-slate-600">From:</span>
                                  <p className="text-xs text-slate-800 font-mono">{log.details.old_value}</p>
                                </div>
                              )}
                              {log.details.new_value && (
                                <div className="mb-2">
                                  <span className="text-xs font-medium text-slate-600">To:</span>
                                  <p className="text-xs text-slate-800 font-mono">{log.details.new_value}</p>
                                </div>
                              )}
                              {log.details.ip_address && (
                                <div className="text-xs text-slate-500">
                                  IP: {log.details.ip_address}
                                </div>
                              )}
                              {log.details.success === false && (
                                <div className="flex items-center space-x-1 text-xs text-red-600">
                                  <XCircle className="h-3 w-3" />
                                  <span>Operation Failed</span>
                                </div>
                              )}
                              {log.details.success === true && (
                                <div className="flex items-center space-x-1 text-xs text-green-600">
                                  <CheckCircle className="h-3 w-3" />
                                  <span>Operation Successful</span>
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Load More Indicator */}
                <div className="p-4 text-center border-t border-slate-200">
                  <p className="text-xs text-slate-500">Showing latest {systemLogs.length} activities • Auto-refreshes every 15 seconds</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-lg font-medium text-slate-600 mb-1">No System Logs Found</p>
                <p className="text-sm text-slate-500">Activity logs will appear here as actions are performed on the platform</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}