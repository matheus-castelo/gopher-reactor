let mediaURL = "";
let currentSubtitles = [];
let syncOffset = 0;
let typingTimer;
let currentToastId = 0;
let fontSize = 26;
let hasWhisper = false;
let selectedMicId = null;
let selectedSpeakerId = null;
let ttsMode = localStorage.getItem('ttsMode') || 'edge';

function toggleSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal.style.display === 'none') {
        document.getElementById('ttsModeSelect').value = ttsMode;
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
    }
}
function updateTTSMode() {
    ttsMode = document.getElementById('ttsModeSelect').value;
    localStorage.setItem('ttsMode', ttsMode);
}

function getEnglishVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    let voice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Online') || v.name.includes('Natural') || v.name.includes('Google')));
    if (!voice) {
        voice = voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
    }
    return voice;
}
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = getEnglishVoice;
}

window.onload = function() {
  if (window.go && window.go.app && window.go.app.App) {
     if (window.go.app.App.HasWhisper) {
         window.go.app.App.HasWhisper().then(hw => {
             hasWhisper = hw;
         }).catch(e => { hasWhisper = false; });
     }
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
  detectDevices();
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', detectDevices);
  }
};
async function detectDevices() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    const micSelect = document.getElementById('micSelect');
    const micWrapper = document.getElementById('micWrapper');
    if (micSelect && micWrapper && audioInputs.length > 0) {
      const currentValue = micSelect.value;
      micSelect.innerHTML = '';
      audioInputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Microphone ${index + 1}`;
        micSelect.appendChild(option);
      });
      micWrapper.style.display = 'inline-flex';
      if (currentValue && Array.from(micSelect.options).some(opt => opt.value === currentValue)) {
        micSelect.value = currentValue;
      } else {
        selectedMicId = micSelect.value;
      }
      micSelect.onchange = (e) => {
        selectedMicId = e.target.value;
      };
    }
    const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
    const speakerSelect = document.getElementById('speakerSelect');
    const speakerWrapper = document.getElementById('speakerWrapper');
    if (speakerSelect && speakerWrapper && audioOutputs.length > 0) {
      const currentValue = speakerSelect.value;
      speakerSelect.innerHTML = '';
      audioOutputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Speaker ${index + 1}`;
        speakerSelect.appendChild(option);
      });
      speakerWrapper.style.display = 'inline-flex';
      if (currentValue && Array.from(speakerSelect.options).some(opt => opt.value === currentValue)) {
        speakerSelect.value = currentValue;
      } else {
        selectedSpeakerId = speakerSelect.value;
      }
      speakerSelect.onchange = (e) => {
        selectedSpeakerId = e.target.value;
        const vid = document.getElementById('vid');
        if (vid && vid.setSinkId) {
            vid.setSinkId(selectedSpeakerId).catch(console.error);
        }
      };
    }
  } catch (err) {
    console.error("Error detecting devices:", err);
  }
}
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
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let isPracticeModeActive = false; 
let currentPracticedSub = null;
let liteRecognition = null;
let hasPracticedCurrentSub = false;
let isReplaying = false;
if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    liteRecognition = new SpeechRecognition();
    liteRecognition.continuous = true; 
    liteRecognition.interimResults = true; 
    liteRecognition.lang = 'en-US';
    liteRecognition.onresult = function(event) {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
            fullTranscript += event.results[i][0].transcript;
        }
        fullTranscript = fullTranscript.trim();
        processProgressiveSpeech(fullTranscript);
    };
    liteRecognition.onerror = function(event) {
        console.error("Lite Speech Recognition error:", event.error);
        if (event.error !== 'no-speech') {
            stopRecording();
        }
    };
    liteRecognition.onend = function() {
        if (isRecording && !hasWhisper) {
            try {
                liteRecognition.start();
            } catch(e) {}
        }
    };
}
const vid = document.getElementById('vid');
const subtitleDiv = document.getElementById('custom-subtitles');
vid.addEventListener('timeupdate', () => {
  if (currentSubtitles.length === 0) return;
  let currentTime = vid.currentTime + syncOffset;
  let activeSubtitle = currentSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);
  if (isReplaying && currentPracticedSub) {
      let htmlPhrase = '';
      currentPracticedSub.words.forEach((word) => {
          htmlPhrase += `<span onclick="speakWord('${word.text.replace(/'/g, "&apos;")}')"
            style="cursor:pointer" ${currentTime >= word.time ? 'class="word-active"' : ''}>${word.text}</span> `;
      });
      subtitleDiv.innerHTML = htmlPhrase;
      subtitleDiv.style.display = "block";
      if (!vid.seeking && currentTime >= currentPracticedSub.end && !vid.paused) {
          vid.pause();
          hasPracticedCurrentSub = true;
          isReplaying = false;
          showPracticeOverlay();
      }
      return;
  }
  if (isPracticeModeActive && currentPracticedSub && !hasPracticedCurrentSub && !vid.paused) {
      if (!vid.seeking && currentTime >= currentPracticedSub.end) {
          vid.pause();
          hasPracticedCurrentSub = true;
          showPracticeOverlay();
          return;
      }
  }
  if (activeSubtitle) {
      if (!currentPracticedSub || currentPracticedSub.start !== activeSubtitle.start) {
          if (isReplaying) {
          } else if (isPracticeModeActive && hasPracticedCurrentSub && vid.paused) {
          } else {
              currentPracticedSub = {
                  ...activeSubtitle,
                  targetWords: activeSubtitle.words.map(w => ({
                      original: w.text,
                      clean: w.text.toLowerCase().replace(/[.,!?]/g, '')
                  })),
                  matchedCount: 0,
                  savedMatchedCount: 0,
                  wrongAttempts: []
              };
              hasPracticedCurrentSub = false;
          }
      }
      let htmlPhrase = '';
      activeSubtitle.words.forEach((word) => {
          htmlPhrase += `<span onclick="speakWord('${word.text.replace(/'/g, "&apos;")}')"
            style="cursor:pointer" ${currentTime >= word.time ? 'class="word-active"' : ''}>${word.text}</span> `;
      });
      subtitleDiv.innerHTML = htmlPhrase;
      subtitleDiv.style.display = "block";
  } else {
      subtitleDiv.innerHTML = "";
      subtitleDiv.style.display = "none";
  }
});
function showPracticeOverlay() {
    if (!currentPracticedSub) return;
    currentPracticedSub.matchedCount = 0;
    currentPracticedSub.savedMatchedCount = 0;
    currentPracticedSub.wrongAttempts = [];
    document.getElementById('listening-indicator').style.display = 'flex';
    let targetHtml = '';
    currentPracticedSub.words.forEach(w => {
        let safeWord = w.text.replace(/'/g, "&apos;");
        targetHtml += `<span onclick="speakWord('${safeWord}')" style="cursor:pointer">${w.text}</span> `;
    });
    document.getElementById('listening-target-text').innerHTML = targetHtml;
    document.getElementById('listening-spoken-text').innerHTML = "Waiting for audio...";
    document.getElementById('listening-text').innerHTML = "";
    document.getElementById('pronunciation-score').innerHTML = "";
    renderListeningText();
    toggleRecord();
}
window.resetPractice = function() {
    if (!currentPracticedSub) return;
    currentPracticedSub.savedMatchedCount = 0;
    currentPracticedSub.matchedCount = 0;
    currentPracticedSub.wrongAttempts = [];
    document.getElementById('listening-spoken-text').innerHTML = "Waiting for audio...";
    document.getElementById('listening-text').innerHTML = "";
    document.getElementById('pronunciation-score').innerHTML = "";
    renderListeningText();
    if (!isRecording) {
        toggleRecord();
    }
};
function togglePracticeModeGlobal() {
    isPracticeModeActive = !isPracticeModeActive;
    const btn = document.getElementById('btnGlobalPractice');
    if (isPracticeModeActive) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
        showToast("Practice Mode", "Auto-pause enabled.", "info");
    } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        hidePracticeOverlay();
        showToast("Practice Mode", "Disabled.", "info");
    }
}
function hidePracticeOverlay() {
    document.getElementById('listening-indicator').style.display = 'none';
    stopRecording();
}
function speakWord(word) {
    if (window.speakTextKokoro) {
        window.speakTextKokoro(word);
    } else if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(word);
        u.lang = 'en-US';
        window.speechSynthesis.speak(u);
    }
}
window.skipPractice = function() {
    isReplaying = false;
    hasPracticedCurrentSub = true; 
    hidePracticeOverlay();
    vid.play();
};
window.replayPracticePhrase = function() {
    if (!currentPracticedSub) return;
    hasPracticedCurrentSub = false;
    isReplaying = true;
    hidePracticeOverlay();
    let targetTime = currentPracticedSub.start;
    if (currentPracticedSub.words && currentPracticedSub.words.length > 0) {
        targetTime = currentPracticedSub.words[0].time;
    }
    vid.currentTime = Math.max(0, targetTime - syncOffset - 0.1);
    vid.play();
};
window.backPracticePhrase = function() {
    if (!currentPracticedSub || currentSubtitles.length === 0) return;
    let currentIndex = currentSubtitles.findIndex(sub => sub.start === currentPracticedSub.start);
    isReplaying = false;
    hasPracticedCurrentSub = false;
    hidePracticeOverlay();
    if (currentIndex <= 0) {
        vid.currentTime = 0;
        vid.play();
        return;
    }
    let previousSub = currentSubtitles[currentIndex - 1];
    let targetTime = previousSub.start;
    if (previousSub.words && previousSub.words.length > 0) {
        targetTime = previousSub.words[0].time;
    }
    vid.currentTime = Math.max(0, targetTime - syncOffset - 0.1);
    vid.play();
};
window.speakPracticePhrase = function(phraseObj = currentPracticedSub) {
    if (!phraseObj) {
        showToast("Practice Error", "No subtitle active.", "error");
        return;
    }
    if (!phraseObj.targetWords) {
        currentPracticedSub = {
            ...phraseObj,
            targetWords: phraseObj.words.map(w => ({
                original: w.text,
                clean: w.text.toLowerCase().replace(/[.,!?]/g, '')
            })),
            matchedCount: 0,
            wrongAttempts: []
        };
    }
    const text = currentPracticedSub.words.map(w => w.text).join(' ');
    speakWord(text);
}
function speakWord(text) {
    if (hasWhisper) {
        window.speakTextKokoro(text);
        return;
    }
    
    if (ttsMode === 'edge' && window.go && window.go.app && window.go.app.App && window.go.app.App.SpeakEdgeTTS) {
        window.go.app.App.SpeakEdgeTTS(text, "en-US-AriaNeural").then(base64Audio => {
            const audio = new Audio("data:audio/mp3;base64," + base64Audio);
            audio.play();
        }).catch(err => {
            showToast("Edge TTS Error", err, "error");
            fallbackWebSpeech(text);
        });
        return;
    }
    
    fallbackWebSpeech(text);
}

