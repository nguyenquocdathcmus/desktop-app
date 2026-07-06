import { describe, it, expect } from 'vitest'
import { generateReviewPageHtml } from '../../src/main/export/reviewPageTemplate'

describe('generateReviewPageHtml', () => {
  it('embeds a YouTube iframe when given a youtube URL', () => {
    const html = generateReviewPageHtml({
      title: 'Demo',
      comments: [],
      youtubeUrl: 'https://www.youtube.com/watch?v=abc123XYZ'
    })
    expect(html).toContain('https://www.youtube.com/embed/abc123XYZ')
  })

  it('embeds a Drive preview iframe when given a drive file id', () => {
    const html = generateReviewPageHtml({ title: 'Demo', comments: [], driveFileId: 'file123' })
    expect(html).toContain('https://drive.google.com/file/d/file123/preview')
  })

  it('shows a no-video message when neither link is provided', () => {
    const html = generateReviewPageHtml({ title: 'Demo', comments: [] })
    expect(html).toContain('No video link available')
  })

  it('escapes HTML in comment text and title to prevent injection', () => {
    const html = generateReviewPageHtml({
      title: '<script>alert(1)</script>',
      comments: [{ id: '1', t: 5, text: '<img src=x onerror=alert(1)>', author: '"quoted"' }]
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('renders comments sorted by timestamp regardless of input order', () => {
    const html = generateReviewPageHtml({
      title: 'Demo',
      comments: [
        { id: 'b', t: 30, text: 'second' },
        { id: 'a', t: 5, text: 'first' }
      ]
    })
    expect(html.indexOf('first')).toBeLessThan(html.indexOf('second'))
  })

  it('marks resolved comments with the resolved class', () => {
    const html = generateReviewPageHtml({
      title: 'Demo',
      comments: [{ id: '1', t: 0, text: 'done', resolved: true }]
    })
    expect(html).toContain('class="comment resolved"')
  })

  it('formats timestamps as m:ss', () => {
    const html = generateReviewPageHtml({
      title: 'Demo',
      comments: [{ id: '1', t: 125, text: 'late comment' }]
    })
    expect(html).toContain('2:05')
  })
})
