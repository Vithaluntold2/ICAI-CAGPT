import ChatHeader from '../ChatHeader';

export default function ChatHeaderExample() {
  return <ChatHeader onMenuToggle={() => console.log('Menu toggle')} />;
}
