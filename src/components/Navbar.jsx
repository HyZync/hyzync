import React, { useState, useEffect, useRef } from 'react';
import { Lock, Menu, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logoWordmark from '../assets/logo_f.png';
import { useHorizonAvailabilityNotice } from './HorizonAvailabilityNoticeProvider';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = useRef(0);
    const location = useLocation();
    const navigate = useNavigate();
    const { openHorizonAvailabilityNotice, isHorizonLocked } = useHorizonAvailabilityNotice();
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
        { name: 'contact', path: '/#contact', cta: true }
    ];

    const mobileNavItems = [
        { name: 'horizon', path: '/horizon' },
        { name: 'academy', path: '/academy' },
        { name: 'IQ', path: '/iq' },
        { name: 'contact', path: '/#contact', cta: true }
    ];

    return (
        <nav
            className={`sticky top-2 z-50 flex w-full justify-center px-4 pt-2 transition-all duration-500 md:top-3 md:px-6 md:pt-3 ${
                isVisible ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0'
            } pointer-events-none`}
        >
            <div className="pointer-events-auto relative w-full max-w-[1580px]">
                <div
                    className={`absolute -inset-2 rounded-[34px] blur-3xl transition-all duration-500 ${
                        isHomeRoute
                            ? 'bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_85%_50%,rgba(59,130,246,0.12),transparent_32%)] opacity-100'
                            : 'bg-fuchsia-500/12 opacity-75'
                    }`}
                />

                <div
                    className={`relative flex items-center justify-between gap-3 overflow-hidden rounded-[28px] border px-2.5 py-2 backdrop-blur-[24px] transition-all duration-500 ${
                        isScrolled ? 'md:px-4 md:py-2' : 'md:px-[18px] md:py-[11px]'
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
                        className={`group relative flex shrink-0 items-center gap-2 rounded-[22px] px-1 py-1 transition-all duration-500 md:gap-3 md:px-1.5 ${
                            isHomeRoute ? 'md:bg-white/40 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]' : 'md:bg-white/[0.03]'
                        }`}
                    >
                        <div className="relative z-10 flex shrink-0 items-center overflow-visible">
                            <div className="pointer-events-none absolute inset-x-[1%] bottom-[2%] h-[32px] overflow-visible">
                                <div
                                    className={`absolute left-[-3%] bottom-[1px] h-[20px] w-[38%] rounded-full blur-[13px] animate-navbar-logo-fog ${
                                        isHomeRoute
                                            ? 'bg-[radial-gradient(ellipse_at_40%_50%,rgba(34,211,238,0.92)_0%,rgba(56,189,248,0.62)_48%,transparent_84%)]'
                                            : 'bg-[radial-gradient(ellipse_at_40%_50%,rgba(34,211,238,0.86)_0%,rgba(56,189,248,0.56)_48%,transparent_84%)]'
                                    }`}
                                />
                                <div
                                    className={`absolute left-[8%] bottom-0 h-[24px] w-[60%] rounded-full blur-[17px] animate-navbar-logo-fog-wide ${
                                        isHomeRoute
                                            ? 'bg-[radial-gradient(ellipse_at_46%_52%,rgba(56,189,248,0.88)_0%,rgba(14,165,233,0.54)_50%,transparent_84%)]'
                                            : 'bg-[radial-gradient(ellipse_at_46%_52%,rgba(56,189,248,0.82)_0%,rgba(14,165,233,0.48)_50%,transparent_84%)]'
                                    }`}
                                />
                                <div
                                    className={`absolute left-[44%] bottom-[2px] h-[20px] w-[26%] rounded-full blur-[13px] animate-navbar-logo-fog-reverse ${
                                        isHomeRoute
                                            ? 'bg-[radial-gradient(ellipse_at_48%_50%,rgba(168,85,247,0.56)_0%,rgba(59,130,246,0.34)_46%,transparent_82%)]'
                                            : 'bg-[radial-gradient(ellipse_at_48%_50%,rgba(168,85,247,0.62)_0%,rgba(59,130,246,0.38)_46%,transparent_82%)]'
                                    }`}
                                />
                                <div
                                    className={`absolute left-[16%] bottom-[5px] h-[12px] w-[40%] rounded-full blur-[9px] animate-navbar-logo-fog-lift ${
                                        isHomeRoute
                                            ? 'bg-[radial-gradient(ellipse_at_50%_50%,rgba(255,255,255,0.42)_0%,rgba(186,230,253,0.28)_52%,transparent_84%)]'
                                            : 'bg-[radial-gradient(ellipse_at_50%_50%,rgba(186,230,253,0.24)_0%,rgba(125,211,252,0.14)_52%,transparent_84%)]'
                                    }`}
                                />
                            </div>
                            <div
                                className={`pointer-events-none absolute left-[6%] bottom-[1px] h-[28px] w-[78%] blur-[20px] animate-navbar-logo-fog-wide ${
                                    isHomeRoute
                                        ? 'bg-[radial-gradient(ellipse_at_44%_52%,rgba(34,211,238,0.42)_0%,rgba(56,189,248,0.32)_38%,rgba(168,85,247,0.14)_62%,transparent_82%)]'
                                        : 'bg-[radial-gradient(ellipse_at_44%_52%,rgba(34,211,238,0.34)_0%,rgba(56,189,248,0.24)_38%,rgba(168,85,247,0.16)_62%,transparent_82%)]'
                                }`}
                            />
                            <img
                                src={logoWordmark}
                                alt="Hyzync"
                                className={`relative z-10 block w-auto shrink-0 object-contain transition-all duration-500 ${
                                    isHomeRoute
                                        ? isScrolled
                                            ? 'h-[28px] md:h-[30px]'
                                            : 'h-[30px] md:h-[34px]'
                                        : isScrolled
                                            ? 'h-[28px] md:h-[30px] [filter:brightness(0)_invert(1)]'
                                            : 'h-[30px] md:h-[34px] [filter:brightness(0)_invert(1)]'
                                }`}
                            />
                        </div>
                        <div className={`relative z-10 hidden h-8 w-px shrink-0 rounded-full transition-all duration-500 xl:block ${isHomeRoute ? 'bg-slate-200' : 'bg-white/14'}`} />
                        <div className={`relative z-10 hidden min-w-0 transition-all duration-500 xl:block ${isScrolled ? 'max-w-[12rem]' : 'max-w-[13.5rem]'}`}>
                            <span className={`block text-[9px] font-semibold uppercase tracking-[0.3em] ${isHomeRoute ? 'text-slate-400' : 'text-white/40'}`}>
                                Feedback Platform
                            </span>
                            <span className={`mt-1 block text-[13px] font-semibold leading-[1.1] ${isHomeRoute ? 'text-slate-700' : 'text-white/80'}`}>
                                Unified customer intelligence
                            </span>
                        </div>
                    </Link>

                    <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
                        <div className="hidden flex-1 lg:block">
                            <div
                                className={`relative h-px overflow-hidden rounded-full ${
                                    isHomeRoute
                                        ? 'bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.12),rgba(56,189,248,0.2),transparent)]'
                                        : 'bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.12),rgba(56,189,248,0.18),transparent)]'
                                }`}
                            >
                                <div
                                    className={`pointer-events-none absolute inset-y-0 left-[-30%] w-[34%] animate-navbar-line-fill ${
                                        isHomeRoute
                                            ? 'bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0),rgba(56,189,248,0.72),rgba(125,211,252,1),rgba(56,189,248,0.68),rgba(56,189,248,0),transparent)]'
                                            : 'bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0),rgba(56,189,248,0.58),rgba(125,211,252,0.88),rgba(56,189,248,0.54),rgba(56,189,248,0),transparent)]'
                                    }`}
                                />
                                <div
                                    className={`pointer-events-none absolute inset-y-[-6px] left-[-16%] w-[18%] blur-sm animate-navbar-line-fill ${
                                        isHomeRoute ? 'bg-sky-300/50' : 'bg-sky-300/42'
                                    }`}
                                />
                            </div>
                        </div>

                        <div
                            className={`ml-auto flex items-center gap-1 rounded-[20px] border p-1 ${
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
                                        className={`group relative inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] transition-all duration-300 md:min-h-[38px] ${
                                            isActive
                                                ? isHomeRoute
                                                    ? item.special
                                                        ? 'bg-[linear-gradient(135deg,#ecfeff_0%,#dbeafe_100%)] text-cyan-800 shadow-[0_18px_40px_-28px_rgba(8,145,178,0.2)]'
                                                        : 'bg-slate-950 text-white shadow-[0_18px_40px_-28px_rgba(15,23,42,0.55)]'
                                                    : 'bg-white text-slate-950 shadow-[0_18px_40px_-28px_rgba(255,255,255,0.24)]'
                                                : item.cta
                                                    ? isHomeRoute
                                                        ? 'bg-slate-950 text-white shadow-[0_16px_36px_-26px_rgba(15,23,42,0.5)] hover:bg-slate-800'
                                                        : 'bg-white text-slate-950 shadow-[0_16px_36px_-26px_rgba(255,255,255,0.24)] hover:bg-white/90'
                                                : item.special
                                                    ? isHomeRoute
                                                        ? 'text-cyan-700 hover:bg-cyan-50/80'
                                                        : 'bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/16'
                                                    : isHomeRoute
                                                        ? 'text-slate-600 hover:bg-white hover:text-slate-950'
                                                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                                        }`}
                                    >
                                        {item.path === '/horizon' && isHorizonLocked ? (
                                            <Lock size={12} className={isHomeRoute ? 'text-amber-600' : 'text-amber-300'} />
                                        ) : item.special ? (
                                            <span className={`h-2 w-2 rounded-full shadow-[0_0_16px_rgba(34,211,238,0.8)] ${isHomeRoute ? 'bg-cyan-400' : 'bg-cyan-300'}`} />
                                        ) : null}
                                        <span>{item.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <button
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all md:hidden ${
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
                                                    : item.cta
                                                        ? isHomeRoute
                                                            ? 'bg-slate-950 text-white hover:bg-slate-800'
                                                            : 'bg-white text-slate-950 hover:bg-white/90'
                                                    : isHomeRoute
                                                        ? 'text-slate-700 hover:bg-white/90'
                                                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            <span className="inline-flex items-center gap-2">
                                                {item.path === '/horizon' && isHorizonLocked && <Lock size={14} className={isHomeRoute ? 'text-amber-600' : 'text-amber-300'} />}
                                                {item.name}
                                            </span>
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
