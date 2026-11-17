/* ============================================================
   GRAPHICS — cinematic post-processing pipeline
   ============================================================ */

/**
 * Attach Babylon's DefaultRenderingPipeline to a scene.
 * High quality adds bloom, ACES tone mapping, vignette, subtle chromatic
 * aberration, film grain and sharpening. Low quality keeps the frame cheap
 * for phones and integrated GPUs.
 *
 * The effect budget is deliberately conservative: strong aberration, grain
 * and bloom were making ships read as blurry, so they are kept just above
 * perceptible and the sharpening pass does the heavy lifting instead.
 */
export function attachCinematicPipeline(scene, quality = "high") {
  if (!scene || !scene.activeCamera) return null;
  const high = quality !== "low";
  try {
    const p = new BABYLON.DefaultRenderingPipeline("cinematic", true, scene, [scene.activeCamera]);
    p.samples = high ? 4 : 1;
    p.fxaaEnabled = true;

    p.bloomEnabled = true;
    p.bloomThreshold = high ? 0.78 : 0.88;
    p.bloomWeight = high ? 0.2 : 0.14;
    p.bloomKernel = high ? 40 : 28;
    p.bloomScale = high ? 0.5 : 0.4;

    p.imageProcessingEnabled = true;
    if (p.imageProcessing) {
      p.imageProcessing.toneMappingEnabled = high;
      p.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
      // ACES crushes the low end; lift exposure and ease contrast so dark
      // hulls stay readable against the starfield.
      p.imageProcessing.exposure = high ? 1.35 : 1.18;
      p.imageProcessing.contrast = high ? 1.03 : 1.0;
      p.imageProcessing.vignetteEnabled = high;
      p.imageProcessing.vignetteWeight = high ? 0.55 : 0.25;
      p.imageProcessing.vignetteStretch = 0.18;
      p.imageProcessing.vignetteColor = new BABYLON.Color4(0.02, 0.01, 0.06, 0);
      p.imageProcessing.vignetteCameraFov = 0.9;
    }

    if (high) {
      p.chromaticAberrationEnabled = true;
      if (p.chromaticAberration) {
        p.chromaticAberration.aberrationAmount = 1.5;
        p.chromaticAberration.radialIntensity = 0.2;
      }

      p.grainEnabled = true;
      if (p.grain) {
        p.grain.intensity = 0.9;
        p.grain.animated = true;
      }

      p.sharpenEnabled = true;
      if (p.sharpen) {
        p.sharpen.edgeAmount = 0.42;
        p.sharpen.colorAmount = 0.85;
      }
    } else {
      p.chromaticAberrationEnabled = false;
      p.grainEnabled = false;
      p.sharpenEnabled = false;
    }

    return p;
  } catch (err) {
    console.warn("Cinematic pipeline unavailable", err);
    return null;
  }
}
