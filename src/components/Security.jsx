import React from 'react';
import { Shield, Lock, FileCheck, Server } from 'lucide-react';

const Security = () => {
    return (
        <section className="pt-40 pb-20 px-6 max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16">
                <div className="w-16 h-16 rounded-2xl bg-brand-green/10 flex items-center justify-center text-brand-green mx-auto mb-6">
                    <Shield size={32} />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-6">
                    Enterprise-Grade <span className="text-gradient">Security</span>
                </h1>
                <p className="text-xl text-secondary">
                    Your data is your most valuable asset. We protect it with the highest standards of compliance and encryption.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
                <SecurityCard
                    icon={FileCheck}
                    title="SOC 2 Type II Compliant"
                    description="We successfully complete annual SOC 2 Type II audits, verifying our security, availability, and confidentiality controls."
                    tag="Audited"
                />
                <SecurityCard
                    icon={Lock}
                    title="GDPR & CCPA Ready"
                    description="Our data processing structure is fully compliant with GDPR, CCPA, and CPRA regulations for global data privacy."
                    tag="Compliant"
                />
                <SecurityCard
                    icon={Server}
                    title="End-to-End Encryption"
                    description="All data is encrypted in transit (TLS 1.2+) and at rest (AES-256) within our secure cloud infrastructure."
                    tag="Encrypted"
                />
            </div>

            <div className="glass-card p-10 max-w-4xl mx-auto">
                <h3 className="text-2xl font-bold text-white mb-6">Compliance & Certifications</h3>
                <div className="flex flex-wrap gap-4 items-center justify-center opacity-80">
                    <div className="py-2 px-6 rounded-lg bg-white-5 border border-white-10 font-bold text-white">SOC 2 Type II</div>
                    <div className="py-2 px-6 rounded-lg bg-white-5 border border-white-10 font-bold text-white">GDPR</div>
                    <div className="py-2 px-6 rounded-lg bg-white-5 border border-white-10 font-bold text-white">CCPA</div>
                    <div className="py-2 px-6 rounded-lg bg-white-5 border border-white-10 font-bold text-white">ISO 27001</div>
                </div>
            </div>
        </section>
    );
};

const SecurityCard = ({ icon: Icon, title, description, tag }) => (
    <div className="glass-card p-8 relative overflow-hidden group hover:border-brand-green/30 transition-colors">
        <div className="absolute top-4 right-4 text-xs font-bold py-1 px-3 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20">
            {tag}
        </div>
        <div className="mb-6 text-brand-green">
            <Icon size={32} />
        </div>
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-secondary leading-relaxed">{description}</p>
    </div>
);

export default Security;
