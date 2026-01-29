import processor from './image-processor.js'

const $ = (s) => document.querySelector(s)
const $$ = (s) => document.querySelectorAll(s)

const state = {
  file: null,
  originalWidth: 0,
  originalHeight: 0,
  aspectRatio: 1,
  mode: 'dimensions',
  resultCanvas: null,
  resultFormat: 'image/png',
  objectURLs: []
}

function revokeURLs() {
  state.objectURLs.forEach(u => URL.revokeObjectURL(u))
  state.objectURLs = []
}

function trackURL(url) {
  state.objectURLs.push(url)
  return url
}

const el = {
  dropZone: $('#dropZone'),
  uploadContent: $('#uploadContent'),
  uploadPreview: $('#uploadPreview'),
  uploadThumb: $('#uploadThumb'),
  uploadInfo: $('#uploadInfo'),
  clearBtn: $('#clearBtn'),
  fileInput: $('#fileInput'),
  controls: $('#controls'),
  modeSelect: $('#modeSelect'),
  dimensionsPanel: $('#dimensionsPanel'),
  scalePanel: $('#scalePanel'),
  presetPanel: $('#presetPanel'),
  inputWidth: $('#inputWidth'),
  inputHeight: $('#inputHeight'),
  lockAspect: $('#lockAspect'),
  fitGroup: $('#fitGroup'),
  fitMode: $('#fitMode'),
  inputScale: $('#inputScale'),
  scaleDisplay: $('#scaleDisplay'),
  algorithmSelect: $('#algorithmSelect'),
  formatSelect: $('#formatSelect'),
  qualityGroup: $('#qualityGroup'),
  qualitySlider: $('#qualitySlider'),
  qualityDisplay: $('#qualityDisplay'),
  resizeBtn: $('#resizeBtn'),
  compareBtn: $('#compareBtn'),
  previewEmpty: $('#previewEmpty'),
  resultArea: $('#resultArea'),
  resultTabs: $('#resultTabs'),
  singleResult: $('#singleResult'),
  compareResult: $('#compareResult'),
  resultImage: $('#resultImage'),
  resultStats: $('#resultStats'),
  downloadBtn: $('#downloadBtn'),
  resetBtn: $('#resetBtn'),
  compareGrid: $('#compareGrid'),
  loadingArea: $('#loadingArea'),
  navToggle: $('#navToggle'),
  navLinks: $('#navLinks'),
  nav: $('#nav')
}

function init() {
  bindUpload()
  bindControls()
  bindNav()
  bindSmooth()
}

function bindUpload() {
  el.dropZone.addEventListener('click', (e) => {
    if (e.target === el.clearBtn || el.clearBtn.contains(e.target)) return
    el.fileInput.click()
  })

  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadFile(e.target.files[0])
  })

  el.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault()
    el.dropZone.classList.add('drag-over')
  })

  el.dropZone.addEventListener('dragleave', () => {
    el.dropZone.classList.remove('drag-over')
  })

  el.dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    el.dropZone.classList.remove('drag-over')
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0])
  })

  el.clearBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    clearFile()
  })

  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) loadFile(file)
        return
      }
    }
  })
}

function loadFile(file) {
  if (!file.type.startsWith('image/')) return
  state.file = file

  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      state.originalWidth = img.naturalWidth
      state.originalHeight = img.naturalHeight
      state.aspectRatio = img.naturalWidth / img.naturalHeight

      el.uploadThumb.src = e.target.result
      el.uploadInfo.textContent = `${img.naturalWidth} x ${img.naturalHeight} \u00B7 ${formatBytes(file.size)}`
      el.uploadContent.style.display = 'none'
      el.uploadPreview.style.display = 'flex'
      el.controls.style.display = 'block'
      el.dropZone.classList.add('has-file')

      el.inputWidth.value = img.naturalWidth
      el.inputHeight.value = img.naturalHeight
      el.inputWidth.placeholder = img.naturalWidth
      el.inputHeight.placeholder = img.naturalHeight

      showPreviewEmpty()
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
}

