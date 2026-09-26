import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get('q') || 'trending';
  const type = searchParams.get('type') || 'gifs'; // gifs or stickers
  const apiKey = process.env.KLIPY_API_KEY || '';

  try {
    // Real Klipy API call if valid key
    if (apiKey && apiKey !== 'your_klipy_api_key_here') {
      const klipyRes = await fetch(`https://api.klipy.co/v2/search?type=${type}&q=${encodeURIComponent(q)}&key=${apiKey}`, { cache: 'no-store' });
      if (klipyRes.ok) {
        const raw = await klipyRes.json();
        const normalized = (raw.results || []).map((item: any) => {
          const gifUrl =
            item.media_formats?.gif?.url ||
            item.media_formats?.mediumgif?.url ||
            item.media_formats?.tinygif?.url ||
            item.media_formats?.nanogif?.url ||
            item.media_formats?.webp?.url ||
            '';
          return { id: item.id, title: item.title || '', url: gifUrl };
        });
        return NextResponse.json({ results: normalized });
      }
    }

    // Mock fallback for demo/testing
    const mockItems = [
      { id: '1', title: 'Happy Dance', url: 'https://media.giphy.com/media/3o7TKSjRrfIPjeiDiM/giphy.gif' },
      { id: '2', title: 'Crypto Moon', url: 'https://media.giphy.com/media/1wPWMnP1l8gRjRj2hV/giphy.gif' },
      { id: '3', title: 'Winner', url: 'https://media.giphy.com/media/xT5LMDz5s3bL0xV6Y0/giphy.gif' },
      { id: '4', title: 'Good Game', url: 'https://media.giphy.com/media/l0HlRnAWXxn0MhOBK/giphy.gif' },
      { id: '5', title: 'Fire', url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif' },
      { id: '6', title: 'Money', url: 'https://media.giphy.com/media/3o6ZsSkj48vM5T5k5q/giphy.gif' },
    ];
    return NextResponse.json({ results: mockItems });
  } catch {
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
