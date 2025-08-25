import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Users, Trash2, Eye, Search, AlertTriangle, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'

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

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  image_url?: string
}

export default function ConversationManagementPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Fetch all conversations for admin
  const { data: conversations = [], isLoading, error } = useQuery({
    queryKey: ['admin-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('messaging-system', {
        body: { action: 'admin_get_all_conversations' }
      })
      
      if (error) throw error
      return data.data || []
    },
    enabled: !!user && user.role === 'SUPER_ADMIN',
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  // Fetch messages for selected conversation
  const { data: selectedMessages = [] } = useQuery({
    queryKey: ['admin-conversation-messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return []
      
      const { data, error } = await supabase.functions.invoke('messaging-system', {
        body: {
          action: 'admin_get_conversation_messages',
          conversationId: selectedConversation
        }
      })
      
      if (error) throw error
      return data.data || []
    },
    enabled: !!selectedConversation
  })

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error } = await supabase.functions.invoke('messaging-system', {
        body: {
          action: 'admin_delete_conversation',
          conversationId: conversationId
        }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data, conversationId) => {
      toast.success('Conversation deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-conversations'] })
      if (selectedConversation === conversationId) {
        setSelectedConversation(null)
      }
      setDeleteConfirmId(null)
    },
    onError: (error: any) => {
      toast.error(`Failed to delete conversation: ${error.message}`)
      setDeleteConfirmId(null)
    }
  })

  const handleDeleteConversation = (conversationId: string) => {
    if (deleteConfirmId === conversationId) {
      deleteConversationMutation.mutate(conversationId)
    } else {
      setDeleteConfirmId(conversationId)
      // Auto-cancel confirmation after 5 seconds
      setTimeout(() => {
        setDeleteConfirmId(null)
      }, 5000)
    }
  }

  const filteredConversations = conversations.filter((conversation: Conversation) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      conversation.participant1_name.toLowerCase().includes(searchLower) ||
      conversation.participant1_email.toLowerCase().includes(searchLower) ||
      conversation.participant2_name.toLowerCase().includes(searchLower) ||
      conversation.participant2_email.toLowerCase().includes(searchLower) ||
      conversation.last_message_content.toLowerCase().includes(searchLower)
    )
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (!user || user.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">Super admin privileges required to access this page.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error Loading Conversations</h2>
          <p className="text-slate-600">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Conversation Management</h1>
              <p className="text-slate-600">View and manage all user conversations</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Total Conversations</p>
            <p className="text-3xl font-bold text-blue-600">{conversations.length}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search conversations by participant name, email, or message content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversations List */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Conversations</h2>
            <p className="text-sm text-slate-600">Showing {filteredConversations.length} conversations</p>
          </div>
          
          <div className="divide-y divide-slate-200 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No conversations found</p>
              </div>
            ) : (
              filteredConversations.map((conversation: Conversation) => (
                <div
                  key={conversation.exchange_id}
                  className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                    selectedConversation === conversation.exchange_id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                  }`}
                  onClick={() => setSelectedConversation(conversation.exchange_id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {conversation.participant1_name}
                        </span>
                        <span className="text-slate-400">↔</span>
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {conversation.participant2_name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs text-slate-500 truncate">{conversation.participant1_email}</span>
                        <span className="text-xs text-slate-500 truncate">{conversation.participant2_email}</span>
                      </div>
                      <p className="text-sm text-slate-600 truncate">{conversation.last_message_content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-500">
                          {conversation.message_count} message{conversation.message_count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(conversation.last_message_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedConversation(conversation.exchange_id)
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="View conversation"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteConversation(conversation.exchange_id)
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          deleteConfirmId === conversation.exchange_id
                            ? 'text-white bg-red-600 hover:bg-red-700'
                            : 'text-slate-400 hover:text-red-600 hover:bg-red-100'
                        }`}
                        title={deleteConfirmId === conversation.exchange_id ? 'Click again to confirm deletion' : 'Delete conversation'}
                        disabled={deleteConversationMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Details */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
            <p className="text-sm text-slate-600">
              {selectedConversation ? 'Select a conversation to view messages' : 'No conversation selected'}
            </p>
          </div>
          
          <div className="p-6">
            {!selectedConversation ? (
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Select a conversation to view messages</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {selectedMessages.map((message: Message) => {
                  const conversation = conversations.find((c: Conversation) => c.exchange_id === selectedConversation)
                  const senderName = message.sender_id === conversation?.participant1_id 
                    ? conversation.participant1_name 
                    : conversation?.participant2_name
                    
                  return (
                    <div key={message.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-slate-900">{senderName}</span>
                          <span className="text-xs text-slate-500">→</span>
                          <span className="text-xs text-slate-500">{message.receiver_id}</span>
                        </div>
                        <span className="text-xs text-slate-500">{formatDate(message.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{message.content}</p>
                      {message.image_url && (
                        <img 
                          src={message.image_url} 
                          alt="Message attachment" 
                          className="mt-2 max-w-xs rounded-lg border border-slate-200"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
