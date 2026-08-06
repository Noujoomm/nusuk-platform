import { randomBytes } from 'crypto';
import sharp from 'sharp';
import {
  prepareImageForClaude,
  CLAUDE_IMAGE_BASE64_LIMIT,
  MAX_RAW_BYTES,
} from './prepare-image-for-claude';

/**
 * Build a noisy RGB PNG of `size`×`size`. Random pixels barely compress, so this
 * reliably produces a multi-megabyte PNG — the shape of the real failing files
 * (large phone-camera photos) that blow the base64 limit.
 */
async function makeNoisePng(size: number): Promise<Buffer> {
  const channels = 3;
  const raw = randomBytes(size * size * channels);
  return sharp(raw, { raw: { width: size, height: size, channels } })
    .png({ compressionLevel: 0 })
    .toBuffer();
}

describe('prepareImageForClaude', () => {
  jest.setTimeout(30000);

  it('compresses an oversized image to fit under the base64 limit and switches to JPEG', async () => {
    const big = await makeNoisePng(3000);
    // Sanity: the input is genuinely oversized (its base64 would exceed the cap).
    expect(big.length).toBeGreaterThan(MAX_RAW_BYTES);
    expect(big.toString('base64').length).toBeGreaterThan(CLAUDE_IMAGE_BASE64_LIMIT);

    const { buffer, mediaType } = await prepareImageForClaude(big, 'image/png');

    expect(mediaType).toBe('image/jpeg');
    expect(buffer.length).toBeLessThanOrEqual(MAX_RAW_BYTES);
    // The actual invariant that matters to the Anthropic API:
    expect(buffer.toString('base64').length).toBeLessThanOrEqual(
      CLAUDE_IMAGE_BASE64_LIMIT,
    );
  });

  it('passes small images through unchanged', async () => {
    const small = await sharp({
      create: { width: 300, height: 300, channels: 3, background: { r: 12, g: 34, b: 56 } },
    })
      .png()
      .toBuffer();

    const { buffer, mediaType } = await prepareImageForClaude(small, 'image/png');

    expect(buffer).toBe(small); // same reference — untouched
    expect(mediaType).toBe('image/png');
  });

  it('passes PDFs through unchanged (never rasterized here)', async () => {
    const pdf = Buffer.from('%PDF-1.4 not a real pdf');
    const { buffer, mediaType } = await prepareImageForClaude(pdf, 'application/pdf');

    expect(buffer).toBe(pdf);
    expect(mediaType).toBe('application/pdf');
  });

  it('handles a small corrupt image buffer gracefully (no throw)', async () => {
    const junk = Buffer.alloc(2048, 0xff); // below passthrough → returned as-is
    const { buffer, mediaType } = await prepareImageForClaude(junk, 'image/png');

    expect(buffer).toBe(junk);
    expect(mediaType).toBe('image/png');
  });

  it('logs the compression (original → final size, dimensions, quality)', async () => {
    const big = await makeNoisePng(2600);
    const messages: string[] = [];

    await prepareImageForClaude(big, 'image/png', (m) => messages.push(m));

    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toMatch(/compressed .*MB → .*MB/);
    expect(messages[0]).toMatch(/q\d+/); // quality present
  });
});