function clearFile() {
  state.file = null
  state.resultCanvas = null
  el.fileInput.value = ''
  el.uploadContent.style.display = 'flex'
  el.uploadPreview.style.display = 'none'
  el.controls.style.display = 'none'
  el.dropZone.classList.remove('has-file')
  showPreviewEmpty()
}

function showPreviewEmpty() {
  el.previewEmpty.style.display = 'flex'
  el.resultArea.style.display = 'none'
  el.loadingArea.style.display = 'none'
}

function showLoading() {
  el.previewEmpty.style.display = 'none'
  el.resultArea.style.display = 'none'
  el.loadingArea.style.display = 'flex'
}

function showResult() {
  el.previewEmpty.style.display = 'none'
  el.loadingArea.style.display = 'none'
  el.resultArea.style.display = 'block'
}

function bindControls() {
  el.modeSelect.querySelectorAll('.control-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      el.modeSelect.querySelectorAll('.control-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      state.mode = tab.dataset.value
      el.dimensionsPanel.style.display = state.mode === 'dimensions' ? 'block' : 'none'
      el.scalePanel.style.display = state.mode === 'scale' ? 'block' : 'none'
      el.presetPanel.style.display = state.mode === 'preset' ? 'grid' : 'none'
    })
  })

  el.inputWidth.addEventListener('input', () => {
    if (el.lockAspect.checked && state.aspectRatio && el.inputWidth.value) {
      el.inputHeight.value = Math.round(el.inputWidth.value / state.aspectRatio)
    }
    updateFitVisibility()
  })

  el.inputHeight.addEventListener('input', () => {
    if (el.lockAspect.checked && state.aspectRatio && el.inputHeight.value) {
      el.inputWidth.value = Math.round(el.inputHeight.value * state.aspectRatio)
    }
    updateFitVisibility()
  })

  el.lockAspect.addEventListener('change', updateFitVisibility)

  el.inputScale.addEventListener('input', () => {
    el.scaleDisplay.textContent = Math.round(el.inputScale.value * 100) + '%'
  })

  $$('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.preset-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      el.inputWidth.value = btn.dataset.w
      el.inputHeight.value = btn.dataset.h
    })
  })

  el.formatSelect.addEventListener('change', () => {
    const lossy = el.formatSelect.value !== 'image/png'
    el.qualityGroup.style.display = lossy ? 'block' : 'none'
  })

  el.qualitySlider.addEventListener('input', () => {
    el.qualityDisplay.textContent = Math.round(el.qualitySlider.value * 100) + '%'
  })

  el.resizeBtn.addEventListener('click', doResize)
  el.compareBtn.addEventListener('click', doCompare)
  el.downloadBtn.addEventListener('click', doDownload)
  el.resetBtn.addEventListener('click', showPreviewEmpty)

  el.resultTabs.querySelectorAll('.result-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      el.resultTabs.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      el.singleResult.style.display = tab.dataset.tab === 'single' ? 'block' : 'none'
      el.compareResult.style.display = tab.dataset.tab === 'compare' ? 'block' : 'none'
    })
  })
}

function updateFitVisibility() {
  const bothSet = el.inputWidth.value && el.inputHeight.value && !el.lockAspect.checked
  el.fitGroup.style.display = bothSet ? 'block' : 'none'
}

function getResizeOptions() {
  const opts = {
    algorithm: el.algorithmSelect.value
  }

  if (state.mode === 'scale') {
    opts.scale = parseFloat(el.inputScale.value)
  } else {
    const w = parseInt(el.inputWidth.value)
    const h = parseInt(el.inputHeight.value)
    if (w) opts.width = w
    if (h) opts.height = h
    if (w && h && !el.lockAspect.checked) {
      opts.fit = el.fitMode.value
    }
  }

  return opts
}

