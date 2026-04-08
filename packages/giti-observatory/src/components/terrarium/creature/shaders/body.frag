uniform float uBioluminescence;
uniform vec3 uBaseColor;
uniform vec3 uGlowColor;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;

void main() {
  // Fresnel rim lighting (jellyfish edge glow)
  vec3 viewDir = normalize(-vPosition);
  float fresnel = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 3.0);

  // Base color with displacement-based variation
  vec3 color = uBaseColor + vDisplacement * 0.3;

  // Bioluminescent glow (stronger at edges via fresnel)
  vec3 glow = uGlowColor * fresnel * uBioluminescence;

  // Pulsing internal glow
  float pulse = sin(uTime * 0.8) * 0.5 + 0.5;
  vec3 internalGlow = uGlowColor * pulse * uBioluminescence * 0.3 * (1.0 - fresnel);

  vec3 finalColor = color + glow + internalGlow;

  // Translucency: higher alpha at edges, more transparent in center
  float alpha = 0.4 + fresnel * 0.5;

  gl_FragColor = vec4(finalColor, alpha);
}
