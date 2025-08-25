import React from 'react'
import { MessageCircle, Users, Trash2, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Conversation {
  exchange_id: string
  participant1_id: string
  participant1_name: string
  participant1_email: string
  participant2_id: string
  participant2_name: string
  participant2_email: string
  message_count: number
  last_message_at: string
  last_message_content: string
}

interface ConversationListProps {
  conversations: Conversation[]
  onSelectConversation: (conversationId: string) => void
  onDeleteConversation: (conversationId: string) => void
  selectedConversation?: string | null
  deleteConfirmId?: string | null
  isLoading?: boolean
}

export default function ConversationList({
  conversations,
  onSelectConversation,
  onDeleteConversation,
  selectedConversation,
  deleteConfirmId,
  isLoading = false
}: ConversationListProps) {
  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return 'Unknown time'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-slate-600">Loading conversations...</span>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="p-8 text-center">
        <MessageCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-slate-900 mb-1">No Conversations Found</h3>
        <p className="text-slate-500">There are currently no conversations to display.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-200">
      {conversations.map((conversation) => (
        <div
          key={conversation.exchange_id}
          className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
            selectedConversation === conversation.exchange_id
              ? 'bg-blue-50 border-r-4 border-blue-500'
              : ''
          }`}
          onClick={() => onSelectConversation(conversation.exchange_id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Participants */}
              <div className="flex items-center space-x-2 mb-1">
                <Users className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-900 truncate">
                  {conversation.participant1_name}
                </span>
                <span className="text-slate-400">↔</span>
                <span className="text-sm font-medium text-slate-900 truncate">
                  {conversation.participant2_name}
                </span>
              </div>
              
              {/* Email addresses */}
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-xs text-slate-500 truncate">
                  {conversation.participant1_email}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500 truncate">
                  {conversation.participant2_email}
                </span>
              </div>
              
              {/* Last message preview */}
              <p className="text-sm text-slate-600 truncate mb-2">
                {conversation.last_message_content}
              </p>
              
              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-3">
                  <span>
                    <MessageCircle className="h-3 w-3 inline mr-1" />
                    {conversation.message_count} message{conversation.message_count !== 1 ? 's' : ''}
                  </span>
                  <span>{formatRelativeTime(conversation.last_message_at)}</span>
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center space-x-1 ml-3">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectConversation(conversation.exchange_id)
                }}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                title="View conversation details"
              >
                <Eye className="h-4 w-4" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteConversation(conversation.exchange_id)
                }}
                className={`p-2 rounded-lg transition-colors ${
                  deleteConfirmId === conversation.exchange_id
                    ? 'text-white bg-red-600 hover:bg-red-700'
                    : 'text-slate-400 hover:text-red-600 hover:bg-red-100'
                }`}
                title={
                  deleteConfirmId === conversation.exchange_id
                    ? 'Click again to confirm deletion'
                    : 'Delete conversation'
                }
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
