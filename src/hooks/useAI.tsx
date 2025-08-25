import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'

export function useAI() {
  const { user } = useAuth()

  const analyzeResourceImageMutation = useMutation({
    mutationFn: async (imageData: string) => {
      try {
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: {
            action: 'analyze_resource_image',
            imageData
          }
        })

        if (error) {
          console.error('AI analysis error:', error)
          throw new Error(error.message || 'Failed to analyze image')
        }
        
        if (!data || !data.data) {
          throw new Error('No analysis generated')
        }
        
        // Log the analysis result for debugging
        console.log('AI analysis result:', data.data)
        
        return data.data
      } catch (err: any) {
        console.error('Image analysis failed:', err)
        throw new Error(err.message || 'Failed to analyze image')
      }
    },
    // Don't show automatic toasts - let components handle all feedback
    retry: 2, // Retry twice
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
  })

  const generateDescriptionMutation = useMutation({
    mutationFn: async (imageData: string) => {
      try {
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: {
            action: 'generate_description',
            imageData
          }
        })

        if (error) {
          console.error('AI description error:', error)
          throw new Error(error.message || 'Failed to generate description')
        }
        
        if (!data || !data.data) {
          throw new Error('No description generated')
        }
        
        return data.data.description
      } catch (err: any) {
        console.error('Description generation failed:', err)
        throw new Error(err.message || 'Failed to generate description')
      }
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  })

  const suggestCategoryMutation = useMutation({
    mutationFn: async ({ title, description }: { title?: string; description?: string }) => {
      try {
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: {
            action: 'suggest_category',
            title,
            description
          }
        })

        if (error) {
          console.error('AI category error:', error)
          throw new Error(error.message || 'Failed to suggest category')
        }
        
        if (!data || !data.data) {
          throw new Error('No category suggested')
        }
        
        return data.data.category
      } catch (err: any) {
        console.error('Category suggestion failed:', err)
        throw new Error(err.message || 'Failed to suggest category')
      }
    },
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  })

  const enhanceSearchMutation = useMutation({
    mutationFn: async (searchText: string) => {
      try {
        const { data, error } = await supabase.functions.invoke('ai-assistant', {
          body: {
            action: 'enhance_search',
            text: searchText
          }
        })

        if (error) {
          console.error('AI search error:', error)
          // Don't throw for search enhancement - fail silently
          return []
        }
        
        if (!data || !data.data) {
          return []
        }
        
        return data.data.suggestions || []
      } catch (err: any) {
        console.error('Search enhancement failed:', err)
        // Fail silently for search enhancement
        return []
      }
    },
    onError: (error: any) => {
      // Don't show error toast for search enhancement
      console.error('Search enhancement failed:', error)
    }
  })

  // Removed automatic error clearing to prevent interference with image state
  // Manual reset functions are available for explicit error clearing when needed

  return {
    analyzeResourceImage: analyzeResourceImageMutation.mutateAsync,
    isAnalyzingImage: analyzeResourceImageMutation.isPending,
    analyzeImageError: analyzeResourceImageMutation.error,
    resetAnalyzeImageError: () => analyzeResourceImageMutation.reset(),
    
    generateDescription: generateDescriptionMutation.mutateAsync,
    isGeneratingDescription: generateDescriptionMutation.isPending,
    resetDescriptionError: () => generateDescriptionMutation.reset(),
    
    suggestCategory: suggestCategoryMutation.mutateAsync,
    isSuggestingCategory: suggestCategoryMutation.isPending,
    resetCategoryError: () => suggestCategoryMutation.reset(),
    
    enhanceSearch: enhanceSearchMutation.mutateAsync,
    isEnhancingSearch: enhanceSearchMutation.isPending
  }
}