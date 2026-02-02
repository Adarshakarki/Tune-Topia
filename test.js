import YTMusic from 'ytmusic-api';

async function main() {
    const ytmusic = new YTMusic();
    await ytmusic.initialize();

    // Search query
    const results = await ytmusic.search('Imagine Dragons Believer');

    // Filter only songs
    const songs = results.filter(item => item.type === 'SONG');

    console.log('Search Results:');
    songs.forEach((item, index) => {
        const title = item.name;
        const artist = item.artist ? item.artist.name : 'Unknown';
        console.log(`${index + 1}. ${title} - ${artist} (videoId: ${item.videoId})`);
    });

    // Fetch details for first song
    if (songs.length > 0) {
        const firstSong = songs[0];
        const songDetails = await ytmusic.getSong(firstSong.videoId);
        console.log('\nSong Details:', songDetails);
    }
}

main();
