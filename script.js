import * as THREE from "three";

import {
    OrbitControls
} from "three/addons/controls/OrbitControls.js";

import {
    EffectComposer
} from "three/addons/postprocessing/EffectComposer.js";

import {
    RenderPass
} from "three/addons/postprocessing/RenderPass.js";

import {
    UnrealBloomPass
} from "three/addons/postprocessing/UnrealBloomPass.js";

import {
    OutputPass
} from "three/addons/postprocessing/OutputPass.js";

const canvas = document.getElementById("scene");
const loading = document.getElementById("loading");
const loadingGif = document.getElementById("loadingGif");
const loadingBar = document.getElementById("loadingBar");
const loadingPercent = document.getElementById("loadingPercent");
const finalVideoWrap =
    document.getElementById("finalVideoWrap");
const finalVideo =
    document.getElementById("finalVideo");

const isMobile = matchMedia(
    "(max-width: 900px), (pointer: coarse)"
).matches;

const quality = isMobile ? 0.72 : 1;
const LOOP_SECONDS = 21;
const LOADING_TAP_COUNT = 10;
const HOME_GIF_DURATION = 3000;
const HOME_GIF_STEP_MS =
    HOME_GIF_DURATION /
    LOADING_TAP_COUNT;
const FINALE_START_SECONDS = 20.2;
const MESSAGE_FORM_SECONDS = 4.2;
const MESSAGE_VIDEO_SECONDS = 30;
const MESSAGE_PARTICLE_COUNT =
    isMobile ? 12000 : 24000;
const MESSAGE_TEXT_LINES = [
    "SARA,",
    "VOCÊ NÃO É GUITARRA,",
    "MAS SOU DOIDINHO",
    "PARA TE TOCAR NO MEU COLO",
    "ENQUANTO FAZ",
    "UNS SONS..."
];
const CAMERA_TARGET =
    new THREE.Vector3(0, -3.5, 0);

const INITIAL_CAMERA_POSITION =
    new THREE.Vector3(0, 5.8, 72);

const cameraWorldQuaternion =
    new THREE.Quaternion();

const parentWorldQuaternion =
    new THREE.Quaternion();

let renderer;
let composer;
let bloomPass;
let scene;
let camera;
let controls;
let world;
let rotatingCore;
let clock;

let heart;
let base;
let plasma;
let ambient;
let baseGlow;
let heartAura;
let filaments;
let messageParticles;
let sceneCycleStartedAt = 0;
let finaleStartedAt = null;
let messageFullyFormedAt = null;
let coreWasHidden = false;
let finalVideoShown = false;

const animatedMaterials = [];

function setLoadingProgress(
    percent
) {
    const value = Math.max(
        0,
        Math.min(
            100,
            Math.round(percent)
        )
    );

    if (loadingBar) {
        loadingBar.style.width =
            `${value}%`;
    }

    if (loadingPercent) {
        loadingPercent.textContent =
            `${value}%`;
    }

}

function waitForPaint() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(resolve);
        });
    });
}

async function setLoadingStep() {
    await waitForPaint();
}

function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function restartLoadingGif() {
    if (!loadingGif) {
        return;
    }

    const source =
        loadingGif.getAttribute("src");

    loadingGif.removeAttribute("src");
    loadingGif.offsetWidth;
    loadingGif.setAttribute("src", source);
}

async function runGifLoadingProgress() {
    setLoadingProgress(0);
    restartLoadingGif();
    await waitForPaint();

    for (
        let step = 1;
        step <= LOADING_TAP_COUNT;
        step++
    ) {
        await wait(HOME_GIF_STEP_MS);

        setLoadingProgress(
            step * 10
        );
    }
}

function hideLoading() {
    setLoadingProgress(
        100
    );

    requestAnimationFrame(() => {
        loading?.classList.add("hidden");
    });
}

function showLoadingError(error) {
    if (loadingPercent) {
        loadingPercent.textContent =
            error?.message || "Erro";
    }
}

function showFinalVideo() {
    if (finalVideoShown) {
        return;
    }

    finalVideoShown = true;

    finalVideoWrap?.classList.add("visible");

    if (finalVideo) {
        finalVideo.currentTime = 0;
        finalVideo.play().catch(() => {});
    }
}

function hideFinalVideo() {
    finalVideoShown = false;
    finalVideoWrap?.classList.remove("visible");

    if (finalVideo) {
        finalVideo.pause();
        finalVideo.currentTime = 0;
    }
}

function resetFinaleState() {
    finaleStartedAt = null;
    messageFullyFormedAt = null;
    coreWasHidden = false;

    hideFinalVideo();

    if (rotatingCore) {
        rotatingCore.visible = true;
    }

    if (messageParticles) {
        messageParticles.visible = false;
        messageParticles.material.opacity = 0;
    }

    if (bloomPass) {
        bloomPass.enabled = true;
    }
}

function restartSceneCycle(elapsed) {
    sceneCycleStartedAt = elapsed;
    resetFinaleState();
}

