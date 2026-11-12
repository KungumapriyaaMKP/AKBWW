/* ============================================================
   A & K Wedding Website - Luxury Editorial JavaScript
   Scroll-driven video, bespoke audio atmosphere, editorial lightbox,
   live countdown, interactive calendar, custom cursor & confetti.
   Zero external dependencies - ultra fast & silky 60fps.
   ============================================================ */

(function () {
  'use strict';

  // ---------- Page Loader ----------
  var loader = document.getElementById('loader');
  document.body.classList.add('loading');

  // ---------- Scroll-Driven Video (Frame Sequence) ----------
  var canvas = document.getElementById('scrollCanvas');
  var ctx2d = canvas ? canvas.getContext('2d') : null;
  var scrollSection = document.querySelector('.scroll-video');
  var scrollContent = document.getElementById('scrollContent');
  var scrollOverlay = document.querySelector('.scroll-video__overlay');
  var scrollHint = document.getElementById('scrollHint');
  var petalContainer = document.querySelector('.hero__petals');

  var frameImages = [];
  var currentFrame = -1;
  var totalFrames = 0;
  var framesLoaded = 0;
  var framesReady = false;

  // Detect frame count (uses fast global count when declared)
  function detectFrameCount(callback) {
    if (typeof window.SCROLL_FRAME_COUNT === 'number' && window.SCROLL_FRAME_COUNT > 0) {
      callback(window.SCROLL_FRAME_COUNT);
      return;
    }
    var testIndex = 0;
    var maxTest = 300;
    function testNext() {
      if (testIndex >= maxTest) {
        callback(testIndex);
        return;
      }
      var img = new Image();
      var padded = String(testIndex).padStart(4, '0');
      img.onload = function () {
        testIndex++;
        testNext();
      };
      img.onerror = function () {
        callback(testIndex);
      };
      img.src = 'frames_opt/f' + padded + '.jpg';
    }
    testNext();
  }

  function initScrollVideo() {
    detectFrameCount(function (count) {
      if (count === 0) {
        if (scrollSection) {
          scrollSection.style.height = '100vh';
          var video = document.createElement('video');
          video.src = 'Seaside_wedding_venue_drone_shot_f6e5fffd_1080p.mp4';
          video.autoplay = true;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.style.cssText = 'position:sticky;top:0;left:0;width:100%;height:100vh;object-fit:cover;';
          if (canvas) canvas.style.display = 'none';
          scrollSection.insertBefore(video, scrollSection.firstChild);
          if (scrollContent) scrollContent.classList.add('visible');
          if (scrollOverlay) scrollOverlay.classList.add('active');
        }
        finishLoading();
        return;
      }

      totalFrames = count;
      loadAllFrames();
      updateScrollVideo();
    });
  }

  function loadAllFrames() {
    var loaded = 0;
    var firstFrameLoaded = false;

    for (var i = 0; i < totalFrames; i++) {
      (function (index) {
        var img = new Image();
        var padded = String(index).padStart(4, '0');
        img.src = 'frames_opt/f' + padded + '.jpg';

        img.onload = function () {
          frameImages[index] = img;
          loaded++;
          framesLoaded = loaded;

          var loaderLine = document.querySelector('.loader__line');
          if (loaderLine) {
            var pct = Math.min((loaded / totalFrames) * 100, 100);
            loaderLine.style.transform = 'scaleX(' + (pct / 100) + ')';
          }

          if (index === 0 && !firstFrameLoaded) {
            firstFrameLoaded = true;
            resizeCanvas();
            drawFrame(0);
          }

          if (loaded >= Math.min(25, totalFrames) && !framesReady) {
            framesReady = true;
            finishLoading();
          }
        };

        img.onerror = function () {
          loaded++;
          framesLoaded = loaded;
          if (loaded >= Math.min(25, totalFrames) && !framesReady) {
            framesReady = true;
            finishLoading();
          }
        };
      })(i);
    }
  }

  function resizeCanvas() {
    if (!canvas || !ctx2d) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx2d.scale(dpr, dpr);
    if (currentFrame >= 0 && frameImages[currentFrame]) {
      drawFrame(currentFrame);
    }
  }

  function drawFrame(index) {
    if (!canvas || !ctx2d) return;
    var img = frameImages[index];
    if (!img || !img.complete || !img.naturalWidth) return;

    var rect = canvas.getBoundingClientRect();
    var cW = rect.width;
    var cH = rect.height;
    var imgW = img.naturalWidth;
    var imgH = img.naturalHeight;

    var scale = Math.max(cW / imgW, cH / imgH);
    var drawW = imgW * scale;
    var drawH = imgH * scale;
    var offsetX = (cW - drawW) / 2;
    var offsetY = (cH - drawH) / 2;

    ctx2d.clearRect(0, 0, cW, cH);
    ctx2d.drawImage(img, offsetX, offsetY, drawW, drawH);
    currentFrame = index;
  }

  // ---------- Eased frame playback (silky scroll) ----------
  var targetFramePos = 0;
  var smoothFramePos = 0;
  var frameLoopRunning = false;

  // Find nearest decoded frame so playback never stalls on a still-loading frame
  function nearestLoadedFrame(idx) {
    if (frameImages[idx]) return idx;
    for (var d = 1; d < totalFrames; d++) {
      if (frameImages[idx - d]) return idx - d;
      if (frameImages[idx + d]) return idx + d;
    }
    return -1;
  }

  function frameLoop() {
    var delta = targetFramePos - smoothFramePos;
    smoothFramePos += delta * 0.14;
    if (Math.abs(delta) < 0.05) smoothFramePos = targetFramePos;

    var idx = nearestLoadedFrame(Math.round(smoothFramePos));
    if (idx >= 0 && idx !== currentFrame) drawFrame(idx);

    if (smoothFramePos !== targetFramePos) {
      requestAnimationFrame(frameLoop);
    } else {
      frameLoopRunning = false;
    }
  }

  function startFrameLoop() {
    if (!frameLoopRunning) {
      frameLoopRunning = true;
      requestAnimationFrame(frameLoop);
    }
  }

  function updateScrollVideo() {
    if (!scrollSection) return;

    var rect = scrollSection.getBoundingClientRect();
    var vh = window.innerHeight;
    var sectionTop = rect.top;
    var sectionHeight = rect.height - vh;

    var progress = sectionHeight > 0 ? -sectionTop / sectionHeight : 0;
    progress = Math.max(0, Math.min(1, progress));

    // The title, overlay, hint and petals are position:fixed, so they must be
    // explicitly hidden once the video section has scrolled out of view.
    // inSection = the sticky video still fills the screen.
    var inSection = rect.top <= 1 && rect.bottom > vh * 0.98;
    var atTop = rect.top > -vh * 0.08;

    // Drive the frame sequence (only once frames are known)
    if (totalFrames > 0) {
      targetFramePos = progress * (totalFrames - 1);
      startFrameLoop();
    }

    // Names appear just after you start scrolling and fade out before the video ends
    if (scrollContent) {
      scrollContent.classList.toggle('visible', inSection && progress > 0.03 && progress < 0.94);
    }

    if (scrollOverlay) {
      scrollOverlay.classList.toggle('active', inSection && progress > 0.05 && progress < 0.97);
    }

    // "Scroll to explore" only at the very top of the page
    if (scrollHint) {
      scrollHint.classList.toggle('hidden', !atTop || progress > 0.08);
    }

    if (petalContainer) {
      petalContainer.classList.toggle('hero__petals--hidden', !atTop || progress > 0.08);
    }
  }

  window.addEventListener('resize', resizeCanvas);

  // ---------- Finish Loading ----------
  function finishLoading() {
    if (!loader) return;
    setTimeout(function () {
      loader.classList.add('loaded');
      document.body.classList.remove('loading');
      setTimeout(function () {
        loader.style.display = 'none';
      }, 900);
    }, 400);
  }

  setTimeout(function () {
    if (!framesReady) {
      finishLoading();
    }
  }, 4000);

  // ---------- Scroll Progress Bar ----------
  var scrollProgress = document.getElementById('scrollProgress');

  function updateScrollProgress() {
    if (!scrollProgress) return;
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    scrollProgress.style.width = progress + '%';
  }

  // ---------- Parallax Scrolling ----------
  var parallaxBgs = document.querySelectorAll('.parallax-bg');

  function updateParallax() {
    var scrollY = window.scrollY;
    var vh = window.innerHeight;

    parallaxBgs.forEach(function (bg) {
      var section = bg.closest('.quote-section') || bg.parentElement;
      if (!section) return;

      var rect = section.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < vh) {
        var centerOffset = (rect.top + rect.height / 2) - vh / 2;
        var speed = 0.25;
        var translateY = centerOffset * speed;
        bg.style.transform = 'translate3d(0, ' + translateY + 'px, 0)';
      }
    });
  }

  // ---------- Timeline Line Fill ----------
  var storyTimeline = document.querySelector('.story__timeline');
  var storyLineFill = document.querySelector('.story__line-fill');

  function updateTimeline() {
    if (!storyTimeline || !storyLineFill) return;

    var rect = storyTimeline.getBoundingClientRect();
    var vh = window.innerHeight;
    var start = vh * 0.7;
    var totalHeight = rect.height;

    if (rect.top < start) {
      var scrolled = start - rect.top;
      var pct = Math.min(Math.max(scrolled / totalHeight, 0), 1) * 100;
      storyLineFill.style.height = pct + '%';
    } else {
      storyLineFill.style.height = '0%';
    }
  }

  // ---------- Unified Scroll Handler (rAF Throttled) ----------
  var ticking = false;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(function () {
        updateScrollVideo();
        updateScrollProgress();
        updateParallax();
        updateTimeline();
        highlightNav();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // ---------- Scroll Reveal (IntersectionObserver) ----------
  var revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var delay = entry.target.dataset.delay;
            if (delay) {
              entry.target.style.transitionDelay = delay + 's';
            }
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealElements.forEach(function (el) {
      el.classList.add('visible');
    });
  }

  // ---------- Tilt Card Effect (Desktop) ----------
  var tiltCards = document.querySelectorAll('.tilt-card');

  tiltCards.forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var centerX = rect.width / 2;
      var centerY = rect.height / 2;

      var rotateX = ((y - centerY) / centerY) * -5;
      var rotateY = ((x - centerX) / centerX) * 5;

      card.style.transform =
        'perspective(1000px) rotateX(' +
        rotateX +
        'deg) rotateY(' +
        rotateY +
        'deg) translateY(-8px)';
    });

    card.addEventListener('mouseleave', function () {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
    });
  });

  // ---------- Smooth Scroll for Anchor Links ----------
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#' || !targetId) return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var targetPosition = target.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    });
  });

  // ---------- Active Section Navigation Highlight ----------
  var sections = document.querySelectorAll('section[id]');
  var navLinksList = document.querySelectorAll('.nav__links a');

  function highlightNav() {
    if (!navLinksList.length) return;
    var scrollPos = window.scrollY + 140;
    sections.forEach(function (section) {
      var top = section.offsetTop;
      var height = section.offsetHeight;
      var id = section.getAttribute('id');
      if (scrollPos >= top && scrollPos < top + height) {
        navLinksList.forEach(function (link) {
          link.style.opacity = '0.6';
          if (link.getAttribute('href') === '#' + id) {
            link.style.opacity = '1';
          }
        });
      }
    });
  }

  // ============================================================
  // WORLD-CLASS BESPOKE LUXURY ENHANCEMENTS
  // ============================================================

  // ---------- 1. Desktop Luxury Custom Cursor ----------
  function initCustomCursor() {
    var dot = document.getElementById('cursorDot');
    var ring = document.getElementById('cursorRing');
    if (!dot || !ring) return;

    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      dot.style.display = 'none';
      ring.style.display = 'none';
      return;
    }

    var mouseX = window.innerWidth / 2;
    var mouseY = window.innerHeight / 2;
    var ringX = mouseX;
    var ringY = mouseY;
    var isHovered = false;

    window.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = 'translate3d(' + mouseX + 'px, ' + mouseY + 'px, 0) translate(-50%, -50%)';
    }, { passive: true });

    function renderRing() {
      ringX += (mouseX - ringX) * 0.16;
      ringY += (mouseY - ringY) * 0.16;
      var scale = isHovered ? ' scale(1.65)' : ' scale(1)';
      ring.style.transform = 'translate3d(' + ringX + 'px, ' + ringY + 'px, 0) translate(-50%, -50%)' + scale;
      requestAnimationFrame(renderRing);
    }
    requestAnimationFrame(renderRing);

    var interactiveSelectors = 'a, button, input, select, textarea, .tilt-card, .gallery__item, .audio-toggle, .events__cal-btn, .magnetic-btn';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest(interactiveSelectors)) {
        isHovered = true;
        ring.classList.add('cursor-ring--hover');
      }
    });

    document.addEventListener('mouseout', function (e) {
      if (e.target.closest(interactiveSelectors)) {
        isHovered = false;
        ring.classList.remove('cursor-ring--hover');
      }
    });

    document.addEventListener('mousedown', function () {
      dot.style.transform += ' scale(0.6)';
    });
    document.addEventListener('mouseup', function () {
      dot.style.transform = 'translate3d(' + mouseX + 'px, ' + mouseY + 'px, 0) translate(-50%, -50%)';
    });
  }

  // ---------- 2. Celebration Live Countdown Timer ----------
  function initCountdown() {
    var countDays = document.getElementById('countDays');
    var countHours = document.getElementById('countHours');
    var countMinutes = document.getElementById('countMinutes');
    var countSeconds = document.getElementById('countSeconds');
    if (!countDays) return;

    // Wedding ceremony date: November 11, 2026, 10:00 AM Athens Time (GMT+2)
    var weddingDate = new Date('2026-11-11T10:00:00+02:00').getTime();

    function update() {
      var now = Date.now();
      var diff = weddingDate - now;

      if (diff <= 0) {
        countDays.textContent = '00';
        countHours.textContent = '00';
        countMinutes.textContent = '00';
        countSeconds.textContent = '00';
        return;
      }

      var d = Math.floor(diff / (1000 * 60 * 60 * 24));
      var h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      var m = Math.floor((diff / (1000 * 60)) % 60);
      var s = Math.floor((diff / 1000) % 60);

      countDays.textContent = String(d).padStart(2, '0');
      countHours.textContent = String(h).padStart(2, '0');
      countMinutes.textContent = String(m).padStart(2, '0');
      countSeconds.textContent = String(s).padStart(2, '0');
    }

    update();
    setInterval(update, 1000);
  }

  // ---------- 3. Background Wedding Music & Audio Atmosphere ----------
  function initAudioToggle() {
    var audioBtn = document.getElementById('audioToggle');
    if (!audioBtn) return;

    var audio = new Audio('wedding-music.mp3');
    audio.loop = true;
    audio.volume = 0.6;

    var isPlaying = false;
    var webAudioCtx = null;
    var synthInterval = null;

    function playSynthAtmosphere() {
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        webAudioCtx = new AudioCtx();
        // Romantic harp arpeggio tones
        var notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
        var noteIdx = 0;
        synthInterval = setInterval(function () {
          if (!isPlaying || !webAudioCtx) return;
          var osc = webAudioCtx.createOscillator();
          var gain = webAudioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = notes[noteIdx % notes.length];
          noteIdx++;
          gain.gain.setValueAtTime(0.001, webAudioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.06, webAudioCtx.currentTime + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.0001, webAudioCtx.currentTime + 1.8);
          osc.connect(gain);
          gain.connect(webAudioCtx.destination);
          osc.start();
          osc.stop(webAudioCtx.currentTime + 1.9);
        }, 850);
      } catch (err) {
        console.warn('Audio synthesis fallback error', err);
      }
    }

    audioBtn.addEventListener('click', function () {
      if (!isPlaying) {
        isPlaying = true;
        audioBtn.classList.add('playing');
        audioBtn.setAttribute('aria-label', 'Pause Wedding Music');

        var promise = audio.play();
        if (promise !== undefined) {
          promise.catch(function () {
            playSynthAtmosphere();
          });
        }
      } else {
        isPlaying = false;
        audioBtn.classList.remove('playing');
        audioBtn.setAttribute('aria-label', 'Play Wedding Music');
        audio.pause();
        if (webAudioCtx) {
          try { webAudioCtx.close(); } catch(e) {}
          webAudioCtx = null;
        }
        if (synthInterval) {
          clearInterval(synthInterval);
          synthInterval = null;
        }
      }
    });
  }

  // ---------- 4. Editorial Gallery Lightbox ----------
  function initGalleryLightbox() {
    var lightbox = document.getElementById('lightbox');
    var lightboxImg = document.getElementById('lightboxImg');
    var lightboxTitle = document.getElementById('lightboxTitle');
    var lightboxDesc = document.getElementById('lightboxDesc');
    var lightboxCounter = document.getElementById('lightboxCounter');
    var lightboxClose = document.getElementById('lightboxClose');
    var lightboxPrev = document.getElementById('lightboxPrev');
    var lightboxNext = document.getElementById('lightboxNext');
    var items = document.querySelectorAll('.gallery__item');

    if (!lightbox || !items.length) return;

    var currentIndex = 0;
    var galleryData = [];

    items.forEach(function (item, idx) {
      var img = item.querySelector('img');
      var title = item.dataset.title || (item.querySelector('h3') ? item.querySelector('h3').textContent : '');
      var desc = item.dataset.desc || (item.querySelector('.gallery__item-badge') ? item.querySelector('.gallery__item-badge').textContent : '');
      var src = item.dataset.full || (img ? img.getAttribute('src') : '');
      galleryData.push({ src: src, title: title, desc: desc });

      item.addEventListener('click', function () {
        openLightbox(idx);
      });
    });

    function openLightbox(index) {
      currentIndex = index;
      updateLightbox();
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }

    function updateLightbox() {
      var data = galleryData[currentIndex];
      if (!data) return;
      lightboxImg.style.opacity = '0';
      lightboxImg.src = data.src;
      lightboxImg.onload = function () {
        lightboxImg.style.opacity = '1';
      };
      if (lightboxTitle) lightboxTitle.textContent = data.title;
      if (lightboxDesc) lightboxDesc.textContent = data.desc;
      if (lightboxCounter) {
        var num = String(currentIndex + 1).padStart(2, '0');
        var tot = String(galleryData.length).padStart(2, '0');
        lightboxCounter.textContent = num + ' / ' + tot;
      }
    }

    function showPrev() {
      currentIndex = (currentIndex - 1 + galleryData.length) % galleryData.length;
      updateLightbox();
    }

    function showNext() {
      currentIndex = (currentIndex + 1) % galleryData.length;
      updateLightbox();
    }

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxPrev) lightboxPrev.addEventListener('click', showPrev);
    if (lightboxNext) lightboxNext.addEventListener('click', showNext);

    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox || e.target.classList.contains('lightbox__dialog')) {
        closeLightbox();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    });
  }

  // ---------- 5. Add to Calendar (.ics Generator) ----------
  function initCalendarButtons() {
    var calBtns = document.querySelectorAll('.events__cal-btn');
    calBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var title = btn.dataset.eventTitle || btn.dataset.event || 'Anirudh & Kavya Wedding Celebration';
        var loc = btn.dataset.eventLoc || btn.dataset.loc || 'Greece';
        var desc = btn.dataset.eventDesc || btn.dataset.desc || 'Celebration of love for Anirudh Ravichander & Kavya Maran';
        var start = btn.dataset.eventStart || ((btn.dataset.date || '20261111') + 'T100000Z');
        var end = btn.dataset.eventEnd || ((btn.dataset.date || '20261111') + 'T180000Z');

        var icsContent = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Anirudh & Kavya Wedding//EN',
          'CALSCALE:GREGORIAN',
          'METHOD:PUBLISH',
          'BEGIN:VEVENT',
          'SUMMARY:' + title,
          'DESCRIPTION:' + desc,
          'LOCATION:' + loc,
          'DTSTART:' + start,
          'DTEND:' + end,
          'STATUS:CONFIRMED',
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\r\n');

        var blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = title.replace(/[^a-zA-Z0-9]/g, '_') + '.ics';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    });
  }

  // ---------- 6. Celebratory Confetti Burst ----------
  function triggerConfetti() {
    var canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width = window.innerWidth;
    var h = canvas.height = window.innerHeight;

    var colors = ['#C5A059', '#D4A69A', '#8B3A4A', '#F5DCA3', '#FFFDF9', '#722F37'];
    var particles = [];
    var count = 140;

    for (var i = 0; i < count; i++) {
      particles.push({
        x: w / 2 + (Math.random() - 0.5) * 220,
        y: h * 0.72,
        vx: (Math.random() - 0.5) * 14,
        vy: -Math.random() * 18 - 8,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 9,
        opacity: 1,
        decay: Math.random() * 0.008 + 0.005
      });
    }

    var animationFrame;
    function render() {
      ctx.clearRect(0, 0, w, h);
      var active = false;

      particles.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38;
        p.vx *= 0.98;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;

        if (p.opacity > 0) {
          active = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
          ctx.restore();
        }
      });

      if (active) {
        animationFrame = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, w, h);
        cancelAnimationFrame(animationFrame);
      }
    }

    render();
  }

  // ---------- 7. RSVP Form Submission ----------
  var rsvpForm = document.getElementById('rsvpForm');
  var rsvpSuccess = document.getElementById('rsvpSuccess');

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', function (e) {
      e.preventDefault();
      rsvpForm.classList.add('hidden');
      if (rsvpSuccess) {
        rsvpSuccess.classList.add('active');
        rsvpSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      triggerConfetti();
    });
  }

  // ---------- Init All Modules ----------
  window.addEventListener('load', function () {
    initScrollVideo();
    updateScrollVideo();
  });

  updateScrollVideo();

  initCustomCursor();
  initCountdown();
  initAudioToggle();
  initGalleryLightbox();
  initCalendarButtons();
  updateScrollProgress();

})();
