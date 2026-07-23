import { apiSuccess, getChannel, youtubeError, youtubeRequest } from '../lib/youtube';

export default async () => {
  try {
    const channel = await getChannel();
    const result = await youtubeRequest('search', { part: 'snippet', channelId: channel.id, eventType: 'live', type: 'video', maxResults: '1' });
    const video = result.items?.[0];
    return apiSuccess({ isLive: Boolean(video), title: video?.snippet?.title || null, url: video ? `https://www.youtube.com/watch?v=${video.id.videoId}` : null }, { maxAge: 120, staleWhileRevalidate: 180 });
  } catch (error) {
    return youtubeError(error);
  }
};
