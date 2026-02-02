import { updateCurrentSongUI, renderSongList } from './ui.js';

let ytPlayer;
let playerReady = false;
let pendingPlay = null;
let currentSong = null;
let songQueue = [];
let currentIndex = -1;
let isPlaying = false;
let progressInterval = null;

// Force HTTPS if page is loaded via HTTP
function ensureHTTPS() {
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        console.log('Redirecting to HTTPS for secure YouTube iframe loading...');
        window.location.protocol = 'https:';
    }
}

// Call this on load
ensureHTTPS();

// Make this function globally accessible for YouTube API
window.onYouTubeIframeAPIReady = function() {
    try {
        ytPlayer = new YT.Player('player', {
            height: '0',
            width: '0',
            playerVars: {
                'autoplay': 0,
                'controls': 0,
                'rel': 0,
                'showinfo': 0,
                'origin': window.location.origin // Add origin for security
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    } catch (error) {
        console.error('Failed to initialize YouTube player:', error);
        showProtocolError();
    }
};

function onPlayerReady() {
    playerReady = true;
    console.log("YT Player ready!");
    
    // Hide loading indicator
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.opacity = '0';
        setTimeout(() => {
            loading.style.display = 'none';
        }, 300);
    }
    
    // Play queued song if any
    if (pendingPlay) {
        playSelectedSong(pendingPlay);
        pendingPlay = null;
    }
    
    setupControls();
}

function onPlayerStateChange(event) {
    // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updatePlayPauseButton(true);
        startProgressTracking();
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        updatePlayPauseButton(false);
        stopProgressTracking();
    } else if (event.data === YT.PlayerState.ENDED) {
        isPlaying = false;
        updatePlayPauseButton(false);
        stopProgressTracking();
        playNext(); // Auto-play next song
    }
}

function onPlayerError(event) {
    console.error('YT Player error:', event.data);
    
    // Error codes:
    // 2 – Invalid parameter value
    // 5 – HTML5 player error
    // 100 – Video not found or private
    // 101, 150 – Video not embeddable
    
    let errorMessage = 'Error playing video.';
    
    switch(event.data) {
        case 2:
            errorMessage = 'Invalid video parameter.';
            break;
        case 5:
            errorMessage = 'HTML5 player error. This might be a protocol issue (HTTP vs HTTPS).';
            showProtocolError();
            break;
        case 100:
            errorMessage = 'Video not found or is private.';
            break;
        case 101:
        case 150:
            errorMessage = 'Video cannot be embedded. Opening in YouTube...';
            if (currentSong) {
                openInWebViewer(currentSong.videoId);
            }
            break;
    }
    
    console.log(errorMessage);
    showErrorNotification(errorMessage);
}

function showProtocolError() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.innerHTML = `
            <div class="error-content">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3>Connection Protocol Issue</h3>
                <p>YouTube iframes require a secure HTTPS connection.</p>
                <p style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.8;">
                    ${window.location.protocol === 'file:' 
                        ? 'Please serve this app through a web server (not file://)' 
                        : 'Please access this page via HTTPS'}
                </p>
                <button onclick="location.reload()" class="retry-btn">Retry</button>
            </div>
        `;
        loading.style.display = 'flex';
        loading.style.opacity = '1';
    }
}

function showErrorNotification(message) {
    // Create or update error notification
    let notification = document.getElementById('error-notification');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'error-notification';
        notification.className = 'error-notification';
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

function onPlayerError(event) {
    console.error('YT Player error:', event.data);
    alert('Error playing video. It might be restricted or unavailable.');
    if (pendingPlay) {
        openInWebViewer(pendingPlay.videoId);
    }
}

function setupControls() {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const volumeBtn = document.getElementById('volume-btn');
    const volumeSlider = document.getElementById('volume-slider');
    
    if (playPauseBtn) {
        playPauseBtn.addEventListener('click', togglePlayPause);
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', playPrevious);
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', playNext);
    }
    
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value);
            if (ytPlayer && ytPlayer.setVolume) {
                ytPlayer.setVolume(volume);
            }
        });
    }
    
    if (volumeBtn) {
        volumeBtn.addEventListener('click', toggleMute);
    }
}

function togglePlayPause() {
    if (!ytPlayer || !currentSong) return;
    
    if (isPlaying) {
        ytPlayer.pauseVideo();
    } else {
        ytPlayer.playVideo();
    }
}

function updatePlayPauseButton(playing) {
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    
    if (playIcon && pauseIcon) {
        if (playing) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }
}

function playPrevious() {
    if (currentIndex > 0) {
        currentIndex--;
        playSelectedSong(songQueue[currentIndex]);
    }
}

function playNext() {
    if (currentIndex < songQueue.length - 1) {
        currentIndex++;
        playSelectedSong(songQueue[currentIndex]);
    }
}

function toggleMute() {
    if (!ytPlayer || !ytPlayer.isMuted) return;
    
    const isMuted = ytPlayer.isMuted();
    if (isMuted) {
        ytPlayer.unMute();
    } else {
        ytPlayer.mute();
    }
}

function startProgressTracking() {
    stopProgressTracking(); // Clear any existing interval
    
    progressInterval = setInterval(() => {
        if (ytPlayer && ytPlayer.getCurrentTime) {
            const currentTime = ytPlayer.getCurrentTime();
            const duration = ytPlayer.getDuration();
            
            updateProgressBar(currentTime, duration);
        }
    }, 1000);
}

function stopProgressTracking() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

function updateProgressBar(current, total) {
    const progressFill = document.getElementById('progress-fill');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    
    if (progressFill && total > 0) {
        const percentage = (current / total) * 100;
        progressFill.style.width = percentage + '%';
    }
    
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(current);
    }
    
    if (durationEl) {
        durationEl.textContent = formatTime(total);
    }
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Play song
export function playSelectedSong(song) {
    if (!playerReady) {
        pendingPlay = song;
        console.log("Player not ready yet! Queuing song...");
        return;
    }

    try {
        currentSong = song;
        ytPlayer.loadVideoById(song.videoId);
        updateCurrentSongUI(song);
        
        // Show controls
        const controls = document.getElementById('controls');
        if (controls) {
            controls.style.display = 'block';
        }
        
        // Update current index in queue
        const index = songQueue.findIndex(s => s.videoId === song.videoId);
        if (index !== -1) {
            currentIndex = index;
        }
        
    } catch (err) {
        console.error("YT embed blocked, using WebViewer fallback", err);
        openInWebViewer(song.videoId);
    }
}

// Fallback if embed blocked
export function openInWebViewer(videoId) {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'width=800,height=600');
}

// Initialize app with song list
export function initializeApp(songs) {
    songQueue = songs;
    renderSongList(songs);
}

// Export for UI to access
export { currentSong, songQueue, currentIndex };
