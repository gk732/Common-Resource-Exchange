import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  User,
  Mail,
  MapPin,
  Calendar,
  Edit,
  Save,
  X,
  Package,
  FileText,
  MessageCircle,
  Star,
  Activity
} from 'lucide-react'
import toast from 'react-hot-toast'
import ProfileImageUpload from '@/components/ui/ProfileImageUpload'
import { useProfileImageUpload } from '@/hooks/useProfileImageUpload'

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const queryClient = useQueryClient()
  const { uploadProfileImage } = useProfileImageUpload()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    bio: user?.profile_info?.bio || '',
    location: user?.profile_info?.location || ''
  })

  const handleProfileImageUpload = async (url: string) => {
    // The ProfileImageUpload component and hook handle the upload and profile update
    toast.success('Profile image updated successfully')
  }

  // Fetch user statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user-stats', user?.id],
    queryFn: async () => {
      if (!user) return null
      
      const [resourcesRes, requestsRes, messagesRes, reviewsRes] = await Promise.all([
        supabase.from('resources').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('requests').select('*', { count: 'exact', head: true }).eq('requester_id', user.id),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('sender_id', user.id),
        supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('reviewer_id', user.id)
      ])
      
      return {
        resourcesCount: resourcesRes.count || 0,
        requestsCount: requestsRes.count || 0,
        messagesSent: messagesRes.count || 0,
        reviewsGiven: reviewsRes.count || 0
      }
    },
    enabled: !!user
  })

  // Fetch user's recent activity
  const { data: recentActivity = [], isLoading: activityLoading } = useQuery({
    queryKey: ['user-activity', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      // Get recent resources, requests, and reviews
      const [resourcesRes, requestsRes, reviewsRes] = await Promise.all([
        supabase
          .from('resources')
          .select('id, title, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('requests')
          .select('id, created_at, resources:resource_id(title)')
          .eq('requester_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('reviews')
          .select('id, rating, created_at, resources:exchange_id(title)')
          .eq('reviewer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
      ])
      
      const activities = []
      
      // Add resources
      resourcesRes.data?.forEach(resource => {
        activities.push({
          id: resource.id,
          type: 'resource_shared',
          title: `Shared resource: ${resource.title}`,
          date: resource.created_at,
          icon: Package
        })
      })
      
      // Add requests
      requestsRes.data?.forEach(request => {
        activities.push({
          id: request.id,
          type: 'request_made',
          title: `Requested: ${(request as any).resources?.title || 'Resource'}`,
          date: request.created_at,
          icon: FileText
        })
      })
      
      // Add reviews
      reviewsRes.data?.forEach(review => {
        activities.push({
          id: review.id,
          type: 'review_given',
          title: `Reviewed exchange (${review.rating} stars)`,
          date: review.created_at,
          icon: Star
        })
      })
      
      // Sort by date
      return activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10)
    },
    enabled: !!user
  })

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!user) throw new Error('No user found')
      
      const { error } = await supabase
        .from('users')
        .update({
          name: updates.name,
          profile_info: {
            ...user.profile_info,
            bio: updates.bio,
            location: updates.location
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
      
      if (error) throw error
      return updates
    },
    onSuccess: (data) => {
      updateProfile({
        name: data.name,
        profile_info: {
          ...user?.profile_info,
          bio: data.bio,
          location: data.location
        }
      })
      toast.success('Profile updated successfully')
      setIsEditing(false)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }
    
    updateProfileMutation.mutate(formData)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatActivityDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) {
      return 'Today'
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-purple-100 text-purple-700'
      case 'ADMIN': return 'bg-red-100 text-red-700'
      case 'CONTRIBUTOR': return 'bg-blue-100 text-blue-700'
      case 'REQUESTER': return 'bg-slate-100 text-slate-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
          <div className="flex items-center space-x-6">
            <ProfileImageUpload 
              currentImageUrl={user?.profile_image_url}
              onImageUploaded={handleProfileImageUpload}
              size="large"
              className="flex-shrink-0"
            />
            
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-900">{user?.name}</h1>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(user?.role || '')}`}>
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
              
              <div className="flex items-center space-x-4 text-slate-600">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  {user?.email}
                </div>
                {user?.profile_info?.location && (
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2" />
                    {user.profile_info.location}
                  </div>
                )}
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Joined {formatDate(user?.created_at || '')}
                </div>
              </div>
              
              {user?.profile_info?.bio && (
                <p className="text-slate-600 mt-3 max-w-2xl">{user.profile_info.bio}</p>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setIsEditing(true)}
            className="mt-4 md:mt-0 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Resources Shared</p>
              <p className="text-2xl font-bold text-slate-900">
                {statsLoading ? '...' : stats?.resourcesCount || 0}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Requests Made</p>
              <p className="text-2xl font-bold text-slate-900">
                {statsLoading ? '...' : stats?.requestsCount || 0}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Messages Sent</p>
              <p className="text-2xl font-bold text-slate-900">
                {statsLoading ? '...' : stats?.messagesSent || 0}
              </p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <MessageCircle className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Reviews Given</p>
              <p className="text-2xl font-bold text-slate-900">
                {statsLoading ? '...' : stats?.reviewsGiven || 0}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <Star className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-xl font-semibold text-slate-900 mb-6">Recent Activity</h2>
        
        {activityLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : recentActivity.length > 0 ? (
          <div className="space-y-4">
            {recentActivity.map((activity) => {
              const IconComponent = activity.icon
              return (
                <div key={`${activity.type}-${activity.id}`} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <IconComponent className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{activity.title}</p>
                    <p className="text-xs text-slate-500">{formatActivityDate(activity.date)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No recent activity</p>
            <p className="text-sm text-slate-400">Start sharing resources or making requests to see activity here</p>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" onClick={() => setIsEditing(false)}></div>
            
            <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900">Edit Profile</h2>
                <button
                  onClick={() => setIsEditing(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your full name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
                  <textarea
                    rows={3}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Tell others about yourself"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your location"
                  />
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                  >
                    {updateProfileMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}