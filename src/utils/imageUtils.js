/**
 * Detect transparent slots in a frame image.
 * Uses a connected component labeling approach to find transparent OR white regions.
 * 
 * @param {string} frameUrl - URL of the frame image
 * @returns {Promise<{width: number, height: number, slots: Array<{x: number, y: number, w: number, h: number}>, isTransparent: boolean}>}
 */
export async function detectSlots(frameUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const originalW = img.width;
            const originalH = img.height;

            // --- OPTIMIZATION: Downsample for detection ---
            // Scanning pixels on 4K images is slow. We scale down to ~1000px max dimension.
            const MAX_DIM = 1000;
            let scale = 1;
            if (originalW > MAX_DIM || originalH > MAX_DIM) {
                scale = Math.min(MAX_DIM / originalW, MAX_DIM / originalH);
            }

            const w = Math.floor(originalW * scale);
            const h = Math.floor(originalH * scale);

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // Draw scaled image
            ctx.drawImage(img, 0, 0, w, h);

            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;

            const visited = new Uint8Array(w * h);
            const slots = [];

            const ALPHA_THRESHOLD = 50;
            const MIN_SLOT_SIZE = (w * h) * 0.005;

            let foundTransparentParam = false;

            // 1. First Pass: Check for Alpha Transparency
            let hasAlpha = false;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] < 255) {
                    hasAlpha = true;
                    break;
                }
            }

            const runDetection = (isAlphaCheck) => {
                visited.fill(0);
                const foundSlots = [];

                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        const idx = (y * w + x);
                        if (visited[idx]) continue;

                        let isSlotPixel = false;
                        if (isAlphaCheck) {
                            if (data[idx * 4 + 3] < ALPHA_THRESHOLD) isSlotPixel = true;
                        } else {
                            // Check for White (Luminance > 240)
                            const r = data[idx * 4];
                            const g = data[idx * 4 + 1];
                            const b = data[idx * 4 + 2];
                            if (r > 240 && g > 240 && b > 240) isSlotPixel = true;
                        }

                        if (isSlotPixel) {
                            const { minX, minY, maxX, maxY, count } = floodFill(x, y, w, h, data, visited, isAlphaCheck);

                            const slotW = maxX - minX + 1;
                            const slotH = maxY - minY + 1;

                            if (count > MIN_SLOT_SIZE && slotW > 10 && slotH > 10) { // Reduced min size for scaled image
                                // Scale BACK to original coordinates
                                foundSlots.push({
                                    x: Math.floor(minX / scale),
                                    y: Math.floor(minY / scale),
                                    w: Math.floor(slotW / scale),
                                    h: Math.floor(slotH / scale),
                                    // Normalized coords remain the same (proportional)
                                    nx: minX / w,
                                    ny: minY / h,
                                    nw: slotW / w,
                                    nh: slotH / h
                                });
                            }
                        } else {
                            visited[idx] = 1;
                        }
                    }
                }
                return foundSlots;
            };

            // Run
            let detected = [];
            if (hasAlpha) {
                detected = runDetection(true);
                foundTransparentParam = true;
            }

            if (detected.length === 0) {
                detected = runDetection(false);
                foundTransparentParam = false;
            }

            // Sort slots
            detected.sort((a, b) => {
                const rowA = Math.floor(a.y / 20); // This logic might need tweak on original size, but Y is already scaled back
                const rowB = Math.floor(b.y / 20); // Actually let's use normalized NY for sorting to be safe or scaled Y
                if (Math.abs(a.ny - b.ny) > 0.1) return a.ny - b.ny; // Better row sort
                return a.x - b.x;
            });

            resolve({ width: originalW, height: originalH, slots: detected, isTransparent: foundTransparentParam });
        };
        img.onerror = (err) => reject(err);
        img.src = frameUrl;
    });
}

function floodFill(startX, startY, w, h, data, visited, isAlphaCheck) {
    const stack = [[startX, startY]];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let count = 0;
    const ALPHA_THRESHOLD = 50;

    while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const idx = cy * w + cx;

        if (visited[idx]) continue;
        visited[idx] = 1;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        count++;

        const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];

        for (let [nx, ny] of neighbors) {
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const nIdx = ny * w + nx;
                if (!visited[nIdx]) {
                    let match = false;
                    if (isAlphaCheck) {
                        if (data[nIdx * 4 + 3] < ALPHA_THRESHOLD) match = true;
                    } else {
                        const r = data[nIdx * 4];
                        const g = data[nIdx * 4 + 1];
                        const b = data[nIdx * 4 + 2];
                        if (r > 240 && g > 240 && b > 240) match = true;
                    }

                    if (match) stack.push([nx, ny]);
                }
            }
        }
    }
    return { minX, minY, maxX, maxY, count };
}


