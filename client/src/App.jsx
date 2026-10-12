import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5010';

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hi Sankar! I am your AI assistant. Ask me anything.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/history`);
        if (response.data.messages?.length) {
          setMessages(response.data.messages.map((item) => ({
            role: item.role,
            content: item.content,
          })));
        }
      } catch (error) {
        console.error('History fetch failed:', error);
      }
    };

    fetchHistory();
  }, []);

  const playSpeech = async (text) => {
    if (!text) return;

    try {
      const response = await fetch(
        `${API_URL}/api/tts?text=${encodeURIComponent(text)}`
      );

      if (!response.ok) {
        throw new Error('Speech generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (error) {
      console.error('TTS playback failed:', error);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.start();
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage = { role: 'user', content: trimmed };
    const conversation = [...messages, userMessage];

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/chat`, {
        messages: conversation,
      });

      const assistantReply = response.data.text;
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantReply }]);
      await playSpeech(assistantReply);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || 'Something went wrong while contacting Groq.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${errorMessage}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-shell">
      <div className="chat-card">
        <header className="topbar">
          <div>
            <p className="eyebrow">AI assistant</p>
            <h1>Groq AI Bot</h1>
          </div>
          <span className="status-pill">Live</span>
        </header>

        <main className="messages-panel">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`message-row ${message.role === 'user' ? 'user' : 'assistant'}`}
            >
              <div className="message-bubble">
                {message.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-row assistant">
              <div className="message-bubble typing">Thinking...</div>
            </div>
          )}
        </main>

        <div className="composer">
          <button
            className="icon-button"
            type="button"
            onClick={startVoiceInput}
            title="Voice input"
            aria-label="Voice input"
          >
            {isListening ? '🎙️' : '🎤'}
          </button>

          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            rows={1}
          />

          <button
            className="send-button"
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
