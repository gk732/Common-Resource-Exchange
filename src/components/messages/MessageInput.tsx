import React, { useState, useRef, useEffect } from 'react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    setIsTyping(e.target.value.length > 0);
  };

  return (
    <div className="bg-white">
      <form onSubmit={handleSubmit} className="flex items-end space-x-3">
        {/* Attachment Button */}
        <button
          type="button"
          className="p-3 text-gray-500 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
          title="Attach file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Message Input Area */}
        <div className="flex-1 relative">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm leading-relaxed"
              style={{ maxHeight: '120px' }}
            />
            
            {/* Emoji Button */}
            <button
              type="button"
              className="absolute right-3 bottom-3 p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Add emoji"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!message.trim()}
          className={`p-3 rounded-full transition-all duration-200 flex-shrink-0 ${
            message.trim()
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl transform hover:scale-105'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          title="Send message"
        >
          <svg
            className={`w-5 h-5 transition-transform ${
              message.trim() ? 'rotate-0' : '-rotate-45'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </form>
      
      {/* Typing Indicator */}
      {isTyping && (
        <div className="mt-2 text-xs text-gray-500 animate-pulse">
          Typing...
        </div>
      )}
    </div>
  );
};