import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Course | PDF to Interactive Lesson Generator'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  
  const fontBuffer = await readFile(
    join(process.cwd(), 'public/Fustat-ExtraBold.ttf')
  )
  // Convert Buffer to ArrayBuffer - create a proper copy
  const fontArray = new Uint8Array(fontBuffer.length)
  fontArray.set(fontBuffer)
  const fontData = fontArray.buffer

  // Load SVGs
  const leftSvg = await readFile(join(process.cwd(), 'public/landing-left-optimized.svg'))
  const rightSvg = await readFile(join(process.cwd(), 'public/landing-right-optimized.svg'))
  
  const leftSvgSrc = `data:image/svg+xml;base64,${leftSvg.toString('base64')}`
  const rightSvgSrc = `data:image/svg+xml;base64,${rightSvg.toString('base64')}`

  // Since course data is stored client-side only (localStorage),
  // we'll use a default design with the slug
  // The actual course title will be set dynamically by the client component
  const displayTitle = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'Fustat',
          position: 'relative',
        }}
      >
        {/* Background Elements */}
        <img
          src={leftSvgSrc}
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: '500px',
            opacity: 0.6,
          }}
        />
        <img
          src={rightSvgSrc}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            height: '500px',
            opacity: 0.6,
          }}
        />

        <div
          style={{
            display: 'flex',
            background: 'linear-gradient(135deg, #FB7372 0%, #FFC33E 30%, #51B9F3 66%, #2CBF76 100%)',
            padding: '4px',
            borderRadius: '28px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
            zIndex: 10,
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '32px',
              background: 'white',
              padding: '60px 80px',
              borderRadius: '24px',
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: '#171717',
                textAlign: 'center',
                lineHeight: 1.0,
                maxWidth: '1000px',
              }}
            >
              {displayTitle}
            </div>
            <div
              style={{
                fontSize: 28,
                color: '#666',
                textAlign: 'center',
                maxWidth: '900px',
              }}
            >
              Interactive course lesson
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Fustat',
          data: fontData,
          style: 'normal',
          weight: 800,
        },
      ],
    }
  )
}
