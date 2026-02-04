import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Server,
    Cpu,
    HardDrive,
    Network,
    Box,
    Activity,
    ChevronRight,
    CreditCard,
    Search,
    Bell,
    CheckCircle,
    XCircle,
    Zap,
    Globe,
    Shield,
    Terminal,
    Maximize2,
    Layers,
    Database,
    Clock
} from 'lucide-react';
import nvidiaLogo from '../assets/nvidia.webp';
import amdLogo from '../assets/amd.webp';
import { useNavigate } from 'react-router-dom';

// --- DATA CONSTANTS ---

const POD_DATA = [
    { id: 1, title: "A100-NVLINK-Tiny", price: 24, specs: { gpus: 1, ram: '30 GB', vcpus: 16, vram: '5 GB' }, available: false },
    { id: 2, title: "A100-NVLINK-Nano", price: 49, specs: { gpus: 1, ram: '60 GB', vcpus: 16, vram: '10 GB' }, available: false },
    { id: 3, title: "A100-NVLINK-Mini", price: 73, specs: { gpus: 1, ram: '60 GB', vcpus: 16, vram: '20 GB' }, available: false },
    { id: 4, title: "A100-NVLINK-Std", price: 145, specs: { gpus: 2, ram: '120 GB', vcpus: 32, vram: '40 GB' }, available: false },
    { id: 5, title: "A100-NVLINK-Pro", price: 290, specs: { gpus: 4, ram: '240 GB', vcpus: 64, vram: '80 GB' }, available: false },
    { id: 6, title: "A100-NVLINK-Max", price: 580, specs: { gpus: 8, ram: '480 GB', vcpus: 128, vram: '160 GB' }, available: false },
    { id: 7, title: "A100-NVLINK-Standard-1x", price: 170, specs: { gpus: 1, ram: '60 GB', vcpus: 16, vram: '40 GB' }, available: false },
    { id: 8, title: "A100-NVLINK-Standard-2x", price: 340, specs: { gpus: 2, ram: '125 GB', vcpus: 16, vram: '80 GB' }, available: false },
    { id: 9, title: "A100-NVLINK-Standard-4x", price: 510, specs: { gpus: 4, ram: '250 GB', vcpus: 128, vram: '160 GB' }, available: false },
];

