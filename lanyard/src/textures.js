import * as THREE from 'three'

// Semua tekstur digambar dengan canvas 2D, jadi tidak ada file gambar atau model 3D yang perlu diunduh.
const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif'
const SERIF = '"Playfair Display", Georgia, "Times New Roman", serif'
const ACCENT = '#4a6cf7'

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function spaced(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'
}

export function makeTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// lubang kecil tempat tali dikaitkan, di tengah atas kartu
function slot(ctx, W) {
  roundedRect(ctx, W / 2 - 72, 46, 144, 28, 14)
  ctx.fillStyle = 'rgba(0,0,0,0.85)'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.stroke()
}

// Logo "A" digambar dengan path sendiri (tidak bergantung font web), supaya selalu tampil benar.
function logoMark(ctx, cx, cy, size, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.11
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(cx - size * 0.2, cy + size * 0.2)
  ctx.lineTo(cx, cy - size * 0.22)
  ctx.lineTo(cx + size * 0.2, cy + size * 0.2)
  ctx.moveTo(cx - size * 0.1, cy + size * 0.05)
  ctx.lineTo(cx + size * 0.1, cy + size * 0.05)
  ctx.stroke()
  ctx.restore()
}

function cardBase(ctx, W, H) {
  roundedRect(ctx, 0, 0, W, H, W * 0.05)
  ctx.clip()
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#ffffff')
  bg.addColorStop(1, '#e9e9e4')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // garis tepi tipis supaya kartu putih tetap terlihat di latar terang
  ctx.lineWidth = 10
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  roundedRect(ctx, 5, 5, W - 10, H - 10, W * 0.05)
  ctx.stroke()
}

// Kartu depan polos: hanya foto yang memenuhi seluruh kartu. Tanpa foto, kartu putih polos.
export function drawCardFront(canvas, photo) {
  const W = canvas.width
  const H = canvas.height
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)
  ctx.save()
  cardBase(ctx, W, H)
  if (photo && photo.width) {
    const r = Math.max(W / photo.width, H / photo.height)
    const dw = photo.width * r
    const dh = photo.height * r
    ctx.drawImage(photo, (W - dw) / 2, (H - dh) * 0.12, dw, dh)
  }
  slot(ctx, W)
  ctx.restore()
}

export function drawCardBack(canvas) {
  const W = canvas.width
  const H = canvas.height
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)
  ctx.save()
  cardBase(ctx, W, H)
  logoMark(ctx, W / 2, H * 0.5, 280, 'rgba(17,17,18,0.18)')
  slot(ctx, W)
  ctx.restore()
}

// tali: hitam polos, tanpa tulisan
export function drawBand(canvas) {
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0b0b0c'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}