async function init() {
    await setLoadingStep();

    const webgl =
        canvas.getContext("webgl2") ||
        canvas.getContext("webgl");

    if (!webgl) {
        throw new Error(
            "Este navegador ou dispositivo não disponibilizou WebGL."
        );
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x00030a, 0.009);

    await setLoadingStep();

    camera = new THREE.PerspectiveCamera(
        44,
        window.innerWidth / window.innerHeight,
        0.1,
        260
    );

    camera.position.copy(
        INITIAL_CAMERA_POSITION
    );

    camera.lookAt(CAMERA_TARGET);

    renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: "high-performance",
        alpha: false,
        depth: true,
        stencil: false
    });

    const pixelRatio = Math.min(
        window.devicePixelRatio,
        isMobile ? 1.15 : 1.5
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight,
        false
    );

    renderer.setPixelRatio(pixelRatio);

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    renderer.toneMapping =
        THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.06;

    await setLoadingStep();

    composer = new EffectComposer(renderer);

    composer.setPixelRatio(pixelRatio);

    composer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    composer.addPass(
        new RenderPass(scene, camera)
    );

    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(
            window.innerWidth,
            window.innerHeight
        ),
        isMobile ? 0.78 : 0.92,
        0.48,
        0.12
    );

    bloomPass.radius = 0.5;
    bloomPass.threshold = 0.12;

    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());

    setupControls();

    await setLoadingStep();

    world = new THREE.Group();

    

    world.position.y = -3.2;

    scene.add(world);

    rotatingCore = new THREE.Group();

    world.add(rotatingCore);

    await setLoadingStep();

    base = createBaseParticles(
        Math.round(7200 * quality)
    );

    rotatingCore.add(base);

    await setLoadingStep();

    heart = createHeartParticles(
        Math.round(18000 * quality)
    );

    rotatingCore.add(heart);

    await setLoadingStep();

    plasma = createPlasmaParticles(
        Math.round(11500 * quality)
    );

    rotatingCore.add(plasma);

    await setLoadingStep();

    ambient = createAmbientParticles(
        Math.round(1100 * quality)
    );

    world.add(ambient);

    messageParticles =
        createMessageParticles(
            MESSAGE_PARTICLE_COUNT
        );

    world.add(messageParticles);

    await setLoadingStep();

    filaments = createFilaments(
        isMobile ? 10 : 16
    );

    rotatingCore.add(filaments);

    clock = new THREE.Clock();

    window.addEventListener(
        "resize",
        onResize,
        { passive: true }
    );

    document.addEventListener(
        "visibilitychange",
        () => {
            if (document.hidden) {
                clock.stop();
            } else {
                clock.start();
            }
        }
    );

    fitComposition();

    await setLoadingStep();
}



function createHeartParticles(count) {
    const geometry = new THREE.BufferGeometry();

    const spawn = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const seeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const layers = new Float32Array(count);

    const dark = new THREE.Color(0x0062d8);
    const cyan = new THREE.Color(0x00dbff);
    const white = new THREE.Color(0xc9ffff);

    const tempColor = new THREE.Color();

    for (let i = 0; i < count; i++) {
        

        const boundary = Math.random() < 0.42;

        const t =
            Math.random() *
            Math.PI *
            2;

        const point = heartFormula(t);

        const radial = boundary
            ? 0.91 + Math.random() * 0.12
            : Math.pow(Math.random(), 0.48) *
            (
                0.95 +
                Math.sin(t * 7) * 0.035
            );

        const irregular =
            1 +
            Math.sin(
                t * 9 +
                i * 0.013
            ) *
            0.018;

        const x =
            point.x *
            1.13 *
            radial *
            irregular;

        const y =
            point.y *
            1.08 *
            radial +
            4.5;

        const thickness = boundary
            ? 2.2
            : 6.8 * (
                1 - radial * 0.38
            );

        const z =
            (Math.random() - 0.5) *
            thickness;

        target[i * 3] = x;
        target[i * 3 + 1] = y;
        target[i * 3 + 2] = z;

        

        const angle =
            Math.random() *
            Math.PI *
            2;

        const radius =
            Math.pow(
                Math.random(),
                0.62
            ) *
            24;

        spawn[i * 3] =
            Math.cos(angle) *
            radius;

        spawn[i * 3 + 1] =
            -20.3 +
            (Math.random() - 0.5) *
            1.25;

        spawn[i * 3 + 2] =
            Math.sin(angle) *
            radius *
            0.32;

        const brightness = Math.random();

        tempColor
            .copy(dark)
            .lerp(
                cyan,
                0.34 +
                brightness * 0.66
            );

        if (
            brightness > 0.91 ||
            (
                boundary &&
                brightness > 0.78
            )
        ) {
            tempColor.lerp(
                white,
                boundary ? 0.72 : 0.42
            );
        }

        colors[i * 3] = tempColor.r;
        colors[i * 3 + 1] = tempColor.g;
        colors[i * 3 + 2] = tempColor.b;

        seeds[i] = Math.random();

        sizes[i] = boundary
            ? 1.1 + Math.random() * 1.55
            : 0.65 + Math.random() * 1.35;

        layers[i] = boundary ? 1 : 0;
    }

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            spawn,
            3
        )
    );

    geometry.setAttribute(
        "aTarget",
        new THREE.BufferAttribute(
            target,
            3
        )
    );

    geometry.setAttribute(
        "aColor",
        new THREE.BufferAttribute(
            colors,
            3
        )
    );

    geometry.setAttribute(
        "aSeed",
        new THREE.BufferAttribute(
            seeds,
            1
        )
    );

    geometry.setAttribute(
        "aSize",
        new THREE.BufferAttribute(
            sizes,
            1
        )
    );

    geometry.setAttribute(
        "aLayer",
        new THREE.BufferAttribute(
            layers,
            1
        )
    );

    const material =
        new THREE.ShaderMaterial({
            uniforms: commonUniforms(),

            vertexShader:
                heartVertexShader,

            fragmentShader:
                particleFragmentShader,

            transparent: true,

            blending:
                THREE.AdditiveBlending,

            depthWrite: false,
            depthTest: true,
            toneMapped: false
        });

    animatedMaterials.push(material);

    return new THREE.Points(
        geometry,
        material
    );
}