const VM_DATA = {
    'CPU VMs': [
        { id: 10, title: "CPU-1x-4GB", price: "3", specs: { vcpus: 1, ram: '4 GB', network: 'Upto 10Gbps' }, available: false },
        { id: 11, title: "CPU-2x-8GB", price: "6", specs: { vcpus: 2, ram: '8 GB', network: 'Upto 10Gbps' }, available: false },
        { id: 12, title: "CPU-4x-16GB", price: "13", specs: { vcpus: 4, ram: '16 GB', network: 'Upto 10Gbps' }, available: false },
        { id: 13, title: "CPU-8x-32GB", price: "25", specs: { vcpus: 8, ram: '32 GB', network: 'Upto 10Gbps' }, available: false },
        { id: 14, title: "CPU-16x-64GB", price: "49", specs: { vcpus: 16, ram: '64 GB', network: 'Upto 10Gbps' }, available: false },
        { id: 15, title: "CPU-32x-128GB", price: "97", specs: { vcpus: 32, ram: '128 GB', network: 'Upto 10Gbps' }, available: false },
    ],
    'GPU VMs': [
        { id: 16, title: "A100-40GB-NVLINK-1x", price: "170", model: "NVIDIA A100", specs: { vcpus: 24, ram: '96 GB', gpus: 1, gpu_mem: '40 GB', network: 'Upto 10Gbps' }, available: false },
        { id: 17, title: "A100-80GB-NVLINK-1x", price: "189", model: "NVIDIA A100", specs: { vcpus: 24, ram: '96 GB', gpus: 1, gpu_mem: '80 GB', network: 'Upto 10Gbps' }, available: false },
        { id: 18, title: "A100-40GB-NVLINK-2x", price: "340", model: "NVIDIA A100", specs: { vcpus: 48, ram: '192 GB', gpus: 2, gpu_mem: '80 GB', network: 'Upto 10Gbps' }, available: false },
        { id: 19, title: "A100-40GB-NVLINK-4x", price: "680", model: "NVIDIA A100", specs: { vcpus: 96, ram: '384 GB', gpus: 4, gpu_mem: '160 GB', network: 'Upto 10Gbps' }, available: false },
        { id: 20, title: "A100-40GB-NVLINK-8x", price: "1360", model: "NVIDIA A100", specs: { vcpus: 192, ram: '768 GB', gpus: 8, gpu_mem: '320 GB', network: 'Upto 10Gbps' }, available: false },
        { id: 21, title: "H100-NVLINK-1x", price: "213", model: "NVIDIA H100", specs: { vcpus: 24, ram: '200 GB', gpus: 1, gpu_mem: '80 GB', network: 'Upto 10Gbps' }, available: false },
    ],
    'GPU Baremetal': [
        { id: 22, title: "A100-40GB-1-Node", price: "720", model: "NVIDIA A100", specs: { vcpus: 128, ram: '2 TB', gpus: 8, gpu_mem: '640 GB', network: 'Upto 10Gbps', ssd: 'Starting from 33 TB' }, available: false },
        { id: 23, title: "H100-80GB-1-Node", price: "1720", model: "NVIDIA H100", specs: { vcpus: 192, ram: '2 TB', gpus: 8, gpu_mem: '640 GB', network: 'Upto 10Gbps', ssd: 'Starting from 56 TB' }, available: false },
        { id: 24, title: "H100-80GB-2-Node", price: "3440", model: "NVIDIA H100", specs: { vcpus: 384, ram: '4 TB', gpus: 16, gpu_mem: '1280 GB', network: 'Upto 10Gbps', ssd: 'Starting from 112 TB' }, available: false },
        { id: 25, title: "H100-80GB-4-Node", price: "6880", model: "NVIDIA H100", specs: { vcpus: 768, ram: '8 TB', gpus: 32, gpu_mem: '2560 GB', network: 'Upto 10Gbps', ssd: 'Starting from 224 TB' }, available: false },
    ]
};

const REGIONS = [
    { id: 'us-east', name: 'US East (Virginia)', status: 'Planned', currency: 'USD', symbol: '$', rate: 1 / 86 },
    { id: 'eu-west', name: 'EU West (Frankfurt)', status: 'Planned', currency: 'EUR', symbol: '€', rate: 1 / 92 },
    { id: 'ap-south', name: 'Asia Pacific (Mumbai)', status: 'Planned', currency: 'INR', symbol: '₹', rate: 1 }
];

