
import { ChatArea, ChatInput } from '../components/features';

export function ChatPage() {
  return (
    <div className="flex flex-col h-full">
      <ChatArea />
      <ChatInput />
    </div>
  );
}
