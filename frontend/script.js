let mediaURL = "";
let currentSubtitles = [];
let syncOffset = 0;
let typingTimer;
let currentToastId = 0;
let fontSize = 26;

window.onload = function() {
  if (window.go && window.go.app && window.go.app.App) {
     window.go.app.App.GetMediaURL().then(url => {
       mediaURL = url;
     });
     
     if (window.runtime && window.runtime.EventsOn) {
       window.runtime.EventsOn("download:progress", handleProgressEvent);
     }
  }

  const urlInput = document.getElementById('videoUrl');
  if (urlInput) {
    urlInput.addEventListener('input', handleUrlInput);
  }

  const syncInput = document.getElementById('syncInput');
  if (syncInput) {
    syncInput.addEventListener('input', () => {
      const val = parseFloat(syncInput.value);
      if (!isNaN(val)) {
        syncOffset = val;
      }
    });
  }

  document.addEventListener('keydown', handleKeyboardShortcuts);
};

function toggleDrawer() {
  const drawer = document.getElementById('sideDrawer');
  const mainContent = document.getElementById('mainContent');
  drawer.classList.toggle('open');
  mainContent.classList.toggle('drawer-open');
}

function handleKeyboardShortcuts(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if (e.shiftKey && e.key === 'ArrowRight') {
    adjustSync(0.1);
    e.preventDefault();
  } else if (e.shiftKey && e.key === 'ArrowLeft') {
    adjustSync(-0.1);
    e.preventDefault();
  } else if (e.ctrlKey && e.key === 'ArrowUp') {
    adjustFontSize(2);
    e.preventDefault();
  } else if (e.ctrlKey && e.key === 'ArrowDown') {
    adjustFontSize(-2);
    e.preventDefault();
  }
}