const StatCard = ({ icon: Icon, label, value, color }) => (
    <motion.div
        whileHover={{ y: -5, skewX: -3, borderColor: '#3B82F6' }}
        className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl p-5 flex items-center gap-5 group relative overflow-hidden shadow-2xl transition-all"
    >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none"></div>
        <div className={`p-3 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/20 group-hover:bg-[#3B82F6]/20 transition-all`}>
            <Icon size={20} className="text-[#3B82F6]" />
        </div>
        <div>
            <div className="text-zinc-500 text-[10px] uppercase tracking-[0.4em] mb-1 font-black italic">{label}</div>
            <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-white italic tracking-tighter uppercase group-hover:text-[#E0E0E0] transition-colors">{value}</span>
            </div>
        </div>
    </motion.div>
);

const RacingLines = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Carbon fiber texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }}></div>

        {/* Animated speed lines */}
        <svg className="w-full h-full opacity-40" viewBox="0 0 1000 1000">
            {[...Array(8)].map((_, i) => (
                <motion.path
                    key={i}
                    d={`M ${-200} ${80 + i * 120} L ${1200} ${200 + i * 120}`}
                    stroke={i % 3 === 0 ? "#06B6D4" : (i % 3 === 1 ? "#3B82F6" : "#A855F7")}
                    strokeWidth={i % 2 === 0 ? "4" : "2"}
                    fill="none"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: [0, 0.4, 0] }}
                    transition={{
                        duration: 1.5 + i * 0.3,
                        repeat: Infinity,
                        ease: "easeOut",
                        delay: i * 0.2
                    }}
                />
            ))}
        </svg>

        {/* Purple glow at top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-[#A855F7]/10 to-transparent opacity-60"></div>

        {/* Checkered flag corner effect */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
            <div className="w-full h-full" style={{
                backgroundImage: 'repeating-conic-gradient(#fff 0deg 90deg, transparent 90deg 180deg)',
                backgroundSize: '16px 16px'
            }}></div>
        </div>

        {/* Bottom racing stripe */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#3B82F6] to-transparent opacity-50"></div>
    </div>
);

const ModuleButton = ({ icon: Icon, label, active, count, onClick }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-300 relative group overflow-hidden border ${active ? 'bg-gradient-to-r from-[#A855F7] to-[#3B82F6] border-white/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-black/40 text-zinc-500 hover:bg-zinc-900 hover:text-white border-white/10'}`}
    >
        <div className="relative z-10 flex items-center gap-3">
            <Icon size={18} className={`${active ? 'text-white' : 'text-[#3B82F6] group-hover:scale-110 transition-transform'}`} />
            <span className="text-xs font-black italic uppercase tracking-widest">{label}</span>
            {count !== undefined && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                    {count}
                </span>
            )}
        </div>
    </button>
);

const RegionSelector = ({ activeRegion, setActiveRegion }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-black border border-white/10 rounded-lg text-xs font-black text-white hover:border-[#00D2BE]/50 transition-all italic uppercase tracking-[0.2em]"
            >
                <div className="w-1.5 h-1.5 rounded-full bg-[#E0E0E0] animate-pulse"></div>
                <span>{REGIONS.find(r => r.id === activeRegion).name}</span>
                <ChevronRight size={14} className={`opacity-50 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, skewY: -1 }}
                        animate={{ opacity: 1, y: 0, skewY: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full mt-2 right-0 w-64 bg-zinc-950 border-2 border-[#00D2BE]/20 rounded-xl p-2 z-50 shadow-[0_20px_40px_rgba(0,0,0,0.8)]"
                    >
                        {REGIONS.map(region => (
                            <button
                                key={region.id}
                                onClick={() => { setActiveRegion(region.id); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between group ${activeRegion === region.id ? 'bg-[#00D2BE] text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
                            >
                                <span>{region.name}</span>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded border ${activeRegion === region.id ? 'border-white/20' : 'border-[#E0E0E0]/20 text-[#E0E0E0]'}`}>
                                    {region.currency}
                                </span>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const InfrastructureCard = ({ type, data, activeRegion }) => {
    const isGPU = type === 'pod' || type === 'gpu-vm' || type === 'baremetal';
    const logo = isGPU ? nvidiaLogo : amdLogo;

    const region = REGIONS.find(r => r.id === activeRegion) || REGIONS[2];
    const displayPrice = typeof data.price === 'string' && data.price === 'Custom'
        ? 'Custom'
        : (parseFloat(data.price) * region.rate).toFixed(region.currency === 'INR' ? 0 : 2);

    return (
        <motion.div
            whileHover={{ y: -10, rotateX: 2, borderColor: '#3B82F6' }}
            className="group relative bg-[#08080a] border-2 border-white/10 rounded-2xl p-8 overflow-hidden flex flex-col h-full transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:shadow-[#3B82F6]/20"
        >
            {/* Intelligence Gradient Accent Bar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#A855F7] via-[#3B82F6] to-[#06B6D4] shadow-[0_2px_10px_rgba(59,130,246,0.4)]"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none"></div>

            {/* Header */}
            <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="flex items-center gap-5">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 w-16 h-16 flex items-center justify-center group-hover:border-[#00D2BE]/50 transition-all shadow-2xl relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-[#00D2BE]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <img src={logo} alt="Logo" className="w-full h-full object-contain relative z-10 transition-transform duration-500 scale-90 group-hover:scale-105" />
                    </div>
                    <div>
                        <h3 className="font-black text-white text-2xl tracking-tighter italic uppercase leading-none mb-1.5 group-hover:text-[#00D2BE] transition-colors">{data.title}</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-black italic">{data.model || 'ENGINE SPEC'}</span>
                            <div className="w-1.5 h-1.5 rounded-full bg-[#E0E0E0] animate-pulse"></div>
                            <span className="text-[10px] text-[#E0E0E0] uppercase tracking-[0.2em] font-black italic">PHASE 1</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-black text-white italic leading-none mb-1 tracking-tighter group-hover:scale-110 transition-transform origin-right">
                        {displayPrice === 'Custom' ? 'Custom' : `${region.symbol}${displayPrice}`}
                    </div>
                    <div className="text-[10px] text-[#06B6D4] font-black uppercase tracking-[0.3em] italic">Credits / HR</div>
                </div>
            </div>

            {/* Specs Grid - Scuderia Style */}
            <div className="grid grid-cols-2 gap-3 mb-8 flex-grow relative z-10">
                {Object.entries(data.specs).map(([key, value]) => (
                    <div key={key} className="bg-zinc-900/80 border border-white/5 rounded-xl p-4 group-hover:border-[#00D2BE]/20 transition-all hover:bg-zinc-900">
                        <div className="text-[9px] text-zinc-500 uppercase tracking-[0.4em] mb-2 font-black italic">{key}</div>
                        <div className="text-base font-black text-white uppercase italic tracking-tight">{value}</div>
                    </div>
                ))}
            </div>

            {/* Action - PIT STOP Style */}
            <div className="relative z-10">
                <button
                    disabled
                    className="w-full py-5 rounded-xl font-black text-xs uppercase tracking-[0.4em] italic transition-all relative overflow-hidden bg-[#00D2BE]/10 text-zinc-400 border border-[#00D2BE]/20 cursor-not-allowed group/btn"
                >
                    <div className="absolute inset-0 bg-[#00D2BE]/5 opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                    <span className="relative z-10 flex items-center justify-center gap-3">
                        <XCircle size={16} className="text-[#00D2BE] opacity-70" />
                        SIGNUP IN PIT STOP
                    </span>
                </button>
                <div className="mt-4 text-[9px] text-center text-zinc-500 font-black uppercase tracking-[0.4em] italic opacity-80 flex items-center justify-center gap-2">
                    <Activity size={10} className="text-[#3B82F6]" />
                    PRECISION LAUNCH Q1 2026
                </div>
            </div>
        </motion.div>
    );
};

const IQ = () => {
    const navigate = useNavigate();
    const [activeView, setActiveView] = useState('vms');
    const [vmTab, setVmTab] = useState('CPU VMs');
    const [activeRegion, setActiveRegion] = useState('ap-south');

    // --- REGION DETECTION ---
    React.useEffect(() => {
        const locale = navigator.language || 'en-US';
        if (locale.includes('IN')) {
            setActiveRegion('ap-south');
        } else if (locale.includes('DE') || locale.includes('FR') || locale.includes('IT') || locale.includes('ES')) {
            setActiveRegion('eu-west');
        } else {
            setActiveRegion('us-east');
        }
    }, []);

    const filteredVMs = React.useMemo(() => VM_DATA[vmTab], [vmTab]);

    return (
        <div className="min-h-screen bg-[#050505] text-white pt-28 pb-20 px-4 md:px-8 relative overflow-hidden font-sans">
            <RacingLines />

            <div className="max-w-[1400px] mx-auto relative z-10">

                {/* --- F1 HEADER --- */}
                <header className="text-center mb-24 space-y-8">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                    >
                        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-lg bg-black border border-[#3B82F6]/30 text-[10px] text-white font-black uppercase tracking-[0.5em] italic shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                            <Activity size={14} className="text-[#06B6D4] animate-pulse" /> Telemetry Active
                        </div>
                        <h1 className="text-8xl md:text-[13rem] font-black italic tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-[#06B6D4] filter drop-shadow-[0_10px_30px_rgba(59,130,246,0.2)]">
                            IQ<span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A855F7] to-[#06B6D4]">.</span>
                        </h1>
                        <p className="text-zinc-400 max-w-2xl mx-auto text-lg md:text-xl font-black italic uppercase tracking-[0.2em] opacity-90 leading-relaxed">
                            <span className="text-white">Ultra-Performance</span> Neural Infrastructure. <br />
                            Precision Engineered for the <span className="text-[#3B82F6]">PERFORMANCE</span> Generation of AI.
                        </p>
                    </motion.div>

                    {/* Countdown Lights Effect */}
                    <motion.div
                        className="flex gap-4 justify-center py-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                    >
                        {[0, 1, 2, 3, 4].map((i) => (
                            <motion.div
                                key={i}
                                className="w-4 h-4 rounded-full border-2 border-[#3B82F6]/50"
                                initial={{ backgroundColor: 'transparent' }}
                                animate={{
                                    backgroundColor: ['transparent', '#3B82F6', '#06B6D4', 'transparent'],
                                    boxShadow: ['0 0 0 rgba(59,130,246,0)', '0 0 20px rgba(6,182,212,0.8)', '0 0 20px rgba(6,182,212,0.8)', '0 0 0 rgba(59,130,246,0)']
                                }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    delay: i * 0.5,
                                    times: [0, 0.1, 0.5, 0.6]
                                }}
                            />
                        ))}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto"
                    >
                        <StatCard icon={Database} label="Tank Volume" value="2.5 PB" color="bg-brand-purple" />
                        <StatCard icon={Zap} label="Aero Speed" value="800 Gbps" color="bg-red-500" />
                        <StatCard icon={Cpu} label="Engine Blocks" value="12 Nodes" color="bg-zinc-100" />
                        <StatCard icon={Clock} label="Reaction Time" value="< 1ms" color="bg-brand-purple" />
                    </motion.div>

                    <div className="flex justify-center gap-4 pt-8">
                        <div className="relative group">
                            <button disabled className="bg-zinc-800 border border-zinc-700 text-zinc-500 px-12 py-5 rounded-lg font-black text-xs uppercase tracking-[0.3em] italic cursor-not-allowed transform skew-x-[-10deg]">
                                <span className="inline-block skew-x-[10deg]">Service Pre-Launch</span>
                            </button>
                            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-white text-black text-[8px] px-3 py-1 font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap">
                                Registration Opens Q1 2026
                            </div>
                        </div>
                    </div>
                </header>

                {/* --- DASHBOARD NAVIGATION --- */}
                <div className="sticky top-24 z-40 mb-16 flex flex-col items-center gap-6 py-6 border-y border-white/5 bg-black/60 backdrop-blur-3xl px-6 rounded-2xl transform skew-x-[-2deg]">
                    <div className="flex flex-wrap justify-center gap-4 skew-x-[2deg]">
                        <ModuleButton
                            icon={Maximize2}
                            label="PRO COMPUTE"
                            active={activeView === 'vms'}
                            onClick={() => setActiveView('vms')}
                            count={VM_DATA['CPU VMs'].length + VM_DATA['GPU VMs'].length}
                        />
                        <ModuleButton
                            icon={Layers}
                            label="NEURAL PODS"
                            active={activeView === 'pods'}
                            onClick={() => setActiveView('pods')}
                            count={POD_DATA.length}
                        />
                        <div className="w-px h-8 bg-white/10 hidden md:block mx-2"></div>
                        <RegionSelector activeRegion={activeRegion} setActiveRegion={setActiveRegion} />
                    </div>

                    {activeView === 'vms' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex gap-2 p-1 bg-zinc-900 rounded-lg border border-white/5 skew-x-[2deg]"
                        >
                            {Object.keys(VM_DATA).map(key => (
                                <button
                                    key={key}
                                    onClick={() => setVmTab(key)}
                                    className={`px-4 py-2 text-[9px] font-black uppercase tracking-[0.2em] italic rounded transition-all ${vmTab === key ? 'bg-brand-purple text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                                >
                                    {key}
                                </button>
                            ))}
                        </motion.div>
                    )}
                </div>

                {/* --- RACING GRID --- */}
                <main className="space-y-16">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6 pb-4 border-b-2 border-zinc-900 italic">
                        <div>
                            <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase">
                                {activeView === 'vms' ? vmTab : 'NEURAL PODS'}
                                <span className="text-brand-purple ml-2">CONFIG</span>
                            </h2>
                            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                                Sector: {REGIONS.find(r => r.id === activeRegion).name} / LIVE FEED
                            </p>
                        </div>
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3B82F6]" size={16} />
                            <input
                                type="text"
                                placeholder="FILTER BY ENGINE SPEC..."
                                className="w-full bg-black border-2 border-white/5 rounded-xl py-4 pl-12 pr-4 text-[11px] font-black tracking-[0.3em] uppercase focus:outline-none focus:border-[#3B82F6] transition-all placeholder:text-zinc-700 italic text-white shadow-2xl"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeView === 'pods' ? (
                            POD_DATA.map((pod, idx) => (
                                <motion.div
                                    key={pod.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.03 }}
                                >
                                    <InfrastructureCard type="pod" data={pod} activeRegion={activeRegion} />
                                </motion.div>
                            ))
                        ) : (
                            filteredVMs.map((vm, idx) => (
                                <motion.div
                                    key={vm.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.03 }}
                                >
                                    <InfrastructureCard
                                        type={vmTab === 'CPU VMs' ? 'cpu-vm' : (vmTab === 'GPU VMs' ? 'gpu-vm' : 'baremetal')}
                                        data={vm}
                                        activeRegion={activeRegion}
                                    />
                                </motion.div>
                            ))
                        )}
                    </div>
                </main>

                {/* --- ACADEMY INTEGRATION LINK --- */}
                <div className="mt-32 mb-16 text-center">
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
                        RECOMMENDED DIAGNOSTICS
                    </p>
                    <button
                        onClick={() => navigate('/academy#reality-check')}
                        className="text-zinc-400 hover:text-white transition-colors text-sm font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-3 mx-auto group"
                    >
                        <span>Know where are you now on retention</span>
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform text-[#3B82F6]" />
                    </button>
                </div>

                {/* --- FOOTER PIT STRATEGY --- */}
                <section className="mt-48 py-20 bg-zinc-950 border border-white/5 rounded-[2rem] text-center relative overflow-hidden transform skew-y-[-1deg]">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-purple to-transparent"></div>
                    <div className="relative z-10 space-y-8 skew-y-[1deg]">
                        <div className="w-16 h-16 rounded-full bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center mx-auto mb-6">
                            <Terminal size={32} className="text-brand-purple" />
                        </div>
                        <h2 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white uppercase leading-none">
                            GET ON THE <span className="text-brand-purple">STARTING GRID.</span>
                        </h2>
                        <p className="text-zinc-500 max-w-xl mx-auto text-sm font-black uppercase tracking-[0.2em] italic">
                            The race to enterprise-grade AI begins Q1 2026. <br />
                            Documentation and API access protocols coming soon.
                        </p>
                        <div className="pt-6 flex justify-center gap-6">
                            <button disabled className="bg-zinc-800 text-zinc-600 px-10 py-5 rounded-lg font-black text-xs uppercase tracking-[0.3em] italic border border-zinc-700 cursor-not-allowed">
                                CREATE PIT PASS
                            </button>
                            <button className="bg-transparent border border-white/10 text-white px-10 py-5 rounded-lg font-black text-xs uppercase tracking-[0.3em] italic hover:bg-white/5 transition-all">
                                TECHNICAL SPECS
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default IQ;