function fallbackWebSpeech(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    
    let voice = getEnglishVoice();
    if (voice) {
        utterance.voice = voice;
    }
    
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
}
function renderListeningText() {
    const textEl = document.getElementById('listening-text');
    const spokenEl = document.getElementById('listening-spoken-text');
    if (!currentPracticedSub) return;
    let html = '';
    const words = currentPracticedSub.targetWords;
    const matchedCount = currentPracticedSub.matchedCount;
    for (let i = 0; i < words.length; i++) {
        let safeWord = words[i].original.replace(/'/g, "\\'");
        let onClickAttr = `onclick="speakWord('${safeWord}')" style="cursor:pointer"`;
        if (i < matchedCount) {
            html += `<span class="word-correct" ${onClickAttr}>${words[i].original}</span> `;
        } else if (i === matchedCount) {
            html += `<span class="word-target" ${onClickAttr}>${words[i].original}</span>`;
            if (currentPracticedSub.wrongAttempts.length > 0) {
                const wrongText = currentPracticedSub.wrongAttempts.slice(-2).join(" ");
                html += ` <span class="word-wrong">${wrongText}</span> `;
            } else {
                html += ` `;
            }
        } else {
            html += `<span class="word-pending" ${onClickAttr}>${words[i].original}</span> `;
        }
    }
    if (textEl) textEl.innerHTML = html || "Listening...";
    if (matchedCount === words.length && words.length > 0) {
        if (spokenEl) spokenEl.innerHTML = "<span style='color: var(--success); font-weight: bold;'>Perfect!</span>";
        if (textEl) textEl.innerHTML = "<span style='color: var(--success); font-weight: bold;'>Perfect!</span>";
        if (isRecording) {
            stopRecording();
        }
        setTimeout(() => {
            skipPractice();
        }, 1500);
    }
}
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= a.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}
function processProgressiveSpeech(transcript) {
    if (!currentPracticedSub) return;
    const spokenWords = transcript.toLowerCase().replace(/[.,!?]/g, '').split(' ').filter(w => w.length > 0);
    if (spokenWords.length === 0) return;
    const expectedWords = currentPracticedSub.targetWords.slice(currentPracticedSub.savedMatchedCount).map(w => w.clean);
    const spokenString = spokenWords.join(' ');
    const expectedString = expectedWords.join(' ');
    const distance = levenshteinDistance(spokenString, expectedString);
    const maxLen = Math.max(spokenString.length, expectedString.length);
    let accuracy = 0;
    if (maxLen > 0) {
        accuracy = Math.round((1 - (distance / maxLen)) * 100);
    }
    const scoreEl = document.getElementById('pronunciation-score');
    if (scoreEl) {
        let emoji = accuracy >= 80 ? '🎯' : accuracy >= 50 ? '👍' : '🤔';
        scoreEl.innerHTML = `${emoji} ${accuracy}%`;
    }
    currentPracticedSub.matchedCount = currentPracticedSub.savedMatchedCount || 0;
    currentPracticedSub.wrongAttempts = [];
    let targetIndex = currentPracticedSub.matchedCount;
    for (let i = 0; i < spokenWords.length; i++) {
        const spokenWord = spokenWords[i];
        if (targetIndex >= currentPracticedSub.targetWords.length) break;
        const targetWord = currentPracticedSub.targetWords[targetIndex].clean;
        if (spokenWord === targetWord) {
            currentPracticedSub.matchedCount++;
            targetIndex++;
            currentPracticedSub.wrongAttempts = [];
        } else {
            if (targetIndex + 1 < currentPracticedSub.targetWords.length && spokenWord === currentPracticedSub.targetWords[targetIndex+1].clean) {
                currentPracticedSub.matchedCount += 2;
                targetIndex += 2;
                currentPracticedSub.wrongAttempts = [];
            } else {
                currentPracticedSub.wrongAttempts.push(spokenWord);
            }
        }
    }
    renderListeningText();
}
async function toggleRecord() {
    if (isRecording) {
        stopRecording();
        return;
    }
    isRecording = true;
    const btnRecord = document.getElementById('btnRecord');
    if (btnRecord) {
        btnRecord.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg> Stop';
        btnRecord.classList.remove('btn-primary');
        btnRecord.classList.add('btn-secondary');
        btnRecord.style.background = 'var(--error)';
        btnRecord.style.color = '#fff';
    }
    if (currentPracticedSub) {
        currentPracticedSub.savedMatchedCount = currentPracticedSub.matchedCount || 0;
        currentPracticedSub.wrongAttempts = [];
        renderListeningText();
    }
    if (hasWhisper) {
        try {
            let audioConstraints = {
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true
            };
            if (selectedMicId) {
                audioConstraints.deviceId = { exact: selectedMicId };
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
            detectDevices();
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                try {
                    const wavBlob = await convertBlobToWav(audioBlob);
                    const formData = new FormData();
                    formData.append("file", wavBlob, "audio.wav");
                    formData.append("response_format", "json");
                    formData.append("language", "en");
                    if (currentPracticedSub && currentPracticedSub.targetWords) {
                        const expectedWordsString = currentPracticedSub.targetWords.map(w => w.original).join(' ');
                        formData.append("prompt", expectedWordsString);
                    }
                    const response = await fetch('http://127.0.0.1:8080/inference', {
                        method: 'POST',
                        body: formData
                    });
                    const data = await response.json();
                    if (data && data.text) {
                        processProgressiveSpeech(data.text);
                    }
                } catch (e) {
                    console.error("Whisper API error:", e);
                }
            };
            mediaRecorder.start();
        } catch (err) {
            stopRecording();
        }
    } else {
        if (liteRecognition) {
            try {
                if (currentPracticedSub && currentPracticedSub.targetWords) {
                    try {
                        const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
                        if (SpeechGrammarList) {
                            const expectedWords = currentPracticedSub.targetWords.map(w => w.clean).filter(w => w);
                            if (expectedWords.length > 0) {
                                const grammar = '#JSGF V1.0; grammar phrase; public <phrase> = (' + expectedWords.join(' | ') + ') ;';
                                const speechRecognitionList = new SpeechGrammarList();
                                speechRecognitionList.addFromString(grammar, 1);
                                liteRecognition.grammars = speechRecognitionList;
                            }
                        }
                    } catch (grammarErr) {
                        console.warn("Grammar injection failed, ignoring:", grammarErr);
                    }
                }
                liteRecognition.start();
            } catch(e) {
                console.error("Failed to start speech recognition:", e);
                stopRecording();
            }
        } else {
            stopRecording();
        }
    }
}
function stopRecording() {
    isRecording = false;
    const btnRecord = document.getElementById('btnRecord');
    if (btnRecord) {
        btnRecord.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg> Record';
        btnRecord.classList.add('btn-primary');
        btnRecord.classList.remove('btn-secondary');
        btnRecord.style.background = '';
        btnRecord.style.color = '';
    }
    if (hasWhisper && mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
    } else if (!hasWhisper && liteRecognition) {
        try {
            liteRecognition.stop();
        } catch(e) {}
    }
}
async function convertBlobToWav(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const offlineCtx = new OfflineAudioContext(1, audioBuffer.duration * 16000, 16000);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    const resampledBuffer = await offlineCtx.startRendering();
    return encodeWAV(resampledBuffer);
}
function encodeWAV(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; 
    const bitDepth = 16;
    const result = new Float32Array(audioBuffer.length);
    audioBuffer.copyFromChannel(result, 0);
    const buffer = new ArrayBuffer(44 + result.length * 2);
    const view = new DataView(buffer);
    const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + result.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, result.length * 2, true);
    let offset = 44;
    for (let i = 0; i < result.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, result[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([view], { type: 'audio/wav' });
}
