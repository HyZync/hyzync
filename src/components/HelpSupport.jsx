import { apiFetch } from '../utils/api';
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageSquare, Send, HelpCircle, BookOpen, FileText, ExternalLink, Loader2, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';

const HelpSupport = ({ onBrowseDocs, onOpenResource, docsEnabled = true }) => {
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error
    const [errorMessage, setErrorMessage] = useState('');

    const API_BASE = '';
    const resourceItems = useMemo(() => ([
        { title: "Getting Started Guide", type: "Tutorial", slug: "getting-started-guide" },
        { title: "Connecting Data Sources", type: "Guide", slug: "connecting-data-sources" },
        { title: "Understanding Health Metrics", type: "Article", slug: "understanding-health-metrics" },
        { title: "Exporting Reports", type: "Video", slug: "exporting-reports" },
    ]), []);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('submitting');
        setErrorMessage('');

        try {
            const response = await apiFetch(`${API_BASE}/api/support/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error('Failed to send message.');

            setStatus('success');
            setFormData({ name: '', email: '', subject: '', message: '' });

            // Reset success message after 5 seconds
            setTimeout(() => {
                setStatus('idle');
            }, 5000);

        } catch (error) {
            console.error('Support submission error:', error);
            setStatus('error');
            setErrorMessage('There was a problem sending your message. Please try again or email us directly.');
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full h-full flex flex-col">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <HelpCircle className="w-7 h-7 text-indigo-600" />
                    Help & Support
                </h1>
                <p className="text-sm text-gray-500 mt-1">Get assistance, find answers, or contact our team directly.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">

                {/* Left Column: Contact Form */}
                <div className="lg:col-span-8 bg-white border border-gray-200 rounded-xl p-6 md:p-8 shadow-sm h-fit">
                    <div className="mb-6 pb-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-indigo-500" />
                                Send us a Message
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">We usually respond within 2-4 hours during business days.</p>
                        </div>
                        <a
                            href="mailto:support@hyzync.com"
                            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors border border-indigo-100 whitespace-nowrap"
                        >
                            <Mail className="w-4 h-4 mr-2" />
                            support@hyzync.com
                        </a>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</label>
                                <input
                                    id="name"
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    disabled={status === 'submitting'}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm outline-none"
                                    placeholder="Jane Doe"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    disabled={status === 'submitting'}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm outline-none"
                                    placeholder="jane@company.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="subject" className="text-sm font-medium text-gray-700">Subject</label>
                            <input
                                id="subject"
                                type="text"
                                required
                                value={formData.subject}
                                onChange={handleInputChange}
                                disabled={status === 'submitting'}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm outline-none"
                                placeholder="How can we help you?"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="message" className="text-sm font-medium text-gray-700">Message</label>
                            <textarea
                                id="message"
                                required
                                rows={5}
                                value={formData.message}
                                onChange={handleInputChange}
                                disabled={status === 'submitting'}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm outline-none resize-none"
                                placeholder="Please describe your issue or question in detail..."
                            ></textarea>
                        </div>

                        {/* Status Messages */}
                        {status === 'error' && (
                            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{errorMessage}</span>
                            </motion.div>
                        )}

                        {status === 'success' && (
                            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-100 flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>Your message has been sent successfully. Our support team will respond to {formData.email || 'your email'} shortly.</span>
                            </motion.div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={status === 'submitting' || status === 'success'}
                                className={`inline-flex items-center justify-center px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all
                                    ${(status === 'submitting' || status === 'success')
                                        ? 'bg-indigo-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md hover:shadow-indigo-500/20 active:scale-[0.98]'
                                    }`}
                            >
                                {status === 'submitting' ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Sending...
                                    </>
                                ) : status === 'success' ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Sent
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        Send Message
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Column: Quick Links & FAQs */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Documentation Card */}
                    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-md relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
                            <BookOpen className="w-24 h-24" />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-lg font-semibold mb-2">Documentation</h3>
                            <p className="text-slate-300 text-sm mb-6">Explore our guides, API references, and best practices to get the most out of Hyzync.</p>
                            <button
                                type="button"
                                onClick={() => onBrowseDocs?.()}
                                disabled={!docsEnabled}
                                className={`inline-flex items-center text-sm font-medium px-4 py-2 rounded-lg backdrop-blur-sm transition-colors border ${
                                    docsEnabled
                                        ? 'text-white bg-white/10 hover:bg-white/20 border-white/10'
                                        : 'text-slate-300 bg-white/5 border-white/5 cursor-not-allowed'
                                }`}
                            >
                                Browse Docs
                                <ExternalLink className="w-4 h-4 ml-2" />
                            </button>
                        </div>
                    </div>

                    {/* Resources List */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-gray-400" />
                            Helpful Resources
                        </h3>
                        <div className="space-y-3">
                            {resourceItems.map((item) => (
                                <button
                                    key={item.slug}
                                    type="button"
                                    onClick={() => onOpenResource?.(item.slug)}
                                    disabled={!docsEnabled}
                                    className={`group w-full flex items-center justify-between p-3 rounded-xl border transition-colors text-left ${
                                        docsEnabled
                                            ? 'border-transparent hover:border-gray-100 hover:bg-gray-50'
                                            : 'border-transparent opacity-60 cursor-not-allowed'
                                    }`}
                                >
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">{item.title}</p>
                                        <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mt-0.5 block">{item.type}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default HelpSupport;
