// Minimal perspective transform (homography) for canvas image warping.
// Used for "perspective crop" — straightening a photographed document.

function solveLinear(A, B) {
  // Gaussian elimination, A is NxN, B is Nx1
  const n = A.length;
  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(A[i][i]), maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) { maxEl = Math.abs(A[k][i]); maxRow = k; }
    }
    [A[maxRow], A[i]] = [A[i], A[maxRow]];
    [B[maxRow], B[i]] = [B[i], B[maxRow]];
    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) A[k][j] += c * A[i][j];
      B[k] += c * B[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = B[i];
    for (let j = i + 1; j < n; j++) sum -= A[i][j] * x[j];
    x[i] = sum / A[i][i];
  }
  return x;
}

// Returns 3x3 matrix (8 values + 1) mapping src points -> dst points
function getHomography(src, dst) {
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    B.push(dx);
    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    B.push(dy);
  }
  const h = solveLinear(A, B);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

// Warps srcCanvas region defined by quad (4 corner points in src pixel coords)
// into a flat rectangle of size outW x outH. Returns a new canvas.
function perspectiveCrop(srcCanvas, quad, outW, outH) {
  const dstQuad = [{ x: 0, y: 0 }, { x: outW, y: 0 }, { x: outW, y: outH }, { x: 0, y: outH }];
  // matrix mapping dst -> src (so we can iterate dst pixels and sample src)
  const M = getHomography(dstQuad, quad);

  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const outCtx = out.getContext('2d');
  const outData = outCtx.createImageData(outW, outH);

  const sw = srcCanvas.width, sh = srcCanvas.height;
  const srcCtx = srcCanvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, sw, sh).data;

  for (let Y = 0; Y < outH; Y++) {
    for (let X = 0; X < outW; X++) {
      const denom = M[6] * X + M[7] * Y + 1;
      const sx = (M[0] * X + M[1] * Y + M[2]) / denom;
      const sy = (M[3] * X + M[4] * Y + M[5]) / denom;

      const di = (Y * outW + X) * 4;
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
        outData.data[di] = 255; outData.data[di+1] = 255; outData.data[di+2] = 255; outData.data[di+3] = 255;
        continue;
      }
      // bilinear sample
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = x0 + 1, y1 = y0 + 1;
      const fx = sx - x0, fy = sy - y0;

      for (let c = 0; c < 4; c++) {
        const p00 = srcData[(y0 * sw + x0) * 4 + c];
        const p10 = srcData[(y0 * sw + x1) * 4 + c];
        const p01 = srcData[(y1 * sw + x0) * 4 + c];
        const p11 = srcData[(y1 * sw + x1) * 4 + c];
        const top = p00 * (1 - fx) + p10 * fx;
        const bottom = p01 * (1 - fx) + p11 * fx;
        outData.data[di + c] = top * (1 - fy) + bottom * fy;
      }
    }
  }
  outCtx.putImageData(outData, 0, 0);
  return out;
}
