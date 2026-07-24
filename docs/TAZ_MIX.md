# Taz’s Mix

Taz’s Mix is a custom music-style interface backed by the official YouTube IFrame API. The website does not extract, convert, proxy, or restream YouTube audio. The required YouTube embed remains at its supported 200 × 200 size outside the visible viewport, while the visible interface provides album art, track information, play and pause, previous and next, volume, progress, minimize, mute, and stop controls.

Astro’s client router handles internal navigation, and the player element uses `transition:persist` so one player instance is carried between pages. The player saves `tazMixVolume`, `tazMixTrack`, `tazMixCurrentTime`, `tazMixPlaying`, and `tazMixMinimized` in local storage. These values restore the playlist item, saved position, playback intent, 25% default volume, and minimized state after a full reload or browser interruption.

Browser autoplay rules still apply. When a browser blocks playback, the player displays a clear play action and keeps the saved track and position ready to resume.

## Owned-audio option

For true audio-only playback, add audio files that Taz owns or has permission to stream under `public/music/`, replace the YouTube adapter with an HTML5 `<audio>` element, and keep the existing visible controls and storage keys. This removes the hidden video embed, reduces bandwidth, improves mobile playback, and provides the most seamless page-to-page experience. Audio files should not be copied or converted from YouTube unless the necessary rights and platform permissions have been obtained.
