/* ============================================================
   A & K Wedding Website - Ultra-Low-Latency Editorial JavaScript
   Zero layout thrashing, asynchronous frame streaming, GPU-composited
   scroll pipeline, zero-overhead passive listeners, locked 60fps.
   ============================================================ */

(function () {
  'use strict';

  // ---------- Page Loader & Fast Startup ----------
  var loader = document.getElementById('loader');
  var loaderDismissed = false;
  document.body.classList.add('loading');

  function finishLoading() {
    if (!loader || loaderDismissed) return;
    loaderDismissed = true;
    loader.classList.add('loaded');
    document.body.classList.remove('loading');
    setTimeout(function () {
      loader.style.display = 'none';
    }, 400);
  }

  // Safety fallback: never keep user waiting more than 1.5s under any condition
  setTimeout(finishLoading, 1500);

  // ---------- Scroll-Driven Video (Frame Sequence) ----------
  var canvas = document.getElementById('scrollCanvas');
  var ctx2d = canvas ? canvas.getContext('2d') : null;
  var scrollSection = document.querySelector('.scroll-video');
  var scrollContent = document.getElementById('scrollContent');
  var scrollOverlay = document.querySelector('.scroll-video__overlay');
  var scrollHint = document.getElementById('scrollHint');
  var petalContainer = document.querySelector('.hero__petals');
  var scrollProgress = document.getElementById('scrollProgress');

  var frameImages = [];
  var frameRequested = {};
  var currentFrame = -1;
  var totalFrames = 0;
  var canvasW = 0;
  var canvasH = 0;

  // Cached layout metrics to avoid forced reflows on scroll
  var winH = window.innerHeight || 800;
  var docHeight = 1;
  var scrollSectionTop = 0;
  var scrollSectionHeight = 1;
  var storyTimelineTop = 0;
  var storyTimelineHeight = 1;
  var parallaxData = [];

  function measureLayout() {
    winH = window.innerHeight || 800;
    docHeight = Math.max(document.documentElement.scrollHeight - winH, 1);

    if (scrollSection) {
      var r = scrollSection.getBoundingClientRect();
      scrollSectionTop = r.top + window.scrollY;
      scrollSectionHeight = Math.max(scrollSection.offsetHeight - winH, 1);
    }

    var storyTimeline = document.querySelector('.story__timeline');
    if (storyTimeline) {
      var str = storyTimeline.getBoundingClientRect();
      storyTimelineTop = str.top + window.scrollY;
      storyTimelineHeight = Math.max(storyTimeline.offsetHeight, 1);
    }

    parallaxData = [];
    var pBgs = document.querySelectorAll('.parallax-bg');
    pBgs.forEach(function (bg) {
      var sec = bg.closest('.quote-section') || bg.closest('.hero-static') || bg.parentElement;
      if (sec) {
        var sr = sec.getBoundingClientRect();
        parallaxData.push({
          bg: bg,
          top: sr.top + window.scrollY,
          height: sec.offsetHeight
        });
      }
    });

    resizeCanvas();
    updateScrollVideo();
    updateScrollProgress();
  }

  function resizeCanvas() {
    if (!canvas || !ctx2d) return;
    var rect = canvas.getBoundingClientRect();
    canvasW = rect.width;
    canvasH = rect.height;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvasW * dpr);
    canvas.height = Math.round(canvasH * dpr);
    ctx2d.scale(dpr, dpr);
    if (currentFrame >= 0 && frameImages[currentFrame]) {
      drawFrame(currentFrame);
    }
  }

  function drawFrame(index) {
    if (!canvas || !ctx2d) return;
    var img = frameImages[index];
    if (!img || !img.complete || !img.naturalWidth) return;

    var cW = canvasW;
    var cH = canvasH;
    var imgW = img.naturalWidth;
    var imgH = img.naturalHeight;

    var scale = Math.max(cW / imgW, cH / imgH);
    var drawW = imgW * scale;
    var drawH = imgH * scale;
    var offsetX = (cW - drawW) * 0.5;
    var offsetY = (cH - drawH) * 0.5;

    ctx2d.clearRect(0, 0, cW, cH);
    ctx2d.drawImage(img, offsetX, offsetY, drawW, drawH);
    currentFrame = index;
  }

  // Find nearest decoded frame so playback never stalls or stutters
  function nearestLoadedFrame(idx) {
    if (frameImages[idx] && frameImages[idx].complete && frameImages[idx].naturalWidth) return idx;
    for (var d = 1; d < totalFrames; d++) {
      var fwd = idx + d;
      var bwd = idx - d;
      if (fwd < totalFrames && frameImages[fwd] && frameImages[fwd].complete && frameImages[fwd].naturalWidth) return fwd;
      if (bwd >= 0 && frameImages[bwd] && frameImages[bwd].complete && frameImages[bwd].naturalWidth) return bwd;
    }
    return -1;
  }

  // Smooth frame interpolation using sub-pixel easing
  var targetFramePos = 0;
  var smoothFramePos = 0;
  var frameLoopRunning = false;

  function frameLoop() {
    var delta = targetFramePos - smoothFramePos;
    var step = delta * 0.22;
    // Cap step on rapid touch swipes so video scrubs smoothly without jumping past
    if (Math.abs(step) > 7) {
      step = step > 0 ? 7 : -7;
    }
    smoothFramePos += step;
    if (Math.abs(delta) < 0.04) smoothFramePos = targetFramePos;

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

  // ---------- Zero-Latency Prioritized Frame Streaming ----------
  function requestSingleFrame(index, onFirstReady) {
    if (index < 0 || index >= totalFrames || frameRequested[index]) return;
    frameRequested[index] = true;

    var img = new Image();
    var padded = String(index).padStart(4, '0');

    function onReady() {
      frameImages[index] = img;
      if (onFirstReady) onFirstReady(img);
      // Reactive re-draw: If the user is currently looking for this frame, draw immediately
      if (Math.abs(Math.round(smoothFramePos) - index) <= 2) {
        drawFrame(index);
      }
    }

    img.onload = onReady;
    img.onerror = function () {
      frameRequested[index] = false;
    };
    img.src = 'frames_opt/f' + padded + '.jpg';
  }

  // Immediately request a window of contiguous frames around user's scroll position
  function requestFrameWindow(centerIdx) {
    if (totalFrames <= 0) return;
    var center = Math.round(centerIdx);
    var radius = 18;
    for (var r = 0; r <= radius; r++) {
      var fwd = center + r;
      if (fwd < totalFrames) requestSingleFrame(fwd);
      var bwd = center - r;
      if (bwd >= 0) requestSingleFrame(bwd);
    }
  }

  function startIntelligentFrameStreaming() {
    frameImages = new Array(totalFrames);

    // 1. Critical Head: Frame 0 (Preloaded in HTML header)
    requestSingleFrame(0, function () {
      resizeCanvas();
      drawFrame(0);
      finishLoading(); // Immediate zero-delay reveal!
    });

    // 2. Video 1 Opening Buffer: Frames 1 through 24
    for (var b = 1; b <= Math.min(24, totalFrames - 1); b++) {
      requestSingleFrame(b);
    }

    // 3. Video 2 Opening Priority: Frames 188 through 212
    // Ensures immediate arrival into the second video drone sequence on mobile!
    for (var v2 = 188; v2 <= Math.min(212, totalFrames - 1); v2++) {
      requestSingleFrame(v2);
    }

    // 4. Keyframe Skeleton: Load every 4th frame across the entire timeline
    setTimeout(function () {
      for (var k = 28; k < totalFrames; k += 4) {
        requestSingleFrame(k);
      }

      // 5. Concurrently stream in-between frames in small responsive batches
      var remainingQueue = [];
      for (var i = 0; i < totalFrames; i++) {
        if (!frameRequested[i]) remainingQueue.push(i);
      }

      var BATCH_SIZE = 8;
      function streamNextBatch() {
        if (!remainingQueue.length) return;
        var cur = Math.round(smoothFramePos);
        remainingQueue.sort(function (a, b) {
          return Math.abs(a - cur) - Math.abs(b - cur);
        });

        var batch = remainingQueue.splice(0, BATCH_SIZE);
        batch.forEach(function (idx) {
          requestSingleFrame(idx);
        });

        if (remainingQueue.length > 0) {
          setTimeout(streamNextBatch, 35);
        }
      }

      streamNextBatch();
    }, 100);
  }

  function initScrollVideo() {
    var count = (typeof window.SCROLL_FRAME_COUNT === 'number' && window.SCROLL_FRAME_COUNT > 0)
      ? window.SCROLL_FRAME_COUNT
      : 362;

    totalFrames = count;
    startIntelligentFrameStreaming();
  }

  // ---------- Zero-Reflow Scroll Pipelines ----------
  function updateScrollVideo() {
    if (!scrollSection) return;

    var scrollY = window.scrollY;
    var progress = (scrollY - scrollSectionTop) / scrollSectionHeight;
    progress = Math.max(0, Math.min(1, progress));

    var inSection = scrollY >= (scrollSectionTop - winH * 0.1) && scrollY <= (scrollSectionTop + scrollSectionHeight + winH * 0.1);
    var atTop = scrollY < (scrollSectionTop + winH * 0.08);

    if (totalFrames > 0) {
      targetFramePos = progress * (totalFrames - 1);
      requestFrameWindow(targetFramePos);
      startFrameLoop();
    }

    // Hero title floats gently up and dissolves smoothly as user begins scrolling,
    // keeping the entire drone descent 100% unobstructed and cinematic
    if (scrollContent) {
      if (progress <= 0.005) {
        scrollContent.style.opacity = '1';
        scrollContent.style.transform = 'translate(-50%, -50%)';
        scrollContent.style.visibility = 'visible';
      } else if (progress < 0.08) {
        var fade = 1 - (progress - 0.005) / 0.075;
        scrollContent.style.opacity = fade.toFixed(3);
        var translateY = -50 - ((1 - fade) * 15);
        scrollContent.style.transform = 'translate(-50%, ' + translateY.toFixed(2) + '%)';
        scrollContent.style.visibility = 'visible';
      } else {
        scrollContent.style.opacity = '0';
        scrollContent.style.visibility = 'hidden';
      }
    }

    if (scrollOverlay) {
      scrollOverlay.style.opacity = progress < 0.08 ? (0.85 - progress * 5).toFixed(2) : '0.15';
    }

    if (scrollHint) {
      if (progress <= 0.03) {
        scrollHint.style.display = 'block';
        scrollHint.style.opacity = (1 - progress / 0.03).toFixed(3);
        scrollHint.style.visibility = 'visible';
      } else {
        scrollHint.style.display = 'none';
        scrollHint.style.opacity = '0';
        scrollHint.style.visibility = 'hidden';
      }
    }

    if (petalContainer) {
      petalContainer.style.opacity = progress < 0.06 ? '1' : '0';
    }
  }

  function updateScrollProgress() {
    if (!scrollProgress) return;
    var progress = Math.min(Math.max(window.scrollY / docHeight, 0), 1);
    scrollProgress.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
  }

  function updateParallax() {
    if (!parallaxData.length) return;
    var scrollY = window.scrollY;
    for (var i = 0; i < parallaxData.length; i++) {
      var p = parallaxData[i];
      var relY = scrollY + winH - p.top;
      if (relY > 0 && relY < p.height + winH) {
        var centerOffset = (p.top + p.height * 0.5) - (scrollY + winH * 0.5);
        // Safe, damped parallax displacement so portraits never get clipped or cut off
        var translateY = Math.max(-25, Math.min(25, centerOffset * 0.05));
        p.bg.style.transform = 'translate3d(0, ' + translateY.toFixed(1) + 'px, 0)';
      }
    }
  }

  var storyLineFill = document.querySelector('.story__line-fill');
  function updateTimeline() {
    if (!storyLineFill || storyTimelineHeight <= 1) return;
    var scrollY = window.scrollY;
    var start = scrollY + winH * 0.7;
    if (start > storyTimelineTop) {
      var pct = Math.min(Math.max((start - storyTimelineTop) / storyTimelineHeight, 0), 1) * 100;
      storyLineFill.style.height = pct.toFixed(1) + '%';
    } else {
      storyLineFill.style.height = '0%';
    }
  }

  // Single rAF-throttled scroll listener with passive flag
  var scrollTicking = false;
  function onScroll() {
    if (!scrollTicking) {
      requestAnimationFrame(function () {
        updateScrollVideo();
        updateScrollProgress();
        updateParallax();
        updateTimeline();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measureLayout, { passive: true });
  window.addEventListener('orientationchange', measureLayout, { passive: true });

  // ---------- Scroll Reveal (IntersectionObserver) ----------
  var revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var delay = entry.target.dataset.delay;
            if (delay) entry.target.style.transitionDelay = delay + 's';
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: '120px 0px 120px 0px' }
    );
    revealElements.forEach(function (el) { revealObserver.observe(el); });

    // On mobile touch devices, reveal all elements immediately to prevent any blank spots
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth <= 768) {
      revealElements.forEach(function (el) { el.classList.add('visible'); });
    }
  } else {
    revealElements.forEach(function (el) { el.classList.add('visible'); });
  }

  // ---------- Tilt Card Effect (Desktop with Hover Only) ----------
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var tiltCards = document.querySelectorAll('.tilt-card');
    tiltCards.forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var centerX = rect.width * 0.5;
        var centerY = rect.height * 0.5;
        var rotateX = ((y - centerY) / centerY) * -5;
        var rotateY = ((x - centerX) / centerX) * 5;
        card.style.transform = 'perspective(1000px) rotateX(' + rotateX.toFixed(1) + 'deg) rotateY(' + rotateY.toFixed(1) + 'deg) translateY(-8px)';
      }, { passive: true });

      card.addEventListener('mouseleave', function () {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
      }, { passive: true });
    });
  }

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
    }, { passive: true });

    document.addEventListener('mouseout', function (e) {
      if (e.target.closest(interactiveSelectors)) {
        isHovered = false;
        ring.classList.remove('cursor-ring--hover');
      }
    }, { passive: true });

    document.addEventListener('mousedown', function () {
      dot.style.transform += ' scale(0.6)';
    }, { passive: true });
    document.addEventListener('mouseup', function () {
      dot.style.transform = 'translate3d(' + mouseX + 'px, ' + mouseY + 'px, 0) translate(-50%, -50%)';
    }, { passive: true });
  }

  // ---------- 2. Celebration Live Countdown Timer ----------
  function initCountdown() {
    var countDays = document.getElementById('countDays');
    var countHours = document.getElementById('countHours');
    var countMinutes = document.getElementById('countMinutes');
    var countSeconds = document.getElementById('countSeconds');
    var countdownHeading = document.getElementById('countdownHeading');
    var countdownCard = document.getElementById('countdownCard');
    var popperBtn = document.getElementById('countdownPopperBtn');
    if (!countDays) return;

    var greeceWedding = new Date('2026-11-11T11:00:00+02:00').getTime();
    var chennaiReception = new Date('2026-11-21T19:00:00+05:30').getTime();
    var hasCelebrated = false;

    function update() {
      var now = Date.now();
      var targetDate = greeceWedding;

      // Smart event switching: Greece ceremony vs. Chennai reception
      if (now >= greeceWedding && now < chennaiReception) {
        targetDate = chennaiReception;
        if (countdownHeading) {
          countdownHeading.textContent = 'Counting Down · Chennai Reception';
        }
      } else if (now >= chennaiReception) {
        countDays.textContent = '00';
        countHours.textContent = '00';
        countMinutes.textContent = '00';
        countSeconds.textContent = '00';
        if (countdownHeading) {
          countdownHeading.textContent = 'The Celebration Has Begun!';
        }
        if (!hasCelebrated) {
          hasCelebrated = true;
          triggerPartyPoppers();
        }
        return;
      }

      var diff = targetDate - now;
      if (diff <= 0) diff = 0;

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

    // Click interactive party popper triggers
    if (popperBtn) {
      popperBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        triggerPartyPoppers();
        popperBtn.classList.add('popped');
        setTimeout(function () { popperBtn.classList.remove('popped'); }, 500);
      });
    }

    if (countdownCard) {
      countdownCard.addEventListener('click', function () {
        triggerPartyPoppers();
      });
    }

    // Auto-fire party poppers when Countdown card scrolls into view
    var countdownSection = document.getElementById('countdown');
    if (countdownSection && 'IntersectionObserver' in window) {
      var popperTriggered = false;
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !popperTriggered) {
            popperTriggered = true;
            setTimeout(function () {
              triggerPartyPoppers();
            }, 400);
          }
        });
      }, { threshold: 0.3 });
      obs.observe(countdownSection);
    }
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
      if (e.target === lightbox || e.target.classList.contains('lightbox__backdrop')) {
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

  // ---------- 6. Grand Celebratory Party Popper Effect ----------
  var popperParticles = [];
  var popperAnimId = null;

  function playPopperSound() {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var actx = new AudioCtx();
      var t = actx.currentTime;

      // Champagne pop tone
      var osc = actx.createOscillator();
      var gain = actx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(460, t);
      osc.frequency.exponentialRampToValueAtTime(75, t + 0.08);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t);
      osc.stop(t + 0.13);

      // Noise texture burst (cork pop)
      var bufferSize = Math.floor(actx.sampleRate * 0.04);
      var buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      var noise = actx.createBufferSource();
      noise.buffer = buffer;
      var noiseGain = actx.createGain();
      noiseGain.gain.setValueAtTime(0.2, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noise.connect(noiseGain);
      noiseGain.connect(actx.destination);
      noise.start(t);
    } catch (e) {
      // AudioContext autoplay catch
    }
  }

  function triggerPartyPoppers() {
    var cvs = document.getElementById('confettiCanvas');
    if (!cvs) return;
    var ctx = cvs.getContext('2d');
    var w = cvs.width = window.innerWidth;
    var h = cvs.height = window.innerHeight;

    playPopperSound();

    var colors = [
      '#F5DCA3', '#C5A059', '#E6C587', '#D4A69A', 
      '#8B3A4A', '#FFFDF9', '#E5A93C', '#B8860B', '#FFD1DC'
    ];
    var types = ['strip', 'star', 'petal', 'dot'];

    // Left cannon, right cannon, and center fountain
    var cannons = [
      { x: w * 0.15, y: h * 0.82, angle: -55, spread: 40, count: 70 },
      { x: w * 0.85, y: h * 0.82, angle: -125, spread: 40, count: 70 },
      { x: w * 0.50, y: h * 0.78, angle: -90, spread: 65, count: 60 }
    ];

    cannons.forEach(function (c) {
      for (var i = 0; i < c.count; i++) {
        var angRad = ((c.angle + (Math.random() - 0.5) * c.spread) * Math.PI) / 180;
        var speed = Math.random() * 18 + 10;

        popperParticles.push({
          x: c.x + (Math.random() - 0.5) * 20,
          y: c.y + (Math.random() - 0.5) * 20,
          vx: Math.cos(angRad) * speed,
          vy: Math.sin(angRad) * speed,
          gravity: Math.random() * 0.16 + 0.22,
          drag: Math.random() * 0.02 + 0.965,
          size: Math.random() * 9 + 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          type: types[Math.floor(Math.random() * types.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: Math.random() * 0.12 + 0.06,
          opacity: 1,
          decay: Math.random() * 0.005 + 0.004
        });
      }
    });

    if (popperAnimId) cancelAnimationFrame(popperAnimId);

    function render() {
      ctx.clearRect(0, 0, w, h);
      var hasActive = false;

      for (var i = 0; i < popperParticles.length; i++) {
        var p = popperParticles[i];
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;
        p.opacity -= p.decay;

        if (p.opacity > 0 && p.y < h + 40) {
          hasActive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;

          var xWobble = Math.cos(p.wobble);

          if (p.type === 'strip') {
            // Foil fluttering ribbon
            ctx.fillRect(-p.size * 0.5 * xWobble, -p.size * 0.35, p.size * xWobble, p.size * 0.7);
          } else if (p.type === 'star') {
            // Shimmering 4-pointed gold star
            var s = p.size * 0.7;
            ctx.beginPath();
            ctx.moveTo(0, -s);
            ctx.quadraticCurveTo(0, 0, s, 0);
            ctx.quadraticCurveTo(0, 0, 0, s);
            ctx.quadraticCurveTo(0, 0, -s, 0);
            ctx.quadraticCurveTo(0, 0, 0, -s);
            ctx.fill();
          } else if (p.type === 'petal') {
            // Rose petal
            ctx.beginPath();
            ctx.ellipse(0, 0, Math.abs(p.size * 0.45 * xWobble), p.size * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Glowing round sparkle
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
      }

      // Filter dead particles
      popperParticles = popperParticles.filter(function (p) {
        return p.opacity > 0 && p.y < h + 40;
      });

      if (hasActive) {
        popperAnimId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, w, h);
        popperAnimId = null;
      }
    }

    render();
  }

  // Backwards-compatible alias for existing triggers
  var triggerConfetti = triggerPartyPoppers;

  // ---------- Fast Init Sequence ----------
  measureLayout();
  initScrollVideo();
  initCustomCursor();
  initCountdown();
  initAudioToggle();
  initGalleryLightbox();
  initCalendarButtons();

  window.addEventListener('load', function () {
    measureLayout();
    updateScrollVideo();
  }, { passive: true });

})();
