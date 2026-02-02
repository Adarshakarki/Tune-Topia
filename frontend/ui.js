import { playSelectedSong, currentSong } from './player.js';

export function renderSongList(songs) {
    const container = document.getElementById('song-list');
    if (!container) return;
    
    container.innerHTML = '';

    songs.forEach((song, index) => {
        const div = document.createElement('div');
        div.classList.add('song-item');
        div.dataset.index = index;

        // Use higher quality thumbnail if available
        const thumbnailUrl = song.thumbnails[1]?.url || song.thumbnails[0]?.url;

        div.innerHTML = `
            <div class="song-thumbnail">
                <img src="${thumbnailUrl}" alt="${song.name}" class="song-thumb">
                <div class="play-overlay">
                    <button class="play-btn" aria-label="Play ${song.name}">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="song-info">
                <span class="song-name" title="${song.name}">${song.name}</span>
                <span class="song-artist" title="${song.artist}">${song.artist}</span>
            </div>
        `;

        // Click handler for the entire card
        div.addEventListener('click', () => {
            playSelectedSong(song);
            highlightCurrentSong(div);
        });

        container.appendChild(div);
    });
}

export function updateCurrentSongUI(song) {
    const current = document.getElementById('current-song');
    if (!current) return;
    
    const thumbnailUrl = song.thumbnails[1]?.url || song.thumbnails[0]?.url;
    
    current.innerHTML = `
        <div class="now-playing-content">
            <div class="now-playing-image">
                <img src="${thumbnailUrl}" alt="${song.name}">
                <div class="now-playing-pulse"></div>
            </div>
            <div class="now-playing-info">
                <div class="now-playing-label">Now Playing</div>
                <div class="current-name">${song.name}</div>
                <div class="current-artist">${song.artist}</div>
            </div>
            <div class="equalizer">
                <span class="bar"></span>
                <span class="bar"></span>
                <span class="bar"></span>
                <span class="bar"></span>
            </div>
        </div>
    `;
}

function highlightCurrentSong(activeElement) {
    // Remove active class from all items
    const allItems = document.querySelectorAll('.song-item');
    allItems.forEach(item => item.classList.remove('active'));
    
    // Add active class to current item
    if (activeElement) {
        activeElement.classList.add('active');
    }
}