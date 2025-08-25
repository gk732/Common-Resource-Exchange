import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  MessageCircle,
  Send,
  User,
  Search,
  MoreVertical,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Archive,
  Check,
  CheckCheck,
  Plus,
  X,
  Users
} from 'lucide-react'
import toast from 'react-hot-toast'
import UserAvatar from '@/components/ui/UserAvatar'

interface Message {
  id: string
  exchange_id: string
  sender_id: string
  receiver_id: string
  content: string
  image_url?: string
  status?: 'sent' | 'delivered' | 'read'
  created_at: string
  read_at?: string
}

interface Conversation {
  partnerId: string
  partner: {
    id: string
    name: string
    email: string
    profile_image_url?: string
  }
  lastMessage: Message
  unreadCount: number
}

export default function MessagesPage() {
  const { user, session } = useAuth()
  const queryClient = useQueryClient()
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)
  const [messagesEndRef, setMessagesEndRef] = useState<HTMLDivElement | null>(null)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [userSearchTerm, setUserSearchTerm] = useState('')
  
  // CRITICAL FIX: Ensure proper session handling for API calls
  const makeAuthenticatedCall = async (action: string, body: any) => {
    if (!session?.access_token) {
      console.error('[Messaging] No session or access token available')
      throw new Error('Authentication session not available. Please log in again.')
    }
    
    console.log('[Messaging] Making authenticated call:', action, 'with session:', !!session)
    
    // Ensure supabase client has the current session
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    })
    
    const { data, error } = await supabase.functions.invoke('messaging-system', {
      body: { action, ...body }
    })
    
    if (error) {
      console.error('[Messaging] API call error:', error)
      throw error
    }
    
    return data
  }
  
  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return
    
    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('messages')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `or(sender_id.eq.${user.id},receiver_id.eq.${user.id})`
        }, 
        (payload) => {
          console.log('New message received:', payload.new)
          // Refresh both conversations and current conversation messages
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
          if (selectedConversation) {
            queryClient.invalidateQueries({ queryKey: ['conversation-messages', selectedConversation] })
          }
          
          // Auto-scroll to bottom if it's a new message in current conversation
          if (payload.new.exchange_id && selectedConversation && 
              (payload.new.sender_id === selectedConversation || payload.new.receiver_id === selectedConversation)) {
            setTimeout(() => messagesEndRef?.scrollIntoView({ behavior: 'smooth' }), 100)
          }
        })
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public', 
          table: 'messages',
          filter: `or(sender_id.eq.${user.id},receiver_id.eq.${user.id})`
        },
        (payload) => {
          console.log('Message updated:', payload.new)
          // Refresh conversations to update read status
          queryClient.invalidateQueries({ queryKey: ['conversations'] })
          if (selectedConversation) {
            queryClient.invalidateQueries({ queryKey: ['conversation-messages', selectedConversation] })
          }
        })
      .subscribe()
    
    return () => {
      messagesChannel.unsubscribe()
    }
  }, [user, selectedConversation, queryClient, messagesEndRef])
  
  // Fetch users for new conversation search
  const { data: searchedUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['search-users', userSearchTerm, user?.id],
    queryFn: async () => {
      if (!user || userSearchTerm.length < 2) return []
      
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, profile_image_url')
        .neq('id', user.id) // Exclude current user
        .or(`name.ilike.%${userSearchTerm}%,email.ilike.%${userSearchTerm}%`)
        .limit(10)
      
      if (error) throw error
      return data || []
    },
    enabled: !!user && showNewConversation && userSearchTerm.length >= 2
  })

  // Fetch user details for new conversation (when no existing conversation exists)
  const { data: selectedUserDetails } = useQuery({
    queryKey: ['user-details', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation || !user) return null
      
      // First check if this is already an existing conversation partner in current conversations list
      // Note: conversations might still be loading, so we fetch user details regardless
      
      // Fetch user details for the selected conversation
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, profile_image_url')
        .eq('id', selectedConversation)
        .single()
      
      if (error) {
        console.error('Error fetching user details:', error)
        return null
      }
      return data
    },
    enabled: !!selectedConversation && !!user
  })

  // Start new conversation function
  const startNewConversation = (userId: string) => {
    setSelectedConversation(userId)
    setShowNewConversation(false)
    setUserSearchTerm('')
  }

  // Manual refresh function for messages
  const refreshMessages = () => {
    queryClient.invalidateQueries({ queryKey: ['conversation-messages', selectedConversation] })
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user || !session) return []
      
      const data = await makeAuthenticatedCall('get_conversations', {})
      return data.data || []
    },
    enabled: !!user && !!session,
    refetchInterval: false, // DEFINITIVE FIX: No automatic polling to prevent re-renders
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['conversation-messages', selectedConversation, user?.id],
    queryFn: async () => {
      if (!user || !selectedConversation || !session) return []
      
      const data = await makeAuthenticatedCall('get_conversation', {
        receiverId: selectedConversation
      })
      return data.data || []
    },
    enabled: !!user && !!selectedConversation && !!session,
    // CRITICAL FIX: Use manual refresh instead of aggressive polling
    refetchInterval: false, // Disabled automatic polling to prevent interference with uploads
    staleTime: 30000 // Keep data fresh for 30 seconds
  })

  // CRITICAL FIX: Enhanced send message mutation with comprehensive error handling
  const sendMessageMutation = useMutation({
    mutationFn: async ({ receiverId, content }: { receiverId: string, content: string }) => {
      const data = await makeAuthenticatedCall('send_message', {
        receiverId,
        messageData: { content }
      })
      return data
    },
    onSuccess: () => {
      setMessageText('')
      // Manual refresh instead of aggressive polling
      refreshMessages()
      toast.success('Message sent successfully!')
    },
    onError: (error: any) => {
      console.error('Send message mutation error:', error)
      toast.error(error.message || 'Failed to send message. Please try again.')
    },
    // CRITICAL FIX: Add onSettled to ensure button state is always reset
    onSettled: () => {
      // This ensures the button is re-enabled regardless of success or failure
      // The mutation state will be reset automatically
      console.log('Message sending operation completed')
    },
    // Enhanced retry mechanism for temporary failures
    retry: (failureCount, error) => {
      // Retry up to 2 times for network or temporary errors
      if (failureCount < 2) {
        const errorMessage = error?.message || ''
        // Retry for specific error types that might be temporary
        if (errorMessage.includes('non-2xx') || 
            errorMessage.includes('network') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('connection')) {
          return true
        }
      }
      return false
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 3000) // Cap at 3 seconds
  })

  // Mark conversation as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const data = await makeAuthenticatedCall('mark_as_read', {
        conversationId
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  })
  
  // Delete completed messages mutation
  const deleteCompletedMessagesMutation = useMutation({
    mutationFn: async () => {
      const data = await makeAuthenticatedCall('delete_completed_messages', {})
      return data
    },
    onSuccess: () => {
      toast.success('Completed messages deleted successfully')
      setShowDeleteOptions(false)
      
      // ENHANCED FIX: Force refresh both conversations and current messages
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.refetchQueries({ queryKey: ['conversations'] })
      
      if (selectedConversation) {
        queryClient.invalidateQueries({ queryKey: ['conversation-messages', selectedConversation] })
      }
      
      // Clear all cached message queries
      queryClient.removeQueries({ queryKey: ['conversation-messages'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete completed messages')
    }
  })
  
  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const data = await makeAuthenticatedCall('delete_conversation', {
        conversationId
      })
      return data
    },
    onSuccess: () => {
      toast.success('Conversation deleted successfully')
      setSelectedConversation(null)
      setShowDeleteOptions(false)
      
      // ENHANCED FIX: More comprehensive refresh to ensure conversation list updates
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.refetchQueries({ queryKey: ['conversations'] })
      
      // Also clear any cached conversation messages
      queryClient.removeQueries({ queryKey: ['conversation-messages'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete conversation')
    }
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, messagesEndRef])

  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversation) {
      const conversationId = `conv_${[user?.id, selectedConversation].sort().join('_')}`
      markAsReadMutation.mutate(conversationId)
    }
  }, [selectedConversation, user?.id])

  // CRITICAL FIX: Enhanced form submit handler with additional safety checks
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent sending if already sending or no text/conversation selected
    if (!messageText.trim() || !selectedConversation || sendMessageMutation.isPending) {
      return
    }
    
    // Additional validation
    if (messageText.length > 1000) {
      toast.error('Message is too long. Please keep it under 1000 characters.')
      return
    }
    
    sendMessageMutation.mutate({
      receiverId: selectedConversation,
      content: messageText.trim()
    })
  }

  const getMessageStatus = (message: Message) => {
    if (message.sender_id !== user?.id) return null // Only show status for own messages
    
    if (message.read_at) {
      return (
        <div className="flex items-center" title="Read">
          <CheckCheck className="h-3 w-3 text-blue-400" />
        </div>
      )
    } else {
      return (
        <div className="flex items-center" title="Sent">
          <Check className="h-3 w-3 text-slate-400" />
        </div>
      )
    }
  }

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const formatLastMessageTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const filteredConversations = conversations.filter((conv: Conversation) => 
    conv.partner?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage?.content?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedPartner = conversations.find((conv: Conversation) => conv.partnerId === selectedConversation)?.partner || selectedUserDetails

  return (
    <div className="h-[calc(100vh-12rem)] bg-white rounded-2xl shadow-sm border border-slate-200 flex">
      {/* Conversations Sidebar */}
      <div className={`w-full md:w-1/3 border-r border-slate-200 flex flex-col ${
        selectedConversation ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Messages</h2>
            <button
              onClick={() => setShowNewConversation(true)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              title="Start new conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {filteredConversations.map((conversation: Conversation) => (
                <button
                  key={conversation.partnerId}
                  onClick={() => setSelectedConversation(conversation.partnerId)}
                  className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                    selectedConversation === conversation.partnerId ? 'bg-blue-50 border-r-2 border-blue-600' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <UserAvatar 
                      user={conversation.partner}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {conversation.partner?.name || 'Unknown User'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatLastMessageTime(conversation.lastMessage?.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-600 truncate">
                          {conversation.lastMessage?.sender_id === user?.id ? 'You: ' : ''}
                          {conversation.lastMessage?.content || 'No messages yet'}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-600 rounded-full">
                            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6">
              <MessageCircle className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-slate-500 text-center">
                {searchTerm ? 'No conversations found' : 'No messages yet'}
              </p>
              <p className="text-sm text-slate-400 text-center mt-1">
                {searchTerm ? 'Try a different search term' : 'Start a conversation by messaging someone'}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Messages Area */}
      <div className={`flex-1 flex flex-col ${
        selectedConversation ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedConversation ? (
          selectedPartner ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <UserAvatar 
                  user={selectedPartner}
                  size="md"
                />
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {selectedPartner.name}
                  </h3>
                  <p className="text-sm text-slate-500">{selectedPartner.email}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={refreshMessages}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                  title="Refresh messages"
                >
                  <RefreshCw className={`h-5 w-5 ${messagesLoading ? 'animate-spin' : ''}`} />
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setShowDeleteOptions(!showDeleteOptions)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                    title="Message options"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  
                  {showDeleteOptions && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-48">
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to delete all completed messages? This cannot be undone.')) {
                            deleteCompletedMessagesMutation.mutate()
                          }
                        }}
                        disabled={deleteCompletedMessagesMutation.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center space-x-2 disabled:opacity-50"
                      >
                        <Archive className="h-4 w-4" />
                        <span>{deleteCompletedMessagesMutation.isPending ? 'Deleting...' : 'Delete Completed Messages'}</span>
                      </button>
                      {selectedConversation && (
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this entire conversation? This cannot be undone.')) {
                              deleteConversationMutation.mutate(selectedConversation)
                            }
                          }}
                          disabled={deleteConversationMutation.isPending}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>{deleteConversationMutation.isPending ? 'Deleting...' : 'Delete This Conversation'}</span>
                        </button>
                      )}
                      <div className="border-t border-slate-200 my-1"></div>
                      <button
                        onClick={() => setShowDeleteOptions(false)}
                        className="w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`animate-pulse ${
                      i % 2 === 0 ? 'flex justify-end' : 'flex justify-start'
                    }`}>
                      <div className={`max-w-xs ${
                        i % 2 === 0 ? 'bg-slate-200' : 'bg-slate-200'
                      } rounded-2xl p-3`}>
                        <div className="h-4 bg-slate-300 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-300 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length > 0 ? (
                messages.map((message: Message) => {
                  const isOwn = message.sender_id === user?.id
                  
                  return (
                    <div key={message.id} className={`flex ${
                      isOwn ? 'justify-end' : 'justify-start'
                    }`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                        isOwn
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-900'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-xs ${
                            isOwn ? 'text-blue-100' : 'text-slate-500'
                          }`}>
                            {formatMessageTime(message.created_at)}
                          </p>
                          {isOwn && (
                            <div className="ml-2">
                              {getMessageStatus(message)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <MessageCircle className="h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-slate-500">No messages yet</p>
                  <p className="text-sm text-slate-400">Send a message to start the conversation</p>
                </div>
              )}
              <div ref={setMessagesEndRef} />
            </div>
            
            {/* CRITICAL FIX: Enhanced Message Input with better error state management */}
            <div className="p-6 border-t border-slate-200">
              <form onSubmit={handleSendMessage} className="flex space-x-3">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message..."
                  maxLength={1000}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={sendMessageMutation.isPending}
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 min-w-[100px]"
                >
                  {sendMessageMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span className="text-sm">Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      <span className="text-sm">Send</span>
                    </>
                  )}
                </button>
              </form>
              {/* Character counter */}
              <div className="mt-2 text-right">
                <span className={`text-xs ${
                  messageText.length > 950 ? 'text-red-500' :
                  messageText.length > 800 ? 'text-yellow-600' :
                  'text-slate-400'
                }`}>
                  {messageText.length}/1000
                </span>
              </div>
            </div>
          </>          
          ) : (
            // Loading state for new conversation user details
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading conversation...</p>
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Select a conversation</h3>
              <p className="text-slate-600">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
      
      {/* New Conversation Modal */}
      {showNewConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 max-h-96 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Start New Conversation</h3>
              <button
                onClick={() => {
                  setShowNewConversation(false)
                  setUserSearchTerm('')
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {userSearchTerm.length < 2 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Type at least 2 characters to search for users</p>
                </div>
              ) : usersLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center space-x-3">
                      <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchedUsers.length > 0 ? (
                <div className="space-y-2">
                  {searchedUsers.map((searchUser) => (
                    <button
                      key={searchUser.id}
                      onClick={() => startNewConversation(searchUser.id)}
                      className="w-full p-3 text-left hover:bg-slate-50 rounded-lg transition-colors flex items-center space-x-3"
                    >
                      <UserAvatar user={searchUser} size="sm" />
                      <div>
                        <p className="font-medium text-slate-900">{searchUser.name}</p>
                        <p className="text-sm text-slate-600">{searchUser.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No users found</p>
                  <p className="text-sm text-slate-400">Try a different search term</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}