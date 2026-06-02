import React, { useState, useRef, useEffect } from 'react';
import { MessageSquareText, X, Send, Sparkles, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../services/api';

export const AIChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([
    { role: 'bot', text: 'Hi! I am your ServaLocal AI Assistant. Ask me anything about cleaning, appliance repair, or current bookings!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    // Add user message
    const newMsg = { role: 'user', text: query };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build history context
      const history = messages.slice(-5).map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.text
      }));

      const res = await apiClient.post('/ai/chat', {
        message: query,
        context: { history }
      });

      setMessages(prev => [...prev, { role: 'bot', text: res.data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'bot', text: 'Oops! I failed to fetch an answer. Please check your network connection.' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    "What is my wallet balance?",
    "How can I book Deep Cleaning?",
    "Do you service electrical MCB?",
    "Tamil translations support?"
  ];

  return (
    <div className="fixed bottom-20 right-6 md:bottom-6 md:right-8 z-40">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 100 }}
            className="w-80 sm:w-96 h-[450px] rounded-3xl border shadow-2xl bg-white dark:bg-slate-900 overflow-hidden flex flex-col mb-4"
          >
            {/* A. HEADER ROW */}
            <div className="bg-gradient-to-r from-primary to-orange-500 p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 animate-pulse text-yellow-300" />
                <div>
                  <h4 className="font-extrabold text-sm tracking-tight">ServaLocal Copilot</h4>
                  <span className="text-[10px] text-white/80 font-medium">Powered by GPT-4o</span>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* B. CONVERSATION BODY */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
              {messages.map((m, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-start space-x-2 ${m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white ${m.role === 'user' ? 'bg-primary' : 'bg-slate-700'}`}>
                    {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`max-w-[75%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex items-start space-x-2">
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-white">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 rounded-tl-none flex space-x-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            {/* C. QUICK SUGGESTIONS GRID */}
            {messages.length === 1 && (
              <div className="px-4 py-2 border-t bg-slate-50 dark:bg-slate-900">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  FAQ SUGGESTIONS
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickQuestions.map((q, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSend(q)}
                      className="text-[10px] font-semibold px-2 py-1 border rounded-lg bg-white hover:bg-primary/10 hover:text-primary transition-colors text-slate-600 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* D. MESSAGE SEND INPUT */}
            <div className="p-3 border-t bg-white dark:bg-slate-900 flex items-center space-x-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask something..."
                className="flex-1 px-3 py-2 border rounded-xl text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button 
                onClick={() => handleSend()}
                className="p-2 rounded-xl bg-primary text-white hover:bg-orange-600 transition-colors shadow-md shadow-primary/10"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOAT ACTION BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-primary hover:bg-orange-600 text-white flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 shadow-primary/30"
      >
        <MessageSquareText className="w-6 h-6" />
      </button>
    </div>
  );
};
