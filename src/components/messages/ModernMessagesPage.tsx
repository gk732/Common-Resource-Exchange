import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  MessageCircle,
  Send,
  Search,
  MoreVertical,
  ArrowLeft,
  Info,
  Trash2,
  Archive,
  Plus,
  X,
  Check,
  CheckCheck,
  Clock,
  Users,
  Loader2,
  AlertCircle,
  MessageSquareX
} from 'lucide-react'
import toast from 'react-hot-toast'
import UserAvatar from '@/components/ui/UserAvatar'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'file' | 'system'
  attachment_url?: string
  attachment_name?: string
  is_read: boolean
  read_at?: string
  delivered_at?: string
  created_at: string
  updated_at: string
}

interface Conversation {
  id: string
  partner: {
    id: string
    name: string
    email: string
    profile_image_url?: string
  }
  lastMessage?: Message
  unreadCount: number
  lastMessageAt: string
  createdAt: string
}

interface UserPresence {
  user_id: string
  is_online: boolean
  last_seen: string
}

export default function ModernMessagesPage() {
  const { user, session } = useAuth()
  const queryClient = useQueryClient()
  
  // UI State
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewConversationModal, setShowNewConversationModal] = useState(false)
  const [showConversationDetails, setShowConversationDetails] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  
  // Search state
  const [userSearchQuery, setUserSearchQuery] = useState('')
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  // Make authenticated API call - ENHANCED: Better error handling and logging
  const makeApiCall = async (action: string, data: any = {}) => {
    if (!session?.access_token) {
      console.error('[API Call] No authentication session available')
      throw new Error('No authentication session')
    }
    
    console.log(`[API Call] Making call to modern-messaging with action: ${action}`, data)
    
    const response = await supabase.functions.invoke('modern-messaging', {
      body: { action, ...data }
    })
    
    console.log(`[API Call] Response for ${action}:`, { 
      data: response.data, 
      error: response.error
    })
    
    if (response.error) {
      console.error(`[API Call] Error in ${action}:`, response.error)
      throw response.error
    }
    
    // Extract the nested data from the edge function response
    // Edge function returns: { success: true, data: actualResult }
    // We need to return just the actualResult
    if (response.data && response.data.success && response.data.data !== undefined) {
      console.log(`[API Call] Extracted data for ${action}:`, response.data.data)
      return response.data.data
    }
    
    // Fallback for any unexpected response structure
    console.warn(`[API Call] Unexpected response structure for ${action}, returning raw data`)
    return response.data
  }
  
  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading, refetch: refetchConversations } = useQuery({
    queryKey: ['modern-conversations', user?.id],
    queryFn: () => makeApiCall('get_conversations'),
    enabled: !!user && !!session,
    refetchInterval: 30000, // Refresh every 30 seconds
  })
  
  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['modern-conversation-messages', selectedConversationId],
    queryFn: () => makeApiCall('get_conversation_messages', { conversationId: selectedConversationId }),
    enabled: !!selectedConversationId && !!user && !!session,
    refetchInterval: 5000, // Refresh messages more frequently
  })
  
  // Search users for new conversation
  const { data: searchedUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['search-users', userSearchQuery],
    queryFn: async () => {
      if (userSearchQuery.length < 2) return []
      
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, profile_image_url')
        .neq('id', user!.id)
        .or(`name.ilike.%${userSearchQuery}%,email.ilike.%${userSearchQuery}%`)
        .limit(10)
      
      if (error) throw error
      return data || []
    },
    enabled: showNewConversationModal && userSearchQuery.length >= 2,
  })
  
  // Get user presence - FIXED: Add null check for conversations
  const partnerIds = useMemo(() => {
    if (!conversations || !Array.isArray(conversations)) return []
    return conversations.map(c => c?.partner?.id).filter(Boolean)
  }, [conversations])
  const { data: userPresence = [] } = useQuery({
    queryKey: ['user-presence', partnerIds],
    queryFn: () => partnerIds.length > 0 ? makeApiCall('get_user_presence', { userIds: partnerIds }) : [],
    enabled: partnerIds.length > 0,
    refetchInterval: 15000, // Check presence every 15 seconds
  })
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ receiverId, content }: { receiverId: string, content: string }) => {
      return makeApiCall('send_message', {
        receiverId,
        content: content.trim(),
        messageType: 'text'
      })
    },
    onSuccess: () => {
      setMessageText('')
      refetchMessages()
      refetchConversations()
      scrollToBottom()
      toast.success('Message sent!')
    },
    onError: (error: any) => {
      console.error('Send message error:', error)
      toast.error(error.message || 'Failed to send message')
    },
  })
  
  // Mark messages as read mutation
  const markReadMutation = useMutation({
    mutationFn: (conversationId: string) => makeApiCall('mark_messages_read', { conversationId }),
    onSuccess: () => {
      refetchConversations()
    },
  })
  
  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: (conversationId: string) => makeApiCall('delete_conversation', { conversationId }),
    onSuccess: () => {
      setSelectedConversationId(null)
      // Invalidate and refetch conversations to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['modern-conversations', user?.id] })
      refetchConversations()
      toast.success('Conversation deleted')
    },
    onError: (error: any) => {
      console.error('Delete conversation error:', error)
      toast.error(error.message || 'Failed to delete conversation')
    },
  })
  
  // Clear chat mutation (delete all messages but keep conversation)
  const clearChatMutation = useMutation({
    mutationFn: (conversationId: string) => makeApiCall('clear_chat', { conversationId }),
    onSuccess: () => {
      // Invalidate and refetch both messages and conversations
      queryClient.invalidateQueries({ queryKey: ['modern-conversation-messages', selectedConversationId] })
      queryClient.invalidateQueries({ queryKey: ['modern-conversations', user?.id] })
      refetchMessages()
      refetchConversations()
      toast.success('Chat cleared - all messages removed')
    },
    onError: (error: any) => {
      console.error('Clear chat error:', error)
      toast.error(error.message || 'Failed to clear chat')
    },
  })
  
  // Update user presence
  const updatePresenceMutation = useMutation({
    mutationFn: () => makeApiCall('update_user_presence'),
  })
  
  // Handle form submission
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!messageText.trim() || !selectedConversation?.partner.id || sendMessageMutation.isPending) {
      return
    }
    
    sendMessageMutation.mutate({
      receiverId: selectedConversation.partner.id,
      content: messageText
    })
  }
  
  // Handle typing
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true)
      // In a real app, you'd send typing indicator to server
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
    }, 1000)
  }
  
  // Start new conversation - DEBUGGING VERSION
  const startNewConversation = async (partnerId: string) => {
    if (!partnerId) {
      toast.error('Invalid user selection')
      return
    }
    
    if (!session?.access_token) {
      toast.error('Please log in again')
      return
    }
    
    try {
      // Close modal immediately to provide better UX
      setShowNewConversationModal(false)
      setUserSearchQuery('')
      
      const toastId = toast.loading('Starting conversation...')
      
      // Create the conversation without sending an automatic message
      const apiResponse = await makeApiCall('send_message', {
        receiverId: partnerId,
        content: 'Started conversation',
        messageType: 'system'
      })
      
      if (!apiResponse) {
        throw new Error('No response from API')
      }
      
      // Refresh conversations to get the new one
      await refetchConversations()
      
      // Wait a moment for React Query to update the cache
      setTimeout(async () => {
        // Get updated conversations from cache
        const currentConversations = queryClient.getQueryData(['modern-conversations', user?.id]) as any[]
        
        if (currentConversations && Array.isArray(currentConversations)) {
          // Find the conversation with the selected partner
          const targetConversation = currentConversations.find(conv => 
            conv?.partner?.id === partnerId
          )
          
          if (targetConversation) {
            // Select the conversation
            setSelectedConversationId(targetConversation.id)
            toast.success('Conversation started!', { id: toastId })
          } else {
            // If not found, try one more refresh with longer delay
            setTimeout(async () => {
              await refetchConversations()
              const retryConversations = queryClient.getQueryData(['modern-conversations', user?.id]) as any[]
              const retryTarget = retryConversations?.find(conv => conv?.partner?.id === partnerId)
              
              if (retryTarget) {
                setSelectedConversationId(retryTarget.id)
                toast.success('Conversation started!', { id: toastId })
              } else {
                toast.success('Message sent! The conversation will appear shortly.', { id: toastId })
              }
            }, 2000)
          }
        } else {
          toast.success('Message sent! Please refresh if needed.', { id: toastId })
        }
      }, 1000)
      
    } catch (error: any) {
      toast.error(`Failed to start conversation: ${error?.message || 'Unknown error'}`)
    }
  }
  
  // Update presence on mount and periodically
  useEffect(() => {
    if (user && session) {
      updatePresenceMutation.mutate()
      
      // Update presence every 5 minutes
      const interval = setInterval(() => {
        updatePresenceMutation.mutate()
      }, 5 * 60 * 1000)
      
      return () => clearInterval(interval)
    }
  }, [user, session])
  
  // Mark conversation as read when selected
  useEffect(() => {
    if (selectedConversationId) {
      markReadMutation.mutate(selectedConversationId)
    }
  }, [selectedConversationId])
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])
  
  // Real-time subscriptions - FIXED: Add null checks for conversations array
  useEffect(() => {
    if (!user || !conversations || !Array.isArray(conversations) || conversations.length === 0) return
    
    // Get conversation IDs safely
    const conversationIds = conversations.map(c => c?.id).filter(Boolean)
    if (conversationIds.length === 0) return
    
    // Subscribe to new messages
    const messagesSubscription = supabase
      .channel('messages_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=in.(${conversationIds.join(',')})`
        },
        (payload) => {
          console.log('New message received:', payload.new)
          
          // Refresh conversations and messages
          refetchConversations()
          if (selectedConversationId === payload.new.conversation_id) {
            refetchMessages()
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=in.(${conversationIds.join(',')})`
        },
        (payload) => {
          console.log('Message updated:', payload.new)
          refetchConversations()
          if (selectedConversationId === payload.new.conversation_id) {
            refetchMessages()
          }
        }
      )
      .subscribe()
    
    return () => {
      messagesSubscription.unsubscribe()
    }
  }, [user, conversations, selectedConversationId])
  
  // Filter conversations based on search - FIXED: Add null check
  const filteredConversations = useMemo(() => {
    if (!conversations || !Array.isArray(conversations)) return []
    return conversations.filter(conversation =>
      conversation?.partner?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation?.lastMessage?.content?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [conversations, searchQuery])
  
  // Get selected conversation - FIXED: Add null check for conversations array
  const selectedConversation = useMemo(() => {
    if (!conversations || !Array.isArray(conversations) || !selectedConversationId) return null
    return conversations.find(conv => conv?.id === selectedConversationId) || null
  }, [conversations, selectedConversationId])
  
  // Get partner presence - FIXED: Add null check for userPresence array
  const getPartnerPresence = (partnerId: string): UserPresence | null => {
    if (!userPresence || !Array.isArray(userPresence) || !partnerId) return null
    return userPresence.find((p: UserPresence) => p?.user_id === partnerId) || null
  }
  
  // Format time
  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }
  
  const formatLastMessageTime = (dateString: string) => {
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
  
  // Get message status icon
  const getMessageStatusIcon = (message: Message) => {
    if (message.sender_id !== user?.id) return null
    
    if (message.read_at) {
      return <CheckCheck className="h-3 w-3 text-blue-500" />
    } else if (message.delivered_at) {
      return <CheckCheck className="h-3 w-3 text-gray-400" />
    } else {
      return <Check className="h-3 w-3 text-gray-400" />
    }
  }
  
  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Please log in to access messages</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-[calc(100vh-12rem)] bg-white rounded-2xl shadow-sm border border-gray-200 flex overflow-hidden">
      {/* Conversations Sidebar */}
      <div className={`w-full md:w-80 border-r border-gray-200 flex flex-col bg-gray-50 ${
        selectedConversationId ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Sidebar Header */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
            <button
              onClick={() => setShowNewConversationModal(true)}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-100 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
        
        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading conversations...</span>
            </div>
          ) : filteredConversations.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {filteredConversations.map((conversation) => {
                const presence = getPartnerPresence(conversation.partner.id)
                const isOnline = presence?.is_online || false
                
                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`w-full p-4 text-left hover:bg-white transition-colors relative ${
                      selectedConversationId === conversation.id
                        ? 'bg-blue-50 border-r-2 border-blue-600'
                        : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <UserAvatar user={conversation.partner} size="md" />

                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {conversation.partner.name}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {formatLastMessageTime(conversation.lastMessageAt)}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-gray-600 truncate">
                            {conversation.lastMessage?.sender_id === user.id ? 'You: ' : ''}
                            {conversation.lastMessage?.content || 'No messages yet'}
                          </p>
                          {conversation.unreadCount > 0 && (
                            <span className="inline-flex items-center justify-center h-5 w-5 text-xs font-medium text-white bg-blue-600 rounded-full">
                              {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <MessageCircle className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 mb-2">
                {searchQuery ? 'No conversations found' : 'No messages yet'}
              </p>
              <p className="text-sm text-gray-400">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Start a conversation by messaging someone'}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-white ${
        selectedConversationId ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedConversationId(null)}
                  className="md:hidden p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                
                <div className="relative">
                  <UserAvatar user={selectedConversation.partner} size="md" />

                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedConversation.partner.name}
                  </h3>

                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <button
                    onClick={() => setShowConversationDetails(!showConversationDetails)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  
                  {showConversationDetails && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-48">
                      <button
                        onClick={() => {
                          setShowConversationDetails(false)
                          if (confirm('Are you sure you want to clear all messages? This action cannot be undone.')) {
                            clearChatMutation.mutate(selectedConversation.id)
                          }
                        }}
                        disabled={clearChatMutation.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center space-x-2"
                      >
                        <MessageSquareX className="h-4 w-4" />
                        <span>Clear Chat</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowConversationDetails(false)
                          if (confirm('Are you sure you want to delete this conversation? This will remove it completely and cannot be undone.')) {
                            deleteConversationMutation.mutate(selectedConversation.id)
                          }
                        }}
                        disabled={deleteConversationMutation.isPending}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Conversation</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : messages && messages.filter((message) => message.message_type !== 'system').length > 0 ? (
                messages
                  .filter((message) => message.message_type !== 'system') // Filter out system messages
                  .map((message) => {
                  const isOwnMessage = message.sender_id === user.id
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          isOwnMessage
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        <div className={`flex items-center justify-between mt-1 space-x-2 ${
                          isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          <span className="text-xs">
                            {formatMessageTime(message.created_at)}
                          </span>
                          {isOwnMessage && (
                            <div className="flex-shrink-0">
                              {getMessageStatusIcon(message)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  <MessageCircle className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500">No messages yet</p>
                  <p className="text-sm text-gray-400">Start the conversation!</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                <div className="flex-1 relative">
                  <input
                    ref={messageInputRef}
                    type="text"
                    value={messageText}
                    onChange={(e) => {
                      setMessageText(e.target.value)
                      handleTyping()
                    }}
                    placeholder="Type a message..."
                    maxLength={2000}
                    disabled={sendMessageMutation.isPending}
                    className="w-full px-4 py-3 bg-gray-50 border-0 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={!messageText.trim() || sendMessageMutation.isPending}
                  className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </form>
              
              {/* Character counter */}
              <div className="mt-2 text-right">
                <span className={`text-xs ${
                  messageText.length > 1800
                    ? 'text-red-500'
                    : messageText.length > 1500
                    ? 'text-yellow-600'
                    : 'text-gray-400'
                }`}>
                  {messageText.length}/2000
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-gray-600">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>
      
      {/* New Conversation Modal */}
      {showNewConversationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 max-h-96 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">New Conversation</h3>
              <button
                onClick={() => {
                  setShowNewConversationModal(false)
                  setUserSearchQuery('')
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {userSearchQuery.length < 2 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Type at least 2 characters to search users</p>
                </div>
              ) : usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Searching...</span>
                </div>
              ) : searchedUsers && searchedUsers.length > 0 ? (
                <div className="space-y-2">
                  {searchedUsers.map((searchUser) => (
                    <button
                      key={searchUser.id}
                      onClick={() => startNewConversation(searchUser.id)}
                      className="w-full p-3 text-left hover:bg-gray-50 rounded-lg transition-colors flex items-center space-x-3 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      type="button"
                    >
                      <UserAvatar user={searchUser} size="sm" />
                      <div className="pointer-events-none">
                        <p className="font-medium text-gray-900">{searchUser.name}</p>
                        <p className="text-sm text-gray-600">{searchUser.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No users found</p>
                  <p className="text-sm text-gray-400">Try a different search term</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}