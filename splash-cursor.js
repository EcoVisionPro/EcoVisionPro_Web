// ================================================================
// SIMPLE SPLASH CURSOR - Works Everywhere!
// Beautiful colorful trails that follow your mouse
// ================================================================

(function initSplashCursor() {
    const canvas = document.getElementById('fluidCursor');
    if (!canvas) {
        console.error('Canvas element not found!');
        return;
    }

    const ctx = canvas.getContext('2d');

    // Set canvas size to window
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle system
    const particles = [];
    let mouseX = 0;
    let mouseY = 0;

    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 4;
            this.vy = (Math.random() - 0.5) * 4;
            this.life = 1;
            this.size = Math.random() * 3 + 2;

            // Random colors
            const colors = [
                { r: 78, g: 205, b: 196 },   // Cyan
                { r: 255, g: 230, b: 109 },  // Yellow
                { r: 255, g: 107, b: 107 },  // Pink
                { r: 100, g: 200, b: 255 },  // Blue
                { r: 150, g: 100, b: 255 }   // Purple
            ];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.1; // gravity
            this.life -= 0.02;
            this.vx *= 0.99; // friction
        }

        draw(ctx) {
            ctx.globalAlpha = this.life;
            ctx.fillStyle = \`rgb(\${this.color.r}, \${this.color.g}, \${this.color.b})\`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Mouse move listener
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        // Create particles
        for (let i = 0; i < 2; i++) {
            particles.push(new Particle(mouseX, mouseY));
        }
    });

    // Mouse click listener - bigger splash
    document.addEventListener('mousedown', (e) => {
        for (let i = 0; i < 15; i++) {
            particles.push(new Particle(e.clientX, e.clientY));
        }
    });

    // Touch support
    document.addEventListener('touchmove', (e) => {
        const touch = e.touches[0];
        mouseX = touch.clientX;
        mouseY = touch.clientY;

        for (let i = 0; i < 2; i++) {
            particles.push(new Particle(mouseX, mouseY));
        }
    });

    // Animation loop
    function animate() {
        // Clear with transparency
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update and draw particles
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw(ctx);

            // Remove dead particles
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        ctx.globalAlpha = 1;
        requestAnimationFrame(animate);
    }

    animate();
    console.log('✨ Splash Cursor Loaded - Move your mouse!');
})();
