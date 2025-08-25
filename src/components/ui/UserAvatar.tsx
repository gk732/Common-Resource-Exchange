import React from 'react'
import { User as UserIcon } from 'lucide-react'

interface UserAvatarProps {
  user?: {
    name?: string
    profile_image_url?: string
  } | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showName?: boolean
}

export default function UserAvatar({ 
  user, 
  size = 'md', 
  className = '', 
  showName = false 
}: UserAvatarProps) {
  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  const iconSizes = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4', 
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8'
  }

  const textSizes = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  }

  const getInitials = (name?: string) => {
    if (!name) return '?'
    return name.split(' ').map(n => n.charAt(0).toUpperCase()).join('').substring(0, 2)
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden border border-slate-200 bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0`}>
        {user?.profile_image_url ? (
          <img 
            src={user.profile_image_url} 
            alt={user.name || 'User'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback to initials on image error
              const target = e.currentTarget
              const parent = target.parentElement
              if (parent) {
                target.style.display = 'none'
                const fallback = document.createElement('span')
                fallback.className = `text-white font-medium ${textSizes[size]}`
                fallback.textContent = getInitials(user?.name)
                parent.appendChild(fallback)
              }
            }}
          />
        ) : (
          user?.name ? (
            <span className={`text-white font-medium ${textSizes[size]}`}>
              {getInitials(user.name)}
            </span>
          ) : (
            <UserIcon className={`${iconSizes[size]} text-white`} />
          )
        )}
      </div>
      
      {showName && user?.name && (
        <span className={`text-slate-700 font-medium ${textSizes[size]}`}>
          {user.name}
        </span>
      )}
    </div>
  )
}