// Icons
const ICON_MAP = {
  play: 'play-fill',
  pause: 'pause-fill',
  more: 'three-dots-vertical',
  heart: 'heart',
  heartFill: 'heart-fill',
  shuffle: 'shuffle',
  repeat: 'arrow-repeat',
  plus: 'plus-lg',
  moon: 'moon-stars',
  queue: 'list-ul',
  chat: 'chat-left-quote-fill',
  atmos: 'speaker',
  person: 'person-circle',
  'chevron-left': 'chevron-left',
  'chevron-down': 'chevron-down',
  'chevron-up': 'chevron-up',
  infinite: 'infinity',
  stars: 'stars',
  error: 'exclamation-circle',
  music: 'music-note-beamed',
  sidebar: 'layout-sidebar-reverse',
  home: 'house-fill',
  search: 'search',
  history: 'clock-history',
  collection: 'collection',
  'chevron-right': 'chevron-right',
  sort: 'sort-down',
  close: 'x-lg',
  settings: 'gear-fill',
  edit: 'pencil',
  download: 'download',
  import: 'box-arrow-in-right',
  trash: 'trash',
  refresh: 'arrow-clockwise',
  prev: 'skip-backward-fill',
  next: 'skip-forward-fill',
  'volume-low': 'volume-down-fill',
  'volume-high': 'volume-up-fill',
  share: 'share',
  external: 'box-arrow-up-right',
  info: 'info-circle',
  cd: 'disc-fill',
  camera: 'camera-video-fill',
  github: 'github',
  google: 'google',
  warning: 'cone-striped',
};

export function getIcon(name) {
  const icon = ICON_MAP[name] || name;
  return `<i class="bi bi-${icon}"></i>`;
}

export function replaceHtmlIcons() {
  const icons = document.querySelectorAll('[data-icon]');
  icons.forEach(el => {
    el.innerHTML = getIcon(el.dataset.icon);
  });
}

export function _isAtmos(t) {
  if (!t) return false;
  return t.audioModes?.includes('DOLBY_ATMOS') || t.title?.toLowerCase().includes('dolby atmos');
}