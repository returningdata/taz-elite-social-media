import { apiSuccess, getChannel, youtubeError } from '../lib/youtube';

export default async () => {
  try {
    const channel = await getChannel();
    return apiSuccess({
      id: channel.id,
      name: channel.snippet.title,
      handle: channel.snippet.customUrl || '@tazelite-plays',
      description: channel.snippet.description,
      image: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.default?.url,
      subscriberCount: channel.statistics.hiddenSubscriberCount ? null : Number(channel.statistics.subscriberCount),
      subscriberCountHidden: Boolean(channel.statistics.hiddenSubscriberCount),
      videoCount: Number(channel.statistics.videoCount),
      viewCount: Number(channel.statistics.viewCount),
      channelUrl: 'https://youtube.com/@tazelite-plays'
    }, { maxAge: 600, staleWhileRevalidate: 1800 });
  } catch (error) {
    return youtubeError(error);
  }
};
