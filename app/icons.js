// Icon registry
export const ICONS = {
  play: 'bi-play-fill', pause: 'bi-pause-fill', heart: 'bi-heart', heartFill: 'bi-heart-fill',
  more: 'bi-three-dots-vertical', chat: 'bi-chat-square-quote-fill', queue: 'bi-music-note-list', error: 'bi-wifi-off',
  music: 'bi-music-note-beamed', disc: 'bi-disc-fill', people: 'bi-people-fill', history: 'bi-clock-history',
  person: 'bi-person-circle', personFill: 'bi-person-fill', chevronL: 'bi-chevron-left', chevronR: 'bi-chevron-right',
  shuffle: 'bi-shuffle', repeat: 'bi-repeat', prev: 'bi-skip-start-fill', next: 'bi-skip-end-fill',
  trash: 'bi-trash', download: 'bi-download', share: 'bi-share-fill', external: 'bi-box-arrow-up-right',
  plus: 'bi-plus-lg', pencil: 'bi-pencil', search: 'bi-search', house: 'bi-house-fill', stars: 'bi-stars',
  arrowUp: 'bi-arrow-up', arrowDown: 'bi-arrow-down', moon: 'bi-moon-stars', wiki: 'bi-wikipedia',
  refresh: 'bi-arrow-repeat', video: 'bi-camera-video-fill'
};

export const getIcon = (k, c = '') => `<i class="bi ${ICONS[k] || k} ${c}"></i>`;