function createBaseParticles(count) {
    const geometry =
        new THREE.BufferGeometry();

    const positions =
        new Float32Array(count * 3);

    const colors =
        new Float32Array(count * 3);

    const seeds =
        new Float32Array(count);

    const sizes =
        new Float32Array(count);

    const deep =
        new THREE.Color(0x0046b8);

    const bright =
        new THREE.Color(0x5ff8ff);

    const tempColor =
        new THREE.Color();

    for (let i = 0; i < count; i++) {
        const angle =
            Math.random() *
            Math.PI *
            2;

        const radius =
            Math.pow(
                Math.random(),
                0.56
            ) *
            27;

        positions[i * 3] =
            Math.cos(angle) *
            radius;

        positions[i * 3 + 1] =
            -20.5 +
            (Math.random() - 0.5) *
            1.25;

        positions[i * 3 + 2] =
            Math.sin(angle) *
            radius *
            0.3;

        tempColor
            .copy(deep)
            .lerp(
                bright,
                Math.pow(
                    Math.random(),
                    1.7
                )
            );

        colors[i * 3] = tempColor.r;
        colors[i * 3 + 1] = tempColor.g;
        colors[i * 3 + 2] = tempColor.b;

        seeds[i] = Math.random();

        sizes[i] =
            0.55 +
            Math.random() *
            1.65;
    }

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            positions,
            3
        )
    );

    geometry.setAttribute(
        "aColor",
        new THREE.BufferAttribute(
            colors,
            3
        )
    );

    geometry.setAttribute(
        "aSeed",
        new THREE.BufferAttribute(
            seeds,
            1
        )
    );

    geometry.setAttribute(
        "aSize",
        new THREE.BufferAttribute(
            sizes,
            1
        )
    );

    const material =
        new THREE.ShaderMaterial({
            uniforms: commonUniforms(),

            vertexShader:
                baseVertexShader,

            fragmentShader:
                particleFragmentShader,

            transparent: true,

            blending:
                THREE.AdditiveBlending,

            depthWrite: false,
            toneMapped: false
        });

    animatedMaterials.push(material);

    return new THREE.Points(
        geometry,
        material
    );
}



function createPlasmaParticles(count) {
    const geometry =
        new THREE.BufferGeometry();

    const positions =
        new Float32Array(count * 3);

    const velocities =
        new Float32Array(count * 3);

    const colors =
        new Float32Array(count * 3);

    const seeds =
        new Float32Array(count);

    const sizes =
        new Float32Array(count);

    const blue =
        new THREE.Color(0x008dff);

    const cyan =
        new THREE.Color(0x38f4ff);

    const white =
        new THREE.Color(0xe4ffff);

    const tempColor =
        new THREE.Color();

    for (let i = 0; i < count; i++) {
        const angle =
            Math.random() *
            Math.PI *
            2;

        const radius =
            Math.pow(
                Math.random(),
                1.1
            ) *
            18;

        positions[i * 3] =
            Math.cos(angle) *
            radius;

        positions[i * 3 + 1] =
            -20.2 +
            Math.random() *
            1.1;

        positions[i * 3 + 2] =
            Math.sin(angle) *
            radius *
            0.25;

        velocities[i * 3] =
            (Math.random() - 0.5) *
            (
                8 +
                Math.random() *
                16
            );

        velocities[i * 3 + 1] =
            27 +
            Math.random() *
            35;

        velocities[i * 3 + 2] =
            (Math.random() - 0.5) *
            18;

        const brightness =
            Math.random();

        tempColor
            .copy(blue)
            .lerp(
                cyan,
                brightness
            );

        if (brightness > 0.82) {
            tempColor.lerp(
                white,
                (
                    brightness -
                    0.82
                ) /
                0.18
            );
        }

        colors[i * 3] = tempColor.r;
        colors[i * 3 + 1] = tempColor.g;
        colors[i * 3 + 2] = tempColor.b;

        seeds[i] = Math.random();

        sizes[i] =
            0.7 +
            Math.random() *
            2.7;
    }

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            positions,
            3
        )
    );

    geometry.setAttribute(
        "aVelocity",
        new THREE.BufferAttribute(
            velocities,
            3
        )
    );

    geometry.setAttribute(
        "aColor",
        new THREE.BufferAttribute(
            colors,
            3
        )
    );

    geometry.setAttribute(
        "aSeed",
        new THREE.BufferAttribute(
            seeds,
            1
        )
    );

    geometry.setAttribute(
        "aSize",
        new THREE.BufferAttribute(
            sizes,
            1
        )
    );

    const material =
        new THREE.ShaderMaterial({
            uniforms: commonUniforms(),

            vertexShader:
                plasmaVertexShader,

            fragmentShader:
                particleFragmentShader,

            transparent: true,

            blending:
                THREE.AdditiveBlending,

            depthWrite: false,
            toneMapped: false
        });

    animatedMaterials.push(material);

    return new THREE.Points(
        geometry,
        material
    );
}



function createAmbientParticles(count) {
    const geometry =
        new THREE.BufferGeometry();

    const positions =
        new Float32Array(count * 3);

    const colors =
        new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        positions[i * 3] =
            (Math.random() - 0.5) *
            110;

        positions[i * 3 + 1] =
            (Math.random() - 0.5) *
            96;

        positions[i * 3 + 2] =
            -8 -
            Math.random() *
            55;

        colors[i * 3] = 0.02;

        colors[i * 3 + 1] =
            0.24 +
            Math.random() *
            0.35;

        colors[i * 3 + 2] =
            0.75 +
            Math.random() *
            0.25;
    }

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            positions,
            3
        )
    );

    geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(
            colors,
            3
        )
    );

    const material =
        new THREE.PointsMaterial({
            size: isMobile
                ? 0.2
                : 0.25,

            vertexColors: true,

            transparent: true,

            opacity: 0.42,

            blending:
                THREE.AdditiveBlending,

            depthWrite: false,
            sizeAttenuation: true,
            toneMapped: false
        });

    return new THREE.Points(
        geometry,
        material
    );
}

