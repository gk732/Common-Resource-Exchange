import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ConversationsList } from './ConversationsList';
import { ChatView } from './ChatView';
import { supabase } from '../../lib/supabase';

export interface Conversation {
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

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'file';
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  metadata?: any;
}

export const NewMessagesPanel: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Fetch conversations on component mount
  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId);
    } else {
      setMessages([]);
    }
  }, [selectedConversationId]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to new conversations
    const conversationsChannel = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `participants.cs.{${user.id}}`
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    // Subscribe to new messages
    const messagesChannel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const newMessage = payload.new as any;
          // Check if this message belongs to the current conversation
          if (newMessage.conversation_id === selectedConversationId) {
            // Transform message format to match our interface
            const transformedMessage: Message = {
              id: newMessage.id,
              conversationId: newMessage.conversation_id,
              senderId: newMessage.sender_id,
              senderName: 'User', // Will be filled by fetchMessages
              content: newMessage.content,
              messageType: newMessage.message_type || 'text',
              status: newMessage.status || 'sent',
              createdAt: newMessage.created_at,
              metadata: newMessage.metadata
            };
            setMessages(prev => [...prev, transformedMessage]);
          }
          // Always refresh conversations to update last message
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      conversationsChannel.unsubscribe();
      messagesChannel.unsubscribe();
    };
  }, [user, selectedConversationId]);

  const fetchConversations = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('messaging-system', {
        body: {
          action: 'getConversations'
        }
      });

      if (error) {
        console.error('Error fetching conversations:', error);
        return;
      }

      setConversations(data?.data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    if (!user) return;
    
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('messaging-system', {
        body: {
          action: 'getMessages',
          conversationId
        }
      });

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data?.data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!selectedConversationId || !user) return;

    try {
      const { data, error } = await supabase.functions.invoke('messaging-system', {
        body: {
          action: 'sendMessage',
          conversationId: selectedConversationId,
          content,
          messageType: 'text'
        }
      });

      if (error) {
        console.error('Error sending message:', error);
        return;
      }

      // Message will be added via real-time subscription
      // But let's also refresh messages to ensure consistency
      fetchMessages(selectedConversationId);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const createNewConversation = async (participantUserId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('messaging-system', {
        body: {
          action: 'createConversation',
          participantUserId
        }
      });

      if (error) {
        console.error('Error creating conversation:', error);
        return;
      }

      // Refresh conversations to get the new one
      await fetchConversations();
      
      // Select the new conversation with a small delay to ensure state is updated
      if (data?.data?.id) {
        setTimeout(() => {
          setSelectedConversationId(data.data.id);
        }, 100);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke('messaging-system', {
        body: {
          action: 'deleteConversation',
          conversationId
        }
      });

      if (error) {
        console.error('Error deleting conversation:', error);
        return;
      }

      // If deleted conversation was selected, clear selection
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }

      // Refresh conversations
      await fetchConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const clearChat = async (conversationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke('messaging-system', {
        body: {
          action: 'clearChat',
          conversationId
        }
      });

      if (error) {
        console.error('Error clearing chat:', error);
        return;
      }

      // Refresh messages if this is the selected conversation
      if (selectedConversationId === conversationId) {
        await fetchMessages(conversationId);
      }
      
      // Refresh conversations to update last message
      await fetchConversations();
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg h-full flex overflow-hidden">
      {/* Conversations Sidebar - Always visible on desktop, fixed width */}
      <div className="w-80 border-r border-gray-200 flex-shrink-0">
        <ConversationsList
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          onCreateConversation={createNewConversation}
        />
      </div>

      {/* Chat Area - Takes remaining space */}
      <div className="flex-1 flex flex-col min-w-0">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600 text-sm">Loading messages...</p>
            </div>
          </div>
        ) : (
          <ChatView
            conversation={conversations.find(c => c.id === selectedConversationId)}
            messages={messages}
            onSendMessage={sendMessage}
            onDeleteConversation={deleteConversation}
            onClearChat={clearChat}
            currentUserId={user?.id}
          />
        )}
      </div>
    </div>
  );
};