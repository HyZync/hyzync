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
import PromoBanner from './components/PromoBanner';
import YearProgress from './components/YearProgress';
import IQ from './components/IQ';
import Founder from './components/Founder';
import ScrollToTop from './components/ScrollToTop';
import HorizonStandalone from './components/HorizonStandalone';

import AdvancedScrollManager from './components/ScrollManager';
import { HorizonAvailabilityNoticeProvider } from './components/HorizonAvailabilityNoticeProvider';

const DesktopOnlyFallback = () => (
  <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_12%_12%,rgba(34,211,238,0.2),transparent_24%),radial-gradient(circle_at_86%_14%,rgba(59,130,246,0.16),transparent_28%),linear-gradient(180deg,#f8fbfe_0%,#eef5fb_100%)] px-5 py-8 text-slate-900">
    <div className="pointer-events-none absolute -left-16 top-10 h-72 w-72 rounded-full bg-cyan-300/28 blur-[120px]" />
    <div className="pointer-events-none absolute right-[-72px] top-16 h-80 w-80 rounded-full bg-blue-300/24 blur-[140px]" />

    <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
      <div className="w-full overflow-hidden rounded-[34px] border border-white/80 bg-white shadow-[0_32px_90px_-44px_rgba(15,23,42,0.18)] ring-1 ring-slate-100/80 backdrop-blur-[24px]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
            Horizon FI
          </div>
        </div>

        <div className="px-7 py-8 text-center">
          <div className="mx-auto inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            Horizon FI
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">
            Temporarily Locked
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-[42px]">
            Horizon FI will be available soon.
          </h1>
          <p className="mx-auto mt-4 max-w-[26rem] text-[15px] leading-relaxed text-slate-600 sm:text-base">
            We are finalizing launch readiness and will open Horizon access very soon.
          </p>

          <div className="mt-7 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Status
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-950">
              Available Soon
            </p>
          </div>

          <div className="mt-6 rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))] px-4 py-3 text-sm leading-relaxed text-slate-600">
            Thanks for visiting. Have a great day.
          </div>
        </div>
      </div>
    </div>
  </div>
);

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
      <HorizonAvailabilityNoticeProvider>
        <AppShell />
      </HorizonAvailabilityNoticeProvider>
    </Router>
  );
}

function AppShell() {
  const location = useLocation();
  const isHorizonRoute = location.pathname.startsWith('/horizon');
  const isHomeRoute = location.pathname === '/';
  if (isHorizonRoute) {
    return <DesktopOnlyFallback />;
  }

  return (
    <>
      {!isHorizonRoute && !isHomeRoute && <YearProgress />}
      {!isHorizonRoute && <PromoBanner />}
      <ScrollToTop />
      <AdvancedScrollManager />
      <Routes>
        <Route path="/horizon/*" element={<HorizonStandalone />} />
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
