const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const MAX_TEXT = 12000
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 15000

export type FetchedPage = {
  title: string
  text: string
  image: { mimeType: string; data: string } | null
}

/** 사설망·로컬 주소로의 요청을 막는다. */
function assertPublicUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('URL 형식이 올바르지 않습니다. http:// 또는 https:// 로 시작해야 합니다.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('http/https 주소만 읽을 수 있습니다.')
  }
  const host = url.hostname.toLowerCase()
  const blocked =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  if (blocked) throw new Error('내부 네트워크 주소는 읽을 수 없습니다.')
  return url
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function metaContent(html: string, property: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
    'i',
  )
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    'i',
  )
  return (html.match(re)?.[1] ?? html.match(alt)?.[1] ?? '').trim()
}

async function fetchOgImage(src: string, base: URL): Promise<FetchedPage['image']> {
  try {
    const url = new URL(src, base)
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Referer: base.origin },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null

    const mimeType = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mimeType)) return null

    const buffer = await res.arrayBuffer()
    if (buffer.byteLength > MAX_IMAGE_BYTES) return null

    return { mimeType, data: Buffer.from(buffer).toString('base64') }
  } catch {
    return null
  }
}

/**
 * 상품 페이지를 읽어 본문 텍스트와 대표 이미지를 돌려준다.
 * 도매 사이트가 봇을 차단하면 throw 하므로, 호출부에서 이미지 입력으로 안내할 것.
 */
export async function fetchProductPage(raw: string): Promise<FetchedPage> {
  const url = assertPublicUrl(raw)

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'ko-KR,ko;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new Error(
      '상품 페이지에 접속하지 못했습니다. 주소를 확인하거나, 대신 상품 이미지를 올려 주세요.',
    )
  }

  if (!res.ok) {
    throw new Error(
      `상품 페이지가 접근을 거부했습니다 (HTTP ${res.status}). 로그인이 필요한 페이지일 수 있으니 상품 이미지를 올려 주세요.`,
    )
  }

  const html = await res.text()
  const title = metaContent(html, 'og:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || ''
  const description = metaContent(html, 'og:description') || metaContent(html, 'description')
  const body = stripHtml(html).slice(0, MAX_TEXT)

  const ogImage = metaContent(html, 'og:image')
  const image = ogImage ? await fetchOgImage(ogImage, url) : null

  return {
    title: title.trim(),
    text: [description, body].filter(Boolean).join('\n\n'),
    image,
  }
}
