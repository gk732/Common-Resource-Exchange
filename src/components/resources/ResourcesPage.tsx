import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import ResourceModal from './ResourceModal'
import SmartSearch from '@/components/ui/SmartSearch'
import AIIndicator from '@/components/ui/AIIndicator'
import {
  Plus,
  Search,
  Filter,
  Package,
  MapPin,
  Calendar,
  Eye,
  Edit,
  Trash2,
  MessageCircle,
  Star,
  Shield,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Resource {
  id: string
  user_id: string
  title: string
  description: string
  category: string
  condition: string
  images?: string[]
  location?: string
  is_available: boolean
  exchange_type: string
  created_at: string
  updated_at: string
  tags?: string[]
  views: number
}

export default function ResourcesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showMyResources, setShowMyResources] = useState(false)
  const [showAdminDeleteConfirm, setShowAdminDeleteConfirm] = useState<{ isOpen: boolean; resource: Resource | null }>({ isOpen: false, resource: null })

  // Check if current user is super admin
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  // Fetch resources
  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['resources', searchTerm, selectedCategory, showMyResources, user?.id],
    queryFn: async () => {
      let query = supabase
        .from('resources')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (showMyResources && user) {
        query = query.eq('user_id', user.id)
      }
      
      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory)
      }
      
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data || []
    },
    enabled: !!user
  })

  const categories = [
    'Books', 'Electronics', 'Tools', 'Furniture', 'Clothing', 
    'Sports', 'Kitchen', 'Garden', 'Toys', 'Music', 'Other'
  ]

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const ResourceCard = ({ resource }: { resource: Resource }) => {
    const isOwner = resource.user_id === user?.id

    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
        {/* Resource Images */}
        {resource.images && resource.images.length > 0 && (
          <div className="mb-4">
            <img
              src={resource.images[0]}
              alt={resource.title}
              className="w-full h-40 object-cover rounded-xl"
            />
            {resource.images.length > 1 && (
              <div className="mt-2 flex space-x-2">
                {resource.images.slice(1, 4).map((image, index) => (
                  <img
                    key={index}
                    src={image}
                    alt={`${resource.title} ${index + 2}`}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                ))}
                {resource.images.length > 4 && (
                  <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-slate-600">+{resource.images.length - 4}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{resource.title}</h3>
            <p className="text-slate-600 text-sm mb-3 line-clamp-2">{resource.description}</p>
            
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="inline-flex px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                {resource.category}
              </span>
              <span className="inline-flex px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                {resource.condition}
              </span>
              <span className="inline-flex px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                {resource.exchange_type}
              </span>
              {resource.is_available ? (
                <span className="inline-flex px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                  Available
                </span>
              ) : (
                <span className="inline-flex px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                  Unavailable
                </span>
              )}
            </div>
            
            <div className="flex items-center text-xs text-slate-500 space-x-4">
              {resource.location && (
                <div className="flex items-center">
                  <MapPin className="h-3 w-3 mr-1" />
                  {resource.location}
                </div>
              )}
              <div className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                {formatDate(resource.created_at)}
              </div>
              <div className="flex items-center">
                <Eye className="h-3 w-3 mr-1" />
                {resource.views} views
              </div>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 ml-4">
            {isOwner ? (
              <>
                <button
                  onClick={() => setEditingResource(resource)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit resource"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleOwnerDeleteResource(resource.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete resource"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleRequestResource(resource.id)}
                  disabled={!resource.is_available || requestResourceMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                >
                  {requestResourceMutation.isPending ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                  ) : null}
                  Request
                </button>
                <button
                  onClick={() => handleMessageOwner(resource.user_id)}
                  className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                  title="Message owner"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
              </>
            )}
            
            {/* Admin Delete Button - Only visible to super admin */}
            {isSuperAdmin && !isOwner && (
              <button
                onClick={() => handleAdminDeleteResource(resource)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center space-x-1"
                title="Admin: Delete this resource"
              >
                <Shield className="h-3 w-3" />
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Delete resource mutation
  const deleteResourceMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const { data, error } = await supabase.functions.invoke('resource-management', {
        body: {
          action: 'delete_resource',
          resourceId
        }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Resource deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['resources'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete resource')
    }
  })

  // Admin delete resource mutation
  const adminDeleteResourceMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const { data, error } = await supabase.functions.invoke('resource-management', {
        body: {
          action: 'admin_delete_resource',
          resourceId
        }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast.success(`Resource "${data.resourceTitle}" deleted successfully by admin`)
      queryClient.invalidateQueries({ queryKey: ['resources'] })
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] }) // Update dashboard stats
      setShowAdminDeleteConfirm({ isOpen: false, resource: null })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete resource')
      setShowAdminDeleteConfirm({ isOpen: false, resource: null })
    }
  })

  const handleAdminDeleteResource = (resource: Resource) => {
    setShowAdminDeleteConfirm({ isOpen: true, resource })
  }

  const confirmAdminDelete = () => {
    if (showAdminDeleteConfirm.resource) {
      adminDeleteResourceMutation.mutate(showAdminDeleteConfirm.resource.id)
    }
  }

  // Request resource mutation
  const requestResourceMutation = useMutation({
    mutationFn: async ({ resourceId, message }: { resourceId: string, message?: string }) => {
      const { data, error } = await supabase.functions.invoke('request-management', {
        body: {
          action: 'create_request',
          requestData: {
            resource_id: resourceId,
            message: message || ''
          }
        }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Resource request sent successfully!')
      queryClient.invalidateQueries({ queryKey: ['resources'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send request')
    }
  })

  const handleRequestResource = (resourceId: string) => {
    const message = prompt('Add a message for the resource owner (optional):') || ''
    requestResourceMutation.mutate({ resourceId, message })
  }

  // Owner delete resource function
  const handleOwnerDeleteResource = async (resourceId: string) => {
    if (confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
      deleteResourceMutation.mutate(resourceId)
    }
  }

  const handleMessageOwner = (ownerId: string) => {
    // This would open messaging interface
    toast.success('Messaging functionality will be implemented')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resources</h1>
          <p className="text-slate-600">Discover and share resources within the community</p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Resource
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Smart Search with AI */}
          <SmartSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search resources..."
            className=""
          />
          
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          
          {/* My Resources Toggle */}
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMyResources}
              onChange={(e) => setShowMyResources(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">My Resources Only</span>
          </label>
          
          {/* Results Count */}
          <div className="flex items-center justify-end">
            <span className="text-sm text-slate-600">
              {resources.length} resource{resources.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>
      </div>

      {/* Resources Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-slate-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-2/3 mb-4"></div>
              <div className="flex space-x-2 mb-4">
                <div className="h-6 bg-slate-200 rounded-full w-16"></div>
                <div className="h-6 bg-slate-200 rounded-full w-20"></div>
              </div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : resources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No resources found</h3>
          <p className="text-slate-600 mb-4">
            {searchTerm || selectedCategory !== 'all' || showMyResources
              ? 'Try adjusting your filters or search terms'
              : 'Be the first to share a resource with the community!'}
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Resource
          </button>
        </div>
      )}

      {/* Create/Edit Resource Modal */}
      {(showCreateModal || editingResource) && (
        <ResourceModal
          resource={editingResource}
          onClose={() => {
            setShowCreateModal(false)
            setEditingResource(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['resources'] })
            setShowCreateModal(false)
            setEditingResource(null)
          }}
        />
      )}

      {/* Admin Delete Confirmation Dialog */}
      {showAdminDeleteConfirm.isOpen && showAdminDeleteConfirm.resource && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Admin: Delete Resource
                </h3>
                <p className="text-sm text-slate-600">
                  You are about to delete this resource as a super admin
                </p>
              </div>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-slate-900 mb-2">
                {showAdminDeleteConfirm.resource.title}
              </h4>
              <p className="text-sm text-slate-600 mb-2">
                {showAdminDeleteConfirm.resource.description}
              </p>
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span className="bg-slate-200 px-2 py-1 rounded">
                  {showAdminDeleteConfirm.resource.category}
                </span>
                <span>
                  Created {formatDate(showAdminDeleteConfirm.resource.created_at)}
                </span>
              </div>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800 mb-1">Admin Action Warning</h4>
                  <p className="text-sm text-red-700">
                    This action will permanently delete the resource and all associated data including:
                  </p>
                  <ul className="text-xs text-red-600 mt-2 space-y-1 ml-4">
                    <li>• Resource details and images</li>
                    <li>• All pending requests for this resource</li>
                    <li>• Related messages and conversations</li>
                    <li>• Platform statistics will be updated</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowAdminDeleteConfirm({ isOpen: false, resource: null })}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={adminDeleteResourceMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={confirmAdminDelete}
                disabled={adminDeleteResourceMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {adminDeleteResourceMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <>
                    <Shield className="h-4 w-4" />
                    <span>Admin Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}