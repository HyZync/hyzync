import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                setIsVisible(false); // Hide on scroll down
            } else {
                setIsVisible(true);  // Show on scroll up
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <nav className="relative w-full flex justify-center pt-4 md:pt-8 z-50">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-8 py-3 flex items-center gap-8 shadow-2xl">
                <Link to="/" className="flex items-center">
                    <img src={logo} alt="Hyzync Logo" className="h-8 w-auto hover:opacity-80 transition-opacity" />
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-8">
                    {[
                        { name: 'horizon', path: '/#horizon' },
                        { name: 'academy', path: '/academy' },
                        { name: 'iq', path: '/iq', special: true },
                        { name: 'contact', path: '/#contact' }
                    ].map((item) => (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`text-sm font-medium transition-all relative group/nav ${item.special
                                ? 'text-brand-purple font-bold flex items-center gap-1.5'
                                : 'text-secondary hover:text-white'
                                }`}
                        >
                            {item.special ? (
                                <>
                                    <span className="relative">
                                        IQ
                                        <span className="absolute -inset-x-2 -inset-y-1 bg-brand-purple/20 blur-md rounded-lg opacity-50 group-hover/nav:opacity-100 transition-opacity"></span>
                                    </span>
                                    <span className="flex items-center gap-1 italic text-[9px] px-1.5 py-0.5 rounded bg-[#E80020]/20 border border-[#E80020]/30 text-[#E80020] font-black tracking-widest">
                                        <span className="w-1 h-1 rounded-full bg-[#E80020] animate-pulse"></span>
                                        PIT STOP
                                    </span>
                                </>
                            ) : (
                                item.name
                            )}
                        </Link>
                    ))}
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden text-white ml-4 hover:text-white/80 transition-colors"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-[90vw] max-w-md mt-4 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col space-y-4 shadow-xl">
                    {[
                        { name: 'Horizon', path: '/#horizon' },
                        { name: 'Academy', path: '/academy' },
                        { name: 'IQ', path: '/iq' },
                        { name: 'Contact', path: '/#contact' }
                    ].map((item) => (
                        <Link
                            key={item.name}
                            to={item.path}
                            className="text-white text-lg font-medium text-center hover:text-brand-purple transition-colors"
                            onClick={() => setIsOpen(false)}
                        >
                            {item.name}
                        </Link>
                    ))}
                </div>
            )}
        </nav>
    );
};

export default Navbar;
