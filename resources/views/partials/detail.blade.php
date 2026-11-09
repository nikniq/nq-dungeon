{{-- A detail sheet for the public pages: click an item or a town and its figures open here. --}}
<dialog id="detail" class="detail" aria-labelledby="detail-title">
  <form method="dialog"><button class="detail-close" aria-label="Close">✕</button></form>
  <div class="detail-head"><canvas id="detail-art" width="96" height="96" hidden></canvas><div><h3 id="detail-title"></h3><p id="detail-sub" class="muted"></p></div></div>
  <div id="detail-body"></div>
</dialog>
<script>
  // showDetail({ title, sub, stats: [[label, value]], notes: [text], html, art: canvas })
  window.showDetail = (d) => {
    const dlg = document.getElementById('detail'), esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    document.getElementById('detail-title').textContent = d.title; document.getElementById('detail-sub').textContent = d.sub || '';
    const art = document.getElementById('detail-art'); art.hidden = !d.art;
    if (d.art) { const g = art.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 96, 96); g.drawImage(d.art, 0, 0, 96, 96); }
    document.getElementById('detail-body').innerHTML =
      (d.stats && d.stats.length ? `<dl class="detail-stats">${d.stats.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '') +
      (d.notes || []).map((n) => `<p>${esc(n)}</p>`).join('') + (d.html || '') +
      (d.links && d.links.length ? `<p class="detail-links">${d.links.map(([t, u]) => `<a href="${esc(u)}">${esc(t)} →</a>`).join('')}</p>` : '');
    if (d.hash) history.replaceState(null, '', '#' + d.hash);
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  };
  (() => {
    const dlg = document.getElementById('detail');
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // a click on the backdrop closes it
    dlg.addEventListener('close', () => { if (location.hash) history.replaceState(null, '', location.pathname + location.search); });
  })();
</script>
