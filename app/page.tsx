"use client"

import { useRef, useEffect } from "react"

// Helper functions for matrix operations
const mat4 = {
  create: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  perspective: (out: Float32Array, fov: number, aspect: number, near: number, far: number) => {
    const f = 1.0 / Math.tan(fov / 2)
    out[0] = f / aspect
    out[1] = 0
    out[2] = 0
    out[3] = 0
    out[4] = 0
    out[5] = f
    out[6] = 0
    out[7] = 0
    out[8] = 0
    out[9] = 0
    out[11] = -1
    out[15] = 0
    if (far != null && far !== Number.POSITIVE_INFINITY) {
      const nf = 1 / (near - far)
      out[10] = (far + near) * nf
      out[14] = 2 * far * near * nf
    } else {
      out[10] = -1
      out[14] = -2 * near
    }
    return out
  },
  translate: (out: Float32Array, a: Float32Array, v: [number, number, number]) => {
    const x = v[0],
      y = v[1],
      z = v[2]
    let a00, a01, a02, a03
    let a10, a11, a12, a13
    let a20, a21, a22, a23
    if (a === out) {
      out[12] = a[0] * x + a[4] * y + a[8] * z + a[12]
      out[13] = a[1] * x + a[5] * y + a[9] * z + a[13]
      out[14] = a[2] * x + a[6] * y + a[10] * z + a[14]
      out[15] = a[3] * x + a[7] * y + a[11] * z + a[15]
    } else {
      a00 = a[0]
      a01 = a[1]
      a02 = a[2]
      a03 = a[3]
      a10 = a[4]
      a11 = a[5]
      a12 = a[6]
      a13 = a[7]
      a20 = a[8]
      a21 = a[9]
      a22 = a[10]
      a23 = a[11]
      out[0] = a00
      out[1] = a01
      out[2] = a02
      out[3] = a03
      out[4] = a10
      out[5] = a11
      out[6] = a12
      out[7] = a13
      out[8] = a20
      out[9] = a21
      out[10] = a22
      out[11] = a23
      out[12] = a00 * x + a10 * y + a20 * z + a[12]
      out[13] = a01 * x + a11 * y + a21 * z + a[13]
      out[14] = a02 * x + a12 * y + a22 * z + a[14]
      out[15] = a03 * x + a13 * y + a23 * z + a[15]
    }
    return out
  },
  rotate: (out: Float32Array, a: Float32Array, rad: number, axis: [number, number, number]) => {
    let x = axis[0],
      y = axis[1],
      z = axis[2]
    let len = Math.hypot(x, y, z)
    let s, c, t
    let a00, a01, a02, a03
    let a10, a11, a12, a13
    let a20, a21, a22, a23
    let b00, b01, b02
    let b10, b11, b12
    let b20, b21, b22
    if (len < 0.000001) {
      return null
    }
    len = 1 / len
    x *= len
    y *= len
    z *= len
    s = Math.sin(rad)
    c = Math.cos(rad)
    t = 1 - c
    a00 = a[0]
    a01 = a[1]
    a02 = a[2]
    a03 = a[3]
    a10 = a[4]
    a11 = a[5]
    a12 = a[6]
    a13 = a[7]
    a20 = a[8]
    a21 = a[9]
    a22 = a[10]
    a23 = a[11]
    b00 = x * x * t + c
    b01 = y * x * t + z * s
    b02 = z * x * t - y * s
    b10 = x * y * t - z * s
    b11 = y * y * t + c
    b12 = z * y * t + x * s
    b20 = x * z * t + y * s
    b21 = y * z * t - x * s
    b22 = z * z * t + c
    out[0] = a00 * b00 + a10 * b01 + a20 * b02
    out[1] = a01 * b00 + a11 * b01 + a21 * b02
    out[2] = a02 * b00 + a12 * b01 + a22 * b02
    out[3] = a03 * b00 + a13 * b01 + a23 * b02
    out[4] = a00 * b10 + a10 * b11 + a20 * b12
    out[5] = a01 * b10 + a11 * b11 + a21 * b12
    out[6] = a02 * b10 + a12 * b11 + a22 * b12
    out[7] = a03 * b10 + a13 * b11 + a23 * b12
    out[8] = a00 * b20 + a10 * b21 + a20 * b22
    out[9] = a01 * b20 + a11 * b21 + a21 * b22
    out[10] = a02 * b20 + a12 * b21 + a22 * b22
    out[11] = a03 * b20 + a13 * b21 + a23 * b22
    if (a !== out) {
      out[12] = a[12]
      out[13] = a[13]
      out[14] = a[14]
      out[15] = a[15]
    }
    return out
  },
}

