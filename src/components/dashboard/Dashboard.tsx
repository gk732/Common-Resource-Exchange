import React, { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  Users,
  Package,
  FileText,
  MessageCircle,
  TrendingUp,
  Clock,
  Star,
  Activity
} from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // PERFORMANCE OPTIMIZATION: Reduced real-time subscriptions and activity tracking frequency
  useEffect(() => {
    if (!user) return

    // Track dashboard visit for active users count (reduced frequency)
    const trackDashboardVisit = async () => {
      try {
        await supabase
          .from('users')
          .update({ 
            last_login: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
      } catch (error) {
        console.warn('Failed to track dashboard visit:', error)
      }
    }

    // Track visit immediately
    trackDashboardVisit()

    // PERFORMANCE FIX: Increased interval from 10 minutes to 15 minutes
    const activityInterval = setInterval(() => {
      trackDashboardVisit()
    }, 15 * 60 * 1000) // 15 minutes instead of 10

    // PERFORMANCE OPTIMIZATION: Optimized real-time subscriptions with debouncing
    let invalidationTimeout: NodeJS.Timeout
    const debouncedInvalidation = (queryKeys: string[]) => {
      clearTimeout(invalidationTimeout)
      invalidationTimeout = setTimeout(() => {
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] })
        })
      }, 1000) // 1 second debounce to prevent excessive updates
    }

    // Single consolidated subscription with debounced invalidations
    const dashboardChannel = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'resources' }, 
        () => {
          debouncedInvalidation(['platform-stats', 'user-resources'])
        })
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'requests' }, 
        () => {
          debouncedInvalidation(['platform-stats', 'user-requests'])
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        () => {
          debouncedInvalidation(['platform-stats'])
        })
      .subscribe()

    return () => {
      clearInterval(activityInterval)
      clearTimeout(invalidationTimeout)
      dashboardChannel.unsubscribe()
    }
  }, [user, queryClient])

  // PERFORMANCE OPTIMIZATION: Increased polling interval and stale time for platform stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('statistics-system', {
        body: { action: 'get_platform_stats' }
      })
      
      if (error) throw error
      return data.data || {
        totalResources: 0,
        activeUsers: 0,
        totalMessages: 0,
        totalRequests: 0
      }
    },
    enabled: !!user,
    refetchInterval: 300000, // PERFORMANCE FIX: Increased from 2 minutes to 5 minutes
    staleTime: 180000, // PERFORMANCE FIX: Increased from 1 minute to 3 minutes
    gcTime: 10 * 60 * 1000, // Keep cached for 10 minutes instead of 5
    refetchOnWindowFocus: false // PERFORMANCE FIX: Disable refetch on window focus
  })

  // PERFORMANCE OPTIMIZATION: Added better caching for user resources
  const { data: userResources, isLoading: resourcesLoading } = useQuery({
    queryKey: ['user-resources', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      return data || []
    },
    enabled: !!user,
    staleTime: 120000, // 2 minutes stale time
    gcTime: 5 * 60 * 1000, // Keep cached for 5 minutes
    refetchOnWindowFocus: false
  })

  // PERFORMANCE OPTIMIZATION: Enhanced caching for user requests
  const { data: userRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['user-requests', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          resources:resource_id (title, user_id)
        `)
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      
      // Filter out requests with deleted resources and add proper status handling
      return (data || []).map(request => ({
        ...request,
        resource_title: request.resources?.title || '[Resource Deleted]',
        resource_exists: !!request.resources,
        display_status: request.resources ? request.status : 'resource_deleted'
      }))
    },
    enabled: !!user,
    staleTime: 120000, // 2 minutes stale time
    gcTime: 5 * 60 * 1000, // Keep cached for 5 minutes
    refetchOnWindowFocus: false
  })

  // PERFORMANCE OPTIMIZATION: Enhanced caching for notifications
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['recent-notifications', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      return data || []
    },
    enabled: !!user,
    staleTime: 180000, // 3 minutes stale time for notifications
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'approved': return 'text-green-600 bg-green-100'
      case 'rejected': return 'text-red-600 bg-red-100'
      case 'completed': return 'text-blue-600 bg-blue-100'
      case 'resource_deleted': return 'text-gray-600 bg-gray-100'
      default: return 'text-slate-600 bg-slate-100'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'resource_deleted': return 'Resource Deleted'
      case 'pending': return 'Pending'
      case 'approved': return 'Approved'
      case 'rejected': return 'Rejected'
      case 'completed': return 'Completed'
      default: return status
    }
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {getGreeting()}, {user?.name}!
            </h1>
            <p className="text-slate-600 mt-1">
              Welcome to your Common Resource Exchange dashboard
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">Your Role</div>
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
              user?.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
              user?.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
              user?.role === 'CONTRIBUTOR' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Platform Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Resources Shared</p>
              <p className="text-2xl font-bold text-slate-900">
                {statsLoading ? '...' : stats?.totalResources?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Across the platform</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full -mr-10 -mt-10"></div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Active Users</p>
              <p className="text-2xl font-bold text-slate-900">
                {statsLoading ? '...' : stats?.activeUsers?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Active in past 7 days</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -mr-10 -mt-10"></div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Message Exchanges</p>
              <p className="text-2xl font-bold text-slate-900">
                {statsLoading ? '...' : stats?.totalMessages?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total messages sent</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <MessageCircle className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -mr-10 -mt-10"></div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Your Resources</p>
              <p className="text-2xl font-bold text-slate-900">
                {resourcesLoading ? '...' : userResources?.length || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Resources you've shared</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full -mr-10 -mt-10"></div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Resources */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Your Recent Resources</h2>
            <Link
              to="/resources"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View all
            </Link>
          </div>
          
          {resourcesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : userResources && userResources.length > 0 ? (
            <div className="space-y-4">
              {userResources.map((resource) => (
                <div key={resource.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <h3 className="font-medium text-slate-900">{resource.title}</h3>
                    <p className="text-sm text-slate-600">{resource.category} • {resource.condition}</p>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      resource.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {resource.is_available ? 'Available' : 'Unavailable'}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{formatDate(resource.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No resources yet</p>
              <Link
                to="/resources"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2 inline-block"
              >
                Add your first resource
              </Link>
            </div>
          )}
        </div>

        {/* Recent Requests */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Your Recent Requests</h2>
            <Link
              to="/requests"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View all
            </Link>
          </div>
          
          {requestsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : userRequests && userRequests.length > 0 ? (
            <div className="space-y-4">
              {userRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <h3 className={`font-medium ${
                      request.resource_exists ? 'text-slate-900' : 'text-slate-500 italic'
                    }`}>
                      {request.resource_title}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {request.message || 'No message'}
                      {!request.resource_exists && ' (resource no longer available)'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                      getStatusColor(request.display_status)
                    }`}>
                      {getStatusLabel(request.display_status)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{formatDate(request.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No requests yet</p>
              <Link
                to="/resources"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2 inline-block"
              >
                Browse resources
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent Notifications */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Recent Activity</h2>
          <Link
            to="/notifications"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            View all
          </Link>
        </div>
        
        {notificationsLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : notifications && notifications.length > 0 ? (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div key={notification.id} className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Activity className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">{notification.title}</h3>
                  <p className="text-sm text-slate-600">{notification.message}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(notification.created_at)}</p>
                </div>
                {!notification.is_read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  )
}