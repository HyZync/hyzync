import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import About from './components/About';
import Academy from './components/Academy';
import Careers from './components/Careers';
import Privacy from './components/Privacy';
import Terms from './components/Terms';
import Security from './components/Security';
import Footer from './components/Footer';
import Background from './components/Background';
import Particles from './components/Particles';
import MouseSpotlight from './components/MouseSpotlight';
import { useEffect } from 'react';
import PromoBanner from './components/PromoBanner';
import YearProgress from './components/YearProgress';
import IQ from './components/IQ';
import Founder from './components/Founder';


const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    } else {
      setTimeout(() => {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [pathname, hash]);

  return null;
}

function App() {
  return (
    <Router>
      <YearProgress />
      <PromoBanner />
      <ScrollToTop />
      <div className="min-h-screen bg-background text-white selection:bg-brand-purple/30 selection:text-white overflow-hidden flex flex-col">
        {/* Background Elements */}
        <Background />
        <div className="fixed inset-0 bg-gradient-mesh z-[-2]"></div>
        <Particles />
        <MouseSpotlight />

        {/* Main Content */}
        <Navbar />

        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/academy" element={<Academy />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/security" element={<Security />} />
            <Route path="/iq" element={<IQ />} />
            <Route path="/visionary" element={<Founder />} />

          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
