import { apiSuccess, formatDuration, getChannel, getRecentVideosFromFeed, getYouTubeKey, youtubeError, youtubeRequest } from '../lib/youtube';

export default async () => {
  try {
    if (!getYouTubeKey()) {
      const items = await getRecentVideosFromFeed();
      return apiSuccess({ items, partial: true, source: 'YouTube official RSS feed', unavailableFields: ['duration'] }, { maxAge: 900, staleWhileRevalidate: 1800 });
    }

    const channel = await getChannel();
    const playlist = await youtubeRequest('playlistItems', { part: 'snippet,contentDetails', playlistId: channel.contentDetails.relatedPlaylists.uploads, maxResults: '3' });
    const ids = playlist.items?.map((item: any) => item.contentDetails.videoId).filter(Boolean) || [];
    if (!ids.length) return apiSuccess({ items: [], partial: false, source: 'YouTube Data API v3' }, { maxAge: 900 });
    const details = await youtubeRequest('videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') });
    const items = ids.map((id: string) => details.items.find((item: any) => item.id === id)).filter(Boolean).map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      viewCount: Number(item.statistics.viewCount),
      duration: formatDuration(item.contentDetails.duration),
      url: `https://www.youtube.com/watch?v=${item.id}`
    }));
    return apiSuccess({ items, partial: false, source: 'YouTube Data API v3' }, { maxAge: 1200, staleWhileRevalidate: 2400 });
  } catch (error) {
    return youtubeError(error);
  }
};
