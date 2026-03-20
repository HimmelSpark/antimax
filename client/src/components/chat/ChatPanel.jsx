import { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import styles from './ChatPanel.module.css';

export default function ChatPanel({ yjs, user, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    return yjs.onChat((msg) => {
      if (msg.userId === user?.id) return;
      setMessages((prev) => [...prev, msg]);
    });
  }, [yjs.onChat, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    yjs.sendChat(text);
    setMessages((prev) => [...prev, {
      userId: user.id,
      displayName: user.displayName,
      content: text,
      timestamp: new Date().toISOString(),
    }]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Chat</span>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>No messages yet</div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.message} ${msg.userId === user.id ? styles.own : ''}`}>
            <span className={styles.author}>{msg.displayName}</span>
            <span className={styles.content}>{msg.content}</span>
            <span className={styles.time}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <input
          className={styles.input}
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className={styles.sendBtn} onClick={handleSend}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
