import React from 'react';

const Privacy = () => {
    return (
        <section className="pt-40 pb-20 px-6 max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-secondary mb-12">Last Updated: February 2026</p>

            <div className="space-y-12 text-secondary leading-relaxed">
                <div className="glass-card p-8">
                    <h2 className="text-2xl font-bold text-white mb-4">1. Data Collection & Usage</h2>
                    <p>
                        At Hyzync, we take data privacy seriously. We collect only necessary information to provide our services.
                        This includes contact information when you request a consultation and usage data when you interact with our website.
                    </p>
                </div>

                <div className="glass-card p-8 border-l-4 border-brand-purple">
                    <h2 className="text-2xl font-bold text-white mb-4">CCPA & CPRA (California Privacy Rights)</h2>
                    <p className="mb-4">
                        Under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA), California residents have specific rights regarding their personal data:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Right to Know:</strong> You may request details about the categories and specific pieces of personal information we collect.</li>
                        <li><strong>Right to Delete:</strong> You may request the deletion of your personal information, subject to certain exceptions.</li>
                        <li><strong>Right to Opt-Out:</strong> We do not sell your personal information. However, you have the right to opt-out of the sharing of your personal data for cross-context behavioral advertising.</li>
                        <li><strong>Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</li>
                    </ul>
                </div>

                <div className="glass-card p-8 border-l-4 border-brand-blue">
                    <h2 className="text-2xl font-bold text-white mb-4">GDPR Compliance</h2>
                    <p className="mb-4">
                        For users in the European Economic Area (EEA), we adhere to the General Data Protection Regulation (GDPR).
                        We act as both a Data Controller (for our direct clients) and a Data Processor (when analyzing client data via Horizon).
                    </p>
                    <p>
                        We ensure that all data processing is lawful, fair, and transparent. You have the right to access, rectify, or erase your personal data at any time.
                    </p>
                </div>

                <div className="glass-card p-8">
                    <h2 className="text-2xl font-bold text-white mb-4">Security Measures</h2>
                    <p>
                        We implement enterprise-grade security controls, including encryption in transit and at rest, strict access controls,
                        and regular security audits to protect your data.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default Privacy;
