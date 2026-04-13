import ChatSidebar from '../ChatSidebar';
import { useState } from 'react';

const mockConversations = [
  {
    id: '1',
    title: 'Delaware C-Corp Tax Question',
    preview: 'What\'s the corporate tax rate...',
    timestamp: 'Today, 2:30 PM'
  },
  {
    id: '2',
    title: 'Depreciation Schedule',
    preview: 'Calculate depreciation for...',
    timestamp: 'Yesterday, 4:15 PM'
  },
  {
    id: '3',
    title: 'GAAP vs IFRS',
    preview: 'Explain the differences...',
    timestamp: '2 days ago'
  }
];

export default function ChatSidebarExample() {
  const [activeId, setActiveId] = useState('1');
  
  return (
    <ChatSidebar 
      conversations={mockConversations}
      activeId={activeId}
      onSelectConversation={setActiveId}
      onNewChat={() => console.log('New chat')}
    />
  );
}
