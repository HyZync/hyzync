import React from 'react';
import logo from '../assets/logo.png';
import { Linkedin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// Custom X (Twitter) Icon
const XIcon = ({ size = 16, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

const Footer = () => {
    const navigate = useNavigate();
    return (
        <footer className="border-t border-white-10 mt-8 pt-12 pb-6 bg-background">
            <div className="max-w-screen-2xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
                    <div className="md:col-span-1">
                        <img src={logo} alt="Hyzync Logo" className="h-8 w-auto mb-4" />
                        <p className="text-secondary leading-relaxed text-sm">
                            AI-powered customer intelligence that stops churn before it happens.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold mb-3 text-white">Services</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/#how-it-works" className="text-secondary hover:text-brand-purple transition-colors">How It Works</Link></li>
                            <li><Link to="/academy" className="text-secondary hover:text-brand-purple transition-colors">Academy</Link></li>
                            <li><Link to="/#contact" className="text-secondary hover:text-brand-purple transition-colors">Contact</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold mb-3 text-white">Company</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/about" className="text-secondary hover:text-brand-purple transition-colors">About Us</Link></li>
                            <li><Link to="/careers" className="text-secondary hover:text-brand-purple transition-colors">Careers</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold mb-3 text-white">Legal</h4>
                        <ul className="space-y-2 text-sm">
                            <li><Link to="/privacy" className="text-secondary hover:text-brand-purple transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="text-secondary hover:text-brand-purple transition-colors">Terms of Service</Link></li>
                            <li><Link to="/security" className="text-secondary hover:text-brand-purple transition-colors">Security</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white-5 pt-8 pb-4 flex flex-col items-center gap-6">

                    {/* Footer CTA */}
                    <div className="flex flex-col items-center text-center mb-4">
                        <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                            Ready to become a Customer First brand?
                        </h3>
                        <button
                            onClick={() => navigate('/#contact')}
                            className="text-base text-secondary hover:text-brand-purple transition-colors border-b border-brand-purple/30 hover:border-brand-purple pb-0.5 cursor-pointer bg-transparent"
                        >
                            Take the first steps in your transformation
                        </button>
                    </div>

                    {/* Verification & Awards Badges */}
                    <div className="flex justify-center mb-4">
                        {/* Customer First Badge - "The Prestige Seal" */}
                        <Link to="/about#customer-first" className="group flex items-center gap-4 hover:opacity-100 transition-opacity opacity-80 scale-90">
                            {/* Premium Seal Graphic */}
                            <div className="relative w-12 h-12">
                                <div className="absolute inset-0 rounded-full border-2 border-brand-purple/30 group-hover:scale-110 transition-transform duration-500"></div>
                                <div className="absolute inset-1 rounded-full border border-brand-purple/50 bg-brand-purple/10 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-brand-purple/20 to-transparent"></div>
                                    <span className="font-serif font-black text-lg text-white italic relative z-10 drop-shadow-lg">C1</span>
                                </div>
                                {/* Shine Effect */}
                                <div className="absolute inset-0 rounded-full overflow-hidden">
                                    <div className="w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shine"></div>
                                </div>
                            </div>

                            <div className="text-left">
                                <div className="text-[9px] tracking-wider text-brand-purple uppercase font-bold mb-0.5">Global Recognition</div>
                                <div className="font-serif text-base text-white font-bold leading-none tracking-wide group-hover:text-brand-purple transition-colors">
                                    Customer First
                                </div>
                                <div className="text-[9px] text-white/40 mt-0.5">
                                    Certified Partner Program
                                </div>
                            </div>
                        </Link>
                    </div>

                    <div className="w-full border-t border-white-5 pt-4 flex flex-col xl:flex-row justify-between items-center gap-4">

                        {/* Left: Logo + copyright + Links */}
                        <div className="flex flex-col lg:flex-row items-center gap-4 text-[11px] text-secondary font-medium">
                            <div className="flex items-center gap-3">
                                <img src={logo} alt="Hyzync" className="h-5 w-auto opacity-70" />
                                <span className="text-white/40">&copy; 2026 Hyzync Inc. All Rights Reserved</span>
                            </div>

                            <div className="flex flex-wrap justify-center gap-4 lg:gap-4 border-t lg:border-t-0 border-white/5 pt-3 lg:pt-0 mt-2 lg:mt-0">
                                <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                                <Link to="/terms" className="hover:text-white transition-colors">Site Terms</Link>
                                <Link to="/preferences" className="hover:text-white transition-colors">Communication Preferences</Link>
                                <Link to="/cookies" className="hover:text-white transition-colors">Cookie Settings</Link>
                                <Link to="/privacy" className="hover:text-white transition-colors whitespace-nowrap">Do Not Share My Personal Information</Link>
                                <Link to="/legal" className="hover:text-white transition-colors">Legal</Link>
                            </div>
                        </div>

                        {/* Right: Socials */}
                        <div className="flex items-center gap-2">
                            <SocialBtn icon={XIcon} href="https://x.com/hyzync" />
                            <SocialBtn icon={Linkedin} href="https://linkedin.com/company/hyzync" />
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

const SocialBtn = ({ icon: Icon, href }) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 rounded-md bg-white-5 hover:bg-white-10 flex items-center justify-center text-white transition-all duration-200 hover:-translate-y-0.5"
    >
        <Icon size={16} fill="white" className="opacity-80" />
    </a>
);

export default Footer;
