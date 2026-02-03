import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Send, CheckCircle, Linkedin, Twitter, Globe, Clock, Ticket, AlertCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';

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
        <section id="contact" className="py-32 px-6 max-w-screen-2xl mx-auto scroll-mt-32">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr] gap-16 items-start">
                {/* Info */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <span className="inline-block py-2 px-4 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-brand-purple font-semibold text-sm mb-6">
                        Contact
                    </span>
                    <h2 className="text-4xl md:text-5xl font-bold mb-6">
                        Let's Start a <br />
                        <span className="text-gradient">Conversation</span>
                    </h2>
                    <p className="text-xl text-secondary mb-12">
                        Ready to see how Hyzync can transform your customer retention? Get in touch and we'll show you the magic.
                    </p>

                    <div className="space-y-8 mb-12">
                        <ContactItem icon={Mail} label="Direct Inquiry" value="info@hyzync.com" />
                        <ContactItem icon={Globe} label="Service Region" value="Global / Remote-First" />
                        <ContactItem icon={Clock} label="Response Commitment" value="Within 24 Hours" />
                    </div>

                    <div className="flex gap-4">
                        <SocialBtn icon={Linkedin} href="https://www.linkedin.com/company/hyzync" />
                        <SocialBtn icon={Twitter} href="https://x.com/hyzync" />
                    </div>
                </motion.div>

                {/* Form */}
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="glass-card p-10"
                >
                    <h3 className="text-2xl font-bold mb-8">Send Us a Message</h3>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InputGroup id="firstName" label="First Name" />
                            <InputGroup id="lastName" label="Last Name" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    <div className="bg-brand-purple/20 border border-brand-purple/50 rounded-lg px-4 py-3 flex items-center gap-3">
                                        <Ticket className="text-brand-magenta" size={20} />
                                        <div className="flex-grow">
                                            <span className="text-xs text-secondary block">Applied Offer Code</span>
                                            <span className="text-brand-magenta font-mono font-bold tracking-wider">{promoCode}</span>
                                        </div>
                                        <span className="text-xs bg-brand-magenta/20 text-brand-magenta px-2 py-1 rounded font-bold">40% OFF</span>
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
                                rows="4"
                                className="w-full bg-white-5 border border-white-10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-purple focus:bg-white-10 peer transition-all resize-none"
                                placeholder=" "
                            ></textarea>
                            <label
                                htmlFor="message"
                                className="absolute left-4 top-3 text-secondary transition-all duration-300 pointer-events-none peer-focus:-top-2.5 peer-focus:left-3 peer-focus:text-sm peer-focus:text-brand-purple peer-focus:bg-background peer-focus:px-1 peer-[:not(:placeholder-shown)]:-top-2.5 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-sm peer-[:not(:placeholder-shown)]:text-brand-purple peer-[:not(:placeholder-shown)]:bg-background peer-[:not(:placeholder-shown)]:px-1"
                            >
                                Message
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={formState === 'sending' || formState === 'success'}
                            className={`w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                                formState === 'success'
                                    ? 'bg-brand-green text-white'
                                    : formState === 'error'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-primary-gradient text-white hover:shadow-lg hover:shadow-brand-purple/30 hover:-translate-y-1'
                            }`}
                        >
                            {formState === 'idle' && (
                                <>
                                    Send Message
                                    <Send size={18} />
                                </>
                            )}
                            {formState === 'sending' && <span>Sending...</span>}
                            {formState === 'success' && (
                                <>
                                    Message Sent!
                                    <CheckCircle size={18} />
                                </>
                            )}
                            {formState === 'error' && (
                                <>
                                    Error - Please Try Again
                                    <AlertCircle size={18} />
                                </>
                            )}
                        </button>
                        <p className="text-xs text-secondary/60 text-center mt-4 px-4 leading-relaxed">
                            By submitting, I agree to the processing of my personal data by Hyzync in accordance with our <a href="/privacy" className="underline hover:text-white transition-colors">Privacy Policy</a>.
                        </p>
                    </form>
                </motion.div>
            </div>
        </section>
    );
};

const ContactItem = ({ icon: Icon, label, value }) => (
    <div className="flex gap-4 items-center">
        <div className="w-12 h-12 rounded-xl bg-white-5 flex items-center justify-center text-brand-purple">
            <Icon size={24} />
        </div>
        <div>
            <span className="block text-sm text-secondary mb-0.5">{label}</span>
            <span className="text-lg font-medium text-white">{value}</span>
        </div>
    </div>
);

const SocialBtn = ({ icon: Icon, href }) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="w-10 h-10 rounded-full bg-white-5 flex items-center justify-center text-secondary hover:bg-brand-purple hover:text-white transition-all hover:-translate-y-1"
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
            className="w-full bg-white-5 border border-white-10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-brand-purple focus:bg-white-10 peer transition-all"
            placeholder=" "
        />
        <label
            htmlFor={id}
            className="absolute left-4 top-3 text-secondary transition-all duration-300 pointer-events-none peer-focus:-top-2.5 peer-focus:left-3 peer-focus:text-sm peer-focus:text-brand-purple peer-focus:bg-background peer-focus:px-1 peer-[:not(:placeholder-shown)]:-top-2.5 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-sm peer-[:not(:placeholder-shown)]:text-brand-purple peer-[:not(:placeholder-shown)]:bg-background peer-[:not(:placeholder-shown)]:px-1"
        >
            {label}
        </label>
    </div>
);

export default Contact;
