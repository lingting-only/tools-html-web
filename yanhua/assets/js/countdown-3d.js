// 3D粒子倒计时特效
let countdown3DScene = null;
let countdown3DCamera = null;
let countdown3DRenderer = null;
let countdown3DParticles = null;
let countdown3DAnimationId = null;
let countdown3DContainer = null;
let countdown3DNumberElement = null;
let isCountdown3DActive = false;
let fireworkParticles = []; // 烟花粒子数组
let lastFireworkTime = 0; // 上次烟花时间

// 获取是否激活状态
function isCountdown3DRunning() {
    return isCountdown3DActive;
}

// 初始化3D粒子系统
function initCountdown3D() {
    if (countdown3DScene) return; // 已经初始化过了

    countdown3DContainer = document.getElementById('countdown-3d-container');
    countdown3DNumberElement = document.getElementById('countdown-number');

    // 创建场景
    countdown3DScene = new THREE.Scene();

    // 创建相机
    const width = window.innerWidth;
    const height = window.innerHeight;
    countdown3DCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    countdown3DCamera.position.z = 5;

    // 创建渲染器
    countdown3DRenderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
    });
    countdown3DRenderer.setSize(width, height);
    countdown3DRenderer.setClearColor(0x000000, 0); // 透明背景
    countdown3DRenderer.domElement.style.display = 'block'; // 显示渲染器
    countdown3DContainer.appendChild(countdown3DRenderer.domElement);

    // 初始化烟花粒子数组
    fireworkParticles = [];

    // 窗口大小改变时更新
    window.addEventListener('resize', onCountdown3DResize);
}

