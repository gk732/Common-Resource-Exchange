import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  FileText,
  Filter,
  Calendar,
  User,
  Package,
  Check,
  X,
  Clock,
  MessageCircle,
  Search,
  Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import UserAvatar from '@/components/ui/UserAvatar'

interface Request {
  id: string
  requester_id: string
  resource_id: string
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  message?: string
  created_at: string
  updated_at: string
}

interface RequestWithDetails extends Request {
  resource?: {
    id: string
    title: string
    description: string
    category: string
    user_id: string
    images?: string[]
  }
  requester?: {
    id: string
    name: string
    email: string
    profile_image_url?: string
  }
}

export default function RequestsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch sent requests (requests made by current user)
  const { data: sentRequests = [], isLoading: sentLoading } = useQuery({
    queryKey: ['sent-requests', user?.id, statusFilter, searchTerm],
    queryFn: async () => {
      if (!user) return []
      
      // Use RPC function for reliable join query
      const { data, error } = await supabase.rpc('get_user_sent_requests', {
        user_id: user.id,
        status_filter: statusFilter === 'all' ? null : statusFilter
      })
      
      if (error) {
        console.log('RPC not available, falling back to manual query')
        
        // Fallback: Get requests first, then fetch resources separately
        let query = supabase
          .from('requests')
          .select('*')
          .eq('requester_id', user.id)
          .order('created_at', { ascending: false })
        
        if (statusFilter === 'all') {
          query = query.in('status', ['pending', 'approved', 'completed'])
        } else {
          query = query.eq('status', statusFilter)
        }
        
        const { data: requests, error: requestsError } = await query
        if (requestsError) throw requestsError
        
        if (!requests || requests.length === 0) return []
        
        // Get unique resource IDs
        const resourceIds = [...new Set(requests.map(r => r.resource_id))]
        
        // Fetch all resources for these requests
        const { data: resources, error: resourcesError } = await supabase
          .from('resources')
          .select('id, title, description, category, images, user_id')
          .in('id', resourceIds)
        
        if (resourcesError) throw resourcesError
        
        // Combine requests with their resource data
        const combinedData = requests.map(request => {
          const resource = resources?.find(r => r.id === request.resource_id)
          return {
            ...request,
            resource: resource || null
          }
        })
        
        let filteredData = combinedData
        
        if (searchTerm) {
          filteredData = filteredData.filter((request: any) => 
            request.resource?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.message?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        }
        
        return filteredData
      }
      
      return data || []
    },
    enabled: !!user && activeTab === 'sent'
  })

  // Fetch received requests (requests for current user's resources)
  const { data: receivedRequests = [], isLoading: receivedLoading } = useQuery({
    queryKey: ['received-requests', user?.id, statusFilter, searchTerm],
    queryFn: async () => {
      if (!user) return []
      
      // First get user's resources
      const { data: userResources, error: resourcesError } = await supabase
        .from('resources')
        .select('id, title, description, category, images')
        .eq('user_id', user.id)
      
      if (resourcesError) throw resourcesError
      if (!userResources || userResources.length === 0) return []
      
      const resourceIds = userResources.map(r => r.id)
      
      // Get requests for user's resources
      let query = supabase
        .from('requests')
        .select('*')
        .in('resource_id', resourceIds)
        .order('created_at', { ascending: false })
      
      // Filter logic: "all" means active requests (pending, approved, completed)
      if (statusFilter === 'all') {
        query = query.in('status', ['pending', 'approved', 'completed'])
      } else {
        query = query.eq('status', statusFilter)
      }
      
      const { data: requests, error: requestsError } = await query
      if (requestsError) throw requestsError
      
      if (!requests || requests.length === 0) return []
      
      // Get unique requester IDs
      const requesterIds = [...new Set(requests.map(r => r.requester_id))]
      
      // Fetch requester user data
      const { data: requesters, error: requestersError } = await supabase
        .from('users')
        .select('id, name, email, profile_image_url')
        .in('id', requesterIds)
      
      if (requestersError) throw requestersError
      
      // Combine requests with resource and requester data
      const combinedData = requests.map(request => {
        const resource = userResources.find(r => r.id === request.resource_id)
        const requester = requesters?.find(u => u.id === request.requester_id)
        return {
          ...request,
          resource: resource || null,
          requester: requester || null
        }
      })
      
      let filteredData = combinedData
      
      if (searchTerm) {
        filteredData = filteredData.filter((request: any) => 
          request.resource?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          request.requester?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          request.message?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }
      
      return filteredData
    },
    enabled: !!user && activeTab === 'received'
  })

  // Update request status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string, status: string }) => {
      const { data, error } = await supabase.functions.invoke('request-management', {
        body: {
          action: 'update_request_status',
          requestId,
          status
        }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Request status updated successfully')
      queryClient.invalidateQueries({ queryKey: ['received-requests'] })
      queryClient.invalidateQueries({ queryKey: ['sent-requests'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update request status')
    }
  })

  // Cancel request mutation (for pending requests only)
  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('request-management', {
        body: {
          action: 'cancel_request',
          requestId
        }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Request cancelled successfully')
      queryClient.invalidateQueries({ queryKey: ['sent-requests'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to cancel request')
    }
  })

  // Delete request mutation (for any status)
  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.functions.invoke('request-management', {
        body: {
          action: 'delete_request',
          requestId
        }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Request deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['sent-requests'] })
      queryClient.invalidateQueries({ queryKey: ['received-requests'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete request')
    }
  })

  // Clear past requests mutation (for completed/rejected requests only)
  const clearPastRequestsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('request-management', {
        body: {
          action: 'clear_past_requests'
        }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Past requests cleared successfully')
      queryClient.invalidateQueries({ queryKey: ['received-requests'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to clear past requests')
    }
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-700 bg-yellow-100'
      case 'approved': return 'text-green-700 bg-green-100'
      case 'rejected': return 'text-red-700 bg-red-100'
      case 'completed': return 'text-blue-700 bg-blue-100'
      default: return 'text-slate-700 bg-slate-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />
      case 'approved': return <Check className="h-4 w-4" />
      case 'rejected': return <X className="h-4 w-4" />
      case 'completed': return <Check className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const handleStatusUpdate = (requestId: string, status: string) => {
    updateStatusMutation.mutate({ requestId, status })
  }

  const handleCancelRequest = (requestId: string) => {
    if (window.confirm('Are you sure you want to cancel this pending request?')) {
      cancelRequestMutation.mutate(requestId)
    }
  }

  const handleDeleteRequest = (requestId: string) => {
    if (window.confirm('Are you sure you want to delete this request? This action cannot be undone.')) {
      deleteRequestMutation.mutate(requestId)
    }
  }

  const handleClearPastRequests = () => {
    if (window.confirm('Are you sure you want to clear all completed and rejected requests? This action cannot be undone.')) {
      clearPastRequestsMutation.mutate()
    }
  }

  const RequestCard = ({ request, type }: { request: RequestWithDetails, type: 'sent' | 'received' }) => {
    const canCancel = type === 'sent' && request.status === 'pending'
    const canDelete = type === 'sent' // Users can delete their own sent requests regardless of status
    const canApproveReject = type === 'received' && request.status === 'pending'
    const canComplete = type === 'received' && request.status === 'approved'
    
    // Determine status-based styling
    const getActionButtonsForSentRequest = () => {
      const buttons = []
      
      // Cancel button (only for pending requests)
      if (canCancel) {
        buttons.push(
          <button
            key="cancel"
            onClick={() => handleCancelRequest(request.id)}
            disabled={cancelRequestMutation.isPending}
            className="px-3 py-1 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
          >
            {cancelRequestMutation.isPending ? '...' : 'Cancel'}
          </button>
        )
      }
      
      // Delete button (for any status)
      if (canDelete) {
        buttons.push(
          <button
            key="delete"
            onClick={() => handleDeleteRequest(request.id)}
            disabled={deleteRequestMutation.isPending}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            {deleteRequestMutation.isPending ? '...' : 'Delete'}
          </button>
        )
      }
      
      return buttons
    }
    
    const getActionButtonsForReceivedRequest = () => {
      const buttons = []
      
      if (canApproveReject) {
        buttons.push(
          <button
            key="approve"
            onClick={() => handleStatusUpdate(request.id, 'approved')}
            disabled={updateStatusMutation.isPending}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
          >
            <Check className="h-4 w-4 mr-1" />
            {updateStatusMutation.isPending ? '...' : 'Approve'}
          </button>
        )
        buttons.push(
          <button
            key="reject"
            onClick={() => handleStatusUpdate(request.id, 'rejected')}
            disabled={updateStatusMutation.isPending}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
          >
            <X className="h-4 w-4 mr-1" />
            {updateStatusMutation.isPending ? '...' : 'Reject'}
          </button>
        )
      }
      
      if (canComplete) {
        buttons.push(
          <button
            key="complete"
            onClick={() => handleStatusUpdate(request.id, 'completed')}
            disabled={updateStatusMutation.isPending}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
          >
            <Check className="h-4 w-4 mr-1" />
            {updateStatusMutation.isPending ? '...' : 'Complete'}
          </button>
        )
      }
      
      return buttons
    }

    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            {/* Resource Image and Title Section */}
            <div className="flex items-start space-x-4 mb-4">
              {/* Resource Image */}
              <div className="flex-shrink-0">
                {request.resource?.images && request.resource.images.length > 0 ? (
                  <>
                    <img
                      src={request.resource.images[0]}
                      alt={request.resource.title || 'Resource'}
                      className="w-20 h-20 object-cover rounded-xl border border-slate-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                    <div className="w-20 h-20 bg-slate-100 rounded-xl border border-slate-200 items-center justify-center hidden">
                      <Package className="h-8 w-8 text-slate-400" />
                    </div>
                  </>
                ) : (
                  <div className="w-20 h-20 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center">
                    <Package className="h-8 w-8 text-slate-400" />
                  </div>
                )}
              </div>
              
              {/* Resource Details */}
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {request.resource?.title || 'Resource'}
                  </h3>
                  {request.resource?.category && (
                    <span className="inline-flex px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {request.resource.category}
                    </span>
                  )}
                </div>
                
                <p className="text-slate-600 text-sm mb-3">
                  {request.resource?.description || 'No description available'}
                </p>
              </div>
            </div>
            
            {request.message && (
              <div className="bg-slate-50 p-3 rounded-lg mb-3">
                <p className="text-sm text-slate-700">
                  <strong>Message:</strong> {request.message}
                </p>
              </div>
            )}
            
            <div className="flex items-center space-x-4 text-sm text-slate-500">
              {type === 'received' && request.requester && (
                <div className="flex items-center space-x-2">
                  <UserAvatar 
                    user={request.requester} 
                    size="xs" 
                  />
                  <span>{request.requester.name}</span>
                </div>
              )}
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                {formatDate(request.created_at)}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 ml-4">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(request.status)}`}>
              {getStatusIcon(request.status)}
              <span className="ml-1 capitalize">{request.status}</span>
            </div>
            
            <div className="flex flex-col space-y-2">
              {/* Action buttons based on request type */}
              {type === 'sent' && getActionButtonsForSentRequest()}
              {type === 'received' && getActionButtonsForReceivedRequest()}
              
              {/* Message button for all requests */}
              <button
                onClick={() => console.log('Message user')}
                className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors self-center"
                title="Send message"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentRequests = activeTab === 'sent' ? sentRequests : receivedRequests
  const isLoading = activeTab === 'sent' ? sentLoading : receivedLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Requests</h1>
          <p className="text-slate-600">Manage your resource requests and incoming requests</p>
        </div>
        
        {/* Clear Past Requests Button - Only show on received requests tab */}
        {activeTab === 'received' && (
          <button
            onClick={handleClearPastRequests}
            disabled={clearPastRequestsMutation.isPending}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            title="Clear all completed and rejected requests"
          >
            {clearPastRequestsMutation.isPending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span>{clearPastRequestsMutation.isPending ? 'Clearing...' : 'Clear Past Requests'}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl p-1 shadow-sm border border-slate-200 inline-flex">
        <button
          onClick={() => setActiveTab('sent')}
          className={`px-6 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'sent'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sent Requests
        </button>
        <button
          onClick={() => setActiveTab('received')}
          className={`px-6 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'received'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Received Requests
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">Active Requests</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
          
          {/* Results Count */}
          <div className="flex items-center justify-end">
            <span className="text-sm text-slate-600">
              {currentRequests.length} request{currentRequests.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-pulse">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="h-5 bg-slate-200 rounded w-1/2 mb-3"></div>
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-slate-200 rounded w-1/2 mb-4"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/3"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-8 bg-slate-200 rounded w-20"></div>
                  <div className="h-8 bg-slate-200 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : currentRequests.length > 0 ? (
        <div className="space-y-4">
          {currentRequests.map((request) => (
            <RequestCard key={request.id} request={request} type={activeTab} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            No {activeTab} requests found
          </h3>
          <p className="text-slate-600">
            {activeTab === 'sent'
              ? 'You haven\'t made any requests yet. Browse resources to get started!'
              : 'No one has requested your resources yet. Share more resources to receive requests!'}
          </p>
        </div>
      )}
    </div>
  )
}