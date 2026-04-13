import ChatInput from '../ChatInput';

export default function ChatInputExample() {
  return (
    <div className="max-w-4xl mx-auto">
      <ChatInput onSend={(msg) => console.log('Message sent:', msg)} />
    </div>
  );
}