// 处理窗口大小改变
function onCountdown3DResize() {
    if (!countdown3DCamera || !countdown3DRenderer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    countdown3DCamera.aspect = width / height;
    countdown3DCamera.updateProjectionMatrix();
    countdown3DRenderer.setSize(width, height);
}

// 创建烟花粒子（围绕数字位置）
function createFireworkParticles(x, y, z) {
    const particleCount = 50; // 进一步增加粒子数量：从30增加到50
    // 使用白色
    const whiteColor = new THREE.Color(0xFFFFFF);

    for (let i = 0; i < particleCount; i++) {
        // 随机角度和速度 - 进一步降低速度让粒子更缓慢扩散
        const angle1 = Math.random() * Math.PI * 2; // 水平角度
        const angle2 = Math.random() * Math.PI; // 垂直角度
        const speed = 0.05 + Math.random() * 0.15; // 进一步降低速度：从0.1-0.3降低到0.05-0.2，让粒子非常缓慢向外扩散

        // 计算方向向量
        const vx = Math.sin(angle2) * Math.cos(angle1) * speed;
        const vy = Math.sin(angle2) * Math.sin(angle1) * speed;
        const vz = Math.cos(angle2) * speed;

        fireworkParticles.push({
            x: x,
            y: y,
            z: z,
            vx: vx,
            vy: vy,
            vz: vz,
            life: 1.0, // 生命周期（0-1）
            decay: 0.008 + Math.random() * 0.008, // 进一步减慢衰减，让粒子存在更久
            size: 0.5 + Math.random() * 0.8, // 保持小粒子大小：0.5-1.3
            color: whiteColor
        });
    }
}

// 显示数字
function showCountdownNumber(num) {
    if (!countdown3DNumberElement) return;

    countdown3DNumberElement.textContent = num;
    countdown3DNumberElement.style.display = 'block';
    countdown3DNumberElement.style.animation = 'none';

    // 根据数字设置不同的赛博朋克渐变色（10、9、8、7、6、5、4、3、2、1）
    const gradients = {
        10: 'linear-gradient(135deg, #00FFFF 0%, #00F0FF 50%, #00E0FF 100%)', // 霓虹青色渐变
        9: 'linear-gradient(135deg, #FF00FF 0%, #FF00E5 50%, #FF00CC 100%)', // 霓虹粉紫色渐变
        8: 'linear-gradient(135deg, #00FF00 0%, #39FF14 50%, #7FFF00 100%)', // 霓虹绿色渐变
        7: 'linear-gradient(135deg, #8B00FF 0%, #9D00FF 50%, #AF00FF 100%)', // 深紫色渐变
        6: 'linear-gradient(135deg, #FF00FF 0%, #FF1493 50%, #FF69B4 100%)', // 洋红到粉红渐变
        5: 'linear-gradient(135deg, #00FFFF 0%, #00CED1 50%, #20B2AA 100%)', // 青色到青绿渐变
        4: 'linear-gradient(135deg, #FF00FF 0%, #8B00FF 50%, #4B0082 100%)', // 粉紫到深紫渐变
        3: 'linear-gradient(135deg, #00FF00 0%, #00FFFF 50%, #0080FF 100%)', // 绿到青到蓝渐变
        2: 'linear-gradient(135deg, #FF00FF 0%, #FF00CC 50%, #FF0080 100%)', // 粉紫到粉红渐变
        1: 'linear-gradient(135deg, #00FFFF 0%, #00FF80 50%, #00FF00 100%)', // 青到绿渐变
    };

    const shadows = {
        10: '0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(0, 255, 255, 0.3)',
        9: '0 0 10px rgba(255, 0, 255, 0.5), 0 0 20px rgba(255, 0, 255, 0.3)',
        8: '0 0 10px rgba(0, 255, 0, 0.5), 0 0 20px rgba(0, 255, 0, 0.3)',
        7: '0 0 10px rgba(139, 0, 255, 0.5), 0 0 20px rgba(139, 0, 255, 0.3)',
        6: '0 0 10px rgba(255, 0, 255, 0.5), 0 0 20px rgba(255, 20, 147, 0.3)',
        5: '0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(0, 206, 209, 0.3)',
        4: '0 0 10px rgba(255, 0, 255, 0.5), 0 0 20px rgba(139, 0, 255, 0.3)',
        3: '0 0 10px rgba(0, 255, 0, 0.5), 0 0 20px rgba(0, 255, 255, 0.3)',
        2: '0 0 10px rgba(255, 0, 255, 0.5), 0 0 20px rgba(255, 0, 204, 0.3)',
        1: '0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(0, 255, 128, 0.3)',
    };

    const gradient = gradients[num] || gradients[10];
    const shadow = shadows[num] || shadows[10];

    // 设置渐变和阴影
    countdown3DNumberElement.style.background = gradient;
    countdown3DNumberElement.style.webkitBackgroundClip = 'text';
    countdown3DNumberElement.style.webkitTextFillColor = 'transparent';
    countdown3DNumberElement.style.backgroundClip = 'text';
    countdown3DNumberElement.style.textShadow = shadow;

    // 触发跳动动画 - 先播放出现动画，然后持续缓慢跳动
    setTimeout(() => {
        countdown3DNumberElement.style.animation = 'countdownBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55), countdownBounceLoop 2s ease-in-out 0.6s infinite';
    }, 10);

    // 已移除爆炸效果
}

// 隐藏数字
function hideCountdownNumber() {
    if (countdown3DNumberElement) {
        countdown3DNumberElement.style.display = 'none';
    }
}

// 动画循环（渲染烟花粒子）
function animateCountdown3D() {
    if (!isCountdown3DActive) return;

    countdown3DAnimationId = requestAnimationFrame(animateCountdown3D);

    // 更新和渲染烟花粒子
    if (fireworkParticles.length > 0) {
        // 更新粒子
        for (let i = fireworkParticles.length - 1; i >= 0; i--) {
            const p = fireworkParticles[i];

            // 更新位置
            p.x += p.vx;
            p.y += p.vy;
            p.z += p.vz;

            // 应用重力
            p.vy -= 0.01;

            // 更新生命周期
            p.life -= p.decay;

            // 移除死亡粒子
            if (p.life <= 0) {
                fireworkParticles.splice(i, 1);
            }
        }

        // 渲染粒子
        if (fireworkParticles.length > 0) {
            // 创建或更新粒子系统
            if (!countdown3DParticles) {
                // 首次创建粒子系统
                const maxParticles = 500; // 最大粒子数
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(maxParticles * 3);
                const colors = new Float32Array(maxParticles * 3);
                const sizes = new Float32Array(maxParticles);

                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
                geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1).setUsage(THREE.DynamicDrawUsage));

                const material = new THREE.ShaderMaterial({
                    uniforms: {
                        time: { value: 0.0 }
                    },
                    vertexShader: `
                        attribute float size;
                        varying vec3 vColor;
                        uniform float time;
                        
                        void main() {
                            vColor = color;
                            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                            float zDepth = -mvPosition.z;
                            zDepth = max(zDepth, 0.1);
                            float pointSize = size * (300.0 / zDepth);
                            gl_PointSize = pointSize;
                            gl_Position = projectionMatrix * mvPosition;
                        }
                    `,
                    fragmentShader: `
                        precision mediump float;
                        varying vec3 vColor;
                        
                        void main() {
                            float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
                            float alpha = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
                            gl_FragColor = vec4(vColor, alpha);
                        }
                    `,
                    transparent: true,
                    vertexColors: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });

                countdown3DParticles = new THREE.Points(geometry, material);
                countdown3DScene.add(countdown3DParticles);
            }

            // 更新粒子数据
            const positions = countdown3DParticles.geometry.attributes.position.array;
            const colors = countdown3DParticles.geometry.attributes.color.array;
            const sizes = countdown3DParticles.geometry.attributes.size.array;

            const particleCount = Math.min(fireworkParticles.length, positions.length / 3);

            for (let i = 0; i < particleCount; i++) {
                const p = fireworkParticles[i];
                const i3 = i * 3;

                positions[i3] = p.x;
                positions[i3 + 1] = p.y;
                positions[i3 + 2] = p.z;

                // 根据生命周期调整颜色和大小
                colors[i3] = p.color.r * p.life;
                colors[i3 + 1] = p.color.g * p.life;
                colors[i3 + 2] = p.color.b * p.life;

                sizes[i] = p.size * p.life;
            }

            // 标记需要更新
            countdown3DParticles.geometry.attributes.position.needsUpdate = true;
            countdown3DParticles.geometry.attributes.color.needsUpdate = true;
            countdown3DParticles.geometry.attributes.size.needsUpdate = true;
            countdown3DParticles.geometry.setDrawRange(0, particleCount);
        } else if (fireworkParticles.length === 0) {
            // 没有粒子时隐藏
            countdown3DParticles.geometry.setDrawRange(0, 0);
        }
    }

    // 渲染场景
    if (countdown3DRenderer && countdown3DScene && countdown3DCamera) {
        countdown3DRenderer.render(countdown3DScene, countdown3DCamera);
    }
}

