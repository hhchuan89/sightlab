import QRCode from "qrcode";

/**
 * Render a QR code for `url` as an inline SVG string, generated SERVER-SIDE — no
 * client JS, no external image host (hitting a third-party QR service would leak
 * the private invite URL to a third party and break the no-external-request
 * posture). Ink modules (the light-theme --text value) on a TRANSPARENT ground, so
 * the surrounding white tile gives a scanner its quiet zone in BOTH themes.
 *
 * Returns null on failure — the caller falls back to the plain text link rather
 * than letting a QR error 500 the page. The failure is logged, never swallowed.
 */
export async function inviteQrSvg(url: string): Promise<string | null> {
  try {
    return await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#221d14", light: "#00000000" },
    });
  } catch (err) {
    console.error(
      `qr: failed to render invite QR: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}
