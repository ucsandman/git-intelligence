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
  vec3 color = uBaseColor * 1.0 + vDisplacement * 0.2;

  // Subtle bioluminescent rim glow (jellyfish edge)
  vec3 rimGlow = uGlowColor * 0.8 * fresnel * uBioluminescence;

  // Soft rim at the very edge (no hot white blowout)
  vec3 hotRim = vec3(0.8, 0.95, 0.95) * hardRim * uBioluminescence * 0.4;

  // Multi-frequency pulsing internal glow (visible breathing light)
  float pulse1 = sin(uTime * 0.8) * 0.5 + 0.5;
  float pulse2 = sin(uTime * 1.3 + 1.0) * 0.3 + 0.5;
  float pulse3 = sin(uTime * 0.3) * 0.2 + 0.5;
  float combinedPulse = pulse1 * 0.5 + pulse2 * 0.3 + pulse3 * 0.2;
  vec3 internalGlow = uGlowColor * combinedPulse * uBioluminescence * 0.3 * (1.0 - fresnel * 0.5);

  // Subsurface scattering approximation (light passing through the body)
  float sss = pow(max(dot(viewDir, normalize(vNormal)), 0.0), 1.5);
  vec3 subsurface = uGlowColor * sss * uBioluminescence * 0.15 * combinedPulse;

  vec3 finalColor = clamp(color + rimGlow + hotRim + internalGlow + subsurface, 0.0, 1.0);

  // Translucency: higher alpha at edges, semi-transparent center shows depth
  float alpha = 0.35 + fresnel * 0.55 + combinedPulse * 0.1;

  gl_FragColor = vec4(finalColor, alpha);
}
