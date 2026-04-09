uniform float uBioluminescence;
uniform vec3 uBaseColor;
uniform vec3 uGlowColor;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;

void main() {
  // Fresnel rim lighting (strong jellyfish edge glow)
  vec3 viewDir = normalize(-vPosition);
  float rawFresnel = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
  float fresnel = pow(rawFresnel, 2.0);
  float hardRim = pow(rawFresnel, 5.0);

  // Base color with displacement-based variation
  vec3 color = uBaseColor * 1.4 + vDisplacement * 0.4;

  // Strong bioluminescent rim glow (jellyfish edge)
  vec3 rimGlow = uGlowColor * 2.5 * fresnel * uBioluminescence;

  // Hot white rim at the very edge
  vec3 hotRim = vec3(1.0, 0.98, 0.95) * hardRim * uBioluminescence * 1.2;

  // Multi-frequency pulsing internal glow (visible breathing light)
  float pulse1 = sin(uTime * 0.8) * 0.5 + 0.5;
  float pulse2 = sin(uTime * 1.3 + 1.0) * 0.3 + 0.5;
  float pulse3 = sin(uTime * 0.3) * 0.2 + 0.5;
  float combinedPulse = pulse1 * 0.5 + pulse2 * 0.3 + pulse3 * 0.2;
  vec3 internalGlow = uGlowColor * combinedPulse * uBioluminescence * 0.8 * (1.0 - fresnel * 0.5);

  // Subsurface scattering approximation (light passing through the body)
  float sss = pow(max(dot(viewDir, normalize(vNormal)), 0.0), 1.5);
  vec3 subsurface = uGlowColor * sss * uBioluminescence * 0.4 * combinedPulse;

  vec3 finalColor = color + rimGlow + hotRim + internalGlow + subsurface;

  // Translucency: higher alpha at edges, semi-transparent center shows depth
  float alpha = 0.35 + fresnel * 0.55 + combinedPulse * 0.1;

  gl_FragColor = vec4(finalColor, alpha);
}
