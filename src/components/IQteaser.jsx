import React from 'react';
import { motion } from 'framer-motion';
import { Zap, ChevronRight, Activity, Gauge, Flag } from 'lucide-react';
import { Link } from 'react-router-dom';

const IQteaser = () => {
    return (
        <section className="py-24 px-6 relative overflow-hidden bg-[#050505]">
            {/* Background Racing Lines */}
            <div className="absolute top-0 left-0 w-full h-full opacity-[0.04] pointer-events-none"
                style={{ backgroundImage: 'repeating-linear-gradient(45deg, #E80020 0, #E80020 1px, transparent 0, transparent 50px)', backgroundSize: '100% 100%' }}>
            </div>

            <div className="max-w-7xl mx-auto">
                <div className="relative group cursor-pointer">
                    <Link to="/iq">
                        <motion.div
                            whileHover={{ scale: 1.01, rotate: -0.5, borderColor: '#E80020' }}
                            className="bg-zinc-900/80 backdrop-blur-xl border-2 border-white/5 rounded-2xl p-8 md:p-12 overflow-hidden relative group shadow-2xl transition-all duration-300"
                        >
                            {/* Ferrari Accent Bar */}
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#E80020] shadow-[0_2px_15px_rgba(232,0,32,0.3)]"></div>

                            {/* Carbon Fiber Texture Simulation */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)', backgroundSize: '15px 15px' }}>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
                                <div className="space-y-8">
                                    <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-lg bg-black border border-[#E80020]/20 text-[9px] text-white font-black uppercase tracking-[0.4em] italic">
                                        <Activity size={12} className="text-[#E80020] animate-pulse" /> Telemetry Active
                                    </div>

                                    <h2 className="text-5xl md:text-7xl font-black italic tracking-tighter text-white uppercase leading-none">
                                        IQ <span className="text-[#E80020]">PRECISION.</span>
                                    </h2>

                                    <p className="text-lg text-zinc-400 font-black italic uppercase tracking-widest leading-relaxed max-w-lg opacity-90">
                                        <span className="text-white">World-class</span> performance infrastructure. <br />
                                        Precision engineered for <span className="text-[#E80020]">elite</span> AI workloads.
                                    </p>

                                    <div className="flex items-center gap-8 pt-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-[#E80020] uppercase tracking-[0.4em] font-black italic mb-1">AERO SPEED</span>
                                            <span className="text-3xl font-black text-white italic tracking-tighter uppercase">800 Gbps</span>
                                        </div>
                                        <div className="w-px h-12 bg-zinc-800"></div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-[#FFEB00] uppercase tracking-[0.4em] font-black italic mb-1">REACTION</span>
                                            <span className="text-3xl font-black text-white italic tracking-tighter uppercase">&lt; 1ms</span>
                                        </div>
                                    </div>

                                    <div className="pt-6">
                                        <span className="inline-flex items-center gap-4 text-[#E80020] font-black text-sm group-hover:gap-6 transition-all italic uppercase tracking-[0.4em]">
                                            ENTER THE STARTING GRID <ChevronRight size={20} />
                                        </span>
                                    </div>
                                </div>

                                <div className="relative">
                                    {/* Racing HUD Style Visual */}
                                    <div className="bg-black/80 border-2 border-white/5 rounded-2xl p-10 aspect-video relative overflow-hidden group-hover:border-[#E80020]/50 transition-all duration-500 transform skew-x-[-2deg] shadow-inner font-sans">
                                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                            <Flag size={180} className="text-white transform skew-x-[2deg]" strokeWidth={0.5} />
                                        </div>

                                        {/* Telemetry HUD Elements */}
                                        <div className="relative z-10 h-full flex flex-col justify-between italic font-black">
                                            <div className="flex justify-between items-start text-[9px] tracking-[0.4em] text-[#E80020] uppercase">
                                                <span>SECTOR_01: NOMINAL</span>
                                                <span className="text-[#FFEB00]">HEAT: 42°C</span>
                                            </div>

                                            <div className="flex-grow flex items-center justify-center">
                                                <div className="relative flex flex-col items-center">
                                                    <Gauge size={80} className="text-white mb-3" strokeWidth={1} />
                                                    <div className="text-5xl tracking-tighter text-white">100%</div>
                                                    <div className="text-[8px] tracking-[0.6em] text-zinc-500 uppercase mt-1">LOAD_FACTOR</div>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-end text-[9px] tracking-[0.4em] text-white uppercase">
                                                <span>ENGINE_V12: <span className="text-[#FFEB00]">READY</span></span>
                                                <span className="text-[#E80020]">RPM: 18,500</span>
                                            </div>
                                        </div>

                                        {/* Scanning Line Effect */}
                                        <motion.div
                                            animate={{ top: ['-10%', '110%'] }}
                                            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                            className="absolute left-0 w-full h-2 bg-[#E80020]/30 blur-md pointer-events-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default IQteaser;
