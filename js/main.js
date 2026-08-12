// ============================================
// WEI XING MACHINERY - Main JavaScript
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        const isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');
        const openLabel = isChinese ? '打开导航菜单' : 'Open navigation menu';
        const closeLabel = isChinese ? '关闭导航菜单' : 'Close navigation menu';

        function setMobileMenu(open, returnFocus) {
            mobileMenuBtn.classList.toggle('active', open);
            mobileMenu.classList.toggle('active', open);
            mobileMenuBtn.setAttribute('aria-expanded', String(open));
            mobileMenuBtn.setAttribute('aria-label', open ? closeLabel : openLabel);
            mobileMenu.setAttribute('aria-hidden', String(!open));
            mobileMenu.toggleAttribute('inert', !open);
            document.body.style.overflow = open ? 'hidden' : '';

            if (open) {
                const firstControl = mobileMenu.querySelector('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (firstControl) firstControl.focus();
            } else if (returnFocus) {
                mobileMenuBtn.focus();
            }
        }

        mobileMenuBtn.addEventListener('click', function() {
            setMobileMenu(!mobileMenu.classList.contains('active'), false);
        });

        // Close on link click
        mobileMenu.querySelectorAll('a').forEach(function(link) {
            link.addEventListener('click', function() {
                setMobileMenu(false, false);
            });
        });

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape' && mobileMenu.classList.contains('active')) {
                setMobileMenu(false, true);
            }
        });

        window.addEventListener('resize', function() {
            if (window.innerWidth > 768 && mobileMenu.classList.contains('active')) {
                setMobileMenu(false, false);
            }
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
            const target = parseInt(counter.dataset.target, 10);
            if (prefersReducedMotion) {
                counter.textContent = target >= 1000 ? target.toLocaleString() : target;
                return;
            }
            const duration = 2000;
            const start = performance.now();

            function formatValue(value) {
                return target >= 1000 ? value.toLocaleString() : value;
            }

            counter.textContent = formatValue(0);

            function update(now) {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                // Ease out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const value = progress === 1 ? target : Math.floor(eased * target);

                counter.textContent = formatValue(value);

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


    if (prefersReducedMotion) {
        document.querySelectorAll('.fade-in').forEach(function(el) { el.classList.add('visible'); });
    } else {
        window.addEventListener('scroll', handleFadeIn);
        handleFadeIn(); // Initial check
    }

    // --- Smooth scroll for anchor links ---
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
        anchor.addEventListener('click', function(e) {
            const selector = this.getAttribute('href');
            const target = document.querySelector(selector);
            if (!target) return;

            e.preventDefault();
            if (this.classList.contains('skip-link')) {
                target.focus({ preventScroll: true });
            }
            target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
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
            images.forEach(function(img) {
                img.classList.remove('active');
                img.setAttribute('aria-hidden', 'true');
            });
            dots.forEach(function(dot) {
                dot.classList.remove('active');
                dot.setAttribute('aria-current', 'false');
            });
            if (images[index]) {
                images[index].classList.add('active');
                images[index].setAttribute('aria-hidden', 'false');
            }
            if (dots[index]) {
                dots[index].classList.add('active');
                dots[index].setAttribute('aria-current', 'true');
            }
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
        gallery.addEventListener('keydown', function(event) {
            if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
            if (event.key === 'ArrowLeft') showImage(current > 0 ? current - 1 : images.length - 1);
            else if (event.key === 'ArrowRight') showImage(current < images.length - 1 ? current + 1 : 0);
            else if (event.key === 'Home') showImage(0);
            else if (event.key === 'End') showImage(images.length - 1);
            else return;
            event.preventDefault();
        });
    }

});
