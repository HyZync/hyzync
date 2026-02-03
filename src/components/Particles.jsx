import React, { useEffect, useRef } from 'react';

const Particles = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];
        let mouse = { x: null, y: null };

        const resize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.x;
            mouse.y = e.y;
        });

        class Particle {
            constructor() {
                this.reset(true);
            }

            reset(initial = false) {
                this.x = initial ? Math.random() * width : Math.random() * width;
                this.y = initial ? Math.random() * height : height + 10;
                this.vx = (Math.random() - 0.5) * 0.2; // Slower, driftier
                this.vy = -(Math.random() * 0.3 + 0.1); // Slowly rising
                this.size = Math.random() * 1.5 + 0.5; // Smaller stars
                this.baseAlpha = Math.random() * 0.5 + 0.2;
                this.alpha = this.baseAlpha;
                this.pulseSpeed = Math.random() * 0.02 + 0.005;
                this.pulseOffset = Math.random() * Math.PI * 2;
            }

            update(time) {
                this.x += this.vx;
                this.y += this.vy;

                // Gentle pulsing
                this.alpha = this.baseAlpha + Math.sin(time * this.pulseSpeed + this.pulseOffset) * 0.15;

                // Mouse interaction - drift away
                if (mouse.x != null) {
                    const dx = mouse.x - this.x;
                    const dy = mouse.y - this.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const maxDistance = 200;
                    const force = (maxDistance - distance) / maxDistance;

                    if (distance < maxDistance) {
                        this.x -= forceDirectionX * force * 2;
                        this.y -= forceDirectionY * force * 2;
                    }
                }

                // Reset when off screen
                if (this.y < -10 || this.x < -10 || this.x > width + 10) {
                    this.reset();
                }
            }

            draw() {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const init = () => {
            particles = [];
            const count = Math.min(window.innerWidth / 8, 150); // More particles, starfield density
            for (let i = 0; i < count; i++) {
                particles.push(new Particle());
            }
        };

        let time = 0;
        const animate = () => {
            time += 1;
            ctx.clearRect(0, 0, width, height);

            particles.forEach(p => {
                p.update(time);
                p.draw();
            });

            requestAnimationFrame(animate);
        };

        window.addEventListener('resize', () => {
            resize();
            init();
        });

        resize();
        init();
        animate();

        return () => {
            // Cleanup if needed
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" style={{ mixBlendMode: 'screen' }} />;
};

export default Particles;
