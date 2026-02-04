import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToHash = () => {
    const { hash, pathname } = useLocation();

    useEffect(() => {
        if (hash) {
            // Delay slightly to ensure content is rendered
            const timeoutId = setTimeout(() => {
                const id = hash.replace('#', '');
                const element = document.getElementById(id);
                if (element) {
                    const navHeight = 80;
                    const top = element.getBoundingClientRect().top + window.scrollY - navHeight;
                    window.scrollTo({
                        top: top,
                        behavior: 'smooth'
                    });
                }
            }, 100);
            return () => clearTimeout(timeoutId);
        } else {
            // Scroll to top if no hash
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [hash, pathname]);

    return null;
};

export default ScrollToHash;
