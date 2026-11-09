(function () {
  var root = document.documentElement;
  var island = document.getElementById('island');
  var toggle = document.getElementById('themeToggle');
  var menuBtn = document.getElementById('menuToggle');
  var nav = document.getElementById('nav');

  // Tema: tombol ganti terang/gelap, pilihan disimpan di browser
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  // Pill mengecil sedikit saat halaman di-scroll
  if (island) {
    var onScroll = function () { island.classList.toggle('is-compact', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Menu mobile: pill melebar ke bawah
  if (island && menuBtn && nav) {
    var closeMenu = function () {
      island.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    };
    menuBtn.addEventListener('click', function () {
      var open = island.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') closeMenu(); });
  }

  // Marquee skills: gandakan daftar logo agar loop tidak terputus
  // Marquee (Skills dan Sertifikat): berjalan otomatis, bisa digeser dengan kursor/jari, ada inersia
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  [['marqueeTrack', 40], ['certTrack', 34]].forEach(function (cfg) {
    var track = document.getElementById(cfg[0]);
    if (!track) return;
    Array.prototype.slice.call(track.children).forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('a').forEach(function (a) { a.setAttribute('tabindex', '-1'); });
      if (clone.tagName === 'A') clone.setAttribute('tabindex', '-1');
      track.appendChild(clone);
    });
    if (reduceMotion) return;

    var box = track.parentNode;
    box.classList.add('is-draggable');
    var speed = cfg[1];
    var x = 0, v = -speed, half = 0, frame = 0;
    var hover = false, down = false, dragging = false, onScreen = true;
    var startX = 0, startPos = 0, lastX = 0, lastT = 0, vel = 0;
    var last = performance.now();

    function measure() { half = track.scrollWidth / 2; }
    function wrap() { if (half) { x = x % half; if (x > 0) x -= half; } }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; }).observe(box);
    }
    box.addEventListener('mouseenter', function () { hover = true; });
    box.addEventListener('mouseleave', function () { hover = false; });
    box.addEventListener('dragstart', function (e) { e.preventDefault(); });

    box.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; dragging = false;
      startX = lastX = e.clientX; startPos = x; lastT = performance.now(); vel = 0;
    });
    box.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) > 5) {
        dragging = true;
        box.classList.add('is-dragging');
        try { box.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (dragging) {
        var now = performance.now();
        var dt = Math.max(1, now - lastT);
        vel = vel * 0.6 + ((e.clientX - lastX) / dt * 1000) * 0.4;
        lastX = e.clientX; lastT = now;
        x = startPos + dx; wrap();
        track.style.transform = 'translate3d(' + x + 'px,0,0)';
      }
    });
    function release() {
      if (!down) return;
      down = false;
      if (dragging) { v = Math.max(-2500, Math.min(2500, vel)); }
      box.classList.remove('is-dragging');
      // setelah digeser, klik yang mengikutinya diabaikan supaya kartu tidak ikut terbuka
      if (dragging) setTimeout(function () { dragging = false; }, 0);
    }
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
    box.addEventListener('click', function (e) { if (dragging) { e.preventDefault(); e.stopPropagation(); } }, true);

    (function loop(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (onScreen) {
        if (++frame % 60 === 0) measure();
        if (!down) {
          var target = hover ? 0 : -speed;
          v += (target - v) * Math.min(1, dt * 3);
          x += v * dt; wrap();
          track.style.transform = 'translate3d(' + x + 'px,0,0)';
        }
      }
      requestAnimationFrame(loop);
    })(last);
  });

  // Teks peran di hero: mengetik dan menghapus bergantian
  var roleEl = document.getElementById('typedRole');
  if (roleEl && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    var roles = ['Aspiring Data Analyst', 'Mahasiswa Informatika', 'Data Enthusiast'];
    var ri = 0, ci = 0, del = false;
    (function tick() {
      var word = roles[ri];
      ci += del ? -1 : 1;
      roleEl.textContent = word.slice(0, ci);
      var wait = del ? 40 : 85;
      if (!del && ci === word.length) { del = true; wait = 1700; }
      else if (del && ci === 0) { del = false; ri = (ri + 1) % roles.length; wait = 350; }
      setTimeout(tick, wait);
    })();
  }

  // Judul section: efek mengetik (TextType) saat masuk layar
  var titles = document.querySelectorAll('.section__title');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (titles.length && !reduce && 'IntersectionObserver' in window) {
    titles.forEach(function (el) {
      var text = el.textContent;
      el.setAttribute('aria-label', text);
      el.classList.add('tt');
      el.innerHTML = '<span class="tt__ghost" aria-hidden="true">' + text + '</span><span class="tt__live" aria-hidden="true"></span>';
    });
    var typer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        typer.unobserve(el);
        var text = el.getAttribute('aria-label');
        var live = el.querySelector('.tt__live');
        el.classList.add('is-typing');
        var i = 0;
        (function step() {
          i++;
          live.textContent = text.slice(0, i);
          if (i < text.length) {
            setTimeout(step, 70 + Math.random() * 40);
          } else {
            setTimeout(function () { el.classList.remove('is-typing'); }, 1400);
          }
        })();
      });
    }, { threshold: 0.6 });
    titles.forEach(function (el) { typer.observe(el); });
  }

  // Animasi muncul saat di-scroll
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-visible'); });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Lanyard 3D (hanya layar lebar; dimuat belakangan supaya halaman tetap cepat)
  var lan = document.getElementById('lanyard');
  if (lan && window.matchMedia('(min-width: 961px)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var load = function () {
      var sc = document.createElement('script');
      sc.src = (document.body.classList.contains('detail-page') ? '../' : '') + 'lanyard/lanyard.js';
      sc.async = true;
      document.body.appendChild(sc);
    };
    if (document.readyState === 'complete') load();
    else window.addEventListener('load', load);
  }
})();
