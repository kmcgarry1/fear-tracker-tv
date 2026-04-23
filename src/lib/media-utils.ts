export function isSafeHttpUrl(value: string) {
  if (!value) {
    return false
  }

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function buildYoutubeEmbedUrl(source: string) {
  const videoId = extractYoutubeId(source)

  if (!videoId) {
    return ''
  }

  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&modestbranding=1&playsinline=1&rel=0`
}

function extractYoutubeId(source: string) {
  if (!source.trim()) {
    return ''
  }

  try {
    const youtubeUrl = new URL(source)

    if (youtubeUrl.hostname.includes('youtu.be')) {
      return youtubeUrl.pathname.replace('/', '')
    }

    if (youtubeUrl.searchParams.get('v')) {
      return youtubeUrl.searchParams.get('v') ?? ''
    }

    const segments = youtubeUrl.pathname.split('/').filter(Boolean)

    if ((segments[0] === 'shorts' || segments[0] === 'embed') && segments[1]) {
      return segments[1]
    }
  } catch {
    return source.trim()
  }

  return source.trim()
}
