import React, { useState, useRef, useEffect } from 'react'
import { Upload, X, Image as ImageIcon, Sparkles } from 'lucide-react'
import { useImageUpload } from '@/hooks/useImageUpload'
import { useAI } from '@/hooks/useAI'
import AIIndicator from './AIIndicator'

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string) => void
  onImageRemoved: (imageUrl: string) => void
  onDescriptionGenerated?: (description: string) => void
  onAIAnalysisGenerated?: (analysis: { title: string; description: string; category: string }) => void
  existingImages?: string[]
  maxImages?: number
  className?: string
}

export default function ImageUpload({ 
  onImageUploaded, 
  onImageRemoved,
  onDescriptionGenerated,
  onAIAnalysisGenerated,
  existingImages = [], 
  maxImages = 5,
  className = ''
}: ImageUploadProps) {
  const [previews, setPreviews] = useState<string[]>(existingImages)
  const [pendingImageData, setPendingImageData] = useState<string | null>(null)
  const [isProcessingAI, setIsProcessingAI] = useState(false)
  const [aiProcessingStatus, setAiProcessingStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { uploadImage, isUploading } = useImageUpload()
  const { 
    generateDescription, 
    isGeneratingDescription, 
    analyzeResourceImage, 
    isAnalyzingImage,
    resetAnalyzeImageError,
    resetDescriptionError
  } = useAI()
  
  // DEFINITIVE FIX: Complete state isolation with initialization-only sync
  const [isInitialized, setIsInitialized] = useState(false)
  
  useEffect(() => {
    // ONE-TIME INITIALIZATION ONLY
    // After initialization, parent cannot interfere with local image state
    if (!isInitialized) {
      if (existingImages.length > 0) {
        console.log('[ImageUpload] ONE-TIME initialization with existing images:', existingImages.length)
        setPreviews([...existingImages])
      }
      setIsInitialized(true)
      return
    }
    
    // ABSOLUTE PROTECTION: No further syncing with parent after initialization
    // Local state is the ONLY source of truth for all user interactions
    console.log('[ImageUpload] Initialization complete - parent sync permanently disabled')
    
  }, [existingImages]) // Remove all other dependencies to prevent re-sync

  const handleFileSelect = async (files: FileList) => {
    if (previews.length >= maxImages) {
      return
    }

    const file = files[0]
    if (!file) return

    // Create preview immediately
    const previewUrl = URL.createObjectURL(file)
    setPreviews(prev => [...prev, previewUrl])

    // Store the file data for potential AI analysis
    const reader = new FileReader()
    reader.onloadend = () => {
      setPendingImageData(reader.result as string)
    }
    reader.readAsDataURL(file)

    try {
      // Upload image with detailed error handling
      const imageUrl = await uploadImage(file)
      
      // Update preview with actual URL
      setPreviews(prev => 
        prev.map(url => url === previewUrl ? imageUrl : url)
      )
      
      // Notify parent component
      onImageUploaded(imageUrl)
      
      // Clean up object URL
      URL.revokeObjectURL(previewUrl)
      
    } catch (error: any) {
      // Remove failed preview
      setPreviews(prev => prev.filter(url => url !== previewUrl))
      
      // Clean up object URL
      URL.revokeObjectURL(previewUrl)
      
      // Clear pending data on upload failure
      setPendingImageData(null)
    }
  }

  const handleGenerateAIAnalysis = async () => {
    if (!pendingImageData || !onAIAnalysisGenerated) return

    // Clear any previous errors
    resetAnalyzeImageError()

    setIsProcessingAI(true)
    setAiProcessingStatus('Uploading image to AI...')
    
    try {
      // Create a promise with custom timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI analysis timed out. Please try again.')), 45000) // 45 seconds
      })
      
      setAiProcessingStatus('AI is analyzing your image...')
      
      const analysisPromise = analyzeResourceImage(pendingImageData)
      
      // Race between the analysis and timeout
      const analysis = await Promise.race([analysisPromise, timeoutPromise])
      
      setAiProcessingStatus('Analysis complete! You can run this again if needed.')
      onAIAnalysisGenerated(analysis as any)
      
      // CRITICAL FIX: Keep pendingImageData intact for re-analysis capability
      // User can run AI analysis multiple times on the same image
      // Don't clear status automatically - let user interact naturally
      
    } catch (error: any) {
      setAiProcessingStatus(`Analysis failed: ${error.message}. You can try again.`)
      
      // Keep image data for retry
      // User can retry analysis by clicking the button again
    } finally {
      setIsProcessingAI(false)
    }
  }

  const handleGenerateDescription = async () => {
    if (!pendingImageData || !onDescriptionGenerated) return

    // Clear any previous errors
    resetDescriptionError()

    try {
      const description = await generateDescription(pendingImageData)
      onDescriptionGenerated(description)
    } catch (error) {
      // Allow retry on error
    }
  }

  const handleRemoveImage = (imageUrl: string) => {
    setPreviews(prev => {
      const newPreviews = prev.filter(url => url !== imageUrl)
      // If this was the last image, clear the pending image data
      if (newPreviews.length === 0) {
        setPendingImageData(null)
      }
      return newPreviews
    })
    
    onImageRemoved(imageUrl)
    
    // Clean up object URL if it's a blob
    if (imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imageUrl)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className={className}>
      {/* Upload Area */}
      {previews.length < maxImages && (
        <div
          className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-slate-400 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center space-y-2">
            <Upload className="h-8 w-8 text-slate-400" />
            <div className="text-sm text-slate-600">
              <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
            </div>
            <div className="text-xs text-slate-500">
              PNG, JPG, GIF up to 5MB
            </div>
            {isUploading && (
              <div className="text-xs text-blue-600 animate-pulse">
                Uploading...
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Analysis Generator */}
      {pendingImageData && onAIAnalysisGenerated && (
        <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AIIndicator isActive={isProcessingAI || isAnalyzingImage} size="md" />
              <span className="text-sm font-medium text-purple-700">
                Auto-fill with AI Analysis
              </span>
            </div>
            <button
              onClick={handleGenerateAIAnalysis}
              disabled={isProcessingAI || isAnalyzingImage}
              className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isProcessingAI || isAnalyzingImage ? 'Analyzing...' : 'Auto-fill Form'}
            </button>
          </div>
          <p className="text-xs text-purple-600 mt-1">
            AI will analyze your image and automatically fill the Title, Description, and Category fields.
            {aiProcessingStatus.includes('complete') ? ' You can run this again if needed.' : ''}
          </p>
          {aiProcessingStatus && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              <div className="flex items-center space-x-2">
                {isProcessingAI && <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full"></div>}
                <span>{aiProcessingStatus}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Description Generator (fallback) */}
      {pendingImageData && onDescriptionGenerated && !onAIAnalysisGenerated && (
        <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AIIndicator isActive={isGeneratingDescription} size="md" />
              <span className="text-sm font-medium text-purple-700">
                Generate AI Description
              </span>
            </div>
            <button
              onClick={handleGenerateDescription}
              disabled={isGeneratingDescription}
              className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isGeneratingDescription ? 'Generating...' : 'Generate'}
            </button>
          </div>
          <p className="text-xs text-purple-600 mt-1">
            Let AI analyze your image and create a helpful description
          </p>
        </div>
      )}

      {/* Image Previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          {previews.map((imageUrl, index) => (
            <div key={index} className="relative group">
              <img
                src={imageUrl}
                alt={`Preview ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border border-slate-200"
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(imageUrl)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Helper text */}
      <div className="text-xs text-slate-500 mt-2">
        {previews.length}/{maxImages} images uploaded
      </div>
    </div>
  )
}