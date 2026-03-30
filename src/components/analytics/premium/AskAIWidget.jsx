import React, { useState } from 'react';
import { Sparkles, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AskAIWidget = ({ messages, input, onInputChange, handleSend, isTyping }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleSend(e);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-full shadow-lg transition-colors z-50 flex items-center justify-center gap-2"
            >
                <Sparkles size={20} />
                <span className="font-semibold text-sm pr-2">Ask AI</span>
            </button>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed bottom-6 right-6 w-[400px] bg-white rounded-xl border border-gray-200 shadow-xl flex flex-col overflow-hidden z-50 text-indigo-950"
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white relative">
                            <span className="font-bold text-sm">H</span>
                            <Sparkles size={10} className="absolute ml-5 -mt-3 text-indigo-200" />
                        </div>
                        <h3 className="font-bold text-[15px] text-gray-900">Ask Horizon AI</h3>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#faf8fc] max-h-[350px]">
                    {messages && messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start gap-3'}`}>
                            {(msg.role === 'ai' || msg.role === 'assistant' || msg.role === 'system') && (
                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 mt-1 relative">
                                    <span className="font-bold text-xs">H</span>
                                    <Sparkles size={8} className="absolute ml-4 -mt-2 text-indigo-200" />
                                </div>
                            )}

                            <div className={`max-w-[85%] rounded-xl px-5 py-3.5 text-[14px] leading-relaxed shadow-sm
                                ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-br-sm'
                                    : 'bg-white border border-gray-100 rounded-tl-sm text-gray-800'
                                }`}
                            >
                                <div className="mb-1 text-[14px]">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                            ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-1 marker:text-indigo-400" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-1 marker:text-indigo-400" {...props} />,
                                            li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                            strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                                            code: ({ node, inline, ...props }) => (
                                                <code className={`px-1 py-0.5 rounded text-xs font-mono bg-gray-100 text-indigo-700`} {...props} />
                                            )
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>

                                {msg.points && (
                                    <ul className="mt-4 space-y-3">
                                        {msg.points.map((pt, i) => (
                                            <li key={i} className="flex gap-2">
                                                <span className="text-indigo-500 font-bold mt-0.5">✓</span>
                                                <span className="text-gray-700">
                                                    {pt.text} <span className="font-bold text-gray-900 ml-1">({pt.count})</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 ml-2 mt-1 hidden">
                                    <span className="font-bold text-xs">U</span>
                                </div>
                            )}
                        </div>
                    ))}
                    {isTyping && (
                        <div className="flex justify-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white flex-shrink-0 mt-1 relative">
                                <span className="font-bold text-xs">H</span>
                            </div>
                            <div className="bg-white border border-gray-100 rounded-xl rounded-tl-sm px-5 py-3.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-100">
                    <div className="flex bg-gray-50 rounded-xl border border-gray-200 p-1">
                        <input
                            type="text"
                            className="flex-1 bg-transparent px-4 text-sm focus:outline-none text-gray-800"
                            placeholder="Ask follow-up..."
                            value={input || ''}
                            onChange={(e) => onInputChange(e.target.value)}
                            onKeyDown={handleKeyPress}
                            disabled={isTyping}
                        />
                        <button
                            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${(input && input.trim()) && !isTyping ? 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                            onClick={handleSend}
                            disabled={!input || !input.trim() || isTyping}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default AskAIWidget;