// 启动3D倒计时特效
function startCountdown3D() {
    if (isCountdown3DActive) return; // 已经在运行

    initCountdown3D();
    isCountdown3DActive = true;
    countdown3DContainer.style.display = 'block';

    // 不创建粒子系统，只显示数字
    animateCountdown3D();
}

// 停止3D倒计时特效
function stopCountdown3D() {
    isCountdown3DActive = false;
    if (countdown3DAnimationId) {
        cancelAnimationFrame(countdown3DAnimationId);
        countdown3DAnimationId = null;
    }
    if (countdown3DContainer) {
        countdown3DContainer.style.display = 'none';
    }
    hideCountdownNumber();

    // 清空烟花粒子
    fireworkParticles = [];
    if (countdown3DParticles) {
        countdown3DScene.remove(countdown3DParticles);
        countdown3DParticles.geometry.dispose();
        countdown3DParticles.material.dispose();
        countdown3DParticles = null;
    }
}

// 清理资源
function disposeCountdown3D() {
    stopCountdown3D();

    if (countdown3DRenderer) {
        countdown3DRenderer.dispose();
        if (countdown3DRenderer.domElement && countdown3DRenderer.domElement.parentNode) {
            countdown3DRenderer.domElement.parentNode.removeChild(countdown3DRenderer.domElement);
        }
        countdown3DRenderer = null;
    }

    if (countdown3DParticles) {
        countdown3DParticles.geometry.dispose();
        countdown3DParticles.material.dispose();
        countdown3DParticles = null;
    }

    countdown3DScene = null;
    countdown3DCamera = null;
    window.removeEventListener('resize', onCountdown3DResize);
}

