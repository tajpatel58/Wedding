/**
 * Taj × Radhika — Wedding Keepsake
 * Vanilla JS only. No dependencies. Organised as small, single-purpose
 * modules that each own one piece of behaviour and fail safely if their
 * target elements aren't present.
 */
(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;

  /* ------------------------------------------------------------------
     1. PRELOADER
     Waits for the hero image to be ready (or a timeout, whichever is
     first) so the reveal never feels stuck on a slow connection.
  ------------------------------------------------------------------ */
  function initLoader() {
    const loader = document.getElementById("loader");
    const heroImage = document.getElementById("heroImage");
    if (!loader) return;

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      loader.setAttribute("data-loaded", "true");
      window.setTimeout(() => {
        loader.setAttribute("data-hidden", "true");
        document.body.style.overflow = "";
      }, reducedMotion ? 50 : 650);
    };

    document.body.style.overflow = "hidden";

    if (heroImage && heroImage.complete) {
      release();
    } else if (heroImage) {
      heroImage.addEventListener("load", release, { once: true });
      heroImage.addEventListener("error", release, { once: true });
    }
    // Safety net: never block the experience for more than 2.5s.
    window.setTimeout(release, 2500);
  }

  /* ------------------------------------------------------------------
     2. SCROLL PROGRESS RAIL
     A hairline on the page edge in place of a traditional scrollbar.
  ------------------------------------------------------------------ */
  function initProgressRail() {
    const fill = document.getElementById("progressFill");
    if (!fill) return;

    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const pct = scrollable > 0 ? (doc.scrollTop / scrollable) * 100 : 0;
      fill.style.height = pct + "%";
      ticking = false;
    };

    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    update();
  }

  /* ------------------------------------------------------------------
     3. DYNAMIC HEADER
     Hidden over the hero; fades in once the hero has scrolled past;
     dims slightly whenever a full-bleed image/video section is in
     view so it never fights the photography for attention.
  ------------------------------------------------------------------ */
  function initHeader() {
    const header = document.getElementById("siteHeader");
    const hero = document.getElementById("hero");
    if (!header || !hero) return;

    const heroObserver = new IntersectionObserver(([entry]) => {
      header.setAttribute("data-visible", entry.isIntersecting ? "false" : "true");
    }, { threshold: 0.1 });
    heroObserver.observe(hero);

    const dimTargets = document.querySelectorAll(".break, .film, .closing");
    if (dimTargets.length) {
      const dimObserver = new IntersectionObserver((entries) => {
        const anyDim = entries.some((e) => e.isIntersecting);
        header.setAttribute("data-dim", anyDim ? "true" : "false");
      }, { threshold: 0.6 });
      dimTargets.forEach((el) => dimObserver.observe(el));
    }
  }

  /* ------------------------------------------------------------------
     4. SCROLL-TRIGGERED REVEALS
     A single Intersection Observer drives every [data-reveal] element.
  ------------------------------------------------------------------ */
  function initReveals() {
    const targets = document.querySelectorAll("[data-reveal]");
    if (!targets.length) return;

    if (reducedMotion || !("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });

    targets.forEach((el) => observer.observe(el));
  }

  /* ------------------------------------------------------------------
     5. LAZY, INTENTIONAL VIDEO LOADING
     Trailers only fetch their source shortly before entering the
     viewport, and only actually play once the visitor asks for them.
  ------------------------------------------------------------------ */
  function initFilmSections() {
    const wraps = document.querySelectorAll("[data-video-wrap]");
    if (!wraps.length) return;

    const loadSource = (video) => {
      if (video.dataset.loaded === "true") return;
      const src = video.dataset.src;
      if (src) {
        video.querySelectorAll("source").forEach((s) => {
          if (s.dataset.src) s.src = s.dataset.src;
        });
        video.src = src;
        video.load();
        video.dataset.loaded = "true";
      }
    };

    // Fetch the source shortly before the player reaches the viewport.
    const loadObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const video = entry.target.querySelector("video");
          if (video) loadSource(video);
          loadObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "600px 0px 600px 0px" });

    wraps.forEach((wrap) => loadObserver.observe(wrap));

    // Play on request; pause automatically once scrolled well out of view.
    wraps.forEach((wrap) => {
      const video = wrap.querySelector("video");
      const button = wrap.querySelector("[data-play-button]");
      if (!video || !button) return;

      const play = () => {
        loadSource(video);
        video.play().then(() => {
          wrap.setAttribute("data-started", "true");
          video.setAttribute("data-playing", "true");
        }).catch(() => {
          // Autoplay/interaction was blocked; controls remain available.
        });
      };

      button.addEventListener("click", play);
      video.addEventListener("play", () => {
        wrap.setAttribute("data-started", "true");
        video.setAttribute("data-playing", "true");
      });
      video.addEventListener("pause", () => video.setAttribute("data-playing", "false"));

      const pauseObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && !video.paused) video.pause();
        });
      }, { threshold: 0 });
      pauseObserver.observe(wrap);
    });
  }

  /* ------------------------------------------------------------------
     6. NEVER-SEEN PHOTO CAROUSEL
     Native horizontal scrolling keeps touch interaction natural while
     buttons, dots, and keyboard controls make the sequence accessible.
  ------------------------------------------------------------------ */
  function initNeverSeenCarousel() {
    const carousels = document.querySelectorAll("[data-carousel]");
    if (!carousels.length) return;

    carousels.forEach((carousel) => {
      const track = carousel.querySelector("[data-carousel-track]");
      const slides = [...carousel.querySelectorAll(".never-seen__slide")];
      const prev = carousel.querySelector("[data-carousel-prev]");
      const next = carousel.querySelector("[data-carousel-next]");
      const dots = carousel.querySelector("[data-carousel-dots]");
      if (!track || !slides.length || !prev || !next || !dots) return;

      let activeIndex = 0;
      const update = () => {
        const dotButtons = dots.querySelectorAll("button");
        dotButtons.forEach((dot, index) => dot.setAttribute("aria-current", String(index === activeIndex)));
        prev.disabled = activeIndex === 0;
        next.disabled = activeIndex === slides.length - 1;
      };

      const goTo = (index) => {
        activeIndex = Math.max(0, Math.min(index, slides.length - 1));
        slides[activeIndex].scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
        update();
      };

      slides.forEach((_, index) => {
        const dot = document.createElement("button");
        dot.className = "never-seen__dot";
        dot.type = "button";
        dot.setAttribute("aria-label", `Show photograph ${index + 1}`);
        dot.addEventListener("click", () => goTo(index));
        dots.appendChild(dot);
      });

      prev.addEventListener("click", () => goTo(activeIndex - 1));
      next.addEventListener("click", () => goTo(activeIndex + 1));
      track.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") goTo(activeIndex - 1);
        if (event.key === "ArrowRight") goTo(activeIndex + 1);
      });

      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          activeIndex = slides.indexOf(visible.target);
          update();
        }
      }, { root: track, threshold: [0.6] });
      slides.forEach((slide) => observer.observe(slide));
      update();
    });
  }

  /* ------------------------------------------------------------------
     7. HERO SCROLL CUE
     Smooth-scrolls to the intro section on click/keyboard activation.
  ------------------------------------------------------------------ */
  function initScrollCue() {
    const cue = document.getElementById("scrollCue");
    const intro = document.getElementById("intro");
    if (!cue || !intro) return;
    cue.addEventListener("click", () => {
      intro.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  }

  /* ------------------------------------------------------------------
      8. SUBTLE HERO PARALLAX
     Desktop-only, capped, and skipped entirely under reduced motion.
  ------------------------------------------------------------------ */
  function initParallax() {
    if (reducedMotion || isTouch) return;
    const heroImage = document.getElementById("heroImage");
    const hero = document.getElementById("hero");
    if (!heroImage || !hero) return;

    let ticking = false;
    const update = () => {
      const rect = hero.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        const offset = Math.max(-1, Math.min(1, rect.top / window.innerHeight));
        heroImage.style.transform = `translateY(${offset * -30}px) scale(1.06)`;
      }
      ticking = false;
    };

    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
      9. PREMIUM CURSOR RING
     Desktop-only decorative cursor that grows over interactive elements.
  ------------------------------------------------------------------ */
  function initCursor() {
    if (isTouch || reducedMotion) return;
    const ring = document.getElementById("cursorRing");
    if (!ring) return;

    let raf = null;
    let x = 0, y = 0;

    window.addEventListener("pointermove", (e) => {
      x = e.clientX;
      y = e.clientY;
      ring.setAttribute("data-active", "true");
      if (!raf) {
        raf = window.requestAnimationFrame(() => {
          ring.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
          raf = null;
        });
      }
    }, { passive: true });

    document.addEventListener("pointerleave", () => ring.setAttribute("data-active", "false"));

    const hoverTargets = document.querySelectorAll("a, button, [data-video-wrap]");
    hoverTargets.forEach((el) => {
      el.addEventListener("pointerenter", () => ring.setAttribute("data-hover", "true"));
      el.addEventListener("pointerleave", () => ring.setAttribute("data-hover", "false"));
    });
  }

  /* ------------------------------------------------------------------
     Boot
  ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    initLoader();
    initProgressRail();
    initHeader();
    initReveals();
    initFilmSections();
    initNeverSeenCarousel();
    initScrollCue();
    initParallax();
    initCursor();
  });
})();