function createMessageParticles(count) {
    const targets =
        createMessageTargets(count);

    const geometry =
        new THREE.BufferGeometry();

    const positions =
        new Float32Array(count * 3);

    const spawn =
        new Float32Array(count * 3);

    const colors =
        new Float32Array(count * 3);

    const seeds =
        new Float32Array(count);

    const cyan =
        new THREE.Color(0x3edcff);

    const soft =
        new THREE.Color(0xbdf7ff);

    const tempColor =
        new THREE.Color();

    for (let i = 0; i < count; i++) {
        const t =
            Math.random() *
            Math.PI *
            2;

        const point =
            heartFormula(t);

        const radial =
            0.32 +
            Math.pow(
                Math.random(),
                0.58
            ) *
            0.78;

        const x =
            point.x *
            1.1 *
            radial;

        const y =
            point.y *
            1.06 *
            radial +
            4.5;

        const z =
            (Math.random() - 0.5) *
            8;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        spawn[i * 3] = x;
        spawn[i * 3 + 1] = y;
        spawn[i * 3 + 2] = z;

        const brightness =
            Math.random();

        tempColor
            .copy(cyan)
            .lerp(
                soft,
                0.18 +
                brightness *
                0.34
            );

        colors[i * 3] = tempColor.r;
        colors[i * 3 + 1] = tempColor.g;
        colors[i * 3 + 2] = tempColor.b;

        seeds[i] = Math.random();
    }

    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            positions,
            3
        )
    );

    geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(
            colors,
            3
        )
    );

    const material =
        new THREE.PointsMaterial({
            size: isMobile ? 3.0 : 2.45,
            vertexColors: true,
            transparent: true,
            opacity: 0,
            blending:
                THREE.NormalBlending,
            depthWrite: false,
            depthTest: false,
            sizeAttenuation: false,
            toneMapped: false
        });

    const points =
        new THREE.Points(
            geometry,
            material
        );

    points.visible = false;
    points.renderOrder = 4;
    points.userData.spawn = spawn;
    points.userData.targets = targets;
    points.userData.seeds = seeds;

    return points;
}

function createMessageTargets(count) {
    const canvas =
        document.createElement("canvas");

    canvas.width = 2600;
    canvas.height = 1200;

    const context =
        canvas.getContext("2d");

    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";

    let fontSize =
        isMobile ? 108 : 122;

    const maxWidth =
        canvas.width * 0.86;

    do {
        context.font =
            `800 ${fontSize}px Segoe UI, Arial, sans-serif`;

        fontSize -= 4;
    } while (
        MESSAGE_TEXT_LINES.some((line) => {
            return context
                .measureText(line)
                .width > maxWidth;
        }) &&
        fontSize > 60
    );

    const lineHeight =
        fontSize * 1.18;

    const startY =
        canvas.height / 2 -
        (
            MESSAGE_TEXT_LINES.length -
            1
        ) *
        lineHeight /
        2;

    for (
        let i = 0;
        i < MESSAGE_TEXT_LINES.length;
        i++
    ) {
        context.fillText(
            MESSAGE_TEXT_LINES[i],
            canvas.width / 2,
            startY +
                i *
                lineHeight
        );
    }

    const imageData =
        context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height
        ).data;

    const points = [];
    const step =
        isMobile ? 3 : 2;

    for (
        let y = 0;
        y < canvas.height;
        y += step
    ) {
        for (
            let x = 0;
            x < canvas.width;
            x += step
        ) {
            const alpha =
                imageData[
                    (
                        y *
                        canvas.width +
                        x
                    ) *
                    4 +
                    3
                ];

            if (alpha > 8) {
                points.push([
                    x,
                    y
                ]);
            }
        }
    }

    const targets =
        new Float32Array(count * 3);

    const width =
        isMobile ? 42 : 58;

    const height =
        isMobile ? 24 : 30;

    for (let i = 0; i < count; i++) {
        const point =
            points[
                Math.floor(
                    Math.random() *
                    points.length
                )
            ];

        targets[i * 3] =
            (
                point[0] /
                canvas.width -
                0.5
            ) *
            width;

        targets[i * 3 + 1] =
            (
                0.5 -
                point[1] /
                canvas.height
            ) *
            height +
            3.8;

        targets[i * 3 + 2] =
            -2.2 +
            (Math.random() - 0.5) *
            0.2;
    }

    return targets;
}

