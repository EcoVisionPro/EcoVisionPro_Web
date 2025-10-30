// ================================================================
// BEAUTIFUL FLUID SPLASH CURSOR - FIXED VERSION
// Won't cover the page content - transparent background!
// ================================================================

(function initFluidCursor() {
    const canvas = document.getElementById('fluidCursor');
    if (!canvas) return;

    const config = {
        SIM_RESOLUTION: 64,
        DYE_RESOLUTION: 512,
        DENSITY_DISSIPATION: 3.5,
        VELOCITY_DISSIPATION: 2,
        PRESSURE: 0.1,
        PRESSURE_ITERATIONS: 10,
        CURL: 3,
        SPLAT_RADIUS: 0.15,
        SPLAT_FORCE: 3000,
        COLOR_UPDATE_SPEED: 10
    };

    let gl, ext;
    let pointers = [{ id: -1, texcoordX: 0, texcoordY: 0, prevTexcoordX: 0, prevTexcoordY: 0, deltaX: 0, deltaY: 0, down: false, moved: false, color: [0, 0, 0] }];
    let dye;

    function getWebGLContext(canvas) {
        const params = {
            alpha: true,
            depth: false,
            stencil: false,
            antialias: false,
            preserveDrawingBuffer: false
        };
        let gl = canvas.getContext('webgl2', params);
        const isWebGL2 = !!gl;
        if (!isWebGL2) {
            gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);
        }

        let supportLinearFiltering;
        if (isWebGL2) {
            gl.getExtension('EXT_color_buffer_float');
            supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
        } else {
            const halfFloat = gl.getExtension('OES_texture_half_float');
            supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
        }

        gl.clearColor(0.0, 0.0, 0.0, 0.0);

        return {
            gl,
            ext: {
                formatRGBA: { internalFormat: gl.RGBA, format: gl.RGBA },
                formatRG: { internalFormat: gl.RGBA, format: gl.RGBA },
                formatR: { internalFormat: gl.RGBA, format: gl.RGBA },
                halfFloatTexType: gl.HALF_FLOAT,
                supportLinearFiltering
            }
        };
    }

    const context = getWebGLContext(canvas);
    gl = context.gl;
    ext = context.ext;

    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    function createProgram(vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        return program;
    }

    function getUniforms(program) {
        const uniforms = [];
        const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < uniformCount; i++) {
            const uniformName = gl.getActiveUniform(program, i).name;
            uniforms[uniformName] = gl.getUniformLocation(program, uniformName);
        }
        return uniforms;
    }

    const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
        precision highp float;
        attribute vec2 aPosition;
        varying vec2 vUv;
        uniform vec2 texelSize;

        void main () {
            vUv = aPosition * 0.5 + 0.5;
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `);

    const displayFragmentShader = compileShader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        precision mediump sampler2D;
        varying highp vec2 vUv;
        uniform sampler2D uTexture;

        void main () {
            gl_FragColor = texture2D(uTexture, vUv);
        }
    `);

    const splatFragmentShader = compileShader(gl.FRAGMENT_SHADER, `
        precision highp float;
        precision highp sampler2D;
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform float aspectRatio;
        uniform vec3 color;
        uniform vec2 point;
        uniform float radius;

        void main () {
            vec2 p = vUv - point.xy;
            p.x *= aspectRatio;
            vec3 splat = exp(-dot(p, p) / radius) * color;
            vec3 base = texture2D(uTarget, vUv).xyz;
            gl_FragColor = vec4(base + splat, 1.0);
        }
    `);

    const displayProgram = createProgram(baseVertexShader, displayFragmentShader);
    const splatProgram = createProgram(baseVertexShader, splatFragmentShader);
    displayProgram.uniforms = getUniforms(displayProgram);
    splatProgram.uniforms = getUniforms(splatProgram);

    function createFBO(w, h, internalFormat, format, type, param) {
        gl.activeTexture(gl.TEXTURE0);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT);

        return {
            texture,
            fbo,
            width: w,
            height: h,
            texelSizeX: 1.0 / w,
            texelSizeY: 1.0 / h,
            attach(id) {
                gl.activeTexture(gl.TEXTURE0 + id);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                return id;
            }
        };
    }

    function initFramebuffers() {
        const dyeRes = 256;
        const texType = gl.UNSIGNED_BYTE;
        const rgba = ext.formatRGBA;
        const filtering = gl.LINEAR;
        gl.disable(gl.BLEND);

        if (!dye) {
            dye = createFBO(dyeRes, dyeRes, rgba.internalFormat, rgba.format, texType, filtering);
        }
    }

    function blit(target, clear = false) {
        if (target == null) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
            gl.viewport(0, 0, target.width, target.height);
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (clear) {
            gl.clearColor(0.0, 0.0, 0.0, 0.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    function splat(x, y, dx, dy, color) {
        splatProgram.bind = () => gl.useProgram(splatProgram);
        splatProgram.bind();
        gl.uniform1i(splatProgram.uniforms.uTarget, dye.attach(0));
        gl.uniform1f(splatProgram.uniforms.aspectRatio, canvas.width / canvas.height);
        gl.uniform2f(splatProgram.uniforms.point, x, y);
        gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
        gl.uniform1f(splatProgram.uniforms.radius, 0.1);
        blit(dye);
    }

    function generateColor() {
        const h = Math.random();
        const s = 1.0;
        const v = 1.0;
        const { r, g, b } = HSVtoRGB(h, s, v);
        return {
            r: r * 0.2,
            g: g * 0.2,
            b: b * 0.2
        };
    }

    function HSVtoRGB(h, s, v) {
        let r, g, b;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        return { r: r || 0, g: g || 0, b: b || 0 };
    }

    function scaleByPixelRatio(input) {
        return Math.floor(input * (window.devicePixelRatio || 1));
    }

    function resizeCanvas() {
        const width = scaleByPixelRatio(canvas.clientWidth);
        const height = scaleByPixelRatio(canvas.clientHeight);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            return true;
        }
        return false;
    }

    function render() {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
        gl.useProgram(displayProgram);
        gl.uniform1i(displayProgram.uniforms.uTexture, dye.attach(0));
        blit(null);
    }

    function updateFrame() {
        if (resizeCanvas()) initFramebuffers();
        render();
        requestAnimationFrame(updateFrame);
    }

    // Setup buffers
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    initFramebuffers();

    window.addEventListener('mousedown', e => {
        const posX = scaleByPixelRatio(e.clientX);
        const posY = scaleByPixelRatio(e.clientY);
        pointers[0].texcoordX = posX / canvas.width;
        pointers[0].texcoordY = 1.0 - posY / canvas.height;
        const color = generateColor();
        color.r *= 8;
        color.g *= 8;
        color.b *= 8;
        splat(pointers[0].texcoordX, pointers[0].texcoordY, 10, 30, color);
    });

    window.addEventListener('mousemove', e => {
        const posX = scaleByPixelRatio(e.clientX);
        const posY = scaleByPixelRatio(e.clientY);
        pointers[0].texcoordX = posX / canvas.width;
        pointers[0].texcoordY = 1.0 - posY / canvas.height;
        const color = generateColor();
        splat(pointers[0].texcoordX, pointers[0].texcoordY, 3, 3, color);
    });

    window.addEventListener('touchstart', e => {
        const touch = e.touches[0];
        const posX = scaleByPixelRatio(touch.clientX);
        const posY = scaleByPixelRatio(touch.clientY);
        pointers[0].texcoordX = posX / canvas.width;
        pointers[0].texcoordY = 1.0 - posY / canvas.height;
        const color = generateColor();
        color.r *= 8;
        color.g *= 8;
        color.b *= 8;
        splat(pointers[0].texcoordX, pointers[0].texcoordY, 10, 30, color);
    });

    window.addEventListener('touchmove', e => {
        const touch = e.touches[0];
        const posX = scaleByPixelRatio(touch.clientX);
        const posY = scaleByPixelRatio(touch.clientY);
        pointers[0].texcoordX = posX / canvas.width;
        pointers[0].texcoordY = 1.0 - posY / canvas.height;
        const color = generateColor();
        splat(pointers[0].texcoordX, pointers[0].texcoordY, 3, 3, color);
    }, false);

    updateFrame();
    console.log("✨ Fluid Splash Cursor Initialized!");
})();
