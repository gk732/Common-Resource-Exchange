import React from 'react'
import { Sparkles } from 'lucide-react'

interface AIIndicatorProps {
  isActive?: boolean
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export default function AIIndicator({ 
  isActive = false, 
  size = 'sm', 
  text,
  className = '' 
}: AIIndicatorProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className={`inline-flex items-center space-x-1 ${className}`}>
      <Sparkles 
        className={`${sizeClasses[size]} text-purple-500 ${isActive ? 'animate-pulse' : ''}`} 
      />
      {text && (
        <span className={`${textSizeClasses[size]} text-purple-600 font-medium`}>
          {text}
        </span>
      )}
    </div>
  )
}