function updateMessageParticles(elapsed) {
    if (!messageParticles) {
        return;
    }

    if (
        finaleStartedAt === null &&
        elapsed >= FINALE_START_SECONDS
    ) {
        finaleStartedAt = elapsed;
        messageParticles.visible = true;

        if (bloomPass) {
            bloomPass.enabled = false;
        }
    }

    if (finaleStartedAt === null) {
        return;
    }

    const rawProgress =
        Math.min(
            1,
            Math.max(
                0,
                (
                    elapsed -
                    finaleStartedAt
                ) /
                MESSAGE_FORM_SECONDS
            )
        );

    const progress =
        rawProgress *
        rawProgress *
        (
            3 -
            2 *
            rawProgress
        );

    const positionAttribute =
        messageParticles
            .geometry
            .attributes
            .position;

    const positions =
        positionAttribute.array;

    const spawn =
        messageParticles.userData.spawn;

    const targets =
        messageParticles.userData.targets;

    const seeds =
        messageParticles.userData.seeds;

    for (
        let i = 0;
        i < positions.length / 3;
        i++
    ) {
        const seed =
            seeds[i];

        const swirl =
            Math.sin(
                elapsed *
                (
                    2.0 +
                    seed *
                    3.0
                ) +
                seed *
                50
            ) *
            (
                1 -
                progress
            ) *
            2.4;

        positions[i * 3] =
            THREE.MathUtils.lerp(
                spawn[i * 3],
                targets[i * 3],
                progress
            ) +
            swirl *
            0.35;

        positions[i * 3 + 1] =
            THREE.MathUtils.lerp(
                spawn[i * 3 + 1],
                targets[i * 3 + 1],
                progress
            ) +
            Math.cos(
                elapsed *
                2.4 +
                seed *
                70
            ) *
            (
                1 -
                progress
            ) *
            0.9;

        positions[i * 3 + 2] =
            THREE.MathUtils.lerp(
                spawn[i * 3 + 2],
                targets[i * 3 + 2],
                progress
            ) +
            Math.sin(
                elapsed *
                1.7 +
                seed *
                80
            ) *
            (
                1 -
                progress
            ) *
            1.6;
    }

    positionAttribute.needsUpdate = true;

    messageParticles.material.opacity =
        Math.min(
            0.45,
            rawProgress *
            0.68
        );

    if (
        !coreWasHidden &&
        rawProgress > 0.16
    ) {
        coreWasHidden = true;
        rotatingCore.visible = false;
    }

    if (
        rawProgress >= 1 &&
        messageFullyFormedAt === null
    ) {
        messageFullyFormedAt = elapsed;
        showFinalVideo();
    }
}

function updateMessageOrientation() {
    if (
        !messageParticles ||
        !messageParticles.visible
    ) {
        return;
    }

    camera.getWorldQuaternion(
        cameraWorldQuaternion
    );

    world.getWorldQuaternion(
        parentWorldQuaternion
    );

    messageParticles.quaternion.copy(
        parentWorldQuaternion
            .invert()
            .multiply(cameraWorldQuaternion)
    );
}



function createFilaments(count) {
    const group =
        new THREE.Group();

    for (let i = 0; i < count; i++) {
        const points = [];

        const turns =
            1.2 +
            Math.random() *
            2.3;

        const phase =
            Math.random() *
            Math.PI *
            2;

        const height =
            28 +
            Math.random() *
            32;

        const radius =
            3 +
            Math.random() *
            10;

        for (let j = 0; j < 72; j++) {
            const t = j / 71;

            const taper =
                1 -
                t *
                0.65;

            points.push(
                new THREE.Vector3(
                    Math.sin(
                        t *
                        Math.PI *
                        2 *
                        turns +
                        phase
                    ) *
                    radius *
                    taper +
                    Math.sin(
                        t * 13 +
                        phase
                    ) *
                    1.4,

                    -20 +
                    t *
                    height,

                    Math.cos(
                        t *
                        Math.PI *
                        2 *
                        turns +
                        phase
                    ) *
                    radius *
                    0.34 *
                    taper
                )
            );
        }

        const geometry =
            new THREE.BufferGeometry()
                .setFromPoints(points);

        let color = 0x008cff;

        if (i % 4 === 0) {
            color = 0xc8ffff;
        } else if (i % 2 === 0) {
            color = 0x39efff;
        }

        const material =
            new THREE.LineBasicMaterial({
                color,
                transparent: true,
                opacity: 0,

                blending:
                    THREE.AdditiveBlending,

                depthWrite: false,
                toneMapped: false
            });

        const line =
            new THREE.Line(
                geometry,
                material
            );

        line.userData.phase = phase;

        line.userData.baseOpacity =
            0.24 +
            Math.random() *
            0.48;

        line.userData.speed =
            0.12 +
            Math.random() *
            0.28;

        group.add(line);
    }

    return group;
}



function createGlowPlane({
    width,
    height,
    color,
    opacity,
    turbulence
}) {
    const material =
        new THREE.ShaderMaterial({
            uniforms: {
                uTime: {
                    value: 0
                },

                uColor: {
                    value:
                        new THREE.Color(color)
                },

                uOpacity: {
                    value: opacity
                },

                uTurbulence: {
                    value: turbulence
                }
            },

            vertexShader:
                glowVertexShader,

            fragmentShader:
                glowFragmentShader,

            transparent: true,

            blending:
                THREE.AdditiveBlending,

            depthWrite: false,
            depthTest: true,
            toneMapped: false
        });

    animatedMaterials.push(material);

    const geometry =
        new THREE.PlaneGeometry(
            width,
            height
        );

    return new THREE.Mesh(
        geometry,
        material
    );
}



function heartFormula(t) {
    const sine = Math.sin(t);

    return {
        x:
            16 *
            sine *
            sine *
            sine,

        y:
            13 * Math.cos(t) -
            5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) -
            Math.cos(4 * t)
    };
}

function commonUniforms() {
    return {
        uTime: {
            value: 0
        },

        uPixelRatio: {
            value: Math.min(
                window.devicePixelRatio,
                isMobile ? 1.15 : 1.5
            )
        },

        uLoop: {
            value: LOOP_SECONDS
        }
    };
}



