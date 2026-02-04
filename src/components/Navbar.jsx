import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const location = useLocation();
    const navigate = useNavigate();

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

    const handleNavClick = (path) => {
        setIsOpen(false);

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

    const navItems = [
        { name: 'horizon', path: '/#horizon' },
        { name: 'academy', path: '/academy' },
        { name: 'iq', path: '/iq', special: true },
        { name: 'contact', path: '/#contact' }
    ];

    const mobileNavItems = [
        { name: 'horizon', path: '/#horizon' },
        { name: 'academy', path: '/academy' },
        { name: 'IQ', path: '/iq' },
        { name: 'contact', path: '/#contact' }
    ];

    return (
        <nav className="relative w-full flex justify-center pt-4 md:pt-8 z-50">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-8 py-3 flex items-center gap-8 shadow-2xl">
                <Link to="/" className="flex items-center">
                    <img src={logo} alt="Hyzync Logo" className="h-8 w-auto hover:opacity-80 transition-opacity" />
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-8">
                    {navItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => handleNavClick(item.path)}
                            className={`text-sm font-medium transition-all relative group/nav cursor-pointer ${item.special
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
                        </button>
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
                    {mobileNavItems.map((item) => (
                        <button
                            key={item.name}
                            onClick={() => handleNavClick(item.path)}
                            className="text-white text-lg font-medium text-center hover:text-brand-purple transition-colors w-full"
                        >
                            {item.name}
                        </button>
                    ))}
                </div>
            )}
        </nav>
    );
};

export default Navbar;
