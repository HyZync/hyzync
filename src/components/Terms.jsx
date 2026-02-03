import React from 'react';

const Terms = () => {
    return (
        <section className="pt-40 pb-20 px-6 max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
            <p className="text-secondary mb-12">Effective Date: February 1, 2026</p>

            <div className="space-y-8 text-secondary leading-relaxed">
                <p>
                    Welcome to Hyzync. By looking at our website or using our services, you agree to these Terms of Service.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Services</h2>
                <p>
                    Hyzync provides strategic customer retention consulting and data analytics services powered by our proprietary Horizon engine.
                    Specific deliverables are defined in individual statements of work (SOWs).
                </p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Intellectual Property</h2>
                <p>
                    All content, branding, and the Horizon analytics engine are the exclusive property of Hyzync.
                    Clients retain ownership of their raw data.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Limitation of Liability</h2>
                <p>
                    While we strive for accuracy, Hyzync is not liable for business decisions made based on our analysis.
                    Our consulting advice is provided "as is" without warranty of any kind.
                </p>
            </div>
        </section>
    );
};

export default Terms;