const GLSLShaderCube = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGL2RenderingContext | null>(null)
  const animationFrameIdRef = useRef<number>(0)

  const mouseRef = useRef({ x: 0, y: 0, isDown: false, lastX: 0, lastY: 0 })
  const rotationRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(6.0)

  // Cube shader program and related refs
  const cubeProgramRef = useRef<WebGLProgram | null>(null)
  const projectionMatrixRef = useRef(mat4.create())
  const cubePositionBufferRef = useRef<WebGLBuffer | null>(null)
  const cubeIndexBufferRef = useRef<WebGLBuffer | null>(null)
  const cubeProjectionMatrixUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const cubeModelViewMatrixUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const cubeTimeUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const cubeMouseUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const cubePositionAttributeLocationRef = useRef<number>(-1)

  const wireframeProgramRef = useRef<WebGLProgram | null>(null)
  const wireframePositionBufferRef = useRef<WebGLBuffer | null>(null)
  const wireframeIndexBufferRef = useRef<WebGLBuffer | null>(null)
  const wireframeProjectionMatrixUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const wireframeModelViewMatrixUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const wireframePositionAttributeLocationRef = useRef<number>(-1)

  // Galaxy shader program and related refs
  const galaxyProgramRef = useRef<WebGLProgram | null>(null)
  const galaxyPositionBufferRef = useRef<WebGLBuffer | null>(null)
  const galaxyResolutionUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const galaxyTimeUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const galaxyMouseUniformLocationRef = useRef<WebGLUniformLocation | null>(null)
  const galaxyPositionAttributeLocationRef = useRef<number>(-1)

  const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) {
      console.error("Unable to create shader")
      return null
    }
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(`An error occurred compiling the shader: ${gl.getShaderInfoLog(shader)}`)
      gl.deleteShader(shader)
      return null
    }
    return shader
  }

  // Cube Shaders
  const cubeVertexShaderSource = `#version 300 es
    in vec3 a_position;
    uniform mat4 u_modelViewMatrix;
    uniform mat4 u_projectionMatrix;
    out vec3 v_worldPosition;
    void main() {
      vec4 worldPosition = u_modelViewMatrix * vec4(a_position, 1.0);
      v_worldPosition = worldPosition.xyz;
      gl_Position = u_projectionMatrix * worldPosition;
    }
  `
  const cubeFragmentShaderSource = `#version 300 es
    precision highp float;
    in vec3 v_worldPosition;
    uniform float u_time;
    uniform vec2 u_mouse;
    out vec4 outColor;
    vec3 hsv(float h,float s,float v){
      vec4 t=vec4(1.,2./3.,1./3.,3.);
      vec3 p=abs(fract(vec3(h)+t.xyz)*6.-vec3(t.w));
      return v*mix(vec3(t.x),clamp(p-vec3(t.x),0.,1.),s);
    }
    void main() {
      float t = u_time;
      vec4 o = vec4(0.0, 0.0, 0.0, 1.0);
      float i = 0.0, e = 0.0, g = 0.0, R = 0.0, s = 0.0;
      vec3 q = vec3(0.0), p = vec3(0.0);
      vec3 d = vec3(v_worldPosition.xy + u_mouse * 0.1, 0.8);
      q.zy--;
      for(;i++<99.;){
        e+=i/9e9; 
        if(i == 1.0) p = vec3(0.0);
        o.rgb+=hsv(p.y + u_mouse.x * 0.1,q.y,min(e*i,.01));
        s=3.;
        p=q+=d*e*R*.25; 
        g+=p.y/s;
        p=vec3(log2(R=length(p))+t*.2,exp2(mod(-p.z,s)/R)-.23,p.x); 
        for(e=--p.y;s<6e3;s+=s){
          e+=-abs(dot(sin(p.xz*s),cos(p.zy*s))/s*.5);
        }
      }
      outColor = o;
    }
  `

  const wireframeVertexShaderSource = `#version 300 es
    in vec3 a_position;
    uniform mat4 u_modelViewMatrix;
    uniform mat4 u_projectionMatrix;
    void main() {
      gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(a_position, 1.0);
    }
  `
  const wireframeFragmentShaderSource = `#version 300 es
    precision highp float;
    out vec4 outColor;
    void main() {
      outColor = vec4(0.8, 0.8, 0.8, 1.0); // Light gray wireframe
    }
  `

  // Galaxy Shaders
  const galaxyVertexShaderSource = `#version 300 es
    in vec2 a_galaxy_position;
    void main() {
      gl_Position = vec4(a_galaxy_position, 0.999, 1.0); 
    }
  `
  const galaxyFragmentShaderSource = `#version 300 es
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_mouse;
    out vec4 outColor;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.y * u.x;
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        uv *= 1.5; 
        float t = u_time * 0.05;

        vec3 color = vec3(0.0);

        // Nebulae with mouse influence
        vec2 noise_uv = uv * vec2(0.5, 0.8) + vec2(t * 0.1, t * 0.03) + u_mouse * 0.05;
        float n = 0.0;
        n += noise(noise_uv * 1.0) * 0.5;
        n += noise(noise_uv * 2.5) * 0.25;
        n += noise(noise_uv * 5.0) * 0.125;
        n = pow(n, 2.5);

        vec3 nebulaColor1 = vec3(0.05, 0.1, 0.25); 
        vec3 nebulaColor2 = vec3(0.2, 0.05, 0.25); 
        color = mix(nebulaColor1, nebulaColor2, smoothstep(0.1, 0.6, n));
        color *= n * 2.0;

        // Stars - Layer 1 with mouse parallax
        float stars = 0.0;
        vec2 star_uv = gl_FragCoord.xy / u_resolution.xy * 200.0; 
        star_uv += vec2(t*0.5, -t*0.3) + u_mouse * 0.02;

        float star_rand = random(floor(star_uv));
        if (star_rand > 0.985) {
            float star_size = random(floor(star_uv) + 0.1) * 0.03 + 0.005;
            float star_intensity = random(floor(star_uv) + 0.2) * 0.5 + 0.5;
            stars += (1.0 - smoothstep(0.0, star_size, length(fract(star_uv) - 0.5))) * star_intensity;
        }
        
        // Stars - Layer 2 with different mouse parallax
        star_uv = gl_FragCoord.xy / u_resolution.xy * 100.0;
        star_uv += vec2(-t*0.2, t*0.15) + u_mouse * 0.01;
        star_rand = random(floor(star_uv));
         if (star_rand > 0.975) {
            float star_size = random(floor(star_uv) + 0.3) * 0.05 + 0.01;
            float star_intensity = random(floor(star_uv) + 0.4) * 0.7 + 0.8;
            stars += (1.0 - smoothstep(0.0, star_size, length(fract(star_uv) - 0.5))) * star_intensity;
        }

        // Stars - Layer 3 with subtle mouse parallax
        star_uv = gl_FragCoord.xy / u_resolution.xy * 400.0; 
        star_uv += vec2(t*0.8, t*0.5) + u_mouse * 0.005;
        star_rand = random(floor(star_uv));
         if (star_rand > 0.996) {
            float star_size = random(floor(star_uv) + 0.5) * 0.015 + 0.002;
            float star_intensity = random(floor(star_uv) + 0.6) * 0.3 + 0.2;
            stars += (1.0 - smoothstep(0.0, star_size, length(fract(star_uv) - 0.5))) * star_intensity;
        }

        color += vec3(stars);
        
        outColor = vec4(color, 1.0);
    }
  `

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl2")
    if (!gl) {
      console.error("WebGL2 is not supported by your browser.")
      return
    }
    glRef.current = gl

    const handleMouseDown = (e: MouseEvent) => {
      mouseRef.current.isDown = true
      mouseRef.current.lastX = e.clientX
      mouseRef.current.lastY = e.clientY
      canvas.style.cursor = "grabbing"
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Update normalized mouse position for shaders
      const rect = canvas.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = (1 - (e.clientY - rect.top) / rect.height) * 2 - 1

      // Handle rotation when dragging
      if (mouseRef.current.isDown) {
        const deltaX = e.clientX - mouseRef.current.lastX
        const deltaY = e.clientY - mouseRef.current.lastY

        rotationRef.current.y += deltaX * 0.01
        rotationRef.current.x += deltaY * 0.01

        mouseRef.current.lastX = e.clientX
        mouseRef.current.lastY = e.clientY
      }
    }

    const handleMouseUp = () => {
      mouseRef.current.isDown = false
      canvas.style.cursor = "grab"
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomRef.current += e.deltaY * 0.01
      zoomRef.current = Math.max(2, Math.min(20, zoomRef.current))
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mousemove", handleMouseMove)
    canvas.addEventListener("mouseup", handleMouseUp)
    canvas.addEventListener("mouseleave", handleMouseUp)
    canvas.addEventListener("wheel", handleWheel)
    canvas.style.cursor = "grab"

    // --- Initialize Cube Shader Program ---
    const cubeVertexShader = createShader(gl, gl.VERTEX_SHADER, cubeVertexShaderSource)
    const cubeFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, cubeFragmentShaderSource)
    if (!cubeVertexShader || !cubeFragmentShader) return

    const cProgram = gl.createProgram()
    if (!cProgram) return
    cubeProgramRef.current = cProgram
    gl.attachShader(cProgram, cubeVertexShader)
    gl.attachShader(cProgram, cubeFragmentShader)
    gl.linkProgram(cProgram)
    if (!gl.getProgramParameter(cProgram, gl.LINK_STATUS)) {
      console.error("Unable to initialize the cube shader program: " + gl.getProgramInfoLog(cProgram))
      return
    }
    cubePositionAttributeLocationRef.current = gl.getAttribLocation(cProgram, "a_position")
    cubeProjectionMatrixUniformLocationRef.current = gl.getUniformLocation(cProgram, "u_projectionMatrix")
    cubeModelViewMatrixUniformLocationRef.current = gl.getUniformLocation(cProgram, "u_modelViewMatrix")
    cubeTimeUniformLocationRef.current = gl.getUniformLocation(cProgram, "u_time")
    cubeMouseUniformLocationRef.current = gl.getUniformLocation(cProgram, "u_mouse")

    const cubePositions = new Float32Array([
      -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0,
      1.0, -1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, -1.0,
      -1.0, 1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, -1.0,
      -1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, -1.0,
    ])
    const cubeIndices = new Uint16Array([
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15, 16, 17, 18, 16, 18, 19, 20, 21,
      22, 20, 22, 23,
    ])
    cubePositionBufferRef.current = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, cubePositionBufferRef.current)
    gl.bufferData(gl.ARRAY_BUFFER, cubePositions, gl.STATIC_DRAW)
    cubeIndexBufferRef.current = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBufferRef.current)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW)

    const wireframeVertexShader = createShader(gl, gl.VERTEX_SHADER, wireframeVertexShaderSource)
    const wireframeFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, wireframeFragmentShaderSource)
    if (!wireframeVertexShader || !wireframeFragmentShader) return

    const wProgram = gl.createProgram()
    if (!wProgram) return
    wireframeProgramRef.current = wProgram
    gl.attachShader(wProgram, wireframeVertexShader)
    gl.attachShader(wProgram, wireframeFragmentShader)
    gl.linkProgram(wProgram)
    if (!gl.getProgramParameter(wProgram, gl.LINK_STATUS)) {
      console.error("Unable to initialize the wireframe shader program: " + gl.getProgramInfoLog(wProgram))
      return
    }
    wireframePositionAttributeLocationRef.current = gl.getAttribLocation(wProgram, "a_position")
    wireframeProjectionMatrixUniformLocationRef.current = gl.getUniformLocation(wProgram, "u_projectionMatrix")
    wireframeModelViewMatrixUniformLocationRef.current = gl.getUniformLocation(wProgram, "u_modelViewMatrix")

    const wireframePositions = new Float32Array([
      -1.0,
      -1.0,
      1.0, // 0: front bottom left
      1.0,
      -1.0,
      1.0, // 1: front bottom right
      1.0,
      1.0,
      1.0, // 2: front top right
      -1.0,
      1.0,
      1.0, // 3: front top left
      -1.0,
      -1.0,
      -1.0, // 4: back bottom left
      1.0,
      -1.0,
      -1.0, // 5: back bottom right
      1.0,
      1.0,
      -1.0, // 6: back top right
      -1.0,
      1.0,
      -1.0, // 7: back top left
    ])
    const wireframeIndices = new Uint16Array([
      // Front face edges
      0, 1, 1, 2, 2, 3, 3, 0,
      // Back face edges
      4, 5, 5, 6, 6, 7, 7, 4,
      // Connecting edges
      0, 4, 1, 5, 2, 6, 3, 7,
    ])
    wireframePositionBufferRef.current = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, wireframePositionBufferRef.current)
    gl.bufferData(gl.ARRAY_BUFFER, wireframePositions, gl.STATIC_DRAW)
    wireframeIndexBufferRef.current = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireframeIndexBufferRef.current)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wireframeIndices, gl.STATIC_DRAW)

    // --- Initialize Galaxy Shader Program ---
    const galaxyVertexShader = createShader(gl, gl.VERTEX_SHADER, galaxyVertexShaderSource)
    const galaxyFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, galaxyFragmentShaderSource)
    if (!galaxyVertexShader || !galaxyFragmentShader) return

    const gProgram = gl.createProgram()
    if (!gProgram) return
    galaxyProgramRef.current = gProgram
    gl.attachShader(gProgram, galaxyVertexShader)
    gl.attachShader(gProgram, galaxyFragmentShader)
    gl.linkProgram(gProgram)
    if (!gl.getProgramParameter(gProgram, gl.LINK_STATUS)) {
      console.error("Unable to initialize the galaxy shader program: " + gl.getProgramInfoLog(gProgram))
      return
    }
    galaxyPositionAttributeLocationRef.current = gl.getAttribLocation(gProgram, "a_galaxy_position")
    galaxyResolutionUniformLocationRef.current = gl.getUniformLocation(gProgram, "u_resolution")
    galaxyTimeUniformLocationRef.current = gl.getUniformLocation(gProgram, "u_time")
    galaxyMouseUniformLocationRef.current = gl.getUniformLocation(gProgram, "u_mouse")

    const galaxyPositions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    galaxyPositionBufferRef.current = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, galaxyPositionBufferRef.current)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(galaxyPositions), gl.STATIC_DRAW)

    const resizeCanvas = () => {
      if (!gl || !canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
      mat4.perspective(
        projectionMatrixRef.current,
        (45 * Math.PI) / 180,
        gl.canvas.width / gl.canvas.height,
        0.1,
        100.0,
      )
    }
    window.addEventListener("resize", resizeCanvas)
    resizeCanvas()

    let cubeRotation = 0.0
    let then = 0

    const render = (now: number) => {
      now *= 0.001
      const deltaTime = now - then
      then = now

      const gl = glRef.current
      if (!gl) return

      gl.clearColor(0.0, 0.0, 0.0, 1.0)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

      // --- Render Galaxy Background ---
      const galaxyProg = galaxyProgramRef.current
      const galPosAttrLoc = galaxyPositionAttributeLocationRef.current
      if (galaxyProg && galPosAttrLoc !== -1) {
        gl.useProgram(galaxyProg)

        gl.bindBuffer(gl.ARRAY_BUFFER, galaxyPositionBufferRef.current)
        gl.vertexAttribPointer(galPosAttrLoc, 2, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(galPosAttrLoc)

        gl.uniform2f(galaxyResolutionUniformLocationRef.current, gl.canvas.width, gl.canvas.height)
        gl.uniform1f(galaxyTimeUniformLocationRef.current, now)
        gl.uniform2f(galaxyMouseUniformLocationRef.current, mouseRef.current.x, mouseRef.current.y)

        gl.disable(gl.DEPTH_TEST)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.enable(gl.DEPTH_TEST)
      }

      // --- Render Cube ---
      const cubeProg = cubeProgramRef.current
      const cubePosAttrLoc = cubePositionAttributeLocationRef.current
      const wireframeProg = wireframeProgramRef.current
      const wireframePosAttrLoc = wireframePositionAttributeLocationRef.current
      if (cubeProg && cubePosAttrLoc !== -1 && wireframeProg && wireframePosAttrLoc !== -1) {
        const modelViewMatrix = mat4.create()
        mat4.translate(modelViewMatrix, modelViewMatrix, [-0.0, 0.0, -zoomRef.current])
        mat4.rotate(modelViewMatrix, modelViewMatrix, rotationRef.current.x, [1, 0, 0])
        mat4.rotate(modelViewMatrix, modelViewMatrix, rotationRef.current.y, [0, 1, 0])
        mat4.rotate(modelViewMatrix, modelViewMatrix, cubeRotation, [0, 1, 0])
        mat4.rotate(modelViewMatrix, modelViewMatrix, cubeRotation * 0.7, [1, 0, 1])

        gl.useProgram(cubeProg)

        gl.uniformMatrix4fv(cubeProjectionMatrixUniformLocationRef.current, false, projectionMatrixRef.current)
        gl.uniformMatrix4fv(cubeModelViewMatrixUniformLocationRef.current, false, modelViewMatrix)
        gl.uniform1f(cubeTimeUniformLocationRef.current, now)
        gl.uniform2f(cubeMouseUniformLocationRef.current, mouseRef.current.x, mouseRef.current.y)

        gl.bindBuffer(gl.ARRAY_BUFFER, cubePositionBufferRef.current)
        gl.vertexAttribPointer(cubePosAttrLoc, 3, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(cubePosAttrLoc)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeIndexBufferRef.current)

        gl.depthFunc(gl.LEQUAL)
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0)

        gl.useProgram(wireframeProg)

        gl.uniformMatrix4fv(wireframeProjectionMatrixUniformLocationRef.current, false, projectionMatrixRef.current)
        gl.uniformMatrix4fv(wireframeModelViewMatrixUniformLocationRef.current, false, modelViewMatrix)

        gl.bindBuffer(gl.ARRAY_BUFFER, wireframePositionBufferRef.current)
        gl.vertexAttribPointer(wireframePosAttrLoc, 3, gl.FLOAT, false, 0, 0)
        gl.enableVertexAttribArray(wireframePosAttrLoc)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireframeIndexBufferRef.current)

        gl.lineWidth(2.0)
        gl.drawElements(gl.LINES, 24, gl.UNSIGNED_SHORT, 0)
      }

      cubeRotation += deltaTime
      animationFrameIdRef.current = requestAnimationFrame(render)
    }

    animationFrameIdRef.current = requestAnimationFrame(render)

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mousemove", handleMouseMove)
      canvas.removeEventListener("mouseup", handleMouseUp)
      canvas.removeEventListener("mouseleave", handleMouseUp)
      canvas.removeEventListener("wheel", handleWheel)

      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationFrameIdRef.current)
      const gl = glRef.current
      if (gl) {
        gl.deleteBuffer(cubePositionBufferRef.current)
        gl.deleteBuffer(cubeIndexBufferRef.current)
        gl.deleteProgram(cubeProgramRef.current)
        gl.deleteBuffer(wireframePositionBufferRef.current)
        gl.deleteBuffer(wireframeIndexBufferRef.current)
        gl.deleteProgram(wireframeProgramRef.current)
        gl.deleteBuffer(galaxyPositionBufferRef.current)
        gl.deleteProgram(galaxyProgramRef.current)
      }
    }
  }, [])

  return (
    <div className="relative w-screen h-screen bg-black">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-black bg-opacity-50 p-1 rounded">
        {" "}
        <a
          href="https://www.linkedin.com/in/sajan-bodele/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-200"
        >
          @SajanBodele
        </a>
      </div>
      <div className="absolute top-2 left-2 text-xs text-gray-400 bg-black bg-opacity-50 p-2 rounded">
        <div>Drag to rotate • Scroll to zoom</div>
        <div>Mouse position affects animation</div>
      </div>
    </div>
  )
}

export default GLSLShaderCube
