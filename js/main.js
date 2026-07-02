// ============================================
// WEI XING MACHINERY - Main JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    // --- Header scroll effect ---
    const header = document.getElementById('header');
    let lastScroll = 0;

    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        if (currentScroll > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        lastScroll = currentScroll;
    });

    // --- Mobile menu toggle ---
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function() {
            this.classList.toggle('active');
            mobileMenu.classList.toggle('active');
            document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
        });

        // Close on link click
        mobileMenu.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                mobileMenuBtn.classList.remove('active');
                mobileMenu.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // --- Animated counters ---
    function animateCounters() {
        const counters = document.querySelectorAll('.stat-number[data-target]');
        counters.forEach(function(counter) {
            if (counter.dataset.animated) return;

            const rect = counter.getBoundingClientRect();
            if (rect.top > window.innerHeight || rect.bottom < 0) return;

            counter.dataset.animated = 'true';
            const target = parseInt(counter.dataset.target);
            const duration = 2000;
            const start = performance.now();

            function update(now) {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const value = Math.floor(eased * target);

                if (target >= 1000) {
                    counter.textContent = value.toLocaleString();
                } else {
                    counter.textContent = value;
                }

                if (progress < 1) {
                    requestAnimationFrame(update);
                }
            }
            requestAnimationFrame(update);
        });
    }

    window.addEventListener('scroll', animateCounters);
    animateCounters(); // Initial check

    // --- Fade-in on scroll ---
    function handleFadeIn() {
        const elements = document.querySelectorAll('.fade-in');
        elements.forEach(function(el) {
            if (el.classList.contains('visible')) return;

            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 80) {
                el.classList.add('visible');

                if (el.dataset.fadeDelay) {
                    const transitionDelay = parseFloat(el.dataset.fadeDelay) * 1000;
                    window.setTimeout(function() {
                        el.style.transitionDelay = '';
                    }, transitionDelay + 700);
                }
            }
        });
    }

    // Add fade-in class to sections
    document.querySelectorAll('.product-card, .why-card, .process-step, .app-card, .cert-item, .value-card').forEach(function(el) {
        el.classList.add('fade-in');
    });

    // Stagger value cards to match the homepage image-card reveal rhythm.
    document.querySelectorAll('.values-grid .value-card').forEach(function(el, index) {
        const delay = index * 0.15;
        el.dataset.fadeDelay = delay.toString();
        el.style.transitionDelay = delay + 's';
    });

    window.addEventListener('scroll', handleFadeIn);
    handleFadeIn(); // Initial check

    // --- Smooth scroll for anchor links ---
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // --- Product Gallery Carousel ---
    var gallery = document.querySelector('.product-gallery');
    if (gallery) {
        var images = gallery.querySelectorAll('img');
        var dots = gallery.querySelectorAll('.gallery-dot');
        var prevBtn = gallery.querySelector('.gallery-prev');
        var nextBtn = gallery.querySelector('.gallery-next');
        var current = 0;

        function showImage(index) {
            images.forEach(function(img) { img.classList.remove('active'); });
            dots.forEach(function(dot) { dot.classList.remove('active'); });
            if (images[index]) images[index].classList.add('active');
            if (dots[index]) dots[index].classList.add('active');
            current = index;
        }

        if (prevBtn) prevBtn.addEventListener('click', function() {
            showImage(current > 0 ? current - 1 : images.length - 1);
        });
        if (nextBtn) nextBtn.addEventListener('click', function() {
            showImage(current < images.length - 1 ? current + 1 : 0);
        });
        dots.forEach(function(dot, i) {
            dot.addEventListener('click', function() { showImage(i); });
        });

        // Auto-rotate every 4 seconds
        setInterval(function() {
            showImage(current < images.length - 1 ? current + 1 : 0);
        }, 4000);
    }

});
