import React, { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useHorizonPreviewNotice } from './HorizonPreviewNoticeProvider';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = useRef(0);
    const location = useLocation();
    const navigate = useNavigate();
    const { openHorizonPreviewNotice } = useHorizonPreviewNotice();
    const isHomeRoute = location.pathname === '/';

    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            setIsScrolled(currentScrollY > 180);

            if (currentScrollY > lastScrollY.current && currentScrollY > 120) {
                setIsVisible(false);
            } else {
                setIsVisible(true);
            }

            lastScrollY.current = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        setIsOpen(false);
    }, [location.pathname, location.hash]);

    const handleNavClick = (path) => {
        setIsOpen(false);

        if (path === '/horizon') {
            openHorizonPreviewNotice();
            return;
        }

        // If it's a hash link
        if (path.includes('#')) {
            const [basePath, hash] = path.split('#');

            // If we are already on the target path, just update hash
            if (location.pathname === basePath || (location.pathname === '/' && basePath === '')) {
                // Force a temporary hash clear if it's the same hash to re-trigger useEffect in ScrollManager
                if (location.hash === `#${hash}`) {
                    navigate(`${basePath || '/'}`, { replace: true });
                    setTimeout(() => navigate(path), 10);
                } else {
                    navigate(path);
                }
            } else {
                navigate(path);
            }
        } else {
            navigate(path);
        }
    };

    const handleLogoClick = (event) => {
        if (location.pathname === '/') {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const isItemActive = (path) => {
        if (path.includes('#')) {
            const [basePath, hash] = path.split('#');
            const normalizedBasePath = basePath || '/';
            return location.pathname === normalizedBasePath && location.hash === `#${hash}`;
        }

        return location.pathname === path;
    };

    const navItems = [
        { name: 'horizon', path: '/horizon' },
        { name: 'academy', path: '/academy' },
        { name: 'iq', path: '/iq', special: true },
        { name: 'contact', path: '/#contact' }
    ];

    const mobileNavItems = [
        { name: 'horizon', path: '/horizon' },
        { name: 'academy', path: '/academy' },
        { name: 'IQ', path: '/iq' },
        { name: 'contact', path: '/#contact' }
    ];

    return (
        <nav
            className={`sticky top-4 z-50 flex w-full justify-center px-4 pt-4 transition-all duration-500 md:top-5 md:px-6 md:pt-5 ${
                isVisible ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
            } pointer-events-none`}
        >
            <div className="pointer-events-auto relative w-full max-w-fit">
                <div
                    className={`absolute -inset-2 rounded-[34px] blur-2xl transition-all duration-500 ${
                        isHomeRoute ? 'bg-cyan-200/45 opacity-90' : 'bg-fuchsia-500/15 opacity-80'
                    }`}
                />

                <div
                    className={`relative flex items-center gap-3 overflow-hidden rounded-[30px] border px-3 py-3 backdrop-blur-2xl transition-all duration-500 ${
                        isScrolled ? 'md:px-3 md:py-2.5' : 'md:px-4 md:py-3'
                    } ${
                        isHomeRoute
                            ? 'border-white/80 bg-white/82 text-slate-900 shadow-[0_28px_90px_-42px_rgba(14,116,144,0.28)]'
                            : 'border-white/10 bg-slate-950/55 text-white shadow-[0_28px_90px_-42px_rgba(15,23,42,0.58)]'
                    }`}
                >
                    <div
                        className={`pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r ${
                            isHomeRoute ? 'from-transparent via-white to-transparent' : 'from-transparent via-white/40 to-transparent'
                        }`}
                    />

                    <Link
                        to="/"
                        onClick={handleLogoClick}
                        className={`group relative flex items-center rounded-[22px] border px-3 py-2.5 transition-all duration-500 ${
                            isHomeRoute
                                ? 'border-slate-200/80 bg-white/78 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)] hover:bg-white'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                    >
                        <img src={logo} alt="Hyzync Logo" className={`w-auto transition-all duration-500 ${isScrolled ? 'h-7' : 'h-8'}`} />
                        <div className={`hidden overflow-hidden transition-all duration-500 lg:block ${isScrolled ? 'ml-0 max-w-0 opacity-0' : 'ml-3 max-w-[10rem] opacity-100'}`}>
                            <span className={`block text-[9px] font-semibold uppercase tracking-[0.28em] ${isHomeRoute ? 'text-slate-400' : 'text-white/40'}`}>
                                Hyzync
                            </span>
                            <span className={`mt-1 block text-xs font-semibold ${isHomeRoute ? 'text-slate-700' : 'text-white/80'}`}>
                                Feedback intelligence
                            </span>
                        </div>
                    </Link>

                    <div className="hidden items-center gap-1 md:flex">
                        {navItems.map((item) => {
                            const isActive = isItemActive(item.path);

                            return (
                                <button
                                    key={item.name}
                                    onClick={() => handleNavClick(item.path)}
                                    className={`group relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${
                                        isActive
                                            ? isHomeRoute
                                                ? 'bg-slate-950 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)]'
                                                : 'bg-white text-slate-950 shadow-[0_18px_40px_-28px_rgba(255,255,255,0.24)]'
                                            : item.special
                                                ? isHomeRoute
                                                    ? 'bg-cyan-50/85 text-cyan-700 hover:bg-cyan-100'
                                                    : 'bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/16'
                                                : isHomeRoute
                                                    ? 'text-slate-600 hover:bg-white hover:text-slate-950'
                                                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    {item.special && (
                                        <span className={`h-2 w-2 rounded-full shadow-[0_0_16px_rgba(34,211,238,0.8)] ${isHomeRoute ? 'bg-cyan-400' : 'bg-cyan-300'}`} />
                                    )}
                                    <span>{item.name}</span>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all md:hidden ${
                            isHomeRoute
                                ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                        }`}
                        onClick={() => setIsOpen(!isOpen)}
                        aria-label="Toggle navigation menu"
                    >
                        {isOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {isOpen && (
                    <div className="pointer-events-auto absolute left-1/2 top-full z-10 mt-4 w-[90vw] max-w-md -translate-x-1/2">
                        <div
                            className={`relative overflow-hidden rounded-[28px] border p-4 backdrop-blur-2xl ${
                                isHomeRoute
                                    ? 'border-white/80 bg-white/90 shadow-[0_28px_90px_-42px_rgba(14,116,144,0.25)]'
                                    : 'border-white/10 bg-slate-950/88 shadow-[0_28px_90px_-42px_rgba(15,23,42,0.58)]'
                            }`}
                        >
                            <div
                                className={`pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r ${
                                    isHomeRoute ? 'from-transparent via-white to-transparent' : 'from-transparent via-white/30 to-transparent'
                                }`}
                            />

                            <div className="relative flex flex-col gap-2">
                                {mobileNavItems.map((item) => {
                                    const isActive = isItemActive(item.path);

                                    return (
                                        <button
                                            key={item.name}
                                            onClick={() => handleNavClick(item.path)}
                                            className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.18em] transition-all ${
                                                isActive
                                                    ? isHomeRoute
                                                        ? 'bg-slate-950 text-white'
                                                        : 'bg-white text-slate-950'
                                                    : isHomeRoute
                                                        ? 'text-slate-700 hover:bg-white'
                                                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            {item.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