function showToast(title, message, type = 'info', id = null, progress = -1) {
  const container = document.getElementById('toastContainer');
  const toastId = id || `toast-${currentToastId++}`;
  
  let toastEl = document.getElementById(toastId);
  
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = toastId;
    toastEl.className = `toast toast-${type}`;
    if (progress >= 0) toastEl.classList.add('has-progress');
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/200/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/200/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
      iconSvg = `<svg class="toast-icon" xmlns="http://www.w3.org/200/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toastEl.innerHTML = `
      <div class="toast-header">
        ${iconSvg}
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          <div class="toast-message">${message}</div>
        </div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width: ${Math.max(0, progress)}%"></div></div>
    `;
    container.appendChild(toastEl);
    
    requestAnimationFrame(() => {
      toastEl.classList.add('show');
    });
  } else {
    toastEl.className = `toast toast-${type} show`;
    if (progress >= 0) {
      toastEl.classList.add('has-progress');
      const fill = toastEl.querySelector('.progress-fill');
      if (fill) fill.style.width = `${progress}%`;
    }
    toastEl.querySelector('.toast-title').textContent = title;
    toastEl.querySelector('.toast-message').textContent = message;
  }

  if (progress < 0 || progress >= 100 || type === 'error') {
    setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => {
        if (toastEl.parentNode) toastEl.remove();
      }, 300);
    }, 5000);
  }
  
  return toastId;
}

function handleProgressEvent(data) {
  if (!data) return;
  const { id, type, percent, status } = data;
  showToast(`Downloading ${type}`, status, 'info', id, percent);
}

function handleUrlInput(event) {
  clearTimeout(typingTimer);
  const url = event.target.value.trim();
  const subSelect = document.getElementById('subLang');
  const formatSelect = document.getElementById('videoFormat');

  if (!url || !url.startsWith('http')) {
    subSelect.innerHTML = '<option value="">Subtitle Language...</option>';
    formatSelect.innerHTML = '<option value="">Video Format...</option>';
    return;
  }

  subSelect.innerHTML = '<option value="">Fetching...</option>';
  formatSelect.innerHTML = '<option value="">Fetching...</option>';

  typingTimer = setTimeout(() => {
    if (window.go && window.go.app && window.go.app.App.ValidateURL) {
      window.go.app.App.ValidateURL(url).then(() => {
        fetchAvailableSubtitles(url);
        fetchAvailableFormats(url);
      }).catch(err => {
        showToast("Invalid URL", err, "error");
        subSelect.innerHTML = '<option value="">Error</option>';
        formatSelect.innerHTML = '<option value="">Error</option>';
      });
    } else {
      fetchAvailableSubtitles(url);
      fetchAvailableFormats(url);
    }
  }, 1000);
}

function fetchAvailableSubtitles(url) {
  if (window.go && window.go.app && window.go.app.App) {
    window.go.app.App.FetchAvailableSubtitles(url)
      .then(options => {
        const subSelect = document.getElementById('subLang');
        subSelect.innerHTML = '';

        if (!options || options.length === 0) {
          subSelect.innerHTML = '<option value="">No Subtitles</option>';
          return;
        }

        options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt.code;
          option.textContent = opt.label;
          if (opt.code === 'en' || opt.code === 'en-orig') {
            option.selected = true;
          }
          subSelect.appendChild(option);
        });
      })
      .catch(err => {
        showToast("Subtitle Error", err, "error");
        document.getElementById('subLang').innerHTML = '<option value="">Error</option>';
      });
  }
}

function fetchAvailableFormats(url) {
  if (window.go && window.go.app && window.go.app.App) {
    window.go.app.App.FetchAvailableFormats(url)
      .then(formats => {
        const formatSelect = document.getElementById('videoFormat');
        formatSelect.innerHTML = '';

        if (!formats || formats.length === 0) {
          formatSelect.innerHTML = '<option value="">No Formats</option>';
          return;
        }

        const bestOption = document.createElement('option');
        bestOption.value = '';
        bestOption.textContent = 'Best Quality (auto)';
        formatSelect.appendChild(bestOption);

        formats.forEach(f => {
          if (f.note === 'storyboard') return;
          const option = document.createElement('option');
          option.value = f.format_id;

          let label = f.format_id + ' | ' + f.ext;
          if (f.audio_only) {
            label += ' | (Audio Only) ' + f.note;
          } else {
            label += ' | ' + f.resolution;
            if (f.note) label += ' ' + f.note;
          }
          if (f.codec) label += ' | ' + f.codec;
          if (f.size) label += ' | ' + f.size;

          option.textContent = label;
          formatSelect.appendChild(option);
        });
      })
      .catch(err => {
        showToast("Format Error", err, "error");
        document.getElementById('videoFormat').innerHTML = '<option value="">Error</option>';
      });
  }
}

function selectDestinationFolder() {
  if (window.go && window.go.app && window.go.app.App) {
    window.go.app.App.SelectDirectory().then(path => {
      if (path) {
        document.getElementById('destPath').value = path;
      }
    }).catch(err => showToast("Folder Error", err, "error"));
  }
}

function executeVideoDownload() {
  const url = document.getElementById('videoUrl').value;
  const destPath = document.getElementById('destPath').value;
  const formatID = document.getElementById('videoFormat').value;

  if (!url) {
    showToast("URL Required", "Please enter a valid YouTube URL.", "error");
    return;
  }

  const btn = document.getElementById('btnDownloadVideo');
  btn.disabled = true;
  
  const toastId = `dl-vid-${Date.now()}`;
  showToast("Downloading Video", "Starting download...", "info", toastId, 0);

  const downloadFn = formatID
    ? window.go.app.App.DownloadVideoWithFormat(url, formatID, destPath)
    : window.go.app.App.DownloadVideo(url, destPath);

  downloadFn
    .then(() => showToast("Download Complete", "Video downloaded successfully!", "success", toastId, 100))
    .catch(err => showToast("Download Failed", err, "error", toastId))
    .finally(() => { btn.disabled = false; });
}

function executeSubtitleDownload() {
  const url = document.getElementById('videoUrl').value;
  const lang = document.getElementById('subLang').value;
  const subFormat = document.getElementById('subFormat').value;
  const destPath = document.getElementById('destPath').value;

  if (!url || !lang) {
    showToast("Input Required", "Please enter URL and wait for subtitle list.", "error");
    return;
  }

  const btn = document.getElementById('btnDownloadSub');
  btn.disabled = true;

  const toastId = `dl-sub-${Date.now()}`;
  showToast("Downloading Subtitle", "Starting download...", "info", toastId, 0);

  window.go.app.App.DownloadSubtitleWithFormat(url, lang, subFormat, destPath)
    .then(() => showToast("Download Complete", "Subtitle downloaded successfully!", "success", toastId, 100))
    .catch(err => showToast("Download Failed", err, "error", toastId))
    .finally(() => { btn.disabled = false; });
}

function selectVideo() {
  window.go.app.App.SelectVideoFile().then(path => {
    if (path) {
      const vid = document.getElementById('vid');
      vid.src = mediaURL + '/video?t=' + Date.now();
      vid.play();
    }
  });
}

function selectSubtitle() {
  window.go.app.App.LoadSubtitle().then(jsonString => {
    if (jsonString && jsonString !== "[]") {
        currentSubtitles = JSON.parse(jsonString);
        showToast("Subtitles Loaded", `${currentSubtitles.length} blocks ready.`, "success");
    }
  }).catch(err => showToast("Load Error", err, "error"));
}

function adjustSync(seconds) {
  syncOffset += seconds;
  document.getElementById('syncInput').value = syncOffset.toFixed(2);
}

function adjustFontSize(delta) {
  fontSize = Math.max(12, Math.min(60, fontSize + delta));
  document.getElementById('custom-subtitles').style.fontSize = `${fontSize}px`;
}

function onWordClick(wordText) {
  console.log("Clicked word:", wordText);
}

const vid = document.getElementById('vid');
const subtitleDiv = document.getElementById('custom-subtitles');

vid.addEventListener('timeupdate', () => {
  if (currentSubtitles.length === 0) return;

  let currentTime = vid.currentTime + syncOffset;
  let activeSubtitle = currentSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);

  if (activeSubtitle) {
      let htmlPhrase = '';
      activeSubtitle.words.forEach(word => {
          if (currentTime >= word.time) {
              htmlPhrase += `<span class="word-active" onclick="onWordClick('${word.text.replace(/'/g, "\\'")}')">${word.text}</span> `;
          } else {
              htmlPhrase += `<span onclick="onWordClick('${word.text.replace(/'/g, "\\'")}')">${word.text}</span> `;
          }
      });
      subtitleDiv.innerHTML = htmlPhrase;
      subtitleDiv.style.display = "block";
  } else {
      subtitleDiv.innerHTML = "";
      subtitleDiv.style.display = "none";
  }
});
