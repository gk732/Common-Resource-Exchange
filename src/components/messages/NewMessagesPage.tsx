import React from 'react';
import { NewMessagesPanel } from './NewMessagesPanel';

export default function MessagesPage() {
  return (
    <div className="h-[calc(100vh-8rem)]">
      <NewMessagesPanel />
    </div>
  );
}