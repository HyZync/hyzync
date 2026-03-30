import { apiFetch } from '../../utils/api';

import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie,
    Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const API_BASE = '';

const CHART_COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#0ea5e9'];

const DynamicChart = ({ configStr }) => {
    try {
        const config = JSON.parse(configStr);
        const { type, data, xKey, yKey, nameKey, valKey, title } = config;

        if (!data || !Array.isArray(data) || data.length === 0) {
            return <div className="text-sm text-rose-500 italic p-4 bg-rose-50 rounded-lg">Chart data is empty or invalid.</div>;
        }

        const keys = Object.keys(data[0] || {});
        // Auto-detect keys if the ones provided don't exist in the data
        const actualXKey = (xKey && keys.includes(xKey)) ? xKey : (nameKey && keys.includes(nameKey)) ? nameKey : keys.find(k => typeof data[0][k] === 'string') || keys[0];
        const actualYKey = (yKey && keys.includes(yKey)) ? yKey : (valKey && keys.includes(valKey)) ? valKey : keys.find(k => typeof data[0][k] === 'number') || keys[1] || keys[0];

        const ChartWrapper = ({ children }) => (
            <div className="w-full h-72 min-h-[250px] my-4 p-5 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
                {title && <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 text-center">{title}</h4>}
                <div className="flex-1 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        {children}
                    </ResponsiveContainer>
                </div>
            </div>
        );

        if (type === 'bar') {
            return (
                <ChartWrapper>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey={actualXKey} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey={actualYKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ChartWrapper>
            );
        }

        if (type === 'line') {
            return (
                <ChartWrapper>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey={actualXKey} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Line type="monotone" dataKey={actualYKey} stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                </ChartWrapper>
            );
        }

        if (type === 'pie') {
            return (
                <ChartWrapper>
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey={actualYKey}
                            nameKey={actualXKey}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            innerRadius={50}
                            paddingAngle={2}
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                </ChartWrapper>
            );
        }

        return <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg">Unsupported chart type: {type}</div>;
    } catch (e) {
        return (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-lg my-2">
                <div className="flex items-center gap-2 text-rose-600 font-semibold text-sm mb-2">
                    <AlertCircle size={16} /> Error parsing chart data
                </div>
                <code className="text-xs text-rose-800 break-words font-mono bg-white p-2 rounded block whitespace-pre-wrap">{configStr}</code>
            </div>
        );
    }
};

/* ---------- Markdown renderer for assistant messages ---------- */
const MarkdownMessage = ({ content }) => (
    <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
            // Headings
            h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1 text-gray-900">{children}</h1>,
            h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1 text-gray-900">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-semibold mt-1 mb-0.5 text-gray-800">{children}</h3>,

            // Paragraphs
            p: ({ children }) => <p className="text-sm text-gray-800 mb-1 last:mb-0 leading-relaxed">{children}</p>,

            // Lists
            ul: ({ children }) => <ul className="list-disc list-inside text-sm text-gray-800 my-1 space-y-0.5 pl-1">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-gray-800 my-1 space-y-0.5 pl-1">{children}</ol>,
            li: ({ children }) => <li className="text-sm text-gray-800 leading-relaxed">{children}</li>,

            // Emphasis
            strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
            em: ({ children }) => <em className="italic text-gray-700">{children}</em>,

            // Code and Charts
            code: ({ inline, className, children }) => {
                const match = /language-(\w+)/.exec(className || '');
                const codeContent = String(children).replace(/\n$/, '');

                let isChart = !inline && match && match[1] === 'chart';

                // Resilient sniffing fallback
                if (!inline && !isChart && codeContent.trim().startsWith('{"type":') && codeContent.includes('"data":')) {
                    isChart = true;
                }

                if (isChart) {
                    return <DynamicChart configStr={codeContent} />;
                }

                return inline
                    ? <code className="bg-indigo-50 text-indigo-700 text-xs font-mono px-1 py-0.5 rounded">{children}</code>
                    : <code className="block bg-gray-800 text-green-300 text-xs font-mono p-2 rounded mt-1 mb-1 overflow-x-auto whitespace-pre-wrap">{children}</code>;
            },

            pre: ({ children }) => <pre className="my-1">{children}</pre>,

            // Blockquote
            blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-indigo-400 pl-2 my-1 text-sm text-gray-600 italic">{children}</blockquote>
            ),

            // Tables (GFM)
            table: ({ children }) => (
                <div className="overflow-x-auto my-1">
                    <table className="min-w-full text-xs border-collapse border border-gray-300 rounded">{children}</table>
                </div>
            ),
            thead: ({ children }) => <thead className="bg-indigo-50">{children}</thead>,
            th: ({ children }) => <th className="border border-gray-300 px-2 py-1 font-semibold text-left text-indigo-800 text-xs">{children}</th>,
            td: ({ children }) => <td className="border border-gray-300 px-2 py-1 text-gray-700 text-xs">{children}</td>,

            // Horizontal rule
            hr: () => <hr className="border-gray-300 my-2" />,
        }}
    >
        {content}
    </ReactMarkdown>
);

class ChatErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            return <div className="text-red-500 text-xs font-mono p-4 bg-red-50 rounded-lg border border-red-100 my-2">Render Error: {this.state.error.message}</div>;
        }
        return this.props.children;
    }
}

/* ---------- Main Chat Component ---------- */
const CopilotChat = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'system', content: "Hello! I am your Analytics Copilot. Ask me anything about your customer reviews." }
    ]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            console.log("Sending Copilot query:", userMsg.content);
            const res = await apiFetch(`${API_BASE}/api/copilot/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg.content, source: 'widget' })
            });

            if (res.ok) {
                const data = await res.json();
                console.log("Received Copilot response:", data);
                if (!data || !data.response) {
                    setMessages(prev => [...prev, { role: 'assistant', content: "Received an empty response from the intelligence engine." }]);
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
                }
            } else {
                const text = await res.text();
                console.error("Copilot HTTP error:", res.status, text);
                setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, HTTP ${res.status} error occurred.` }]);
            }
        } catch (error) {
            console.error("Copilot fetch error:", error);
            setMessages(prev => [...prev, { role: 'assistant', content: `Connection error: ${error.message}. Please try again.` }]);
        } finally {
            setLoading(false);
            setTimeout(() => scrollToBottom(), 100);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[600px]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center bg-indigo-50 rounded-t-xl">
                <div className="p-2 bg-indigo-100 rounded-lg mr-3">
                    <MessageSquare className="text-indigo-600" size={20} />
                </div>
                <div>
                    <h3 className="font-semibold text-indigo-900">Analytics Copilot</h3>
                    <p className="text-xs text-indigo-600">AI-powered insights assistant</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar */}
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mx-2 self-start mt-1
                                ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                            </div>

                            {/* Bubble */}
                            <div className={`p-3 rounded-lg shadow-sm text-sm
                                ${msg.role === 'user'
                                    ? 'bg-indigo-600 text-white rounded-tr-none'
                                    : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm prose-indigo max-w-none text-gray-800 leading-relaxed">
                                        <ChatErrorBoundary>
                                            <MarkdownMessage content={msg.content} />
                                        </ChatErrorBoundary>
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Loading indicator */}
                {loading && (
                    <div className="flex justify-start">
                        <div className="flex flex-row">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mx-2 bg-gray-200 text-gray-600">
                                <Bot size={14} />
                            </div>
                            <div className="bg-gray-100 p-3 rounded-lg rounded-tl-none flex items-center">
                                <Loader2 className="animate-spin text-indigo-400" size={16} />
                                <span className="ml-2 text-xs text-gray-500">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                <div className="flex space-x-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about trends, issues, or specific features..."
                        className="flex-grow px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CopilotChat;
