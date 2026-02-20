export let player, ytReady = false;

window.onYouTubeIframeAPIReady = () => {
  ytReady = true;
  player = new YT.Player('yt-player', {
    height: '1',
    width: '1',
    playerVars: { controls: 0 }
  });
};

export function playVideo(id, volume) {
  if (!player) return;
  player.loadVideoById(id);
  player.setVolume(volume);
}