import React, { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logoWordmark from '../assets/logo_f.png';
import { useHorizonAvailabilityNotice } from './HorizonAvailabilityNoticeProvider';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = useRef(0);
    const location = useLocation();
    const navigate = useNavigate();
    const { openHorizonAvailabilityNotice } = useHorizonAvailabilityNotice();
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
            openHorizonAvailabilityNotice();
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
            className={`sticky top-3 z-50 flex w-full justify-center px-4 pt-3 transition-all duration-500 md:top-4 md:px-6 md:pt-4 ${
                isVisible ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
            } pointer-events-none`}
        >
            <div className="pointer-events-auto relative w-full max-w-[1660px]">
                <div
                    className={`absolute -inset-2 rounded-[38px] blur-3xl transition-all duration-500 ${
                        isHomeRoute
                            ? 'bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_85%_50%,rgba(59,130,246,0.12),transparent_32%)] opacity-100'
                            : 'bg-fuchsia-500/12 opacity-75'
                    }`}
                />

                <div
                    className={`relative flex items-center justify-between gap-4 overflow-hidden rounded-[32px] border px-3 py-2.5 backdrop-blur-[24px] transition-all duration-500 ${
                        isScrolled ? 'md:px-4 md:py-2.5' : 'md:px-5 md:py-3'
                    } ${
                        isHomeRoute
                            ? 'border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,249,255,0.9))] text-slate-900 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.16)]'
                            : 'border-white/10 bg-slate-950/55 text-white shadow-[0_28px_90px_-42px_rgba(15,23,42,0.58)]'
                    }`}
                >
                    <div
                        className={`pointer-events-none absolute inset-0 ${
                            isHomeRoute
                                ? 'bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(207,250,254,0.4),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.34),transparent_58%)]'
                                : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_55%)]'
                        }`}
                    />
                    <div
                        className={`pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r ${
                            isHomeRoute ? 'from-transparent via-white to-transparent' : 'from-transparent via-white/40 to-transparent'
                        }`}
                    />
                    <div
                        className={`pointer-events-none absolute inset-x-20 bottom-0 h-px bg-gradient-to-r ${
                            isHomeRoute ? 'from-transparent via-cyan-200/70 to-transparent' : 'from-transparent via-white/20 to-transparent'
                        }`}
                    />

                    <Link
                        to="/"
                        onClick={handleLogoClick}
                        className="group relative flex shrink-0 items-center gap-3 px-1.5 py-1 transition-all duration-500 md:gap-4"
                    >
                        <img
                            src={logoWordmark}
                            alt="Hyzync"
                            className={`relative z-10 block w-auto shrink-0 object-contain transition-all duration-500 ${
                                isHomeRoute
                                    ? isScrolled
                                        ? 'h-8 md:h-9'
                                        : 'h-9 md:h-10'
                                    : isScrolled
                                        ? 'h-8 md:h-9 [filter:brightness(0)_invert(1)]'
                                        : 'h-9 md:h-10 [filter:brightness(0)_invert(1)]'
                            }`}
                        />
                        <div className={`hidden h-9 w-px shrink-0 rounded-full transition-all duration-500 xl:block ${isHomeRoute ? 'bg-slate-200' : 'bg-white/14'}`} />
                        <div className={`hidden min-w-0 transition-all duration-500 xl:block ${isScrolled ? 'max-w-[13.5rem]' : 'max-w-[16rem]'}`}>
                            <span className={`block text-[10px] font-semibold uppercase tracking-[0.26em] ${isHomeRoute ? 'text-slate-400' : 'text-white/40'}`}>
                                Feedback Platform
                            </span>
                            <span className={`mt-1.5 block text-[14px] font-semibold leading-[1.15] ${isHomeRoute ? 'text-slate-700' : 'text-white/80'}`}>
                                Unified customer intelligence
                            </span>
                        </div>
                    </Link>

                    <div className="hidden min-w-0 flex-1 items-center gap-4 md:flex">
                        <div
                            className={`hidden h-px flex-1 lg:block ${
                                isHomeRoute
                                    ? 'bg-[linear-gradient(90deg,transparent,rgba(14,165,233,0.22),transparent)]'
                                    : 'bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]'
                            }`}
                        />

                        <div
                            className={`ml-auto flex items-center gap-1 rounded-[24px] border p-1.5 ${
                                isHomeRoute
                                    ? 'border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(246,250,255,0.86))] shadow-[0_18px_44px_-34px_rgba(15,23,42,0.12)]'
                                    : 'border-white/10 bg-white/6'
                            }`}
                        >
                            {navItems.map((item) => {
                                const isActive = isItemActive(item.path);

                                return (
                                    <button
                                        key={item.name}
                                        onClick={() => handleNavClick(item.path)}
                                        className={`group relative inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-300 ${
                                            isActive
                                                ? isHomeRoute
                                                    ? item.special
                                                        ? 'bg-[linear-gradient(135deg,#ecfeff_0%,#dbeafe_100%)] text-cyan-800 shadow-[0_18px_40px_-28px_rgba(8,145,178,0.2)]'
                                                        : 'bg-slate-950 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)]'
                                                    : 'bg-white text-slate-950 shadow-[0_18px_40px_-28px_rgba(255,255,255,0.24)]'
                                                : item.special
                                                    ? isHomeRoute
                                                        ? 'text-cyan-700 hover:bg-cyan-50/80'
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
                    </div>

                    <button
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all md:hidden ${
                            isHomeRoute
                                ? 'border-white/80 bg-white/84 text-slate-700 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.22)] hover:bg-white'
                                : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                        }`}
                        onClick={() => setIsOpen(!isOpen)}
                        aria-label="Toggle navigation menu"
                    >
                        {isOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {isOpen && (
                    <div className="pointer-events-auto absolute left-1/2 top-full z-10 mt-3 w-full max-w-sm -translate-x-1/2">
                        <div
                            className={`relative overflow-hidden rounded-[28px] border p-4 backdrop-blur-2xl ${
                                isHomeRoute
                                    ? 'border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,251,255,0.92))] shadow-[0_28px_90px_-42px_rgba(14,116,144,0.18)]'
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
                                                        ? 'bg-slate-950 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]'
                                                        : 'bg-white text-slate-950'
                                                    : isHomeRoute
                                                        ? 'text-slate-700 hover:bg-white/90'
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
