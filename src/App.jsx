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
import ScrollToTop from './components/ScrollToTop';

import AdvancedScrollManager from './components/ScrollManager';
import HorizonStandalone from './components/HorizonStandalone';
import { HorizonPreviewNoticeProvider } from './components/HorizonPreviewNoticeProvider';

const MainLayout = ({ children }) => {
  const location = useLocation();
  const isHomeRoute = location.pathname === '/';

  return (
    <div
      className={`min-h-screen overflow-hidden flex flex-col ${
        isHomeRoute
          ? 'bg-[#f5f9fc] text-slate-900 selection:bg-cyan-200/70 selection:text-slate-900'
          : 'bg-background text-white selection:bg-brand-purple/30 selection:text-white'
      }`}
    >
      {isHomeRoute ? (
        <div className="fixed inset-0 z-[-2] bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_50%_14%,rgba(16,185,129,0.12),transparent_24%),linear-gradient(180deg,#f8fbfe_0%,#eef5fb_100%)]" />
      ) : (
        <>
          <Background />
          <div className="fixed inset-0 bg-gradient-mesh z-[-2]"></div>
          <Particles />
          <MouseSpotlight />
        </>
      )}

      <Navbar />

      <main className="flex-grow">
        {children}
      </main>

      <Footer />
    </div>
  );
};

function App() {
  return (
    <Router>
      <HorizonPreviewNoticeProvider>
        <AppShell />
      </HorizonPreviewNoticeProvider>
    </Router>
  );
}

function AppShell() {
  const location = useLocation();
  const isHorizonRoute = location.pathname.startsWith('/horizon');
  const isHomeRoute = location.pathname === '/';

  return (
    <>
      {!isHorizonRoute && !isHomeRoute && <YearProgress />}
      {!isHorizonRoute && <PromoBanner />}
      <ScrollToTop />
      <AdvancedScrollManager />
      <Routes>
        <Route path="/horizon" element={<HorizonStandalone />} />
        <Route path="*" element={
          <MainLayout>
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
          </MainLayout>
        } />
      </Routes>
    </>
  );
}

export default App;
