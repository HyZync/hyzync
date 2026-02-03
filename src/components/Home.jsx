import React from 'react';
import Hero from './Hero';
import Features from './Features';
import HowItWorks from './HowItWorks';
import Stats from './Stats';
import RetentionVisual from './RetentionVisual';
import Contact from './Contact';
import HorizonStandalone from './HorizonStandalone';
import SectionWrapper from './SectionWrapper';
import Partners from './Partners';
import IQteaser from './IQteaser';


const Home = () => {
    return (
        <div className="flex flex-col gap-0 md:gap-12">
            <Hero />

            <SectionWrapper>
                <Features />
            </SectionWrapper>

            <SectionWrapper>
                <RetentionVisual />
            </SectionWrapper>

            <SectionWrapper>
                <HorizonStandalone />
            </SectionWrapper>

            <SectionWrapper>
                <HowItWorks />
            </SectionWrapper>

            <SectionWrapper>
                <Stats />
            </SectionWrapper>

            <IQteaser />
            <Partners />


            <SectionWrapper>
                <Contact />
            </SectionWrapper>
        </div>
    );
};

export default Home;
