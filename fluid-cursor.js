// ================================================================
// BEAUTIFUL FLUID SPLASH CURSOR - Converted from React to Vanilla JS
// ReactBits inspired design with WebGL fluid simulation
// ================================================================

(function initFluidCursor() {
    const canvas = document.getElementById('fluidCursor');
    if (!canvas) return;

    const config = {
        SIM_RESOLUTION: 128,
        DYE_RESOLUTION: 1440,
        CAPTURE_RESOLUTION: 512,
        DENSITY_DISSIPATION: 3.5,
        VELOCITY_DISSIPATION: 2,
        PRESSURE: 0.1,
        PRESSURE_ITERATIONS: 20,
        CURL: 3,
        SPLAT_RADIUS: 0.2,
        SPLAT_FORCE: 6000,
        SHADING: true,
        COLOR_UPDATE_SPEED: 10,
        BACK_COLOR: { r: 0.5, g: 0, b: 0 },
        TRANSPARENT: true,
        PAUSED: false
    };

    function Pointer() {
        this.id = -1;
        this.texcoordX = 0;
        this.texcoordY = 0;
        this.prevTexcoordX = 0;
        this.prevTexcoordY = 0;
        this.deltaX = 0;
        this.deltaY = 0;
        this.down = false;
        this.moved = false;
        this.color = [0, 0, 0];
    }

    let pointers = [new Pointer()];
    let gl, ext;

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

        let halfFloat, supportLinearFiltering;
        if (isWebGL2) {
            gl.getExtension('EXT_color_buffer_float');
            supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
        } else {
            halfFloat = gl.getExtension('OES_texture_half_float');
            supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
        }

        gl.clearColor(0.0, 0.0, 0.0, 1.0);

        const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : (halfFloat && halfFloat.HALF_FLOAT_OES);
        let formatRGBA, formatRG, formatR;

        if (isWebGL2) {
            formatRGBA = { internalFormat: gl.RGBA16F, format: gl.RGBA };
            formatRG = { internalFormat: gl.RG16F, format: gl.RG };
            formatR = { internalFormat: gl.R16F, format: gl.RED };
        } else {
            formatRGBA = { internalFormat: gl.RGBA, format: gl.RGBA };
            formatRG = { internalFormat: gl.RGBA, format: gl.RGBA };
            formatR = { internalFormat: gl.RGBA, format: gl.RGBA };
        }

        return {
            gl,
            ext: {
                formatRGBA,
                formatRG,
                formatR,
                halfFloatTexType,
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
        varying vec2 vL;
        varying vec2 vR;
        varying vec2 vT;
        varying vec2 vB;
        uniform vec2 texelSize;

        void main () {
            vUv = aPosition * 0.5 + 0.5;
            vL = vUv - vec2(texelSize.x, 0.0);
            vR = vUv + vec2(texelSize.x, 0.0);
            vT = vUv + vec2(0.0, texelSize.y);
            vB = vUv - vec2(0.0, texelSize.y);
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

    let dye;

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
        const dyeRes = getResolution(config.DYE_RESOLUTION);
        const texType = ext.halfFloatTexType;
        const rgba = ext.formatRGBA;
        const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
        gl.disable(gl.BLEND);

        if (!dye) {
            dye = createFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
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
            gl.clearColor(0.0, 0.0, 0.0, 1.0);
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
            r: r * 0.15,
            g: g * 0.15,
            b: b * 0.15
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

    function getResolution(resolution) {
        const aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
        const min = Math.round(resolution);
        const max = Math.round(resolution * (aspectRatio > 1 ? aspectRatio : 1));
        return gl.drawingBufferWidth > gl.drawingBufferHeight
            ? { width: max, height: min }
            : { width: min, height: max };
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
        const pointer = pointers[0];
        const posX = scaleByPixelRatio(e.clientX);
        const posY = scaleByPixelRatio(e.clientY);
        pointer.texcoordX = posX / canvas.width;
        pointer.texcoordY = 1.0 - posY / canvas.height;
        const color = generateColor();
        color.r *= 10;
        color.g *= 10;
        color.b *= 10;
        splat(pointer.texcoordX, pointer.texcoordY, 10, 30, color);
    });

    window.addEventListener('mousemove', e => {
        const posX = scaleByPixelRatio(e.clientX);
        const posY = scaleByPixelRatio(e.clientY);
        pointers[0].texcoordX = posX / canvas.width;
        pointers[0].texcoordY = 1.0 - posY / canvas.height;
        const color = generateColor();
        splat(pointers[0].texcoordX, pointers[0].texcoordY, 5, 5, color);
    });

    window.addEventListener('touchstart', e => {
        const touch = e.touches[0];
        const posX = scaleByPixelRatio(touch.clientX);
        const posY = scaleByPixelRatio(touch.clientY);
        pointers[0].texcoordX = posX / canvas.width;
        pointers[0].texcoordY = 1.0 - posY / canvas.height;
        const color = generateColor();
        color.r *= 10;
        color.g *= 10;
        color.b *= 10;
        splat(pointers[0].texcoordX, pointers[0].texcoordY, 10, 30, color);
    });

    window.addEventListener('touchmove', e => {
        const touch = e.touches[0];
        const posX = scaleByPixelRatio(touch.clientX);
        const posY = scaleByPixelRatio(touch.clientY);
        pointers[0].texcoordX = posX / canvas.width;
        pointers[0].texcoordY = 1.0 - posY / canvas.height;
        const color = generateColor();
        splat(pointers[0].texcoordX, pointers[0].texcoordY, 5, 5, color);
    }, false);

    updateFrame();
    console.log("✨ Fluid Splash Cursor Initialized - Beautiful ReactBits style!");
})();
