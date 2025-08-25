import React, { useRef, useEffect } from 'react';
import { Conversation, Message } from './NewMessagesPanel';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

interface ChatViewProps {
  conversation: Conversation | undefined;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onClearChat: (conversationId: string) => void;
  currentUserId: string | undefined;
}

export const ChatView: React.FC<ChatViewProps> = ({
  conversation,
  messages,
  onSendMessage,
  onDeleteConversation,
  onClearChat,
  currentUserId
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showActions, setShowActions] = React.useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close actions dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Messages</h3>
          <p className="text-gray-600 mb-6">Select a conversation from the sidebar to start chatting, or create a new conversation to connect with someone.</p>
          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Real-time messaging</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Message status indicators</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Search and organize chats</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="p-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3">
          {/* Avatar */}
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
            <span className="text-white font-semibold text-sm">
              {conversation.name.charAt(0).toUpperCase()}
            </span>
          </div>
          
          {/* Conversation Info */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{conversation.name}</h3>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500">Active now</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 relative">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" title="Search in conversation">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <div className="relative" ref={actionsRef}>
              <button 
                onClick={() => setShowActions(!showActions)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" 
                title="More options"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {/* Actions Dropdown */}
              {showActions && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                  <button
                    onClick={() => {
                      if (conversation?.id) {
                        if (confirm('Are you sure you want to clear this chat? This will delete all messages.')) {
                          onClearChat(conversation.id);
                        }
                      }
                      setShowActions(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Clear Chat</span>
                  </button>
                  <button
                    onClick={() => {
                      if (conversation?.id) {
                        if (confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
                          onDeleteConversation(conversation.id);
                        }
                      }
                      setShowActions(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Delete Conversation</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-gray-50 px-4 py-2"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3e%3cg fill='none' fill-rule='evenodd'%3e%3cg fill='%23f8fafc' fill-opacity='0.4'%3e%3cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm-16-16v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3e%3c/g%3e%3c/g%3e%3c/svg%3e")`,
        }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Start the conversation</h3>
              <p className="text-gray-600 mb-4">Send a message to begin chatting with {conversation.name}</p>
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 inline-block">
                <p className="text-sm text-gray-500">Your messages are private and secure</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {messages.map((message, index) => {
              const isOwnMessage = message.senderId === currentUserId;
              const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;
              const isLastInGroup = index === messages.length - 1 || messages[index + 1].senderId !== message.senderId;
              
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwnMessage={isOwnMessage}
                  showAvatar={showAvatar && !isOwnMessage}
                  isLastInGroup={isLastInGroup}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 bg-white border-t border-gray-200">
        <MessageInput onSendMessage={onSendMessage} />
      </div>
    </div>
  );
};