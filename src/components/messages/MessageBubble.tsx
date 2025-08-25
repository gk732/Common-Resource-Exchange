import React from 'react';
import { Message } from './NewMessagesPanel';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
  isLastInGroup: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwnMessage,
  showAvatar,
  isLastInGroup
}) => {
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case 'delivered':
        return (
          <div className="flex -space-x-1">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'read':
        return (
          <div className="flex -space-x-1">
            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={`flex items-end space-x-2 max-w-xs lg:max-w-md xl:max-w-lg ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''}`}>
        {/* Avatar */}
        {showAvatar && (
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-medium text-xs">
              {message.senderName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        
        {/* Message Bubble */}
        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
          {/* Sender Name (only for received messages and first in group) */}
          {!isOwnMessage && showAvatar && (
            <span className="text-xs text-gray-500 mb-1 px-3">
              {message.senderName}
            </span>
          )}
          
          {/* Message Content */}
          <div
            className={`relative px-4 py-2 rounded-2xl shadow-sm ${
              isOwnMessage
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-900 border border-gray-200'
            } ${
              isOwnMessage
                ? showAvatar || isLastInGroup
                  ? 'rounded-br-md'
                  : 'rounded-br-2xl'
                : showAvatar || isLastInGroup
                ? 'rounded-bl-md'
                : 'rounded-bl-2xl'
            }`}
          >
            {/* Message Text */}
            <p className="text-sm leading-relaxed break-words">
              {message.content}
            </p>
            
            {/* Message Info */}
            <div className={`flex items-center justify-end space-x-1 mt-1 ${
              isOwnMessage ? 'text-blue-100' : 'text-gray-400'
            }`}>
              <span className="text-xs">
                {formatTime(message.createdAt)}
              </span>
              {isOwnMessage && (
                <div className="flex items-center">
                  {getStatusIcon(message.status)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};