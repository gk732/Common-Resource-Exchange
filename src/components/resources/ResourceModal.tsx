import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import ImageUpload from '@/components/ui/ImageUpload'
import AIIndicator from '@/components/ui/AIIndicator'
import { useAI } from '@/hooks/useAI'
import { Image as ImageIcon, Sparkles } from 'lucide-react'
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

// Resource Modal Component
function ResourceModal({
  resource,
  onClose,
  onSuccess
}: {
  resource?: Resource | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    title: resource?.title || '',
    description: resource?.description || '',
    category: resource?.category || 'Other',
    condition: resource?.condition || 'Good',
    location: resource?.location || '',
    exchange_type: resource?.exchange_type || 'lend',
    tags: resource?.tags?.join(', ') || '',
    // CRITICAL FIX: Filter out invalid/placeholder image URLs
    // Only include real Supabase Storage URLs that start with http/https
    images: resource?.images?.filter((img: string) => 
      img && (img.startsWith('http://') || img.startsWith('https://') || img.includes('/storage/v1/object/public/'))
    ) || []
  })
  
  const [loading, setLoading] = useState(false)
  const { suggestCategory, isSuggestingCategory } = useAI()
  
  const categories = [
    'Books', 'Electronics', 'Tools', 'Furniture', 'Clothing', 
    'Sports', 'Kitchen', 'Garden', 'Toys', 'Music', 'Other'
  ]
  
  const conditions = ['Excellent', 'Good', 'Fair', 'Poor']
  const exchangeTypes = ['lend', 'give', 'trade', 'sell']

  const handleImageUploaded = (imageUrl: string) => {
    console.log('[ResourceModal] Image uploaded, adding to formData:', imageUrl)
    setFormData(prev => {
      const newFormData = {
        ...prev,
        images: [...prev.images, imageUrl]
      }
      console.log('[ResourceModal] Updated formData.images:', newFormData.images)
      return newFormData
    })
  }

  const handleImageRemoved = (imageUrl: string) => {
    console.log('[ResourceModal] Image removed from formData:', imageUrl)
    setFormData(prev => {
      const newFormData = {
        ...prev,
        images: prev.images.filter(img => img !== imageUrl)
      }
      console.log('[ResourceModal] Updated formData.images:', newFormData.images)
      return newFormData
    })
  }

  const handleDescriptionGenerated = (description: string) => {
    setFormData(prev => ({
      ...prev,
      description: prev.description ? `${prev.description}\n\n${description}` : description
    }))
    toast.success('AI description added!')
  }

  const handleAIAnalysisGenerated = (analysis: { title: string; description: string; category: string }) => {
    console.log('[ResourceModal] AI Analysis completed, updating formData:', analysis)
    console.log('[ResourceModal] Current formData.images before AI update:', formData.images)
    
    setFormData(prev => {
      const newFormData = {
        ...prev,
        title: analysis.title,
        description: analysis.description,
        category: analysis.category
        // CRITICAL: NOT touching the images array here!
      }
      console.log('[ResourceModal] FormData after AI update - images preserved:', newFormData.images)
      return newFormData
    })
    
    // Show detailed success message with a longer display time
    toast.success(
      `AI Analysis Complete! Auto-filled:\n• Title: "${analysis.title}"\n• Category: ${analysis.category}\n• Description updated`,
      {
        duration: 6000,
        style: {
          background: '#10b981',
          color: '#fff',
        },
      }
    )
  }

  const handleSuggestCategory = async () => {
    if (!formData.title && !formData.description) {
      toast.error('Please enter a title or description first')
      return
    }

    try {
      const suggestedCategory = await suggestCategory({
        title: formData.title,
        description: formData.description
      })
      
      setFormData(prev => ({ ...prev, category: suggestedCategory }))
      toast.success(`AI suggested category: ${suggestedCategory}`, {
        duration: 4000,
        style: {
          background: '#8b5cf6',
          color: '#fff',
        },
      })
    } catch (error: any) {
      console.error('Category suggestion failed:', error)
      toast.error(error.message || 'Failed to suggest category')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const resourceData = {
        ...formData,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : []
      }
      
      const { data, error } = await supabase.functions.invoke('resource-management', {
        body: {
          action: resource ? 'update_resource' : 'create_resource',
          resourceData,
          resourceId: resource?.id
        }
      })
      
      if (error) {
        throw error
      }
      
      toast.success(resource ? 'Resource updated successfully' : 'Resource created successfully')
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save resource')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div className="relative bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">
            {resource ? 'Edit Resource' : 'Add New Resource'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter resource title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe your resource"
              />
            </div>
            
            {/* Images Upload Section */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <ImageIcon className="inline h-4 w-4 mr-1" />
                Resource Images
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Upload images to make your resource more appealing. You can add up to 5 images.
              </p>
              
              <ImageUpload
                onImageUploaded={handleImageUploaded}
                onImageRemoved={handleImageRemoved}
                onDescriptionGenerated={handleDescriptionGenerated}
                onAIAnalysisGenerated={handleAIAnalysisGenerated}
                existingImages={formData.images}
                maxImages={5}
                className=""
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Category</label>
                  <button
                    type="button"
                    onClick={handleSuggestCategory}
                    disabled={isSuggestingCategory || (!formData.title && !formData.description)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs text-purple-600 hover:text-purple-700 disabled:opacity-50"
                  >
                    <AIIndicator isActive={isSuggestingCategory} size="sm" />
                    <span>{isSuggestingCategory ? 'Suggesting...' : 'AI Suggest'}</span>
                  </button>
                </div>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Condition</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {conditions.map((condition) => (
                    <option key={condition} value={condition}>{condition}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Exchange Type</label>
              <select
                value={formData.exchange_type}
                onChange={(e) => setFormData({ ...formData, exchange_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {exchangeTypes.map((type) => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter location (optional)"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tags</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter tags separated by commas"
              />
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving...' : (resource ? 'Update Resource' : 'Create Resource')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ResourceModal