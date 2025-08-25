import React, { useState, useRef } from 'react'
import { Camera, Upload, User as UserIcon, Loader2, X } from 'lucide-react'
import { useProfileImageUpload } from '@/hooks/useProfileImageUpload'
import toast from 'react-hot-toast'

interface ProfileImageUploadProps {
  currentImageUrl?: string
  onImageUploaded: (url: string) => void
  size?: 'small' | 'medium' | 'large'
  className?: string
  showUploadButton?: boolean
}

export default function ProfileImageUpload({ 
  currentImageUrl, 
  onImageUploaded, 
  size = 'medium', 
  className = '',
  showUploadButton = true 
}: ProfileImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { uploadProfileImage, isUploading } = useProfileImageUpload()

  const sizeClasses = {
    small: 'w-12 h-12',
    medium: 'w-20 h-20',
    large: 'w-32 h-32'
  }

  const iconSizes = {
    small: 'h-6 w-6',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (2MB limit for profile images)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB')
      return
    }

    // Show preview while uploading
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    try {
      const imageUrl = await uploadProfileImage(file)
      onImageUploaded(imageUrl)
      setPreviewUrl(null)
    } catch (error: any) {
      console.error('Profile image upload error:', error)
      toast.error(error.message || 'Failed to upload profile image')
      setPreviewUrl(null)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const clearPreview = () => {
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const displayImageUrl = previewUrl || currentImageUrl

  return (
    <div className={`relative ${className}`}>
      {/* Profile Image Display */}
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden border-2 border-slate-200 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center relative group`}>
        {displayImageUrl ? (
          <img 
            src={displayImageUrl} 
            alt="Profile" 
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error('Profile image failed to load:', displayImageUrl)
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <UserIcon className={`${iconSizes[size]} text-white`} />
        )}
        
        {/* Loading Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          </div>
        )}
        
        {/* Hover Overlay for Upload */}
        {showUploadButton && !isUploading && (
          <div 
            onClick={handleUploadClick}
            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center cursor-pointer transition-all duration-200"
          >
            <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
        )}
      </div>

      {/* Preview Controls */}
      {previewUrl && !isUploading && (
        <button
          onClick={clearPreview}
          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Upload Button (Alternative to hover) */}
      {showUploadButton && size === 'large' && !isUploading && (
        <button
          onClick={handleUploadClick}
          className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Photo
        </button>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}