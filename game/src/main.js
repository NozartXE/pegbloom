// Temporary boot stub: paints the 1280x800 canvas cream and draws the PEGBLOOM wordmark so the page visibly boots.
(function () {
  const canvas = document.getElementById('game');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 1280;
  const H = 800;
  const palette = globalThis.PB_PALETTE || { cream: '#FFF6E9', ink: '#2B2118', coral: '#FF7A59' };

  ctx.fillStyle = palette.cream;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = palette.ink;
  ctx.font = 'bold 168px "Arial Narrow", Arial, Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PEGBLOOM', W / 2, H / 2 - 18);

  const width = ctx.measureText('PEGBLOOM').width;
  ctx.fillStyle = palette.coral;
  ctx.fillRect(W / 2 - width / 2, H / 2 + 78, width, 16);
})();
