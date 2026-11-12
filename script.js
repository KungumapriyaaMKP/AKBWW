/* ============================================================
   A & K Wedding Website - JavaScript
   Scroll-driven video, parallax, reveals, tilt cards
   Zero dependencies, optimized with rAF + IntersectionObserver
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

  // Detect frame count by trying to load frames
  function detectFrameCount(callback) {
    // Try loading frames sequentially until one fails
    var testIndex = 0;
    var maxTest = 300; // Safety limit

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
        // No frames found, hide scroll video section and show fallback
        if (scrollSection) {
          scrollSection.style.height = '100vh';
          // Use the video as a simple background instead
          var video = document.createElement('video');
          video.src = 'Seaside_wedding_venue_drone_shot_f6e5fffd_1080p.mp4';
          video.autoplay = true;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.style.cssText = 'position:sticky;top:0;left:0;width:100%;height:100vh;object-fit:cover;';
          canvas.style.display = 'none';
          scrollSection.insertBefore(video, scrollSection.firstChild);
          if (scrollContent) {
            scrollContent.classList.add('visible');
          }
          if (scrollOverlay) scrollOverlay.classList.add('active');
        }
        finishLoading();
        return;
      }

      totalFrames = count;
      console.log('Scroll video: ' + totalFrames + ' frames detected');

      // Preload all frames
      var loaded = 0;
      frameImages = new Array(totalFrames);

      for (var i = 0; i < totalFrames; i++) {
        (function (index) {
          var img = new Image();
          img.onload = function () {
            frameImages[index] = img;
            loaded++;
            if (loaded === totalFrames) {
              framesReady = true;
              console.log('All frames loaded');
              // Size canvas and draw first frame
              sizeCanvas();
              drawFrame(0);
              finishLoading();
            } else if (loaded === 1) {
              // Draw first frame immediately for fast visual
              sizeCanvas();
              drawFrame(0);
            }
          };
          img.onerror = function () {
            loaded++;
            if (loaded === totalFrames) {
              framesReady = true;
              finishLoading();
            }
          };
          var padded = String(index).padStart(4, '0');
          img.src = 'frames_opt/f' + padded + '.jpg';
        })(i);
      }
    });
  }

  function sizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function drawFrame(index) {
    if (!ctx2d || !frameImages[index]) return;
    var img = frameImages[index];
    var cw = canvas.width;
    var ch = canvas.height;

    // Cover-fit the image to canvas
    var imgRatio = img.width / img.height;
    var canvasRatio = cw / ch;
    var drawW, drawH, drawX, drawY;

    if (canvasRatio > imgRatio) {
      drawW = cw;
      drawH = cw / imgRatio;
      drawX = 0;
      drawY = (ch - drawH) / 2;
    } else {
      drawH = ch;
      drawW = ch * imgRatio;
      drawX = (cw - drawW) / 2;
      drawY = 0;
    }

    ctx2d.drawImage(img, drawX, drawY, drawW, drawH);
  }

  function updateScrollVideo() {
    if (!scrollSection || !framesReady || totalFrames === 0) return;

    var rect = scrollSection.getBoundingClientRect();
    var sectionHeight = scrollSection.offsetHeight - window.innerHeight;
    var scrolled = -rect.top;
    var progress = Math.max(0, Math.min(1, scrolled / sectionHeight));

    // Map progress to frame index
    var frameIndex = Math.min(Math.floor(progress * totalFrames), totalFrames - 1);
    frameIndex = Math.max(0, frameIndex);

    if (frameIndex !== currentFrame) {
      currentFrame = frameIndex;
      drawFrame(frameIndex);
    }

    // Text overlay: show from 20% to 80% scroll, fade in and out
    if (scrollContent) {
      if (progress > 0.15 && progress < 0.85) {
        scrollContent.classList.add('visible');
        var textOpacity = 1;
        if (progress < 0.25) {
          textOpacity = (progress - 0.15) / 0.1;
        } else if (progress > 0.75) {
          textOpacity = (0.85 - progress) / 0.1;
        }
        scrollContent.style.opacity = Math.max(0, Math.min(1, textOpacity));
      } else {
        scrollContent.classList.remove('visible');
        scrollContent.style.opacity = '0';
      }
    }

    // Overlay
    if (scrollOverlay) {
      if (progress > 0.05) {
        scrollOverlay.classList.add('active');
      } else {
        scrollOverlay.classList.remove('active');
      }
    }

    // Hide scroll hint after user starts scrolling
    if (scrollHint) {
      if (progress > 0.05) {
        scrollHint.classList.add('hidden');
      } else {
        scrollHint.classList.remove('hidden');
      }
    }

    // Show/hide petals based on scroll
    if (petalContainer) {
      petalContainer.style.opacity = progress > 0.1 && progress < 0.9 ? '1' : '0';
    }

    // Fix overlay and content position only while in scroll-video section
    var isInSection = rect.top <= 0 && rect.bottom > window.innerHeight;
    if (scrollOverlay) scrollOverlay.style.position = isInSection ? 'fixed' : 'absolute';
    if (scrollContent) scrollContent.style.position = isInSection ? 'fixed' : 'absolute';
    if (scrollHint) scrollHint.style.position = isInSection ? 'fixed' : 'absolute';
    if (petalContainer) petalContainer.style.position = isInSection ? 'fixed' : 'absolute';
  }

  // ---------- Finish Loading ----------
  function finishLoading() {
    setTimeout(function () {
      loader.classList.add('hide');
      document.body.classList.remove('loading');
    }, 400);
  }

  // Fallback: if frames take too long, show page anyway
  setTimeout(function () {
    if (!framesReady) {
      finishLoading();
    }
  }, 5000);

  // ---------- Navigation Scroll Effect ----------
  var nav = document.getElementById('nav');

  function updateNav() {
    if (!nav) return;
    if (window.scrollY > 80) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
  }

  // ---------- Scroll Progress Bar ----------
  var scrollProgress = document.getElementById('scrollProgress');

  function updateScrollProgress() {
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    scrollProgress.style.width = progress + '%';
  }

  // ---------- Parallax Scrolling ----------
  var parallaxElements = document.querySelectorAll('.parallax-bg');
  var isMobile = window.innerWidth <= 768;

  function updateParallax() {
    if (isMobile) return;
    var windowHeight = window.innerHeight;

    parallaxElements.forEach(function (el) {
      var parent = el.parentElement;
      var rect = parent.getBoundingClientRect();
      var speed = parseFloat(el.getAttribute('data-speed')) || 0.3;

      if (rect.bottom < -200 || rect.top > windowHeight + 200) return;

      var centerOffset = rect.top + rect.height / 2 - windowHeight / 2;
      var translateY = centerOffset * speed;
      el.style.transform = 'translate3d(0, ' + translateY + 'px, 0)';
    });
  }

  // ---------- Timeline Line Fill ----------
  var storySection = document.querySelector('.story');
  var storyLineFill = document.getElementById('storyLineFill');

  function updateTimelineFill() {
    if (!storySection || !storyLineFill) return;
    var rect = storySection.getBoundingClientRect();
    var windowHeight = window.innerHeight;
    var scrolledInSection = windowHeight * 0.6 - rect.top;
    var progress = Math.max(0, Math.min(1, scrolledInSection / rect.height));
    storyLineFill.style.height = (progress * 100) + '%';
  }

  // ---------- Unified Scroll Handler ----------
  var scrollTicking = false;

  function onScroll() {
    if (!scrollTicking) {
      requestAnimationFrame(function () {
        updateNav();
        updateScrollProgress();
        updateScrollVideo();
        updateParallax();
        updateTimelineFill();
        highlightNav();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  window.addEventListener('resize', function () {
    isMobile = window.innerWidth <= 768;
    if (canvas) sizeCanvas();
    if (framesReady && currentFrame >= 0) drawFrame(currentFrame);
  }, { passive: true });

  // ---------- Mobile Navigation Toggle ----------
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
      document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // ---------- Scroll Reveal (IntersectionObserver) ----------
  var revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var delay = parseFloat(el.getAttribute('data-delay')) || 0;
          if (delay > 0) {
            setTimeout(function () { el.classList.add('visible'); }, delay * 1000);
          } else {
            el.classList.add('visible');
          }
          revealObserver.unobserve(el);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    revealElements.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealElements.forEach(function (el) { el.classList.add('visible'); });
  }

  // ---------- Tilt Card Effect (Desktop only) ----------
  if (!isMobile && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.tilt-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -4;
        var rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 4;
        card.style.transform = 'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) scale3d(1.02, 1.02, 1)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      });
    });
  }

  // ---------- Gallery Magnetic Hover ----------
  if (!isMobile && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.gallery__item').forEach(function (item) {
      var img = item.querySelector('img');
      if (!img) return;
      item.addEventListener('mousemove', function (e) {
        var rect = item.getBoundingClientRect();
        var x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        var y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        img.style.transform = 'scale(1.08) translate(' + (x * 6) + 'px, ' + (y * 6) + 'px)';
      });
      item.addEventListener('mouseleave', function () {
        img.style.transform = 'scale(1) translate(0, 0)';
      });
    });
  }

  // ---------- Smooth Scroll for Anchor Links ----------
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var navHeight = nav ? nav.offsetHeight : 0;
        var targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    });
  });

  // ---------- RSVP Form ----------
  var rsvpForm = document.getElementById('rsvpForm');
  var rsvpSuccess = document.getElementById('rsvpSuccess');

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', function (e) {
      e.preventDefault();
      rsvpForm.classList.add('hidden');
      rsvpSuccess.classList.add('active');
    });
  }

  // ---------- Active Nav Link Highlight ----------
  var sections = document.querySelectorAll('section[id]');
  var navLinksList = document.querySelectorAll('.nav__links a');

  function highlightNav() {
    if (!navLinksList.length) return;
    var scrollPos = window.scrollY + 120;
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

  // ---------- Init ----------
  window.addEventListener('load', function () {
    initScrollVideo();
  });

  updateNav();
  updateScrollProgress();
  highlightNav();

})();
