import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  name: string;
  email: string;
  profile_image_url?: string;
}

interface Conversation {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  participants: string[];
  isGroupChat: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConversationsListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateConversation: (userId: string) => void;
}

export const ConversationsList: React.FC<ConversationsListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation
}) => {
  const { user } = useAuth();
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Search for users when user search term changes
  useEffect(() => {
    if (userSearchTerm.length >= 2 && showNewChatModal) {
      searchUsers(userSearchTerm);
    } else {
      setAvailableUsers([]);
    }
  }, [userSearchTerm, showNewChatModal]);

  const searchUsers = async (searchQuery: string) => {
    if (!user) return;
    
    setSearchingUsers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, profile_image_url')
        .neq('id', user.id) // Exclude current user
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(10);
        
      if (!error && data) {
        setAvailableUsers(data);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setSearchingUsers(false);
    }
  };

  const handleCreateConversation = (selectedUser: User) => {
    onCreateConversation(selectedUser.id);
    setShowNewChatModal(false);
    setUserSearchTerm('');
    setAvailableUsers([]);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Messages</h2>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="p-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-1"
            title="New Chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm">New</span>
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search conversations"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium mb-2 text-gray-700">No conversations yet</p>
            <p className="text-sm mb-6 text-gray-500">Start chatting with someone to see your conversations here</p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Start New Chat
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedConversationId === conversation.id
                    ? 'bg-blue-50 border-r-4 border-blue-600'
                    : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                      <span className="text-white font-semibold text-sm">
                        {conversation.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Conversation Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {conversation.name}
                      </h3>
                      {conversation.lastMessageTime && (
                        <span className="text-xs text-gray-500 ml-2">
                          {formatTime(conversation.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-gray-600 truncate">
                        {conversation.lastMessage || 'Start a conversation...'}
                      </p>
                      {conversation.unreadCount && conversation.unreadCount > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-blue-600 rounded-full ml-2">
                          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Start New Chat</h3>
                <button
                  onClick={() => {
                    setShowNewChatModal(false);
                    setUserSearchTerm('');
                    setAvailableUsers([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Search Input */}
            <div className="p-6">
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search users by name..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              
              {/* Search Results */}
              <div className="max-h-64 overflow-y-auto">
                {userSearchTerm.length < 2 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm">Type at least 2 characters to search for users</p>
                  </div>
                ) : searchingUsers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600">Searching users...</p>
                  </div>
                ) : availableUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                    </svg>
                    <p className="text-sm">No users found matching '{userSearchTerm}'</p>
                    <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableUsers.map((availableUser) => (
                      <button
                        key={availableUser.id}
                        onClick={() => handleCreateConversation(availableUser)}
                        className="w-full p-3 text-left rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-colors group"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {availableUser.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600">
                              {availableUser.name}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {availableUser.email}
                            </p>
                          </div>
                          <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};