// MangaDrive: サイト内検索 & PDF リーダー
(() => {
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ---------- 曜日タブ ----------
  document.querySelectorAll('.day-tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      const box = b.closest('.weekly');
      box.querySelectorAll('.day-tabs button').forEach((x) => x.setAttribute('aria-selected', x === b));
      box.querySelectorAll('.day-panel').forEach((p) => (p.hidden = p.dataset.day !== b.dataset.day));
    }),
  );

  // ---------- ヒーロースライダー ----------
  const slides = document.querySelector('.slides');
  if (slides) {
    const dots = [...document.querySelectorAll('.dots span')];
    const n = dots.length;
    const cur = () => Math.round(slides.scrollLeft / slides.clientWidth);
    const go = (i) => slides.scrollTo({ left: ((i + n) % n) * slides.clientWidth, behavior: 'smooth' });
    const mark = () => dots.forEach((d, i) => d.classList.toggle('on', i === cur()));
    mark();
    slides.addEventListener('scroll', () => requestAnimationFrame(mark), { passive: true });
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    let timer = n > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches && setInterval(() => go(cur() + 1), 6000);
    slides.addEventListener('pointerdown', () => clearInterval(timer), { once: true });
  }

  // ---------- 検索 ----------
  const results = document.getElementById('results');
  if (results) {
    const q = new URLSearchParams(location.search).get('q') || '';
    const input = document.getElementById('q');
    input.value = q;
    const norm = (s) => String(s).normalize('NFKC').toLowerCase();
    fetch('/search.json')
      .then((r) => r.json())
      .then((items) => {
        const run = (term) => {
          const t = norm(term).split(/\s+/).filter(Boolean);
          const hits = t.length ? items.filter((i) => t.every((w) => norm([i.t, i.a, i.g.join(' '), i.d].join(' ')).includes(w))) : items;
          results.innerHTML = hits.length
            ? hits
                .map((i) => `<article class="card"><a href="/manga/${i.s}/"><img src="${i.c}" alt="${esc(i.t)} 表紙" loading="lazy"><h3>${esc(i.t)}</h3></a><p class="meta">${esc(i.a)}${i.a ? ' · ' : ''}${i.p}ページ</p></article>`)
                .join('')
            : '<p class="muted">該当する作品が見つかりませんでした。</p>';
        };
        run(q);
        input.addEventListener('input', () => run(input.value));
      });
  }

  // ---------- PDF リーダー ----------
  const reader = document.querySelector('.reader[data-pdf]');
  if (!reader) return;
  const start = reader.querySelector('[data-reader-start]');
  const url = reader.dataset.pdf;
  // 別ドメインの PDF は Worker の /pdf プロキシ経由（CORS 対策）
  const src = new URL(url, location.href).origin === location.origin ? url : `/pdf?u=${encodeURIComponent(url)}`;
  const fallback = () => {
    reader.classList.add('on');
    reader.innerHTML = `<iframe src="${esc(url)}#view=FitH" title="PDFリーダー" loading="lazy"></iframe><p class="small" style="text-align:center"><a href="${esc(url)}" target="_blank" rel="noopener">新しいタブでPDFを開く</a></p>`;
  };
  start?.addEventListener('click', async () => {
    start.disabled = true;
    start.textContent = '読み込み中…';
    try {
      const pdfjs = await import(PDFJS + 'pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
      const doc = await pdfjs.getDocument({ url: src, cMapUrl: PDFJS + 'cmaps/', cMapPacked: true }).promise;
      reader.classList.add('on');
      reader.innerHTML = `<div class="reader-bar"><span>全${doc.numPages}ページ</span><a href="${esc(url)}" target="_blank" rel="noopener">PDFを開く</a></div>`;
      const width = Math.min(reader.clientWidth || 900, 900) * (window.devicePixelRatio || 1);
      const io = new IntersectionObserver(
        (entries) =>
          entries.forEach(async (e) => {
            if (!e.isIntersecting || e.target.dataset.done) return;
            e.target.dataset.done = 1;
            io.unobserve(e.target);
            const page = await doc.getPage(+e.target.dataset.page);
            const vp = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
            e.target.width = vp.width;
            e.target.height = vp.height;
            await page.render({ canvasContext: e.target.getContext('2d'), viewport: vp }).promise;
          }),
        { rootMargin: '800px' },
      );
      for (let i = 1; i <= doc.numPages; i++) {
        const c = document.createElement('canvas');
        c.dataset.page = i;
        c.width = 600;
        c.height = 850;
        c.setAttribute('aria-label', `${i}ページ`);
        reader.appendChild(c);
        io.observe(c);
      }
    } catch (err) {
      console.warn('pdf.js で読み込めないため埋め込み表示に切り替えます', err);
      fallback();
    }
  });
})();