function setupControls() {
    controls = new OrbitControls(
        camera,
        renderer.domElement
    );

    controls.target.copy(
        CAMERA_TARGET
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.rotateSpeed = 0.58;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle =
        Math.PI - 0.08;
    controls.mouseButtons.LEFT =
        THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE =
        null;
    controls.mouseButtons.RIGHT =
        null;
    controls.touches.ONE =
        THREE.TOUCH.ROTATE;
    controls.touches.TWO =
        THREE.TOUCH.ROTATE;

    controls.update();

    configureInteraction();
}

function configureInteraction() {
    renderer.domElement.addEventListener(
        "contextmenu",
        (event) => {
            event.preventDefault();
        }
    );

    renderer.domElement.addEventListener(
        "dblclick",
        (event) => {
            event.preventDefault();
            event.stopPropagation();
            resetCamera();
        }
    );

    window.addEventListener(
        "wheel",
        (event) => {
            if (
                event.target ===
                    renderer.domElement ||
                event.ctrlKey
            ) {
                event.preventDefault();
            }
        },
        { passive: false }
    );

    [
        "gesturestart",
        "gesturechange",
        "gestureend"
    ].forEach((eventName) => {
        window.addEventListener(
            eventName,
            (event) => {
                event.preventDefault();
            },
            { passive: false }
        );
    });

    document.addEventListener(
        "selectstart",
        (event) => {
            event.preventDefault();
        }
    );

    document.addEventListener(
        "dragstart",
        (event) => {
            event.preventDefault();
        }
    );
}

function resetCamera() {
    camera.position.copy(
        INITIAL_CAMERA_POSITION
    );

    camera.up.set(0, 1, 0);

    controls.target.copy(
        CAMERA_TARGET
    );

    controls.update();
}



function render() {
    const elapsed =
        clock.getElapsedTime();

    let sceneElapsed =
        elapsed -
        sceneCycleStartedAt;

    if (
        messageFullyFormedAt !== null &&
        sceneElapsed -
            messageFullyFormedAt >=
            MESSAGE_VIDEO_SECONDS
    ) {
        restartSceneCycle(elapsed);
        sceneElapsed = 0;
    }

    const phase =
        sceneElapsed %
        LOOP_SECONDS;

    for (
        const material
        of animatedMaterials
    ) {
        if (
            material.uniforms.uTime
        ) {
            material.uniforms
                .uTime
                .value = sceneElapsed;
        }
    }

    const burst =
        smoothWindow(
            phase,
            8.7,
            9.8,
            14,
            16
        );

    const stableGlow =
        0.92 +
        Math.sin(
            sceneElapsed *
            2.1
        ) *
        0.08;

    if (baseGlow) {
        baseGlow.material
            .uniforms
            .uOpacity
            .value =
            (
                0.62 +
                burst *
                0.72
            ) *
            stableGlow;
    }

    if (heartAura) {
        heartAura.material
            .uniforms
            .uOpacity
            .value =
            0.09 +
            burst *
            0.12 +
            Math.sin(
                sceneElapsed *
                1.15
            ) *
            0.018;
    }

    for (
        const line
        of filaments.children
    ) {
        line.material.opacity =
            burst *
            line.userData.baseOpacity *
            (
                0.68 +
                Math.sin(
                    sceneElapsed *
                    5.2 +
                    line.userData.phase
                ) *
                0.32
            );

        line.rotation.y =
            sceneElapsed *
            line.userData.speed +
            line.userData.phase;

        line.rotation.z =
            Math.sin(
                sceneElapsed *
                1.8 +
                line.userData.phase
            ) *
            0.055;

        line.position.x =
            Math.sin(
                sceneElapsed *
                1.2 +
                line.userData.phase
            ) *
            burst *
            1.7;
    }

    ambient.rotation.y =
        sceneElapsed *
        0.012;

    ambient.position.y =
        Math.sin(
            sceneElapsed *
            0.16
        ) *
        0.55;

    updateMessageParticles(sceneElapsed);
    updateMessageOrientation();

    controls.update();

    composer.render();

}

function smoothWindow(
    value,
    attackStart,
    attackEnd,
    releaseStart,
    releaseEnd
) {
    const attack =
        THREE.MathUtils.smoothstep(
            value,
            attackStart,
            attackEnd
        );

    const release =
        1 -
        THREE.MathUtils.smoothstep(
            value,
            releaseStart,
            releaseEnd
        );

    return attack * release;
}



function fitComposition() {
    const aspect =
        window.innerWidth /
        window.innerHeight;

    let scale = 1;

    if (aspect < 0.72) {
        scale = 0.92;
    } else if (aspect > 1.4) {
        scale = 1.12;
    }

    world.scale.setScalar(scale);
}

function onResize() {
    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();

    const pixelRatio =
        Math.min(
            window.devicePixelRatio,
            isMobile ? 1.15 : 1.5
        );

    renderer.setPixelRatio(pixelRatio);

    renderer.setSize(
        window.innerWidth,
        window.innerHeight,
        false
    );

    composer.setPixelRatio(pixelRatio);

    composer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    if (bloomPass) {
        bloomPass.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }

    for (
        const material
        of animatedMaterials
    ) {
        if (
            material.uniforms
                .uPixelRatio
        ) {
            material.uniforms
                .uPixelRatio
                .value =
                pixelRatio;
        }
    }

    fitComposition();
}

const particleFragmentShader =  `
  precision highp float;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    vec2 point =
      gl_PointCoord -
      0.5;

    float distanceToCenter =
      length(point) *
      2.0;

    if (
      distanceToCenter >
      1.0
    ) {
      discard;
    }

    float softEdge =
      smoothstep(
        1.0,
        0.08,
        distanceToCenter
      );

    float core =
      smoothstep(
        0.58,
        0.0,
        distanceToCenter
      );

    vec3 hotColor =
      mix(
        vColor,
        vec3(
          0.82,
          1.0,
          1.0
        ),
        core *
        (
          0.42 +
          vHeat *
          0.44
        )
      );

    

    vec3 hdrColor =
      hotColor *
      (
        1.15 +
        core *
        2.35 +
        vHeat *
        0.85
      );

    gl_FragColor =
      vec4(
        hdrColor,
        softEdge *
        vAlpha
      );
  }
`;



const heartVertexShader =  `
  precision highp float;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uLoop;

  attribute vec3 aTarget;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aSize;
  attribute float aLayer;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vHeat;

  float ease(float value) {
    value =
      clamp(
        value,
        0.0,
        1.0
      );

    return
      value *
      value *
      (
        3.0 -
        2.0 *
        value
      );
  }

  void main() {
    float phase =
      mod(
        uTime,
        uLoop
      );

    

    float beginAt =
      0.18 +
      aSeed *
      1.65;

    float form =
      smoothstep(
        beginAt,
        3.9 +
        aSeed *
        0.35,
        phase
      );

    float endFade =
      1.0 -
      smoothstep(
        20.1,
        20.95,
        phase
      );

    

    float burstAttack =
      smoothstep(
        8.7,
        9.9,
        phase
      );

    float burstRelease =
      1.0 -
      smoothstep(
        14.0,
        16.25,
        phase
      );

    float burst =
      burstAttack *
      burstRelease;

    

    float front =
      -20.0 +
      clamp(
        (
          phase -
          8.75
        ) /
        3.4,
        0.0,
        1.0
      ) *
      43.0;

    float frontHeat =
      exp(
        -abs(
          aTarget.y -
          front
        ) *
        0.16
      ) *
      burstAttack;

    float lowerWeight =
      1.0 -
      smoothstep(
        -3.0,
        14.0,
        aTarget.y
      );

    

    float pulse =
      1.0 +
      pow(
        sin(
          uTime *
          3.05
        ) *
        0.5 +
        0.5,
        8.0
      ) *
      0.026;

    float breathe =
      1.0 +
      sin(
        uTime *
        0.92
      ) *
      0.009;

    vec3 target =
      aTarget;

    target.xy *=
      pulse *
      breathe;

    vec3 positionFinal =
      mix(
        position,
        target,
        ease(form)
      );

    float swirlAngle =
      uTime *
      (
        1.4 +
        aSeed *
        1.1
      ) +
      aSeed *
      35.0;

    vec3 turbulence =
      vec3(
        sin(
          swirlAngle +
          aTarget.y *
          0.18
        ),

        cos(
          swirlAngle *
          1.17 +
          aTarget.x *
          0.12
        ),

        sin(
          swirlAngle *
          0.83 +
          aTarget.x *
          0.2
        )
      );

    positionFinal +=
      turbulence *
      burst *
      (
        0.65 +
        lowerWeight *
        6.8 +
        frontHeat *
        3.0
      );

    positionFinal.y +=
      frontHeat *
      (
        2.5 +
        aSeed *
        7.5
      );

    positionFinal.x +=
      sin(
        uTime *
        1.7 +
        aSeed *
        50.0
      ) *
      0.16;

    positionFinal.y +=
      cos(
        uTime *
        1.45 +
        aSeed *
        43.0
      ) *
      0.13;

    vec4 mvPosition =
      modelViewMatrix *
      vec4(
        positionFinal,
        1.0
      );

    gl_Position =
      projectionMatrix *
      mvPosition;

    gl_PointSize =
      clamp(
        aSize *
        uPixelRatio *
        (
          70.0 /
          max(
            1.0,
            -mvPosition.z
          )
        ),
        1.0,
        8.5
      );

    float flicker =
      0.72 +
      0.28 *
      sin(
        uTime *
        (
          3.0 +
          aSeed *
          4.0
        ) +
        aSeed *
        90.0
      );

    float shellBoost =
      mix(
        0.7,
        1.18,
        aLayer
      );

    vColor = aColor;

    vAlpha =
      form *
      endFade *
      shellBoost *
      flicker *
      (
        0.84 +
        frontHeat *
        0.7
      );

    vHeat =
      clamp(
        frontHeat +
        burst *
        lowerWeight *
        0.52 +
        aLayer *
        0.12,
        0.0,
        1.0
      );
  }
`;



const baseVertexShader =  `
  precision highp float;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uLoop;

  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aSize;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    float phase =
      mod(
        uTime,
        uLoop
      );

    float burst =
      smoothstep(
        8.6,
        9.8,
        phase
      ) *
      (
        1.0 -
        smoothstep(
          14.1,
          16.0,
          phase
        )
      );

    float fadeEnd =
      1.0 -
      smoothstep(
        20.25,
        20.95,
        phase
      );

    vec3 positionFinal =
      position;

    float angle =
      atan(
        positionFinal.z,
        positionFinal.x
      ) +
      uTime *
      (
        0.08 +
        aSeed *
        0.22
      );

    float radius =
      length(
        vec2(
          positionFinal.x,
          positionFinal.z
        )
      );

    positionFinal.x =
      cos(angle) *
      radius;

    positionFinal.z =
      sin(angle) *
      radius;

    positionFinal.y +=
      sin(
        radius *
        0.55 -
        uTime *
        2.5 +
        aSeed *
        12.0
      ) *
      (
        0.18 +
        burst *
        0.48
      );

    positionFinal.x *=
      1.0 +
      sin(
        uTime *
        1.25 +
        aSeed *
        17.0
      ) *
      0.018;

    vec4 mvPosition =
      modelViewMatrix *
      vec4(
        positionFinal,
        1.0
      );

    gl_Position =
      projectionMatrix *
      mvPosition;

    gl_PointSize =
      clamp(
        aSize *
        uPixelRatio *
        (
          67.0 /
          max(
            1.0,
            -mvPosition.z
          )
        ),
        1.0,
        7.0
      );

    float center =
      1.0 -
      smoothstep(
        5.0,
        27.0,
        radius
      );

    float flicker =
      0.62 +
      sin(
        uTime *
        (
          4.0 +
          aSeed *
          5.0
        ) +
        aSeed *
        60.0
      ) *
      0.28;

    vColor = aColor;

    vAlpha =
      fadeEnd *
      (
        0.34 +
        center *
        0.44 +
        burst *
        0.55
      ) *
      flicker;

    vHeat =
      clamp(
        center *
        0.46 +
        burst *
        0.72,
        0.0,
        1.0
      );
  }
`;



const plasmaVertexShader =  `
  precision highp float;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uLoop;

  attribute vec3 aVelocity;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aSize;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vHeat;

  void main() {
    float phase =
      mod(
        uTime,
        uLoop
      );

    float burst =
      smoothstep(
        8.65,
        9.55,
        phase
      ) *
      (
        1.0 -
        smoothstep(
          14.25,
          15.8,
          phase
        )
      );

    float cycle =
      clamp(
        (
          phase -
          8.65
        ) /
        6.7,
        0.0,
        1.0
      );

    float delayed =
      max(
        0.0,
        cycle -
        aSeed *
        0.28
      );

    float travel =
      fract(
        delayed *
        (
          1.45 +
          aSeed *
          0.85
        )
      );

    float enabled =
      step(
        aSeed *
        0.28,
        cycle
      );

    vec3 positionFinal =
      position;

    float spiral =
      travel *
      13.0 +
      aSeed *
      40.0 +
      uTime *
      2.2;

    float containment =
      mix(
        1.0,
        0.22,
        travel
      );

    positionFinal.x =
      positionFinal.x *
      containment +
      sin(spiral) *
      (
        2.0 +
        travel *
        8.0
      ) +
      aVelocity.x *
      travel *
      travel *
      0.28;

    positionFinal.y +=
      aVelocity.y *
      travel *
      (
        0.72 +
        aSeed *
        0.34
      );

    positionFinal.z =
      positionFinal.z *
      containment +
      cos(spiral) *
      (
        1.0 +
        travel *
        4.5
      ) +
      aVelocity.z *
      travel *
      0.22;

    float flare =
      smoothstep(
        0.52,
        0.9,
        travel
      );

    positionFinal.x +=
      aVelocity.x *
      flare *
      0.22;

    positionFinal.z +=
      aVelocity.z *
      flare *
      0.16;

    vec4 mvPosition =
      modelViewMatrix *
      vec4(
        positionFinal,
        1.0
      );

    gl_Position =
      projectionMatrix *
      mvPosition;

    gl_PointSize =
      clamp(
        aSize *
        uPixelRatio *
        (
          72.0 /
          max(
            1.0,
            -mvPosition.z
          )
        ),
        1.2,
        11.0
      );

    float envelope =
      sin(
        clamp(
          travel,
          0.0,
          1.0
        ) *
        3.14159265
      );

    float flicker =
      0.72 +
      sin(
        uTime *
        7.0 +
        aSeed *
        80.0
      ) *
      0.28;

    vColor = aColor;

    vAlpha =
      burst *
      enabled *
      envelope *
      flicker *
      (
        0.5 +
        aSeed *
        0.72
      );

    vHeat =
      clamp(
        0.46 +
        flare *
        0.55 +
        (
          1.0 -
          travel
        ) *
        0.22,
        0.0,
        1.0
      );
  }
`;



const glowVertexShader =  `
  varying vec2 vUv;

  void main() {
    vUv = uv;

    gl_Position =
      projectionMatrix *
      modelViewMatrix *
      vec4(
        position,
        1.0
      );
  }
`;

const glowFragmentShader =  `
  precision highp float;

  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTurbulence;

  varying vec2 vUv;

  float hash(vec2 point) {
    return fract(
      sin(
        dot(
          point,
          vec2(
            127.1,
            311.7
          )
        )
      ) *
      43758.5453123
    );
  }

  float noise(vec2 point) {
    vec2 integerPart =
      floor(point);

    vec2 fractionalPart =
      fract(point);

    fractionalPart =
      fractionalPart *
      fractionalPart *
      (
        3.0 -
        2.0 *
        fractionalPart
      );

    return mix(
      mix(
        hash(integerPart),
        hash(
          integerPart +
          vec2(1.0, 0.0)
        ),
        fractionalPart.x
      ),

      mix(
        hash(
          integerPart +
          vec2(0.0, 1.0)
        ),

        hash(
          integerPart +
          vec2(1.0, 1.0)
        ),

        fractionalPart.x
      ),

      fractionalPart.y
    );
  }

  void main() {
    vec2 point =
      (
        vUv -
        0.5
      ) *
      2.0;

    float radius =
      length(point);

    float turbulenceNoise =
      noise(
        point *
        4.2 +
        vec2(
          uTime *
          0.16,
          -uTime *
          0.11
        )
      );

    float pulse =
      0.88 +
      sin(
        uTime *
        2.05
      ) *
      0.12;

    float body =
      smoothstep(
        1.0,
        0.02,
        radius +
        (
          turbulenceNoise -
          0.5
        ) *
        uTurbulence *
        0.24
      );

    float core =
      exp(
        -radius *
        radius *
        6.8
      );

    float alpha =
      body *
      (
        0.25 +
        core *
        0.92
      ) *
      uOpacity *
      pulse;

    vec3 color =
      uColor *
      (
        0.8 +
        core *
        3.1 +
        turbulenceNoise *
        uTurbulence
      );

    gl_FragColor =
      vec4(
        color,
        alpha
      );
  }
`;

start();

async function start() {
    try {
        await Promise.all([
            init(),
            runGifLoadingProgress()
        ]);

        renderer.setAnimationLoop(render);
        hideLoading();
    } catch (error) {
        showLoadingError(error);
        throw error;
    }
}