async function doResize() {
  if (!state.file) return

  const opts = getResizeOptions()
  if (!opts.width && !opts.height && !opts.scale) {
    opts.width = state.originalWidth
    opts.height = state.originalHeight
  }

  showLoading()
  el.resizeBtn.disabled = true

  try {
    const start = performance.now()
    const result = await processor.processFromFile(state.file, opts)
    const elapsed = performance.now() - start

    state.resultCanvas = result.canvas
    revokeURLs()

    const format = el.formatSelect.value
    const quality = parseFloat(el.qualitySlider.value)
    const blob = await processor.toBlob(result.canvas, format, quality)
    const url = trackURL(URL.createObjectURL(blob))

    el.resultImage.src = url
    state.resultFormat = format

    const ext = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP' }[format]
    el.resultStats.innerHTML = `
      <div class="stat-grid">
        <div class="stat-item">
          <span class="stat-label">Original</span>
          <span class="stat-value">${state.originalWidth} x ${state.originalHeight}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Resized</span>
          <span class="stat-value">${result.width} x ${result.height}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Format</span>
          <span class="stat-value">${ext}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Size</span>
          <span class="stat-value">${formatBytes(blob.size)}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Algorithm</span>
          <span class="stat-value">${opts.algorithm}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Time</span>
          <span class="stat-value">${elapsed < 1000 ? Math.round(elapsed) + 'ms' : (elapsed / 1000).toFixed(1) + 's'}</span>
        </div>
      </div>
    `

    switchResultTab('single')
    showResult()
  } catch (err) {
    showPreviewEmpty()
    alert('Error: ' + err.message)
  } finally {
    el.resizeBtn.disabled = false
  }
}

async function doCompare() {
  if (!state.file) return

  const baseOpts = getResizeOptions()
  if (!baseOpts.width && !baseOpts.height && !baseOpts.scale) {
    baseOpts.width = Math.round(state.originalWidth * 0.5)
    baseOpts.height = Math.round(state.originalHeight * 0.5)
  }

  showLoading()
  el.compareBtn.disabled = true
  revokeURLs()

  try {
    const algos = ['lanczos', 'bicubic', 'bilinear', 'nearest']
    const format = el.formatSelect.value
    const quality = parseFloat(el.qualitySlider.value)
    let html = ''

    for (const algo of algos) {
      const opts = { ...baseOpts, algorithm: algo }
      const start = performance.now()
      const result = await processor.processFromFile(state.file, opts)
      const elapsed = performance.now() - start
      const blob = await processor.toBlob(result.canvas, format, quality)
      const url = trackURL(URL.createObjectURL(blob))

      html += `
        <div class="compare-item">
          <div class="compare-header">
            <strong>${algo.charAt(0).toUpperCase() + algo.slice(1)}</strong>
            <span>${result.width}x${result.height} \u00B7 ${formatBytes(blob.size)} \u00B7 ${Math.round(elapsed)}ms</span>
          </div>
          <img src="${url}" alt="${algo} result">
        </div>
      `
    }

    el.compareGrid.innerHTML = html
    switchResultTab('compare')
    showResult()
  } catch (err) {
    showPreviewEmpty()
    alert('Error: ' + err.message)
  } finally {
    el.compareBtn.disabled = false
  }
}

function switchResultTab(tab) {
  el.resultTabs.querySelectorAll('.result-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab)
  })
  el.singleResult.style.display = tab === 'single' ? 'block' : 'none'
  el.compareResult.style.display = tab === 'compare' ? 'block' : 'none'
}

async function doDownload() {
  if (!state.resultCanvas) return

  const format = el.formatSelect.value
  const quality = parseFloat(el.qualitySlider.value)
  const blob = await processor.toBlob(state.resultCanvas, format, quality)
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[format]

  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  const baseName = state.file.name.replace(/\.[^.]+$/, '')
  a.download = `${baseName}-resized.${ext}`
  a.click()
  URL.revokeObjectURL(a.href)
}

function bindNav() {
  el.navToggle.addEventListener('click', () => {
    el.navLinks.classList.toggle('open')
    el.navToggle.classList.toggle('open')
  })

  el.navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      el.navLinks.classList.remove('open')
      el.navToggle.classList.remove('open')
    })
  })

  let lastScroll = 0
  window.addEventListener('scroll', () => {
    const st = window.scrollY
    el.nav.classList.toggle('scrolled', st > 50)
    lastScroll = st
  }, { passive: true })
}

function bindSmooth() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'))
      if (target) {
        e.preventDefault()
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  })
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

init()
