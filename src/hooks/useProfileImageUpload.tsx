import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

export function useProfileImageUpload() {
  const { user, updateProfile } = useAuth()
  const queryClient = useQueryClient()

  const uploadProfileImageMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) {
        throw new Error('User not logged in')
      }

      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file')
      }

      if (file.size > 2 * 1024 * 1024) { // 2MB limit for profile images
        throw new Error('Image size must be less than 2MB')
      }

      // Convert file to base64
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = async () => {
          try {
            const base64Data = reader.result as string

            // Use dedicated profile image upload Edge Function
            const { data, error } = await supabase.functions.invoke('profile-image-upload', {
              body: {
                imageData: base64Data,
                fileName: file.name
              }
            })

            if (error) {
              throw new Error(`Upload service error: ${error.message || 'Unknown error'}`)
            }
            
            if (!data || !data.data || !data.data.publicUrl) {
              throw new Error('Invalid response from upload service')
            }
            
            // Update local auth context
            await updateProfile({ profile_image_url: data.data.publicUrl })
            
            resolve(data.data.publicUrl)
          } catch (err: any) {
            reject(new Error(`Upload failed: ${err.message || 'Unknown error'}`))  
          }
        }
        reader.onerror = () => {
          reject(new Error('Failed to read file'))
        }
        reader.readAsDataURL(file)
      })
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      queryClient.invalidateQueries({ queryKey: ['user-stats'] })
    },
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  })

  return {
    uploadProfileImage: uploadProfileImageMutation.mutateAsync,
    isUploading: uploadProfileImageMutation.isPending,
    uploadError: uploadProfileImageMutation.error
  }
}