/**
 * Merges captured shots into the frame slots.
 * Automatically handles converting opaque white slots to transparent if needed.
 * 
 * @param {string} frameUrl - URL of the frame
 * @param {HTMLImageElement[]} shots - Array of captured images (Image objects or similar)
 * @param {Array} slots - Array of slot objects {x, y, w, h, ...} (denormalized to fit frame size)
 * @returns {Promise<string>} - DataURL of the merged image
 */
export async function mergeImages(frameUrl, shots, slots) {
    return new Promise((resolve, reject) => {
        const frame = new Image();
        frame.crossOrigin = "anonymous";
        frame.onload = () => {
            const w = frame.width;
            const h = frame.height;

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            // 1. Analyze Frame for Opaque White Slots
            // If we detected white slots earlier (implied), we should make those pixels transparent.
            // Since we don't pass 'isTransparent' here, let's just do a smart check:
            // Check if the 'slots' areas are White in the 'frame' image.

            // Draw frame first to analyze
            ctx.drawImage(frame, 0, 0);
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;
            let needsMasking = false;

            // Sample center of first slot to see if it's white
            if (slots.length > 0) {
                const s = slots[0];
                const cx = Math.floor(s.x + s.w / 2);
                const cy = Math.floor(s.y + s.h / 2);
                const idx = (cy * w + cx) * 4;
                if (data[idx + 3] > 250 && data[idx] > 240 && data[idx + 1] > 240 && data[idx + 2] > 240) {
                    needsMasking = true;
                }
            }

            if (needsMasking) {
                // Turn White pixels pixels to Transparent
                // Better: Turn White pixels within the detected SLOT RECTS to transparent.
                // This prevents turning white parts of the frame (titles, snow) transparent inadvertently.
                for (let slot of slots) {
                    for (let y = slot.y; y < slot.y + slot.h; y++) {
                        for (let x = slot.x; x < slot.x + slot.w; x++) {
                            const idx = (y * w + x) * 4;
                            const r = data[idx];
                            const g = data[idx + 1];
                            const b = data[idx + 2];
                            if (r > 240 && g > 240 && b > 240) {
                                data[idx + 3] = 0; // Alpha 0
                            }
                        }
                    }
                }
                // Put back processed frame data (now transparent)
                ctx.putImageData(imageData, 0, 0);

                // Now we have a transparent frame on the canvas.
                // We need to move it to a temp canvas so we can layer properly (Shots -> Frame).
                const frameCanvas = document.createElement('canvas');
                frameCanvas.width = w;
                frameCanvas.height = h;
                frameCanvas.getContext('2d').putImageData(imageData, 0, 0);

                // Clear main canvas logic
                ctx.clearRect(0, 0, w, h);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);

                // Draw shots (copy-paste logic from before)
                drawShots(ctx, shots, slots);

                // Draw modified frame (Overlay)
                ctx.drawImage(frameCanvas, 0, 0);

            } else {
                // Normal Transparent Frame
                // Clear and rebuild
                ctx.clearRect(0, 0, w, h);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);

                // Draw shots
                drawShots(ctx, shots, slots);

                // Draw original frame
                ctx.drawImage(frame, 0, 0);
            }

            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        frame.onerror = reject;
        frame.src = frameUrl;
    });
}

function drawShots(ctx, shots, slots) {
    slots.forEach((slot, i) => {
        const shot = shots[i % shots.length];
        if (!shot) return;

        const sw = shot.naturalWidth || shot.width;
        const sh = shot.naturalHeight || shot.height;
        const targetW = slot.w;
        const targetH = slot.h;
        const targetX = slot.x;
        const targetY = slot.y;

        const scale = Math.max(targetW / sw, targetH / sh);
        const dw = sw * scale;
        const dh = sh * scale;

        const dx = targetX + (targetW - dw) / 2;
        const dy = targetY + (targetH - dh) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(targetX, targetY, targetW, targetH);
        ctx.clip();

        ctx.drawImage(shot, dx, dy, dw, dh);
        ctx.restore();
    });
}

/**
 * Triggers the browser print dialog for a specific image.
 * Uses a hidden iframe to print just the image.
 * 
 * @param {string} imageUrl 
 */
export function printImage(imageUrl) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    document.body.appendChild(iframe);

    const content = `
    <html>
      <body style="margin:0; display:flex; justify-content:center; align-items:center; height:100vh;">
        <img src="${imageUrl}" style="max-width:100%; max-height:100vh; width: 100%; height: 100%; object-fit: contain;" onload="window.print(); setTimeout(() => window.parent.document.body.removeChild(window.frameElement), 1000);" />
      </body>
    </html>
  `;

    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(content);
    iframe.contentWindow.document.close();
}

/**
 * Trigger a download of the image data URL
 * @param {string} dataUrl 
 * @param {string} filename 
 */
export function downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
