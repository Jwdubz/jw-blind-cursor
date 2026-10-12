(function () {
  var PAYOFF_AT = 5.79;
  var root = document.documentElement;
  var pauseBtn = document.getElementById("pause");
  var topBtn = document.getElementById("top");
  var payoff = document.getElementById("payoff");
  var wide = document.getElementById("hero-wide");
  var tall = document.getElementById("hero-tall");
  var phone = window.matchMedia("(max-width: 759px)");
  var films = Array.prototype.slice.call(document.querySelectorAll("video.film"));
  var landed = false;
  var userPaused = false;
  var y = window.scrollY;
  var dest = y;
  var rafId = 0;
  var lock = false;
  var topAnim = false;

  function activeHero() {
    return phone.matches ? tall : wide;
  }

  function mountHero() {
    var on = activeHero();
    var off = on === tall ? wide : tall;
    if (off.getAttribute("src")) {
      off.pause();
      off.removeAttribute("src");
      off.load();
    }
    if (!on.getAttribute("src")) {
      on.preload = "auto";
      on.src = on.getAttribute("data-src");
      on.muted = true;
      on.playsInline = true;
    }
    if (!userPaused && on.paused) {
      var pending = on.play();
      if (pending) pending.catch(function () {});
    }
  }

  function land() {
    if (landed) return;
    landed = true;
    payoff.classList.remove("is-held");
    payoff.classList.add("is-landed");
  }

  function watchPayoff(video) {
    video.addEventListener("timeupdate", function () {
      if (video === activeHero() && video.currentTime >= PAYOFF_AT) land();
    });
  }

  function setPaused(on) {
    userPaused = on;
    root.classList.toggle("is-paused", on);
    pauseBtn.setAttribute("aria-pressed", on ? "true" : "false");
    pauseBtn.textContent = on ? "Play" : "Pause";
    if (on) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      topAnim = false;
      y = dest = window.scrollY;
      films.forEach(function (video) { video.pause(); });
      land();
      return;
    }
    playVisible();
  }

  function playVisible() {
    if (userPaused) return;
    films.forEach(function (video) {
      if (!video.getAttribute("src")) return;
      var box = video.getBoundingClientRect();
      var visible = box.height > 0 && box.bottom > box.height * 0.35 && box.top < window.innerHeight - box.height * 0.35;
      if (visible) {
        var pending = video.play();
        if (pending) pending.catch(function () {});
      } else {
        video.pause();
      }
    });
  }

  var view = new IntersectionObserver(function (entries) {
    if (userPaused) return;
    entries.forEach(function (entry) {
      var video = entry.target;
      if (!video.getAttribute("src")) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
        var pending = video.play();
        if (pending) pending.catch(function () {});
      } else {
        video.pause();
      }
    });
  }, { threshold: [0, 0.45, 0.75] });

  films.forEach(function (video) {
    video.muted = true;
    video.playsInline = true;
    view.observe(video);
  });

  var sawPlayback = false;

  function notePlaying(video) {
    video.addEventListener("playing", function () {
      if (video === activeHero()) sawPlayback = true;
    });
  }

  watchPayoff(wide);
  watchPayoff(tall);
  notePlaying(wide);
  notePlaying(tall);
  mountHero();
  phone.addEventListener("change", mountHero);

  pauseBtn.addEventListener("click", function () {
    setPaused(!userPaused);
  });

  // Show the held word only if the film never starts. A stall still resolves after the payoff window.
  window.setTimeout(function () {
    if (!sawPlayback) land();
  }, 1800);

  window.setTimeout(function () {
    land();
  }, 9500);

  function pollPayoff() {
    if (landed) return;
    var hero = activeHero();
    if (hero && hero.currentTime >= PAYOFF_AT) land();
    if (!landed) requestAnimationFrame(pollPayoff);
  }
  requestAnimationFrame(pollPayoff);

  var footer = document.querySelector(".site-footer");
  if (footer && "IntersectionObserver" in window) {
    var end = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) land();
      });
    }, { threshold: 0.2 });
    end.observe(footer);
  }

  function maxY() {
    return Math.max(0, root.scrollHeight - window.innerHeight);
  }

  function apply(next) {
    lock = true;
    window.scrollTo(0, next);
    lock = false;
  }

  function tick() {
    rafId = 0;
    if (userPaused || topAnim) return;
    var dy = dest - y;
    if (Math.abs(dy) < 0.5) {
      y = dest;
      apply(y);
      return;
    }
    y += dy * 0.085;
    apply(y);
    rafId = requestAnimationFrame(tick);
  }

  function kick() {
    if (!rafId && !userPaused && !topAnim) rafId = requestAnimationFrame(tick);
  }

  window.addEventListener("scroll", function () {
    if (lock || topAnim) return;
    cancelAnimationFrame(rafId);
    rafId = 0;
    y = dest = window.scrollY;
    if (topBtn) {
      var heroBox = document.querySelector(".hero");
      var gate = heroBox ? heroBox.offsetHeight * 0.9 : 480;
      if (window.scrollY > gate) topBtn.hidden = false;
      else topBtn.hidden = true;
    }
  }, { passive: true });

  window.addEventListener("wheel", function (event) {
    if (userPaused) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    event.preventDefault();
    topAnim = false;
    var scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    dest = Math.max(0, Math.min(maxY(), dest + event.deltaY * scale));
    kick();
  }, { passive: false });

  function bezier(p1x, p1y, p2x, p2y) {
    function sample(a, b, c, d, t) {
      var u = 1 - t;
      return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    }
    return function (t) {
      var lo = 0;
      var hi = 1;
      var mid = t;
      for (var i = 0; i < 18; i++) {
        mid = (lo + hi) / 2;
        if (sample(0, p1x, p2x, 1, mid) < t) lo = mid;
        else hi = mid;
      }
      return sample(0, p1y, p2y, 1, (lo + hi) / 2);
    };
  }

  var easeTop = bezier(0.7, 0, 0.3, 1);

  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function scrollToY(target, duration, ease) {
    var start = window.scrollY;
    var delta = target - start;
    var t0 = performance.now();
    topAnim = true;
    cancelAnimationFrame(rafId);
    rafId = 0;
    function step(now) {
      if (!topAnim) return;
      var t = Math.min(1, (now - t0) / duration);
      var next = start + delta * ease(t);
      y = dest = next;
      apply(next);
      if (t < 1) requestAnimationFrame(step);
      else {
        topAnim = false;
        y = dest = window.scrollY;
      }
    }
    requestAnimationFrame(step);
  }

  function headerOffset() {
    var header = document.querySelector(".site-header");
    return header ? header.offsetHeight + 8 : 84;
  }

  document.querySelectorAll('a[href="#book"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      var section = document.getElementById("book");
      if (!section) return;
      event.preventDefault();
      land();
      var top = section.getBoundingClientRect().top + window.scrollY - headerOffset();
      scrollToY(Math.max(0, top), 800, easeOutExpo);
    });
  });

  topBtn.addEventListener("click", function () {
    scrollToY(0, 1850, easeTop);
  });

  window.addEventListener("load", function () {
    mountHero();
    playVisible();
  });
})();
