import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

export function useImageUpload() {
  const { user } = useAuth()

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) {
        throw new Error('User not logged in')
      }

      // Validate file
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file')
      }

      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('Image size must be less than 5MB')
      }

      // Convert file to base64
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = async () => {
          try {
            const base64Data = reader.result as string

            // Use Edge Function to upload image
            const { data, error } = await supabase.functions.invoke('image-upload', {
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
    retry: 1,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  })

  return {
    uploadImage: uploadImageMutation.mutateAsync,
    isUploading: uploadImageMutation.isPending,
    uploadError: uploadImageMutation.error
  }
}