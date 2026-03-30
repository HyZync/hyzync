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
            // Support both the corrected Formspree env names and the legacy typo.
            const formSpreeEndpoint =
                import.meta.env.VITE_FORMSPREE_ENDPOINT ||
                import.meta.env.VITE_FORMFREE_ENDPOINT ||
                'https://formspree.io/f/mykpbkdb';
            const formSpreeApiKey =
                import.meta.env.VITE_FORMSPREE_API_KEY ||
                import.meta.env.VITE_FORMFREE_API_KEY ||
                '';

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
        <section id="contact" className="relative mx-auto mt-16 max-w-[1520px] px-6 py-6 scroll-mt-32">
            <div className="pointer-events-none absolute left-8 top-12 h-56 w-56 rounded-full bg-cyan-200/35 blur-[120px]" />
            <div className="pointer-events-none absolute right-6 top-10 h-72 w-72 rounded-full bg-blue-200/25 blur-[140px]" />
            <div className="pointer-events-none absolute bottom-8 left-[36%] h-52 w-52 rounded-full bg-emerald-200/20 blur-[120px]" />

            <div className="relative overflow-hidden rounded-[38px] border border-slate-200 bg-white p-7 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.24)] md:p-8">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(34,211,238,0.18),transparent_26%),radial-gradient(circle_at_92%_8%,rgba(59,130,246,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,251,255,0.82))]" />

                <div className="relative grid grid-cols-1 items-start gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12">
                {/* Info Column */}
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
                        Contact Hyzync
                    </span>
                    <h2 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-slate-950 md:text-6xl">
                        Bring your customer signals into one clear action plan.
                    </h2>
                    <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                        Share your team, your data sources, and the friction you want to solve first. We will show how Horizon fits your workflow across product, support, growth, and leadership.
                    </p>

                    <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                        <ContactItem icon={Mail} label="Email" value="info@hyzync.com" />
                        <ContactItem icon={Globe} label="Best For" value="Reviews, CRM, surveys, and uploads" />
                        <ContactItem icon={Clock} label="Response Time" value="Within 24 hours" />
                    </div>

                    <div className="mt-8 flex gap-3">
                        <SocialBtn icon={Linkedin} href="https://www.linkedin.com/company/hyzync" />
                        <SocialBtn icon={XIcon} href="https://x.com/hyzync" />
                    </div>
                </motion.div>

                {/* Form Card */}
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="rounded-[32px] border border-slate-200 bg-slate-50/90 p-6 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.24)] md:p-8"
                >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Book a walkthrough</p>
                            <h3 className="mt-3 text-3xl font-semibold leading-tight text-slate-950">
                                Tell us what Horizon should analyze first.
                            </h3>
                            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
                                We will use your note to tailor the demo around your feedback sources, workflows, and biggest customer risk signals.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <InputGroup id="firstName" label="First Name" placeholder="Alex" />
                            <InputGroup id="lastName" label="Last Name" placeholder="Morgan" />
                        </div>
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            <InputGroup id="email" label="Work Email" type="email" placeholder="alex@company.com" />
                            <InputGroup id="phone" label="Phone" type="tel" placeholder="+1 555 010 2400" />
                        </div>

                        <AnimatePresence>
                            {promoCode && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="flex items-center gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                                        <Ticket className="text-cyan-700" size={18} />
                                        <div className="flex-grow">
                                            <span className="block text-[10px] uppercase tracking-[0.18em] text-slate-400">Access Code</span>
                                            <span className="font-mono text-sm font-semibold text-slate-900">{promoCode}</span>
                                        </div>
                                        <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                                            Priority
                                        </span>
                                    </div>
                                    <input type="hidden" name="promo_code" value={promoCode} />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="space-y-2">
                            <label htmlFor="message" className="text-sm font-medium text-slate-700">
                                What should Horizon analyze first?
                            </label>
                            <textarea
                                id="message"
                                name="message"
                                required
                                rows="6"
                                className="w-full rounded-[24px] border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.28)] outline-none transition-all placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100 resize-none"
                                placeholder="Example: Merge app reviews, SurveyMonkey responses, Trustpilot feedback, and CRM notes so we can spot onboarding friction and churn risk."
                            />
                        </div>

                        <AnimatePresence mode="wait">
                            {formState === 'error' && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                                >
                                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                    <span>There was a problem sending your request. Please try again.</span>
                                </motion.div>
                            )}

                            {formState === 'success' && (
                                <motion.div
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                                >
                                    <CheckCircle size={18} className="mt-0.5 shrink-0" />
                                    <span>Your request has been sent. We will get back to you shortly.</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <button
                            type="submit"
                            disabled={formState === 'sending' || formState === 'success'}
                            className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-sm font-semibold transition-all duration-300 ${formState === 'success'
                                ? 'bg-emerald-500 text-white shadow-[0_24px_55px_-30px_rgba(16,185,129,0.55)]'
                                : formState === 'error'
                                    ? 'bg-rose-500 text-white'
                                    : 'bg-slate-950 text-white shadow-[0_24px_55px_-30px_rgba(15,23,42,0.55)] hover:bg-slate-800'
                                }`}
                        >
                            {formState === 'idle' && (
                                <>
                                    Request Walkthrough
                                    <Send size={16} />
                                </>
                            )}
                            {formState === 'sending' && <span className="animate-pulse">Sending...</span>}
                            {formState === 'success' && (
                                <>
                                    Request Received
                                    <CheckCircle size={16} />
                                </>
                            )}
                            {formState === 'error' && (
                                <>
                                    Error - Try Again
                                    <AlertCircle size={16} />
                                </>
                            )}
                        </button>
                        <p className="px-1 text-[11px] leading-relaxed text-slate-500">
                            By submitting, I agree to the processing of my personal data by Hyzync in accordance with our <a href="/privacy" className="underline transition-colors hover:text-slate-700">Privacy Policy</a>.
                        </p>
                    </form>
                </motion.div>
                </div>
            </div>
        </section>
    );
};

const ContactItem = ({ icon: Icon, label, value }) => (
    <div className="flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.25)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <Icon size={20} />
        </div>
        <div>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
            <span className="text-sm font-medium leading-relaxed text-slate-700">{value}</span>
        </div>
    </div>
);

const SocialBtn = ({ icon: Icon, href }) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.25)] transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:text-cyan-700"
    >
        <Icon size={18} />
    </a>
);

const InputGroup = ({ id, label, type = 'text', placeholder = '' }) => (
    <div className="space-y-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
            {label}
        </label>
        <input
            type={type}
            id={id}
            name={id}
            required
            className="w-full rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.28)] outline-none transition-all placeholder:text-slate-400 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100"
            placeholder={placeholder || label}
        />
    </div>
);

export default Contact;
