import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Send, CheckCircle, Linkedin, Globe, Clock, Ticket, AlertCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

// Custom X (Twitter) Icon
const XIcon = ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const Contact = () => {
    const [formState, setFormState] = useState('idle'); // idle, sending, success, error
    const { search } = useLocation();
    const [promoCode, setPromoCode] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(search);
        const code = params.get('code');
        if (code) setPromoCode(code);
    }, [search]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormState('sending');

        // Get form data
        const formData = new FormData(e.target);
        const data = {
            firstName: formData.get('firstName') || '',
            lastName: formData.get('lastName') || '',
            email: formData.get('email') || '',
            phone: formData.get('phone') || '',
            message: formData.get('message') || '',
            promoCode: promoCode || formData.get('promo_code') || ''
        };

        try {
            // FormSpree integration
            const formSpreeEndpoint = import.meta.env.VITE_FORMFREE_ENDPOINT || 'https://formspree.io/f/mykpbkdb';
            const formSpreeApiKey = import.meta.env.VITE_FORMFREE_API_KEY || '';

            // FormSpree accepts both JSON and form-urlencoded
            // Using form-urlencoded for better compatibility
            const formBody = new URLSearchParams();
            formBody.append('firstName', data.firstName);
            formBody.append('lastName', data.lastName);
            formBody.append('email', data.email);
            formBody.append('phone', data.phone);
            formBody.append('message', data.message);
            if (data.promoCode) {
                formBody.append('promoCode', data.promoCode);
            }

            const response = await fetch(formSpreeEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json',
                    ...(formSpreeApiKey && { 'Authorization': `Bearer ${formSpreeApiKey}` })
                },
                body: formBody.toString()
            });

            if (!response.ok) {
                throw new Error(`Form submission failed: ${response.statusText}`);
            }

            setFormState('success');
            setTimeout(() => {
                setFormState('idle');
                e.target.reset();
                setPromoCode('');
            }, 3000);
        } catch (error) {
            console.error('Form submission error:', error);
            setFormState('error');
            setTimeout(() => setFormState('idle'), 3000);
        }
    };

    return (
        <section id="contact" className="py-24 px-6 max-w-screen-2xl mx-auto scroll-mt-32 relative">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-purple/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-16 lg:gap-24 items-start relative z-10">
                {/* Info Column */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <span className="inline-block py-2 px-4 rounded-full bg-[#1A1A1C] border border-white/10 text-brand-purple font-medium text-[10px] uppercase tracking-widest mb-8">
                        Contact
                    </span>
                    <h2 className="text-5xl md:text-6xl font-bold mb-8 leading-tight tracking-tight text-white">
                        Let's Start a <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue via-brand-purple to-brand-magenta">Conversation</span>
                    </h2>
                    <p className="text-lg text-zinc-400 mb-12 max-w-md font-light leading-relaxed">
                        Ready to see how Hyzync can transform your customer retention? Get in touch and we'll show you the magic.
                    </p>

                    <div className="space-y-10 mb-12">
                        <ContactItem icon={Mail} label="Direct Inquiry" value="info@hyzync.com" />
                        <ContactItem icon={Globe} label="Service Region" value="Global / Remote-First" />
                        <ContactItem icon={Clock} label="Response Commitment" value="Within 24 Hours" />
                    </div>

                    <div className="flex gap-4">
                        <SocialBtn icon={Linkedin} href="https://www.linkedin.com/company/hyzync" />
                        <SocialBtn icon={XIcon} href="https://x.com/hyzync" />
                    </div>
                </motion.div>

                {/* Form Card - Dark Glass Aesthetic */}
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="bg-zinc-950/20 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden"
                >
                    <h3 className="text-2xl font-bold text-white mb-8">Send Us a Message</h3>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <InputGroup id="firstName" label="First Name" />
                            <InputGroup id="lastName" label="Last Name" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <InputGroup id="email" label="Email" type="email" />
                            <InputGroup id="phone" label="Phone" type="tel" />
                        </div>

                        <AnimatePresence>
                            {promoCode && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-brand-purple/10 border border-brand-purple/30 rounded-lg px-4 py-3 flex items-center gap-3">
                                        <Ticket className="text-brand-purple" size={18} />
                                        <div className="flex-grow">
                                            <span className="text-[10px] text-zinc-400 block uppercase tracking-wider">Applied Offer Code</span>
                                            <span className="text-white font-mono font-medium">{promoCode}</span>
                                        </div>
                                        <span className="text-[10px] bg-brand-purple/20 text-brand-purple px-2 py-1 rounded font-bold border border-brand-purple/20">40% OFF</span>
                                    </div>
                                    <input type="hidden" name="promo_code" value={promoCode} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="relative">
                            <textarea
                                id="message"
                                name="message"
                                required
                                rows="5"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-purple/50 focus:bg-white/10 peer transition-all resize-none placeholder-transparent"
                                placeholder="Message"
                            ></textarea>
                            <label
                                htmlFor="message"
                                className="absolute left-4 top-3 text-zinc-500 text-sm transition-all duration-300 pointer-events-none 
                                peer-focus:-top-2.5 peer-focus:left-3 peer-focus:text-xs peer-focus:text-brand-purple peer-focus:bg-transparent peer-focus:px-1 
                                peer-[:not(:placeholder-shown)]:-top-2.5 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-brand-purple peer-[:not(:placeholder-shown)]:bg-transparent peer-[:not(:placeholder-shown)]:px-1"
                            >
                                Message
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={formState === 'sending' || formState === 'success'}
                            className={`w-full py-4 rounded-lg font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all duration-300 ${formState === 'success'
                                ? 'bg-brand-green text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                                : formState === 'error'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gradient-to-r from-brand-purple to-brand-magenta text-white hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:brightness-110'
                                }`}
                        >
                            {formState === 'idle' && (
                                <>
                                    Send Message
                                    <Send size={16} />
                                </>
                            )}
                            {formState === 'sending' && <span className="animate-pulse">Sending...</span>}
                            {formState === 'success' && (
                                <>
                                    Message Sent
                                    <CheckCircle size={16} />
                                </>
                            )}
                            {formState === 'error' && (
                                <>
                                    Error - Retry
                                    <AlertCircle size={16} />
                                </>
                            )}
                        </button>
                        <p className="text-[10px] text-zinc-600 text-center mt-4 px-4 leading-relaxed">
                            By submitting, I agree to the processing of my personal data by Hyzync in accordance with our <a href="/privacy" className="underline hover:text-zinc-400 transition-colors">Privacy Policy</a>.
                        </p>
                    </form>
                </motion.div>
            </div>
        </section>
    );
};

const ContactItem = ({ icon: Icon, label, value }) => (
    <div className="flex gap-5 items-center group">
        <div className="w-12 h-12 rounded-2xl bg-[#1A1A1C] border border-white/5 flex items-center justify-center text-brand-purple group-hover:border-brand-purple/30 group-hover:bg-[#202022] transition-colors shadow-lg">
            <Icon size={20} />
        </div>
        <div>
            <span className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-widest font-bold opacity-60 group-hover:opacity-100 transition-opacity">{label}</span>
            <span className="text-base font-medium text-white group-hover:text-brand-purple transition-colors">{value}</span>
        </div>
    </div>
);

const SocialBtn = ({ icon: Icon, href }) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="w-12 h-12 rounded-xl bg-[#1A1A1C] border border-white/5 flex items-center justify-center text-zinc-400 hover:bg-brand-purple hover:text-white hover:border-brand-purple transition-all hover:-translate-y-1 shadow-lg"
    >
        <Icon size={20} />
    </a>
);

const InputGroup = ({ id, label, type = "text" }) => (
    <div className="relative">
        <input
            type={type}
            id={id}
            name={id}
            required
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-purple/50 focus:bg-white/10 peer transition-all placeholder-transparent"
            placeholder={label}
        />
        <label
            htmlFor={id}
            className="absolute left-4 top-3 text-zinc-500 text-sm transition-all duration-300 pointer-events-none 
            peer-focus:-top-2.5 peer-focus:left-3 peer-focus:text-xs peer-focus:text-brand-purple peer-focus:bg-transparent peer-focus:px-1 
            peer-[:not(:placeholder-shown)]:-top-2.5 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:text-brand-purple peer-[:not(:placeholder-shown)]:bg-transparent peer-[:not(:placeholder-shown)]:px-1"
        >
            {label}
        </label>
    </div>
);

export default Contact;
