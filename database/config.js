import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DB_PATH = path.resolve(__dirname, "data/db.json");

export const DEFAULT_DB = {
  user: null,           
  activeSession: null,
  songs: [],
  artists: [],
  albums: [],
  playlists: [],
  likedSongs: [],
  recentlyPlayed: [],
  followingArtists: []
};

export const MAX_RECENTLY_PLAYED = 20;