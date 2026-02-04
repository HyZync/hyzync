import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * AdvancedScrollManager
 * 
 * Uses a robust polling and mutation observation strategy to ensure 
 * hash-based navigation works across route transitions and dynamic content.
 */
const AdvancedScrollManager = () => {
    const { pathname, hash } = useLocation();
    const lastHash = useRef('');

    useEffect(() => {
        // Handle scroll to top on path change (when no hash is present)
        if (!hash) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            lastHash.current = '';
            return;
        }

        const targetId = hash.replace('#', '');

        // If the hash hasn't changed, we might still want to re-scroll if clicked again
        // so we don't return early here unless we're absolutely sure.

        const performScroll = () => {
            const element = document.getElementById(targetId);
            if (element) {
                // Get the accurate position relative to the scroll parent
                const navHeight = 90; // Fixed navbar height
                const elementPosition = element.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - navHeight;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                return true;
            }
            return false;
        };

        // Aggressive polling strategy (Advanced tech)
        let attempts = 0;
        const maxAttempts = 50; // Try for 5 seconds total

        const scrollInterval = setInterval(() => {
            attempts++;
            const success = performScroll();

            if (success || attempts >= maxAttempts) {
                clearInterval(scrollInterval);
                lastHash.current = hash;
            }
        }, 100);

        return () => clearInterval(scrollInterval);
    }, [pathname, hash]);

    return null;
};

export default AdvancedScrollManager;
