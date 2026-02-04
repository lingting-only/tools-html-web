'use strict';
console.clear();

//这是一个从简单项目开始的典型例子
//并且雪球远远超出了它的预期大小。有点笨重
//读取/处理这个单独的文件，但不管怎样，它还是在这里:)

const IS_MOBILE = window.innerWidth <= 640;
const IS_DESKTOP = window.innerWidth > 800;
const IS_HEADER = IS_DESKTOP && window.innerHeight < 300;
const IS_HIGH_END_DEVICE = (() => {
	const hwConcurrency = navigator.hardwareConcurrency;
	if (!hwConcurrency) {
		return false;
	}

	//大屏幕显示的是全尺寸的计算机，现在的计算机通常都有超线程技术。
	//所以一台四核台式机有8个核心。我们将在那里设置一个更高的最小阈值。
	const minCount = window.innerWidth <= 1024 ? 4 : 8;
	return hwConcurrency >= minCount;
})();

//防止画布在荒谬的屏幕尺寸上变得过大。
// 8K -如果需要，可以对此进行限制
const MAX_WIDTH = 7680;
const MAX_HEIGHT = 4320;
const GRAVITY = 0.9; //以像素/秒为单位的加速度
let simSpeed = 1;
const LAZY_LOADING_TIME = 0;

function getDefaultScaleFactor() {
	if (IS_MOBILE) return 0.9;
	if (IS_HEADER) return 0.75;
	return 1;
}

//考虑比例的宽度/高度值。
//使用这些来绘制位置
let stageW, stageH;

//所有质量全局变量都将被覆盖，并通过“configDidUpdate”进行更新。
let quality = 1;
let isLowQuality = false;
let isNormalQuality = true;
let isHighQuality = false;

const QUALITY_LOW = 1;
const QUALITY_NORMAL = 2;
const QUALITY_HIGH = 3;

const SKY_LIGHT_NONE = 0;
const SKY_LIGHT_DIM = 1;
const SKY_LIGHT_NORMAL = 2;

const COLOR = {
	Red: '#ff0043',
	Green: '#14fc56',
	Blue: '#1e7fff',
	Purple: '#e60aff',
	Gold: '#ffbf36',
	White: '#ffffff'
};
//特殊的不可见颜色(未呈现，因此不在颜色贴图中)

const INVISIBLE = '_INVISIBLE_';

const PI_2 = Math.PI * 2;
const PI_HALF = Math.PI * 0.5;

Stage.disableHighDPI = true;
const trailsStage = new Stage('trails-canvas');
const mainStage = new Stage('main-canvas');
const stages = [
	trailsStage,
	mainStage
];

//随机文字烟花内容（将从配置中读取）
let randomWords = ["新年快乐", "2025行大运", "蛇年大吉", "阖家欢乐", "巳巳如意", "和睦安康", "生生不息", "前程似锦", "学业有成", "心想事成"];
let wordDotsMap = {};

// 更新文字烟花内容
function updateRandomWords() {
	try {
		// 从配置中获取文案，如果没有则使用默认值
		let fireworkText = "新年快乐\n2025行大运\n蛇年大吉\n阖家欢乐\n巳巳如意\n和睦安康\n生生不息\n前程似锦\n学业有成\n心想事成";

		if (typeof store !== 'undefined' && store.state && store.state.config && store.state.config.fireworkText) {
			fireworkText = store.state.config.fireworkText;
		}

		// 按换行符分割，过滤空行
		randomWords = fireworkText.split(/\r?\n/).filter(word => word.trim());

		// 更新 wordDotsMap
		wordDotsMap = {};
		if (typeof Mymath !== 'undefined' && Mymath.literalLattice) {
			// 根据屏幕尺寸动态调整字体大小
			const screenWidth = typeof stageW !== 'undefined' ? stageW : window.innerWidth;
			let fontSize, latticeDensity;

			if (screenWidth <= 480) {
				fontSize = "50px";
				latticeDensity = 2;
			} else if (screenWidth <= 768) {
				fontSize = "60px";
				latticeDensity = 2;
			} else if (screenWidth <= 1024) {
				fontSize = "70px";
				latticeDensity = 3;
			} else {
				fontSize = IS_HEADER ? "60px" : "90px";
				latticeDensity = 2; // PC端使用更密集的点阵（参数2）以提高清晰度
			}

			randomWords.forEach((word) => {
				try {
					wordDotsMap[word] = Mymath.literalLattice(word, latticeDensity, "Gabriola,华文琥珀", fontSize);
				} catch (e) {
					console.error('Error creating word lattice for:', word, e);
				}
			});
		}
	} catch (e) {
		console.error('Error in updateRandomWords:', e);
	}
}

// 初始化将在 store 定义后调用

//全屏帮助程序，使用Fscreen作为前缀。
function fullscreenEnabled() {
	return fscreen.fullscreenEnabled;
}

//请注意，全屏状态与存储同步，存储应该是源
//判断应用程序是否处于全屏模式。
function isFullscreen() {
	return !!fscreen.fullscreenElement;
}

// 尝试切换全屏模式。
function toggleFullscreen() {
	if (fullscreenEnabled()) {
		if (isFullscreen()) {
			fscreen.exitFullscreen();
		} else {
			fscreen.requestFullscreen(document.documentElement);
		}
	}
}

//将全屏更改与存储同步。事件侦听器是必需的，因为用户可以
//直接通过浏览器切换全屏模式，我们希望对此做出反应。
//这个项目的语言由Nianbroken翻译成中文
fscreen.addEventListener('fullscreenchange', () => {
	store.setState({ fullscreen: isFullscreen() });
});

// 简单的状态容器
const store = {
	_listeners: new Set(),
	_dispatch(prevState) {
		this._listeners.forEach(listener => listener(this.state, prevState))
	},

	//当前上下文状态
	state: {
		// 将在init()中取消挂起
		paused: true,
		soundEnabled: true,
		menuOpen: false,
		openHelpTopic: null,
		fullscreen: isFullscreen(),
		//请注意，用于<select>的配置值必须是字符串，除非手动将值转换为字符串
		//在呈现时，并在更改时解析。
		config: {
			quality: String(IS_HIGH_END_DEVICE ? QUALITY_HIGH : QUALITY_NORMAL),
			shell: 'Random',
			size: IS_DESKTOP
				? '3' // Desktop default
				: IS_HEADER
					? '1.2' //配置文件头默认值(不必是int)
					: '2', //手机默认
			wordShell: true, 	//文字烟花 默认为开启 若不开启可修改为false
			autoLaunch: true,	//自动发射烟花
			finale: false,		//同时放更多烟花
			skyLighting: SKY_LIGHT_NORMAL + '',
			hideControls: IS_HEADER,
			longExposure: false,
			scaleFactor: getDefaultScaleFactor(),
			countdownTargetTime: (() => {
				// 默认设置为2026年1月1日 00:00:00
				const defaultDate = new Date(2026, 0, 1, 0, 0, 0, 0);
				// 转换为 YYYY/MM/DD HH:mm:ss 格式
				const year = defaultDate.getFullYear();
				const month = String(defaultDate.getMonth() + 1).padStart(2, '0');
				const day = String(defaultDate.getDate()).padStart(2, '0');
				const hours = String(defaultDate.getHours()).padStart(2, '0');
				const minutes = String(defaultDate.getMinutes()).padStart(2, '0');
				const seconds = String(defaultDate.getSeconds()).padStart(2, '0');
				return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
			})(),
			countdownText: '恭祝全球华人新年快乐！\n梦虽遥，追则能达；愿虽艰，持则可圆。\n河山添锦绣，星光映万家！\n${year}年，新年新气象！',
			fireworkText: '新年快乐\n2025行大运\n蛇年大吉\n阖家欢乐\n巳巳如意\n和睦安康\n生生不息\n前程似锦\n学业有成\n心想事成'
		}
	},

	setState(nextState) {
		const prevState = this.state;
		this.state = Object.assign({}, this.state, nextState);
		this._dispatch(prevState);
		this.persist();
	},

	subscribe: function (listener) {
		this._listeners.add(listener);
		return () => {
			return this._listeners.remove(listener);
		};
	},


	load() {
		const serializedData = localStorage.getItem('cm_fireworks_data');
		if (serializedData) {
			const {
				schemaVersion,
				data
			} = JSON.parse(serializedData);

			const config = this.state.config;
			switch (schemaVersion) {
				case '1.1':
					config.quality = data.quality;
					config.size = data.size;
					config.skyLighting = data.skyLighting;
					break;
				case '1.2':
					config.autoLaunch = data.autoLaunch;
					config.finale = data.finale;
					config.hideControls = data.hideControls;
					config.longExposure = data.longExposure;
					config.quality = data.quality;
					config.scaleFactor = data.scaleFactor;
					config.shell = data.shell;
					config.size = data.size;
					config.skyLighting = data.skyLighting;
					break;
				case '1.3':
					config.autoLaunch = data.autoLaunch;
					config.finale = data.finale;
					config.hideControls = data.hideControls;
					config.longExposure = data.longExposure;
					config.quality = data.quality;
					config.scaleFactor = data.scaleFactor;
					config.shell = data.shell;
					config.size = data.size;
					config.skyLighting = data.skyLighting;
					config.countdownTargetTime = data.countdownTargetTime || config.countdownTargetTime;
					break;
				case '1.4':
					config.autoLaunch = data.autoLaunch;
					config.finale = data.finale;
					config.hideControls = data.hideControls;
					config.longExposure = data.longExposure;
					config.quality = data.quality;
					config.scaleFactor = data.scaleFactor;
					config.shell = data.shell;
					config.size = data.size;
					config.skyLighting = data.skyLighting;
					config.countdownTargetTime = data.countdownTargetTime || config.countdownTargetTime;
					// 兼容旧版本：如果有4个单独的文案配置，合并为多行文本
					if (data.countdownText1 || data.countdownText2 || data.countdownText3 || data.countdownText4) {
						const lines = [
							data.countdownText1 || '恭祝全球华人新年快乐！',
							data.countdownText2 || '梦虽遥，追则能达；愿虽艰，持则可圆。',
							data.countdownText3 || '河山添锦绣，星光映万家！',
							data.countdownText4 || '${year}年，新年新气象！'
						].filter(line => line.trim());
						config.countdownText = lines.join('\n');
					} else {
						config.countdownText = data.countdownText || config.countdownText;
					}
					break;
				case '1.5':
					config.autoLaunch = data.autoLaunch;
					config.finale = data.finale;
					config.hideControls = data.hideControls;
					config.longExposure = data.longExposure;
					config.quality = data.quality;
					config.scaleFactor = data.scaleFactor;
					config.shell = data.shell;
					config.size = data.size;
					config.skyLighting = data.skyLighting;
					config.countdownTargetTime = data.countdownTargetTime || config.countdownTargetTime;
					config.countdownText = data.countdownText || config.countdownText;
					break;
				case '1.6':
					config.autoLaunch = data.autoLaunch;
					config.finale = data.finale;
					config.hideControls = data.hideControls;
					config.longExposure = data.longExposure;
					config.quality = data.quality;
					config.scaleFactor = data.scaleFactor;
					config.shell = data.shell;
					config.size = data.size;
					config.skyLighting = data.skyLighting;
					config.countdownTargetTime = data.countdownTargetTime || config.countdownTargetTime;
					config.countdownText = data.countdownText || config.countdownText;
					config.fireworkText = data.fireworkText || config.fireworkText;
					break;
				default:
					throw new Error('version switch should be exhaustive');
			}
			console.log(`Loaded config (schema version ${schemaVersion})`);
			// 配置加载后更新文字烟花内容
			if (typeof updateRandomWords === 'function') {
				updateRandomWords();
			}
		}
		else if (localStorage.getItem('schemaVersion') === '1') {
			let size;
			try {
				const sizeRaw = localStorage.getItem('configSize');
				size = typeof sizeRaw === 'string' && JSON.parse(sizeRaw);
			}
			catch (e) {
				console.log('Recovered from error parsing saved config:');
				console.error(e);
				return;
			}
			const sizeInt = parseInt(size, 10);
			if (sizeInt >= 0 && sizeInt <= 4) {
				this.state.config.size = String(sizeInt);
			}
		}
	},

	persist() {
		const config = this.state.config;
		// 创建配置副本，排除三个从 JSON 文件读取的配置项
		const configToSave = { ...config };
		delete configToSave.countdownTargetTime;
		delete configToSave.countdownText;
		delete configToSave.fireworkText;

		localStorage.setItem('cm_fireworks_data', JSON.stringify({
			schemaVersion: '1.6',
			data: configToSave
		}));
	}
};


if (!IS_HEADER) {
	store.load();
	// 初始化文字烟花内容
	if (typeof Mymath !== 'undefined' && Mymath.literalLattice) {
		updateRandomWords();
	} else {
		setTimeout(() => {
			if (typeof Mymath !== 'undefined' && Mymath.literalLattice) {
				updateRandomWords();
			}
		}, 100);
	}
} else {
	// IS_HEADER 模式下也初始化文字烟花内容
	if (typeof Mymath !== 'undefined' && Mymath.literalLattice) {
		updateRandomWords();
	} else {
		setTimeout(() => {
			if (typeof Mymath !== 'undefined' && Mymath.literalLattice) {
				updateRandomWords();
			}
		}, 100);
	}
}

function togglePause(toggle) {
	const paused = store.state.paused;
	let newValue;
	if (typeof toggle === 'boolean') {
		newValue = toggle;
	} else {
		newValue = !paused;
	}

	if (paused !== newValue) {
		store.setState({ paused: newValue });
	}
}

function toggleSound(toggle) {
	if (typeof toggle === 'boolean') {
		store.setState({ soundEnabled: toggle });
	} else {
		store.setState({ soundEnabled: !store.state.soundEnabled });
	}
}

function toggleMenu(toggle) {
	if (typeof toggle === 'boolean') {
		store.setState({ menuOpen: toggle });

	} else {
		store.setState({ menuOpen: !store.state.menuOpen });
	}
	if (store.state.menuOpen === true) {
		document.body.classList.add('menu-open');
	} else {
		document.body.classList.remove('menu-open');
	}
}

function updateConfig(nextConfig) {
	nextConfig = nextConfig || getConfigFromDOM();
	store.setState({
		config: Object.assign({}, store.state.config, nextConfig)
	});

	configDidUpdate();
}

function configDidUpdate() {
	quality = qualitySelector();
	isLowQuality = quality === QUALITY_LOW;
	isNormalQuality = quality === QUALITY_NORMAL;
	isHighQuality = quality === QUALITY_HIGH;

	if (skyLightingSelector() === SKY_LIGHT_NONE) {
		appNodes.canvasContainer.style.backgroundColor = '#000';
	}

	Spark.drawWidth = quality === QUALITY_HIGH ? 0.75 : 1;
}


const isRunning = (state = store.state) => !state.paused && !state.menuOpen;
const soundEnabledSelector = (state = store.state) => state.soundEnabled;
const canPlaySoundSelector = (state = store.state) => isRunning(state) && soundEnabledSelector(state);
const qualitySelector = () => +store.state.config.quality;
const shellNameSelector = () => store.state.config.shell;
const shellSizeSelector = () => +store.state.config.size;
const finaleSelector = () => store.state.config.finale;
const skyLightingSelector = () => +store.state.config.skyLighting;
const scaleFactorSelector = () => store.state.config.scaleFactor;


const helpContent = {
	shellType: {
		header: '烟花类型',
		body: '选择一个烟花类型：<br>' +
			'<span style="background: linear-gradient(to right, #F44336, #FF9800, #FFEB3B);-webkit-background-clip: text;color: transparent;text-shadow: none;">Random</span> <span style="font-size: 18px">会随机选择一个烟花类型；</span><br>' +
			'<span style="color: #F44336">Crackle</span> <span style="font-size: 18px">会在烟花爆炸时发出爆裂声；</span><br>' +
			'<span style="color: #FFEB3B">Crossette</span> <span style="font-size: 18px">会在烟花爆炸后滋啦声；</span><br>' +
			'<span style="color: #03A9F4">Crysanthemum</span> <span style="font-size: 18px">普通烟花；</span><br>' +
			'<span style="color: #4CAF50">Falling Leaves</span> <span style="font-size: 18px">会在烟花爆炸后发出鞭炮声(性能损耗极大，谨慎连续点按)；</span><br>' +
			'<span style="color: #8BC34A">Floral</span> <span style="font-size: 18px">爆炸后会分裂出更多的烟花；</span><br>' +
			'<span style="color: #448AFF">Ghost</span> <span style="font-size: 18px">烟花是透明的；</span><br>' +
			'<span style="color: #673AB7">Horse Tail</span> <span style="font-size: 18px">马尾型烟花；</span><br>' +
			'<span style="color: #EC407A">Palm</span> <span style="font-size: 18px">小烟花会留下残影；</span><br>' +
			'<span style="color: #AB47BC">Ring</span> <span style="font-size: 18px">花环型烟花；</span><br>' +
			'<span style="color: #009688">Strobe</span> <span style="font-size: 18px">会在烟花爆炸后闪烁；</span><br>' +
			'<span style="color: #795548">Willow</span> <span style="font-size: 18px">烟花会在爆炸后留下残影。</span>'
	},
	shellSize: {
		header: '烟花大小',
		body: '烟花越大绽放范围就越大，但是烟花越大，设备所需的性能也会增多，大的烟花可能导致你的设备卡顿。'
	},
	quality: {
		header: '画质',
		body: '如果动画运行不流畅，你可以试试降低画质。画质越高，烟花绽放后的火花数量就越多，但高画质可能导致你的设备卡顿。'
	},
	skyLighting: {
		header: '天空照亮',
		body: '烟花爆炸时，背景会被照亮。如果你的屏幕看起来太亮了，可以把它改成“昏暗”或者“无”。'
	},
	scaleFactor: {
		header: '缩放',
		body: '使你与烟花离得更近或更远。对于较大的烟花，你可以选择更小的缩放值，尤其是在手机或平板电脑上。'
	},
	wordShell: {
		header: "文字烟花",
		body: "开启后，会出现烟花形状的文字。例如：新年快乐、心想事成等等",
	},
	autoLaunch: {
		header: '自动放烟花',
		body: '开启后你就可以坐在你的设备屏幕前面欣赏烟花了，你也可以关闭它，但关闭后你就只能通过点击屏幕的方式来放烟花。'
	},
	finaleMode: {
		header: '结局模式',
		body: '发射后，烟花会在一段时间后自动结束，但是如果你开启了结局模式，烟花就会一直绽放下去，直到你手动关闭它。前提你必须打开"自动发射"。'
	},
	hideControls: {
		header: '隐藏控制按钮',
		body: '隐藏屏幕顶部的按钮。如果你要截图，或者需要一个无缝的体验，你就可以将按钮隐藏，隐藏按钮后你仍然可以在右上角打开设置。'
	},
	fullscreen: {
		header: '全屏',
		body: '切换至全屏模式'
	},
	longExposure: {
		header: '保留烟花轨迹',
		body: '可以保留烟花留下轨迹的效果，但是这样会导致你的设备卡顿。'
	},
	countdownTarget: {
		header: '倒计时目标时间',
		body: '设置倒计时器的目标日期和时间。格式：年-月-日 时:分。例如：2026-01-01 00:00 表示2026年1月1日零点。'
	}
};

const nodeKeyToHelpKey = {
	shellTypeLabel: 'shellType',
	shellSizeLabel: 'shellSize',
	qualityLabel: 'quality',
	skyLightingLabel: 'skyLighting',
	scaleFactorLabel: 'scaleFactor',
	wordShellLabel: "wordShell",
	autoLaunchLabel: 'autoLaunch',
	finaleModeLabel: 'finaleMode',
	hideControlsLabel: 'hideControls',
	fullscreenLabel: 'fullscreen',
	longExposureLabel: 'longExposure',
	countdownTargetLabel: 'countdownTarget'
};

// 程序dom节点列表
const appNodes = {
	stageContainer: '.stage-container',
	canvasContainer: '.canvas-container',
	controls: ".controls",
	menu: '.menu',
	menuInnerWrap: '.menu__inner-wrap',
	pauseBtn: '.pause-btn',
	pauseBtnSVG: '.pause-btn use',
	soundBtn: '.sound-btn',
	soundBtnSVG: '.sound-btn use',
	shellType: '.shell-type',
	shellTypeLabel: '.shell-type-label',
	shellSize: '.shell-size',
	shellSizeLabel: '.shell-size-label',
	quality: '.quality-ui',
	qualityLabel: '.quality-ui-label',
	skyLighting: '.sky-lighting',
	skyLightingLabel: '.sky-lighting-label',
	scaleFactor: '.scaleFactor',
	scaleFactorLabel: '.scaleFactor-label',
	wordShell: ".word-shell", // 文字烟花
	wordShellLabel: ".word-shell-label",
	autoLaunch: '.auto-launch',
	autoLaunchLabel: '.auto-launch-label',
	finaleModeFormOption: '.form-option--finale-mode',
	finaleMode: '.finale-mode',
	finaleModeLabel: '.finale-mode-label',
	hideControls: '.hide-controls',
	hideControlsLabel: '.hide-controls-label',
	fullscreenFormOption: '.form-option--fullscreen',
	fullscreen: '.fullscreen',
	fullscreenLabel: '.fullscreen-label',
	longExposure: '.long-exposure',
	longExposureLabel: '.long-exposure-label',
	countdownTarget: '.countdown-target',
	countdownTargetLabel: '.countdown-target-label',
	countdownText: '.countdown-text',
	countdownTextLabel: '.countdown-text-label',
	fireworkText: '.firework-text',
	fireworkTextLabel: '.firework-text-label',

	helpModal: '.help-modal',
	helpModalOverlay: '.help-modal__overlay',
	helpModalHeader: '.help-modal__header',
	helpModalBody: '.help-modal__body',
	helpModalCloseBtn: '.help-modal__close-btn'
};

Object.keys(appNodes).forEach(key => {
	appNodes[key] = document.querySelector(appNodes[key]);
});

if (!fullscreenEnabled()) {
	appNodes.fullscreenFormOption.classList.add('remove');
}

function renderApp(state) {
	const pauseBtnIcon = `#icon-${state.paused ? 'play' : 'pause'}`;
	const soundBtnIcon = `#icon-sound-${soundEnabledSelector() ? 'on' : 'off'}`;
	appNodes.pauseBtnSVG.setAttribute('href', pauseBtnIcon);
	appNodes.pauseBtnSVG.setAttribute('xlink:href', pauseBtnIcon);
	appNodes.soundBtnSVG.setAttribute('href', soundBtnIcon);
	appNodes.soundBtnSVG.setAttribute('xlink:href', soundBtnIcon);
	appNodes.canvasContainer.classList.toggle('blur', state.menuOpen);
	appNodes.menu.classList.toggle('hide', !state.menuOpen);
	appNodes.finaleModeFormOption.style.opacity = state.config.autoLaunch ? 1 : 0.32;

	appNodes.quality.value = state.config.quality;
	appNodes.shellType.value = state.config.shell;
	appNodes.shellSize.value = state.config.size;
	appNodes.wordShell.checked = state.config.wordShell;
	appNodes.autoLaunch.checked = state.config.autoLaunch;
	appNodes.finaleMode.checked = state.config.finale;
	appNodes.skyLighting.value = state.config.skyLighting;
	appNodes.hideControls.checked = state.config.hideControls;
	appNodes.fullscreen.checked = state.fullscreen;
	appNodes.longExposure.checked = state.config.longExposure;
	appNodes.scaleFactor.value = state.config.scaleFactor.toFixed(2);
	if (appNodes.countdownTarget && state.config.countdownTargetTime) {
		// 将 YYYY/MM/DD HH:mm:ss 格式转换为 datetime-local 需要的 YYYY-MM-DDTHH:mm 格式
		let timeValue = state.config.countdownTargetTime;
		if (timeValue.includes('/')) {
			// 新格式: YYYY/MM/DD HH:mm:ss -> YYYY-MM-DDTHH:mm
			timeValue = timeValue.replace(/\//g, '-').replace(' ', 'T');
			// 移除秒数部分（datetime-local 不需要秒）
			if (timeValue.includes(':')) {
				const parts = timeValue.split(':');
				if (parts.length > 2) {
					timeValue = parts.slice(0, 2).join(':');
				}
			}
		}
		appNodes.countdownTarget.value = timeValue;
	}
	if (appNodes.countdownText && state.config.countdownText) {
		appNodes.countdownText.value = state.config.countdownText;
	}
	if (appNodes.fireworkText && state.config.fireworkText) {
		appNodes.fireworkText.value = state.config.fireworkText;
	}

	appNodes.menuInnerWrap.style.opacity = state.openHelpTopic ? 0.12 : 1;
	appNodes.helpModal.classList.toggle('active', !!state.openHelpTopic);
	if (state.openHelpTopic) {
		const { header, body } = helpContent[state.openHelpTopic];
		appNodes.helpModalHeader.textContent = header;
		appNodes.helpModalBody.innerHTML = body;
	}

	if (state.config.hideControls) {
		document.body.classList.add('hide-controls');
	} else {
		document.body.classList.remove('hide-controls');
	}
}

store.subscribe(renderApp);

function handleStateChange(state, prevState) {
	const canPlaySound = canPlaySoundSelector(state);
	const canPlaySoundPrev = canPlaySoundSelector(prevState);

	if (canPlaySound !== canPlaySoundPrev) {
		if (canPlaySound) {
			soundManager.resumeAll();
		} else {
			soundManager.pauseAll();
		}
	}
}

store.subscribe(handleStateChange);


function getConfigFromDOM() {
	return {
		quality: appNodes.quality.value,
		shell: appNodes.shellType.value,
		size: appNodes.shellSize.value,
		wordShell: appNodes.wordShell.checked,
		autoLaunch: appNodes.autoLaunch.checked,
		finale: appNodes.finaleMode.checked,
		skyLighting: appNodes.skyLighting.value,
		longExposure: appNodes.longExposure.checked,
		hideControls: appNodes.hideControls.checked,
		scaleFactor: parseFloat(appNodes.scaleFactor.value),
		countdownTargetTime: (() => {
			// 将 datetime-local 的 YYYY-MM-DDTHH:mm 格式转换为 YYYY/MM/DD HH:mm:ss 格式
			let timeValue = appNodes.countdownTarget.value;
			if (timeValue) {
				timeValue = timeValue.replace(/-/g, '/').replace('T', ' ') + ':00';
			}
			return timeValue;
		})(),
		countdownText: appNodes.countdownText ? appNodes.countdownText.value : '恭祝全球华人新年快乐！\n梦虽遥，追则能达；愿虽艰，持则可圆。\n河山添锦绣，星光映万家！\n${year}年，新年新气象！',
		fireworkText: appNodes.fireworkText ? appNodes.fireworkText.value : '新年快乐\n2025行大运\n蛇年大吉\n阖家欢乐\n巳巳如意\n和睦安康\n生生不息\n前程似锦\n学业有成\n心想事成'
	};
}

const updateConfigNoEvent = () => updateConfig();
appNodes.quality.addEventListener('input', updateConfigNoEvent);
appNodes.shellType.addEventListener('input', updateConfigNoEvent);
appNodes.shellSize.addEventListener('input', updateConfigNoEvent);
appNodes.wordShell.addEventListener("click", () => setTimeout(updateConfig, 0));
appNodes.autoLaunch.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.finaleMode.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.skyLighting.addEventListener('input', updateConfigNoEvent);
appNodes.longExposure.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.hideControls.addEventListener('click', () => setTimeout(updateConfig, 0));
appNodes.fullscreen.addEventListener('click', () => setTimeout(toggleFullscreen, 0));
appNodes.scaleFactor.addEventListener('input', () => {
	updateConfig();
	handleResize();
});
if (appNodes.countdownTarget) {
	appNodes.countdownTarget.addEventListener('change', () => {
		updateConfig();
		// 倒计时会自动从store中读取新值，无需重新初始化
	});
	appNodes.countdownTarget.addEventListener('input', () => {
		updateConfig();
		// 倒计时会自动从store中读取新值，无需重新初始化
	});
}
if (appNodes.countdownText) {
	appNodes.countdownText.addEventListener('input', () => {
		updateConfig();
	});
}
if (appNodes.fireworkText) {
	appNodes.fireworkText.addEventListener('input', () => {
		updateConfig();
		// 更新文字烟花内容
		if (typeof updateRandomWords === 'function') {
			updateRandomWords();
		}
	});
}

Object.keys(nodeKeyToHelpKey).forEach(nodeKey => {
	const helpKey = nodeKeyToHelpKey[nodeKey];
	appNodes[nodeKey].addEventListener('click', () => {
		store.setState({ openHelpTopic: helpKey });
	});
});

appNodes.helpModalCloseBtn.addEventListener('click', () => {
	store.setState({ openHelpTopic: null });
});

appNodes.helpModalOverlay.addEventListener('click', () => {
	store.setState({ openHelpTopic: null });
});


//常数导数
const COLOR_NAMES = Object.keys(COLOR);
const COLOR_CODES = COLOR_NAMES.map(colorName => COLOR[colorName]);
//看不见的星星需要一个标识符，即使它们不会被渲染——物理学仍然适用。
const COLOR_CODES_W_INVIS = [...COLOR_CODES, INVISIBLE];
//颜色代码映射到它们在数组中的索引。对于快速确定颜色是否已经在循环中更新非常有用。
const COLOR_CODE_INDEXES = COLOR_CODES_W_INVIS.reduce((obj, code, i) => {
	obj[code] = i;
	return obj;
}, {});

// Tuples是用{ r，g，b }元组(仍然只是对象)的值通过颜色代码(十六进制)映射的键。
const COLOR_TUPLES = {};
COLOR_CODES.forEach(hex => {
	COLOR_TUPLES[hex] = {
		r: parseInt(hex.substr(1, 2), 16),
		g: parseInt(hex.substr(3, 2), 16),
		b: parseInt(hex.substr(5, 2), 16),
	};
});

// 获取随机颜色
function randomColorSimple() {
	return COLOR_CODES[Math.random() * COLOR_CODES.length | 0];
}

// 得到一个随机的颜色根据一些定制选项
let lastColor;
function randomColor(options) {
	const notSame = options && options.notSame;
	const notColor = options && options.notColor;
	const limitWhite = options && options.limitWhite;
	let color = randomColorSimple();

	// 限制白色随机抽取的
	if (limitWhite && color === COLOR.White && Math.random() < 0.6) {
		color = randomColorSimple();
	}

	if (notSame) {
		while (color === lastColor) {
			color = randomColorSimple();
		}
	}
	else if (notColor) {
		while (color === notColor) {
			color = randomColorSimple();
		}
	}

	lastColor = color;
	return color;
}

// 随机获取一段文字
function randomWord() {
	if (randomWords.length === 0) return "";
	if (randomWords.length === 1) return randomWords[0];
	return randomWords[(Math.random() * randomWords.length) | 0];
}

function whiteOrGold() {
	return Math.random() < 0.5 ? COLOR.Gold : COLOR.White;
}

function makePistilColor(shellColor) {
	return (shellColor === COLOR.White || shellColor === COLOR.Gold) ? randomColor({ notColor: shellColor }) : whiteOrGold();
}

// 唯一的 shell 类型
const crysanthemumShell = (size = 1) => {
	const glitter = Math.random() < 0.25;
	const singleColor = Math.random() < 0.72;
	const color = singleColor ? randomColor({ limitWhite: true }) : [randomColor(), randomColor({ notSame: true })];
	const pistil = singleColor && Math.random() < 0.42;
	const pistilColor = pistil && makePistilColor(color);
	const secondColor = singleColor && (Math.random() < 0.2 || color === COLOR.White) ? pistilColor || randomColor({ notColor: color, limitWhite: true }) : null;
	const streamers = !pistil && color !== COLOR.White && Math.random() < 0.42;
	let starDensity = glitter ? 1.1 : 1.25;
	if (isLowQuality) starDensity *= 0.8;
	if (isHighQuality) starDensity = 1.2;
	return {
		shellSize: size,
		spreadSize: 300 + size * 100,
		starLife: 900 + size * 200,
		starDensity,
		color,
		secondColor,
		glitter: glitter ? 'light' : '',
		glitterColor: whiteOrGold(),
		pistil,
		pistilColor,
		streamers
	};
};


const ghostShell = (size = 1) => {
	const shell = crysanthemumShell(size);
	shell.starLife *= 1.5;
	let ghostColor = randomColor({ notColor: COLOR.White });
	shell.streamers = true;
	const pistil = Math.random() < 0.42;
	// const pistilColor = pistil && makePistilColor(ghostColor);
	pistil && makePistilColor(ghostColor);
	shell.color = INVISIBLE;
	shell.secondColor = ghostColor;
	shell.glitter = '';

	return shell;
};


const strobeShell = (size = 1) => {
	const color = randomColor({ limitWhite: true });
	return {
		shellSize: size,
		spreadSize: 280 + size * 92,
		starLife: 1100 + size * 200,
		starLifeVariation: 0.40,
		starDensity: 1.1,
		color,
		glitter: 'light',
		glitterColor: COLOR.White,
		strobe: true,
		strobeColor: Math.random() < 0.5 ? COLOR.White : null,
		pistil: Math.random() < 0.5,
		pistilColor: makePistilColor(color)
	};
};


const palmShell = (size = 1) => {
	const color = randomColor();
	const thick = Math.random() < 0.5;
	return {
		shellSize: size,
		color,
		spreadSize: 250 + size * 75,
		starDensity: thick ? 0.15 : 0.4,
		starLife: 1800 + size * 200,
		glitter: thick ? 'thick' : 'heavy'
	};
};

const ringShell = (size = 1) => {
	const color = randomColor();
	const pistil = Math.random() < 0.75;
	return {
		shellSize: size,
		ring: true,
		color,
		spreadSize: 300 + size * 100,
		starLife: 900 + size * 200,
		starCount: 2.2 * PI_2 * (size + 1),
		pistil,
		pistilColor: makePistilColor(color),
		glitter: !pistil ? 'light' : '',
		glitterColor: color === COLOR.Gold ? COLOR.Gold : COLOR.White,
		streamers: Math.random() < 0.3
	};
};

const crossetteShell = (size = 1) => {
	const color = randomColor({ limitWhite: true });
	return {
		shellSize: size,
		spreadSize: 300 + size * 100,
		starLife: 750 + size * 160,
		starLifeVariation: 0.4,
		starDensity: 0.85,
		color,
		crossette: true,
		pistil: Math.random() < 0.5,
		pistilColor: makePistilColor(color)
	};
};

const floralShell = (size = 1) => ({
	shellSize: size,
	spreadSize: 300 + size * 120,
	starDensity: 0.12,
	starLife: 500 + size * 50,
	starLifeVariation: 0.5,
	color: Math.random() < 0.65 ? 'random' : (Math.random() < 0.15 ? randomColor() : [randomColor(), randomColor({ notSame: true })]),
	floral: true
});

const fallingLeavesShell = (size = 1) => ({
	shellSize: size,
	color: INVISIBLE,
	spreadSize: 300 + size * 120,
	starDensity: 0.12,
	starLife: 500 + size * 50,
	starLifeVariation: 0.5,
	glitter: 'medium',
	glitterColor: COLOR.Gold,
	fallingLeaves: true
});

const willowShell = (size = 1) => ({
	shellSize: size,
	spreadSize: 300 + size * 100,
	starDensity: 0.6,
	starLife: 3000 + size * 300,
	glitter: 'willow',
	glitterColor: COLOR.Gold,
	color: INVISIBLE
});

const crackleShell = (size = 1) => {
	const color = Math.random() < 0.75 ? COLOR.Gold : randomColor();
	return {
		shellSize: size,
		spreadSize: 380 + size * 75,
		starDensity: isLowQuality ? 0.65 : 1,
		starLife: 600 + size * 100,
		starLifeVariation: 0.32,
		glitter: 'light',
		glitterColor: COLOR.Gold,
		color,
		crackle: true,
		pistil: Math.random() < 0.65,
		pistilColor: makePistilColor(color)
	};
};

const horsetailShell = (size = 1) => {
	const color = randomColor();
	return {
		shellSize: size,
		horsetail: true,
		color,
		spreadSize: 250 + size * 38,
		starDensity: 0.9,
		starLife: 2500 + size * 300,
		glitter: 'medium',
		glitterColor: Math.random() < 0.5 ? whiteOrGold() : color,
		strobe: color === COLOR.White
	};
};

function randomShellName() {
	return Math.random() < 0.5 ? 'Crysanthemum' : shellNames[(Math.random() * (shellNames.length - 1) + 1) | 0];
}

function randomShell(size) {
	if (IS_HEADER) return randomFastShell()(size);
	return shellTypes[randomShellName()](size);
}

function shellFromConfig(size) {
	return shellTypes[shellNameSelector()](size);
}

//获取随机外壳，不包括处理密集型变体
//注意，只有在配置中选择了“随机”shell时，这才是随机的。
//还有，这不创建烟花，只返回工厂函数。
const fastShellBlacklist = ['Falling Leaves', 'Floral', 'Willow'];
function randomFastShell() {
	const isRandom = shellNameSelector() === 'Random';
	let shellName = isRandom ? randomShellName() : shellNameSelector();
	if (isRandom) {
		while (fastShellBlacklist.includes(shellName)) {
			shellName = randomShellName();
		}
	}
	return shellTypes[shellName];
}

//烟花类型
const shellTypes = {
	'Random': randomShell,
	'Crackle': crackleShell,
	'Crossette': crossetteShell,
	'Crysanthemum': crysanthemumShell,
	'Falling Leaves': fallingLeavesShell,
	'Floral': floralShell,
	'Ghost': ghostShell,
	'Horse Tail': horsetailShell,
	'Palm': palmShell,
	'Ring': ringShell,
	'Strobe': strobeShell,
	'Willow': willowShell
};

const shellNames = Object.keys(shellTypes);

function init() {
	if (LOADING_POINT_TIMER !== null) {
		clearInterval(LOADING_POINT_TIMER);
		LOADING_POINT_TIMER = null;
	}
	document.querySelector('.time-text').style.opacity = "1";
	document.querySelector('#right-bottom-button .parent-button').style.opacity = "1";
	document.querySelector('.loading-init').remove();
	document.querySelector('body').classList.remove('loading');
	
	// 显示舞台容器
	appNodes.stageContainer.classList.remove('remove');

	// 自动启动系统
	// 激活 AudioContext（浏览器要求用户交互后才能播放声音）
	if (typeof soundManager !== 'undefined' && soundManager.ctx) {
		soundManager.ctx.resume().then(() => {
			// 播放音效
			try {
				soundManager.playSound('lift', 1);
			} catch (e) {
				console.log('音效播放失败:', e);
			}
		}).catch(err => {
			console.log('AudioContext 激活失败:', err);
		});
	}

	// 等待一帧确保canvas已渲染
	requestAnimationFrame(() => {
		// 在屏幕中心创建多个烟花效果
		if (typeof Shell !== 'undefined' && typeof shellFromConfig !== 'undefined') {
			const centerX = typeof stageW !== 'undefined' ? stageW / 2 : window.innerWidth / 2;
			const centerY = typeof stageH !== 'undefined' ? stageH / 2 : window.innerHeight / 2;
			
			// 创建多个不同大小的烟花
			for (let i = 0; i < 3; i++) {
				setTimeout(() => {
					const shell = new Shell(shellFromConfig(3)); // 中等大小
					shell.burst(centerX, centerY);
				}, i * 100); // 每个烟花间隔100ms
			}
		}
	});

	// 开始运行系统
	if (typeof store !== 'undefined' && store.state) {
		store.setState({ paused: false });

		// 启动倒计时（如果还没启动）
		if (typeof nextNewYearTime === 'function') {
			nextNewYearTime();
		}
	}

	function setOptionsForSelect(node, options) {
		node.innerHTML = options.reduce((acc, opt) => acc + `<option value="${opt.value}">${opt.label}</option>`, '');
	}

	let options = '';
	shellNames.forEach(opt => options += `<option value="${opt}">${opt}</option>`);
	appNodes.shellType.innerHTML = options;
	options = '';
	['3"', '4"', '6"', '8"', '12"', '16"'].forEach((opt, i) => options += `<option value="${i}">${opt}</option>`);
	appNodes.shellSize.innerHTML = options;

	setOptionsForSelect(appNodes.quality, [
		{ label: '低质量', value: QUALITY_LOW },
		{ label: '正常', value: QUALITY_NORMAL },
		{ label: '高质量', value: QUALITY_HIGH }
	]);

	setOptionsForSelect(appNodes.skyLighting, [
		{ label: '无', value: SKY_LIGHT_NONE },
		{ label: '昏暗', value: SKY_LIGHT_DIM },
		{ label: '正常', value: SKY_LIGHT_NORMAL }
	]);

	setOptionsForSelect(
		appNodes.scaleFactor,
		[0.5, 0.62, 0.75, 0.9, 1.0, 1.5, 2.0]
			.map(value => ({ value: value.toFixed(2), label: `${value * 100}%` }))
	);

	togglePause(false);
	appNodes.soundBtn.addEventListener("click", () => toggleSound());
	appNodes.pauseBtn.addEventListener("click", () => togglePause());
	setBottomRightButton(toggleMenu);

	renderApp(store.state);

	configDidUpdate();
}


function fitShellPositionInBoundsH(position) {
	const edge = 0.18;
	return (1 - edge * 2) * position + edge;
}

function fitShellPositionInBoundsV(position) {
	return position * 0.75;
}

function getRandomShellPositionH() {
	return fitShellPositionInBoundsH(Math.random());
}

function getRandomShellPositionV() {
	return fitShellPositionInBoundsV(Math.random());
}

// 获取随机的烟花尺寸
function getRandomShellSize() {
	const baseSize = shellSizeSelector();
	const maxVariance = Math.min(2.5, baseSize);
	const variance = Math.random() * maxVariance;
	const size = baseSize - variance;
	const height = maxVariance === 0 ? Math.random() : 1 - (variance / maxVariance);
	const centerOffset = Math.random() * (1 - height * 0.65) * 0.5;
	const x = Math.random() < 0.5 ? 0.5 - centerOffset : 0.5 + centerOffset;
	return {
		size,
		x: fitShellPositionInBoundsH(x),
		height: fitShellPositionInBoundsV(height)
	};
}

function launchShellFromConfig(event) {
	const shell = new Shell(shellFromConfig(shellSizeSelector()));
	const w = mainStage.width;
	const h = mainStage.height;

	shell.launch(
		event ? event.x / w : getRandomShellPositionH(),
		event ? 1 - event.y / h : getRandomShellPositionV()
	);
}


//随机生成一个烟花
function seqRandomShell() {
	const size = getRandomShellSize();
	const shell = new Shell(shellFromConfig(size.size));
	shell.launch(size.x, size.height);

	let extraDelay = shell.starLife;
	if (shell.fallingLeaves) {
		extraDelay = 4600;
	}

	return 900 + Math.random() * 600 + extraDelay;
}

function seqRandomFastShell() {
	const shellType = randomFastShell();
	const size = getRandomShellSize();
	const shell = new Shell(shellType(size.size));
	shell.launch(size.x, size.height);

	let extraDelay = shell.starLife;

	return 900 + Math.random() * 600 + extraDelay;
}

function seqTwoRandom() {
	const size1 = getRandomShellSize();
	const size2 = getRandomShellSize();
	const shell1 = new Shell(shellFromConfig(size1.size));
	const shell2 = new Shell(shellFromConfig(size2.size));
	const leftOffset = Math.random() * 0.2 - 0.1;
	const rightOffset = Math.random() * 0.2 - 0.1;
	shell1.launch(0.3 + leftOffset, size1.height);
	setTimeout(() => {
		shell2.launch(0.7 + rightOffset, size2.height);
	}, 100);

	let extraDelay = Math.max(shell1.starLife, shell2.starLife);
	if (shell1.fallingLeaves || shell2.fallingLeaves) {
		extraDelay = 4600;
	}

	return 900 + Math.random() * 600 + extraDelay;
}

function seqTriple() {
	const shellType = randomFastShell();
	const baseSize = shellSizeSelector();
	const smallSize = Math.max(0, baseSize - 1.25);

	const offset = Math.random() * 0.08 - 0.04;
	const shell1 = new Shell(shellType(baseSize));
	shell1.launch(0.5 + offset, 0.7);

	const leftDelay = 1000 + Math.random() * 400;
	const rightDelay = 1000 + Math.random() * 400;

	setTimeout(() => {
		const offset = Math.random() * 0.08 - 0.04;
		const shell2 = new Shell(shellType(smallSize));
		shell2.launch(0.2 + offset, 0.1);
	}, leftDelay);

	setTimeout(() => {
		const offset = Math.random() * 0.08 - 0.04;
		const shell3 = new Shell(shellType(smallSize));
		shell3.launch(0.8 + offset, 0.1);
	}, rightDelay);

	return 4000;
}

function seqPyramid() {
	const barrageCountHalf = IS_DESKTOP ? 7 : 4;
	const largeSize = shellSizeSelector();
	const smallSize = Math.max(0, largeSize - 3);
	const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
	const randomSpecialShell = randomShell;

	function launchShell(x, useSpecial) {
		const isRandom = shellNameSelector() === 'Random';
		let shellType = isRandom
			? useSpecial ? randomSpecialShell : randomMainShell
			: shellTypes[shellNameSelector()];
		const shell = new Shell(shellType(useSpecial ? largeSize : smallSize));
		const height = x <= 0.5 ? x / 0.5 : (1 - x) / 0.5;
		shell.launch(x, useSpecial ? 0.75 : height * 0.42);
	}

	let count = 0;
	let delay = 0;
	while (count <= barrageCountHalf) {
		if (count === barrageCountHalf) {
			setTimeout(() => {
				launchShell(0.5, true);
			}, delay);
		} else {
			const offset = count / barrageCountHalf * 0.5;
			const delayOffset = Math.random() * 30 + 30;
			setTimeout(() => {
				launchShell(offset, false);
			}, delay);
			setTimeout(() => {
				launchShell(1 - offset, false);
			}, delay + delayOffset);
		}

		count++;
		delay += 200;
	}

	return 3400 + barrageCountHalf * 250;
}

function seqSmallBarrage() {
	seqSmallBarrage.lastCalled = Date.now();
	const barrageCount = IS_DESKTOP ? 11 : 5;
	const specialIndex = IS_DESKTOP ? 3 : 1;
	const shellSize = Math.max(0, shellSizeSelector() - 2);
	const randomMainShell = Math.random() < 0.78 ? crysanthemumShell : ringShell;
	const randomSpecialShell = randomFastShell();
	function launchShell(x, useSpecial) {
		const isRandom = shellNameSelector() === 'Random';
		let shellType = isRandom
			? useSpecial ? randomSpecialShell : randomMainShell
			: shellTypes[shellNameSelector()];
		const shell = new Shell(shellType(shellSize));
		const height = (Math.cos(x * 5 * Math.PI + PI_HALF) + 1) / 2;
		shell.launch(x, height * 0.75);
	}

	let count = 0;
	let delay = 0;
	while (count < barrageCount) {
		if (count === 0) {
			launchShell(0.5, false)
			count += 1;
		}
		else {
			const offset = (count + 1) / barrageCount / 2;
			const delayOffset = Math.random() * 30 + 30;
			const useSpecial = count === specialIndex;
			setTimeout(() => {
				launchShell(0.5 + offset, useSpecial);
			}, delay);
			setTimeout(() => {
				launchShell(0.5 - offset, useSpecial);
			}, delay + delayOffset);
			count += 2;
		}
		delay += 200;
	}

	return 3400 + barrageCount * 120;
}
seqSmallBarrage.cooldown = 15000;
seqSmallBarrage.lastCalled = Date.now();

const sequences = [seqRandomShell, seqTwoRandom, seqTriple, seqPyramid, seqSmallBarrage];

let isFirstSeq = true;
const finaleCount = 32;
let currentFinaleCount = 0;

//随机生成一个烟花序列
function startSequence() {
	if (isFirstSeq) {
		isFirstSeq = false;
		if (IS_HEADER) {
			return seqTwoRandom();
		}
		else {
			const shell = new Shell(crysanthemumShell(shellSizeSelector()));
			shell.launch(0.5, 0.5);
			return 2400;
		}
	}

	if (finaleSelector()) {
		seqRandomFastShell();
		if (currentFinaleCount < finaleCount) {
			currentFinaleCount++;
			return 170;
		}
		else {
			currentFinaleCount = 0;
			return 6000;
		}
	}

	const rand = Math.random();

	if (rand < 0.08 && Date.now() - seqSmallBarrage.lastCalled > seqSmallBarrage.cooldown) {
		return seqSmallBarrage();
	}

	if (rand < 0.1) {
		return seqPyramid();
	}

	if (rand < 0.6 && !IS_HEADER) {
		return seqRandomShell();
	}
	else if (rand < 0.8) {
		return seqTwoRandom();
	}
	else if (rand < 1) {
		return seqTriple();
	}
}


let activePointerCount = 0;
let isUpdatingSpeed = false;

function handlePointerStart(event) {
	activePointerCount++;
	const btnSize = 50;

	/*if (event.y < btnSize) {
		if (event.x < btnSize) {
			togglePause();
			return;
		}
		if (event.x > mainStage.width/2 - btnSize/2 && event.x < mainStage.width/2 + btnSize/2) {
			toggleSound();
			return;
		}
		if (event.x > mainStage.width - btnSize) {
			toggleMenu();
			return;
		}
	}*/

	if (!isRunning()) return;

	if (updateSpeedFromEvent(event)) {
		isUpdatingSpeed = true;
	} else if (event.onCanvas) {
		launchShellFromConfig(event);
	}
}

function handlePointerEnd() {
	activePointerCount--;
	isUpdatingSpeed = false;
}

function handlePointerMove(event) {
	if (!isRunning()) return;

	if (isUpdatingSpeed) {
		updateSpeedFromEvent(event);
	}
}

function handleKeydown(event) {
	// P
	if (event.keyCode === 80) {
		togglePause();
	}
	// O
	else if (event.keyCode === 79) {
		toggleMenu();
	}
	// Esc
	else if (event.keyCode === 27) {
		toggleMenu(false);
	}
}

mainStage.addEventListener('pointerstart', handlePointerStart);
mainStage.addEventListener('pointerend', handlePointerEnd);
mainStage.addEventListener('pointermove', handlePointerMove);
window.addEventListener('keydown', handleKeydown);


function handleResize() {
	const w = window.innerWidth;
	const h = window.innerHeight;
	const containerW = Math.min(w, MAX_WIDTH);
	const containerH = w <= 420 ? h : Math.min(h, MAX_HEIGHT);
	appNodes.stageContainer.style.width = containerW + 'px';
	appNodes.stageContainer.style.height = containerH + 'px';
	stages.forEach(stage => stage.resize(containerW, containerH));
	const scaleFactor = scaleFactorSelector();
	stageW = containerW / scaleFactor;
	stageH = containerH / scaleFactor;
}

handleResize();

window.addEventListener('resize', handleResize);


let currentFrame = 0;
let speedBarOpacity = 0;
let autoLaunchTime = 0;

function updateSpeedFromEvent(event) {
	if (isUpdatingSpeed || event.y >= mainStage.height - 44) {
		const edge = 16;
		const newSpeed = (event.x - edge) / (mainStage.width - edge * 2);
		simSpeed = Math.min(Math.max(newSpeed, 0), 1);
		speedBarOpacity = 1;
		return true;
	}
	return false;
}


function updateGlobals(timeStep, lag) {
	currentFrame++;
	if (!isUpdatingSpeed) {
		speedBarOpacity -= lag / 30; // half a second
		if (speedBarOpacity < 0) {
			speedBarOpacity = 0;
		}
	}

	if (store.state.config.autoLaunch) {
		autoLaunchTime -= timeStep;
		if (autoLaunchTime <= 0) {
			autoLaunchTime = startSequence() * 1.25;
		}
	}
}

//帧绘制回调
function update(frameTime, lag) {
	if (!isRunning()) return;
	const timeStep = frameTime * simSpeed;
	const speed = simSpeed * lag;

	updateGlobals(timeStep, lag);

	const starDrag = 1 - (1 - Star.airDrag) * speed;
	const starDragHeavy = 1 - (1 - Star.airDragHeavy) * speed;
	const sparkDrag = 1 - (1 - Spark.airDrag) * speed;
	const gAcc = (timeStep / 1000) * GRAVITY;
	COLOR_CODES_W_INVIS.forEach(color => {
		// 绘制星花
		const stars = Star.active[color];
		for (let i = stars.length - 1; i >= 0; i = i - 1) {
			const star = stars[i];
			if (star.updateFrame === currentFrame) {
				continue;
			}
			star.updateFrame = currentFrame;

			star.life -= timeStep;
			//星花生命周期结束回收实例
			if (star.life <= 0) {
				stars.splice(i, 1);
				Star.returnInstance(star);
			} else {
				const burnRate = Math.pow(star.life / star.fullLife, 0.5);
				const burnRateInverse = 1 - burnRate;

				star.prevX = star.x;
				star.prevY = star.y;
				star.x += star.speedX * speed;
				star.y += star.speedY * speed;

				if (!star.heavy) {
					star.speedX *= starDrag;
					star.speedY *= starDrag;
				}
				else {
					star.speedX *= starDragHeavy;
					star.speedY *= starDragHeavy;
				}
				star.speedY += gAcc;

				if (star.spinRadius) {
					star.spinAngle += star.spinSpeed * speed;
					star.x += Math.sin(star.spinAngle) * star.spinRadius * speed;
					star.y += Math.cos(star.spinAngle) * star.spinRadius * speed;
				}

				if (star.sparkFreq) {
					star.sparkTimer -= timeStep;
					while (star.sparkTimer < 0) {
						star.sparkTimer += star.sparkFreq * 0.75 + star.sparkFreq * burnRateInverse * 4;
						Spark.add(
							star.x,
							star.y,
							star.sparkColor,
							Math.random() * PI_2,
							Math.random() * star.sparkSpeed * burnRate,
							star.sparkLife * 0.8 + Math.random() * star.sparkLifeVariation * star.sparkLife
						);
					}
				}

				if (star.life < star.transitionTime) {
					if (star.secondColor && !star.colorChanged) {
						star.colorChanged = true;
						star.color = star.secondColor;
						stars.splice(i, 1);
						Star.active[star.secondColor].push(star);
						if (star.secondColor === INVISIBLE) {
							star.sparkFreq = 0;
						}
					}

					if (star.strobe) {
						star.visible = Math.floor(star.life / star.strobeFreq) % 3 === 0;
					}
				}
			}
		}

		// 绘制火花
		const sparks = Spark.active[color];
		for (let i = sparks.length - 1; i >= 0; i = i - 1) {
			const spark = sparks[i];
			spark.life -= timeStep;
			if (spark.life <= 0) {
				sparks.splice(i, 1);
				Spark.returnInstance(spark);
			} else {
				spark.prevX = spark.x;
				spark.prevY = spark.y;
				spark.x += spark.speedX * speed;
				spark.y += spark.speedY * speed;
				spark.speedX *= sparkDrag;
				spark.speedY *= sparkDrag;
				spark.speedY += gAcc;
			}
		}
	});

	render(speed);
}

function render(speed) {
	const { dpr } = mainStage;
	const width = stageW;
	const height = stageH;
	const trailsCtx = trailsStage.ctx;
	const mainCtx = mainStage.ctx;

	if (skyLightingSelector() !== SKY_LIGHT_NONE) {
		colorSky(speed);
	}

	const scaleFactor = scaleFactorSelector();
	trailsCtx.scale(dpr * scaleFactor, dpr * scaleFactor);
	mainCtx.scale(dpr * scaleFactor, dpr * scaleFactor);

	trailsCtx.globalCompositeOperation = 'source-over';
	trailsCtx.fillStyle = `rgba(0, 0, 0, ${store.state.config.longExposure ? 0.0025 : 0.175 * speed})`;
	trailsCtx.fillRect(0, 0, width, height);

	mainCtx.clearRect(0, 0, width, height);

	while (BurstFlash.active.length) {
		const bf = BurstFlash.active.pop();

		const burstGradient = trailsCtx.createRadialGradient(bf.x, bf.y, 0, bf.x, bf.y, bf.radius);
		burstGradient.addColorStop(0.024, 'rgba(255, 255, 255, 1)');
		burstGradient.addColorStop(0.125, 'rgba(255, 160, 20, 0.2)');
		burstGradient.addColorStop(0.32, 'rgba(255, 140, 20, 0.11)');
		burstGradient.addColorStop(1, 'rgba(255, 120, 20, 0)');
		trailsCtx.fillStyle = burstGradient;
		trailsCtx.fillRect(bf.x - bf.radius, bf.y - bf.radius, bf.radius * 2, bf.radius * 2);

		BurstFlash.returnInstance(bf);
	}

	trailsCtx.globalCompositeOperation = 'lighten';

	trailsCtx.lineWidth = 3;
	trailsCtx.lineCap = isLowQuality ? 'square' : 'round';
	mainCtx.strokeStyle = '#fff';
	mainCtx.lineWidth = 1;
	mainCtx.beginPath();
	COLOR_CODES.forEach(color => {
		const stars = Star.active[color];
		trailsCtx.strokeStyle = color;
		trailsCtx.beginPath();
		stars.forEach(star => {
			if (star.visible) {
				trailsCtx.lineWidth = star.size;
				trailsCtx.moveTo(star.x, star.y);
				trailsCtx.lineTo(star.prevX, star.prevY);
				mainCtx.moveTo(star.x, star.y);
				mainCtx.lineTo(star.x - star.speedX * 1.6, star.y - star.speedY * 1.6);
			}
		});
		trailsCtx.stroke();
	});
	mainCtx.stroke();

	trailsCtx.lineWidth = Spark.drawWidth;
	trailsCtx.lineCap = 'butt';
	COLOR_CODES.forEach(color => {
		const sparks = Spark.active[color];
		trailsCtx.strokeStyle = color;
		trailsCtx.beginPath();
		sparks.forEach(spark => {
			trailsCtx.moveTo(spark.x, spark.y);
			trailsCtx.lineTo(spark.prevX, spark.prevY);
		});
		trailsCtx.stroke();
	});


	if (speedBarOpacity) {
		const speedBarHeight = 6;
		mainCtx.globalAlpha = speedBarOpacity;
		mainCtx.fillStyle = COLOR.Blue;
		mainCtx.fillRect(0, height - speedBarHeight, width * simSpeed, speedBarHeight);
		mainCtx.globalAlpha = 1;
	}


	trailsCtx.setTransform(1, 0, 0, 1, 0, 0);
	mainCtx.setTransform(1, 0, 0, 1, 0, 0);
}


const currentSkyColor = { r: 0, g: 0, b: 0 };
const targetSkyColor = { r: 0, g: 0, b: 0 };
function colorSky(speed) {
	const maxSkySaturation = skyLightingSelector() * 15;
	const maxStarCount = 500;
	let totalStarCount = 0;
	targetSkyColor.r = 0;
	targetSkyColor.g = 0;
	targetSkyColor.b = 0;
	COLOR_CODES.forEach(color => {
		const tuple = COLOR_TUPLES[color];
		const count = Star.active[color].length;
		totalStarCount += count;
		targetSkyColor.r += tuple.r * count;
		targetSkyColor.g += tuple.g * count;
		targetSkyColor.b += tuple.b * count;
	});

	const intensity = Math.pow(Math.min(1, totalStarCount / maxStarCount), 0.3);
	const maxColorComponent = Math.max(1, targetSkyColor.r, targetSkyColor.g, targetSkyColor.b);
	targetSkyColor.r = targetSkyColor.r / maxColorComponent * maxSkySaturation * intensity;
	targetSkyColor.g = targetSkyColor.g / maxColorComponent * maxSkySaturation * intensity;
	targetSkyColor.b = targetSkyColor.b / maxColorComponent * maxSkySaturation * intensity;

	const colorChange = 10;
	currentSkyColor.r += (targetSkyColor.r - currentSkyColor.r) / colorChange * speed;
	currentSkyColor.g += (targetSkyColor.g - currentSkyColor.g) / colorChange * speed;
	currentSkyColor.b += (targetSkyColor.b - currentSkyColor.b) / colorChange * speed;

	appNodes.canvasContainer.style.backgroundColor = `rgb(${currentSkyColor.r | 0}, ${currentSkyColor.g | 0}, ${currentSkyColor.b | 0})`;
}

mainStage.addEventListener('ticker', update);


function createParticleArc(start, arcLength, count, randomness, particleFactory) {
	const angleDelta = arcLength / count;
	const end = start + arcLength - (angleDelta * 0.5);

	if (end > start) {
		for (let angle = start; angle < end; angle = angle + angleDelta) {
			particleFactory(angle + Math.random() * angleDelta * randomness);
		}
	} else {
		for (let angle = start; angle > end; angle = angle + angleDelta) {
			particleFactory(angle + Math.random() * angleDelta * randomness);
		}
	}
}

//获取字体点阵信息
function getWordDots(word) {
	if (!word) return null;
	// var res = wordDotsMap[word];
	// if (!res) {
	//     wordDotsMap[word] = Mymath.literalLattice(word);
	//     res = wordDotsMap[word];
	// }

	// 根据屏幕尺寸自适应字体大小
	const screenWidth = typeof stageW !== 'undefined' ? stageW : window.innerWidth;
	let baseFontSize, fontSizeRange, latticeDensity;

	if (screenWidth <= 480) {
		// 小屏手机：40-60px
		baseFontSize = 40;
		fontSizeRange = 20;
		latticeDensity = 2;
	} else if (screenWidth <= 768) {
		// 大屏手机/小平板：50-70px
		baseFontSize = 50;
		fontSizeRange = 20;
		latticeDensity = 2;
	} else if (screenWidth <= 1024) {
		// 平板：60-80px
		baseFontSize = 60;
		fontSizeRange = 20;
		latticeDensity = 3;
	} else {
		// 桌面端：80-130px（保持原范围），使用更密集的点阵提高清晰度
		baseFontSize = 80;
		fontSizeRange = 50;
		latticeDensity = 2; // PC端使用更密集的点阵（参数2）以提高清晰度
	}

	var fontSize = Math.floor(Math.random() * fontSizeRange + baseFontSize);
	var res = Mymath.literalLattice(word, latticeDensity, "Gabriola,华文琥珀", fontSize + "px");

	return res;
}


/**
 * 用于创建球形粒子爆发的辅助对象。
 *
 * @param  {Number} count               所需的恒星/粒子数量。该值是一个建议，而创建的爆发可能有更多的粒子。目前的算法无法完美地
 *										在球体表面均匀分布特定数量的点。
 * @param  {Function} particleFactory   每生成一颗星/粒子调用一次。传递了两个参数:
 * 										`angle `:恒星/粒子的方向。
 * 										`speed `:粒子速度的倍数，从0.0到1.0。
 * @param  {Number} startAngle=0        对于分段爆发，只能生成部分粒子弧。这
 *										允许设置起始圆弧角度(弧度)。
 * @param  {Number} arcLength=TAU       弧的长度(弧度)。默认为整圆。
 *
 * @return {void}              不返回任何内容；由“particleFactory”使用给定的数据。
 */
function createBurst(count, particleFactory, startAngle = 0, arcLength = PI_2) {
	const R = 0.5 * Math.sqrt(count / Math.PI);
	const C = 2 * R * Math.PI;
	const C_HALF = C / 2;

	for (let i = 0; i <= C_HALF; i++) {
		const ringAngle = i / C_HALF * PI_HALF;
		const ringSize = Math.cos(ringAngle);
		const partsPerFullRing = C * ringSize;
		const partsPerArc = partsPerFullRing * (arcLength / PI_2);

		const angleInc = PI_2 / partsPerFullRing;
		const angleOffset = Math.random() * angleInc + startAngle;
		const maxRandomAngleOffset = angleInc * 0.33;

		for (let i = 0; i < partsPerArc; i++) {
			const randomAngleOffset = Math.random() * maxRandomAngleOffset;
			let angle = angleInc * i + angleOffset + randomAngleOffset;
			particleFactory(angle, ringSize);
		}
	}
}

/**
 *
 * @param {string} wordText  文字内容
 * @param {Function} particleFactory 每生成一颗星/粒子调用一次。传递参数:
 * 		                             `point `:恒星/粒子的起始位置_相对于canvas。
 *              					 `color `:粒子颜色。
 * @param {number} center_x 	爆炸中心点x
 * @param {number} center_y  	爆炸中心点y
 */
function createWordBurst(wordText, particleFactory, center_x, center_y) {
	//将点阵坐标转换为canvas坐标
	var map = getWordDots(wordText);
	if (!map) return;
	var dcenterX = map.width / 2;
	var dcenterY = map.height / 2;
	var color = randomColor();
	var strobed = Math.random() < 0.5;
	var strobeColor = strobed ? randomColor() : color;

	// 确保文字位置在屏幕范围内
	// 计算文字边界
	const wordWidth = map.width;
	const wordHeight = map.height;
	const padding = 50; // 边距

	// 限制中心点位置，确保文字不超出屏幕
	let safeX = center_x;
	let safeY = center_y;

	if (typeof stageW !== 'undefined' && typeof stageH !== 'undefined') {
		// 确保文字不超出左边界
		if (safeX - dcenterX < padding) {
			safeX = padding + dcenterX;
		}
		// 确保文字不超出右边界
		if (safeX + dcenterX > stageW - padding) {
			safeX = stageW - padding - dcenterX;
		}
		// 确保文字不超出上边界
		if (safeY - dcenterY < padding) {
			safeY = padding + dcenterY;
		}
		// 确保文字不超出下边界
		if (safeY + dcenterY > stageH - padding) {
			safeY = stageH - padding - dcenterY;
		}
	}

	for (let i = 0; i < map.points.length; i++) {
		const point = map.points[i];
		let x = safeX + (point.x - dcenterX);
		let y = safeY + (point.y - dcenterY);
		particleFactory({ x, y }, color, strobed, strobeColor);
	}
}



function crossetteEffect(star) {
	const startAngle = Math.random() * PI_HALF;
	createParticleArc(startAngle, PI_2, 4, 0.5, (angle) => {
		Star.add(
			star.x,
			star.y,
			star.color,
			angle,
			Math.random() * 0.6 + 0.75,
			600
		);
	});
}

function floralEffect(star) {
	const count = 12 + 6 * quality;
	createBurst(count, (angle, speedMult) => {
		Star.add(
			star.x,
			star.y,
			star.color,
			angle,
			speedMult * 2.4,
			1000 + Math.random() * 300,
			star.speedX,
			star.speedY
		);
	});
	BurstFlash.add(star.x, star.y, 46);
	soundManager.playSound('burstSmall');
}

function fallingLeavesEffect(star) {
	createBurst(7, (angle, speedMult) => {
		const newStar = Star.add(
			star.x,
			star.y,
			INVISIBLE,
			angle,
			speedMult * 2.4,
			2400 + Math.random() * 600,
			star.speedX,
			star.speedY
		);

		newStar.sparkColor = COLOR.Gold;
		newStar.sparkFreq = 144 / quality;
		newStar.sparkSpeed = 0.28;
		newStar.sparkLife = 750;
		newStar.sparkLifeVariation = 3.2;
	});
	BurstFlash.add(star.x, star.y, 46);
	soundManager.playSound('burstSmall');
}

function crackleEffect(star) {
	const count = isHighQuality ? 32 : 16;
	createParticleArc(0, PI_2, count, 1.8, (angle) => {
		Spark.add(
			star.x,
			star.y,
			COLOR.Gold,
			angle,
			Math.pow(Math.random(), 0.45) * 2.4,
			300 + Math.random() * 200
		);
	});
}


class Shell {
	spreadSize;
	horsetail;
	starLife;
	fallingLeaves;
	glitter;
	crossette;
	crackle;
	floral;
	secondColor;
	strobe;
	strobeColor;
	ring;
	pistil;
	pistilColor;
	streamers;
	shellSize;
	constructor(options) {
		Object.assign(this, options);
		this.starLifeVariation = options.starLifeVariation || 0.125;
		this.color = options.color || randomColor();
		this.glitterColor = options.glitterColor || this.color;

		if (!this.starCount) {
			const density = options.starDensity || 1;
			const scaledSize = this.spreadSize / 54;
			this.starCount = Math.max(6, scaledSize * scaledSize * density);
		}
	}

	launch(position, launchHeight) {
		const width = stageW;
		const height = stageH;
		const hpad = 60;
		const vpad = 50;
		const minHeightPercent = 0.45;
		const minHeight = height - height * minHeightPercent;
		const launchX = position * (width - hpad * 2) + hpad;
		const launchY = height;
		const burstY = minHeight - (launchHeight * (minHeight - vpad));
		const launchDistance = launchY - burstY;
		const launchVelocity = Math.pow(launchDistance * 0.04, 0.64);
		const comet = this.comet = Star.add(
			launchX,
			launchY,
			typeof this.color === 'string' && this.color !== 'random' ? this.color : COLOR.White,
			Math.PI,
			launchVelocity * (this.horsetail ? 1.2 : 1),
			launchVelocity * (this.horsetail ? 100 : 400)
		);

		comet.heavy = true;
		comet.spinRadius = Mymath.random(0.32, 0.85);
		comet.sparkFreq = 32 / quality;
		if (isHighQuality) comet.sparkFreq = 8;
		comet.sparkLife = 320;
		comet.sparkLifeVariation = 3;
		if (this.glitter === 'willow' || this.fallingLeaves) {
			comet.sparkFreq = 20 / quality;
			comet.sparkSpeed = 0.5;
			comet.sparkLife = 500;
		}
		if (this.color === INVISIBLE) {
			comet.sparkColor = COLOR.Gold;
		}
		if (Math.random() > 0.4 && !this.horsetail) {
			comet.secondColor = INVISIBLE;
			comet.transitionTime = Math.pow(Math.random(), 1.5) * 700 + 500;
		}

		comet.onDeath = comet => this.burst(comet.x, comet.y);

		soundManager.playSound('lift');
	}

	burst(x, y) {
		const speed = this.spreadSize / 96;

		let color, onDeath, sparkFreq, sparkSpeed, sparkLife;
		let sparkLifeVariation = 0.25;
		let playedDeathSound = false;

		if (this.crossette) onDeath = (star) => {
			if (!playedDeathSound) {
				soundManager.playSound('crackleSmall');
				playedDeathSound = true;
			}
			crossetteEffect(star);
		}
		if (this.crackle) onDeath = (star) => {
			if (!playedDeathSound) {
				soundManager.playSound('crackle');
				playedDeathSound = true;
			}
			crackleEffect(star);
		}
		if (this.floral) onDeath = floralEffect;
		if (this.fallingLeaves) onDeath = fallingLeavesEffect;

		if (this.glitter === 'light') {
			sparkFreq = 400;
			sparkSpeed = 0.3;
			sparkLife = 300;
			sparkLifeVariation = 2;
		}
		else if (this.glitter === 'medium') {
			sparkFreq = 200;
			sparkSpeed = 0.44;
			sparkLife = 700;
			sparkLifeVariation = 2;
		}
		else if (this.glitter === 'heavy') {
			sparkFreq = 80;
			sparkSpeed = 0.8;
			sparkLife = 1400;
			sparkLifeVariation = 2;
		}
		else if (this.glitter === 'thick') {
			sparkFreq = 16;
			sparkSpeed = isHighQuality ? 1.65 : 1.5;
			sparkLife = 1400;
			sparkLifeVariation = 3;
		}
		else if (this.glitter === 'streamer') {
			sparkFreq = 32;
			sparkSpeed = 1.05;
			sparkLife = 620;
			sparkLifeVariation = 2;
		}
		else if (this.glitter === 'willow') {
			sparkFreq = 120;
			sparkSpeed = 0.34;
			sparkLife = 1400;
			sparkLifeVariation = 3.8;
		}

		sparkFreq = sparkFreq / quality;

		const starFactory = (angle, speedMult) => {
			const standardInitialSpeed = this.spreadSize / 1800;

			const star = Star.add(
				x,
				y,
				color || randomColor(),
				angle,
				speedMult * speed,
				this.starLife + Math.random() * this.starLife * this.starLifeVariation,
				this.horsetail ? this.comet && this.comet.speedX : 0,
				this.horsetail ? this.comet && this.comet.speedY : -standardInitialSpeed
			);

			if (this.secondColor) {
				star.transitionTime = this.starLife * (Math.random() * 0.05 + 0.32);
				star.secondColor = this.secondColor;
			}

			if (this.strobe) {
				star.transitionTime = this.starLife * (Math.random() * 0.08 + 0.46);
				star.strobe = true;
				star.strobeFreq = Math.random() * 20 + 40;
				if (this.strobeColor) {
					star.secondColor = this.strobeColor;
				}
			}

			star.onDeath = onDeath;

			if (this.glitter) {
				star.sparkFreq = sparkFreq;
				star.sparkSpeed = sparkSpeed;
				star.sparkLife = sparkLife;
				star.sparkLifeVariation = sparkLifeVariation;
				star.sparkColor = this.glitterColor;
				star.sparkTimer = Math.random() * star.sparkFreq;
			}
		};

		//点阵星星工厂
		const dotStarFactory = (point, color, strobe, strobeColor) => {
			const standardInitialSpeed = this.spreadSize / 1800;
			// 增加文字粒子的基础大小，提高可见性（移动端需要更大的粒子）
			const baseSize = IS_MOBILE ? 3 : 2;

			if (strobe) {
				//随机speed 0.05~0.15
				var speed = Math.random() * 0.1 + 0.05;

				const star = Star.add(
					point.x,
					point.y,
					color,
					Math.random() * 2 * Math.PI,
					speed,
					// add minor variation to star life
					this.starLife + Math.random() * this.starLife * this.starLifeVariation + speed * 1000,
					this.horsetail ? this.comet && this.comet.speedX : 0,
					this.horsetail ? this.comet && this.comet.speedY : -standardInitialSpeed,
					baseSize
				);

				star.transitionTime = this.starLife * (Math.random() * 0.08 + 0.46);
				star.strobe = true;
				star.strobeFreq = Math.random() * 20 + 40;
				star.secondColor = strobeColor;
			} else {
				Spark.add(
					point.x,
					point.y,
					color,
					Math.random() * 2 * Math.PI,
					// apply near cubic falloff to speed (places more particles towards outside)
					Math.pow(Math.random(), 0.15) * 1.4,
					this.starLife + Math.random() * this.starLife * this.starLifeVariation + 1000
				);
			}

			//文字尾影（移动端减少尾影偏移，避免文字模糊）
			const tailOffsetX = IS_MOBILE ? 3 : 5;
			const tailOffsetY = IS_MOBILE ? 6 : 10;
			Spark.add(point.x + tailOffsetX, point.y + tailOffsetY, color, Math.random() * 2 * Math.PI, Math.pow(Math.random(), 0.05) * 0.4, this.starLife + Math.random() * this.starLife * this.starLifeVariation + 2000);
		};


		if (typeof this.color === 'string') {
			if (this.color === 'random') {
				color = null;
			} else {
				color = this.color;
			}

			if (this.ring) {
				const ringStartAngle = Math.random() * Math.PI;
				const ringSquash = Math.pow(Math.random(), 2) * 0.85 + 0.15;

				createParticleArc(0, PI_2, this.starCount, 0, angle => {
					const initSpeedX = Math.sin(angle) * speed * ringSquash;
					const initSpeedY = Math.cos(angle) * speed;
					const newSpeed = Mymath.pointDist(0, 0, initSpeedX, initSpeedY);
					const newAngle = Mymath.pointAngle(0, 0, initSpeedX, initSpeedY) + ringStartAngle;
					const star = Star.add(
						x,
						y,
						color,
						newAngle,
						newSpeed,
						this.starLife + Math.random() * this.starLife * this.starLifeVariation
					);

					if (this.glitter) {
						star.sparkFreq = sparkFreq;
						star.sparkSpeed = sparkSpeed;
						star.sparkLife = sparkLife;
						star.sparkLifeVariation = sparkLifeVariation;
						star.sparkColor = this.glitterColor;
						star.sparkTimer = Math.random() * star.sparkFreq;
					}
				});
			}
			else {
				createBurst(this.starCount, starFactory);
			}
		}
		else if (Array.isArray(this.color)) {
			if (Math.random() < 0.5) {
				const start = Math.random() * Math.PI;
				const start2 = start + Math.PI;
				const arc = Math.PI;
				color = this.color[0];
				createBurst(this.starCount, starFactory, start, arc);
				color = this.color[1];
				createBurst(this.starCount, starFactory, start2, arc);
			} else {
				color = this.color[0];
				createBurst(this.starCount / 2, starFactory);
				color = this.color[1];
				createBurst(this.starCount / 2, starFactory);
			}
		}
		else {
			throw new Error('Invalid shell color. Expected string or array of strings, but got: ' + this.color);
		}


		if (!this.disableWordd && store.state.config.wordShell) {
			if (Math.random() < 0.1) {
				if (Math.random() < 0.5) {
					createWordBurst(randomWord(), dotStarFactory, x, y);
				}
			}
		}

		if (this.pistil) {
			const innerShell = new Shell({
				spreadSize: this.spreadSize * 0.5,
				starLife: this.starLife * 0.6,
				starLifeVariation: this.starLifeVariation,
				starDensity: 1.4,
				color: this.pistilColor,
				glitter: 'light',
				glitterColor: this.pistilColor === COLOR.Gold ? COLOR.Gold : COLOR.White
			});
			innerShell.burst(x, y);
		}

		if (this.streamers) {
			const innerShell = new Shell({
				spreadSize: this.spreadSize * 0.9,
				starLife: this.starLife * 0.8,
				starLifeVariation: this.starLifeVariation,
				starCount: Math.floor(Math.max(6, this.spreadSize / 45)),
				color: COLOR.White,
				glitter: 'streamer'
			});
			innerShell.burst(x, y);
		}

		BurstFlash.add(x, y, this.spreadSize / 4);

		//播放声音，但只针对“原装”shell，即被推出的那个。
		//我们不希望多个声音来自雌蕊或流光“子壳”。
		//这可以通过彗星的出现来检测。
		if (this.comet) {
			//根据当前烟花大小和选定的(最大)烟花大小缩放爆炸声音。
			//拍摄选择的外壳尺寸无论选择的尺寸如何，听起来总是一样的，
			//但是小一点的炮弹自动发射的时候，声音会小一点。听起来不太好
			//但是当给定的值太小时，我们不是根据比例，而是
			//看大小差异，映射到一个已知好听的范围。
			//这个项目的语言由Nianbroken翻译成中文
			const maxDiff = 2;
			const sizeDifferenceFromMaxSize = Math.min(maxDiff, shellSizeSelector() - this.shellSize);
			const soundScale = (1 - sizeDifferenceFromMaxSize / maxDiff) * 0.3 + 0.7;
			soundManager.playSound('burst', soundScale);
		}
	}
}



const BurstFlash = {
	active: [],
	_pool: [],

	_new() {
		return {}
	},

	add(x, y, radius) {
		const instance = this._pool.pop() || this._new();

		instance.x = x;
		instance.y = y;
		instance.radius = radius;

		this.active.push(instance);
		return instance;
	},

	returnInstance(instance) {
		this._pool.push(instance);
	}
};


function createParticleCollection() {
	const collection = {};
	COLOR_CODES_W_INVIS.forEach(color => {
		collection[color] = [];
	});
	return collection;
}


const Star = {
	drawWidth: 3,
	airDrag: 0.98,
	airDragHeavy: 0.992,

	active: createParticleCollection(),
	_pool: [],

	_new() {
		return {};
	},

	add(x, y, color, angle, speed, life, speedOffX, speedOffY, size = 3) {
		const instance = this._pool.pop() || this._new();

		instance.visible = true;
		instance.heavy = false;
		instance.x = x;
		instance.y = y;
		instance.prevX = x;
		instance.prevY = y;
		instance.color = color;
		instance.speedX = Math.sin(angle) * speed + (speedOffX || 0);
		instance.speedY = Math.cos(angle) * speed + (speedOffY || 0);
		instance.life = life;
		instance.fullLife = life;
		instance.spinAngle = Math.random() * PI_2;
		instance.spinSpeed = 0.8;
		instance.spinRadius = 0;
		instance.sparkFreq = 0;
		instance.sparkSpeed = 1;
		instance.sparkTimer = 0;
		instance.sparkColor = color;
		instance.sparkLife = 750;
		instance.sparkLifeVariation = 0.25;
		instance.strobe = false;


		/*
			visible: bool, 是否应该绘制星花.
			heavy: bool, 是否是 "重" 星花, 关系到应用的空气阻力.
			x: float, 星花的当前 x 坐标.
			y: float, 星花的当前 y 坐标.
			prevX: float, 上一帧星花的 x 坐标.
			prevY: float, 上一帧星花的 y 坐标.
			color: string, 星花的颜色.
			speedX: float, 星花当前 x 方向的速度.
			speedY: float, 星花当前 y 方向的速度.
			life: float, 星花的剩余生命值 (ms).
			fullLife: float, 星花的总生命值 (ms).
			spinAngle: float, 星花的旋转角度.
			spinSpeed: float, 星花的旋转速度.
			spinRadius: float, 星花的旋转半径.
			sparkFreq: float, 发射火花的频率 (ms).
			sparkSpeed: float, 火花的速度.
			sparkTimer: float, 火花的计时器 (ms).
			sparkColor: string, 火花的颜色.
			sparkLife: float, 火花的生命值 (ms).
			sparkLifeVariation: float, 火花的生命值的可变范围.
			strobe: bool, 是否应用闪烁效果.
			onDeath: function, 星花死亡时调用的回调函数.
			secondColor: string, 在生命周期中星花颜色渐变时的第二个颜色.
			transitionTime:星花生命周期结束之前发生变化的时间
		*/


		this.active[color].push(instance);
		return instance;
	},

	returnInstance(instance) {
		instance.onDeath && instance.onDeath(instance);
		instance.onDeath = null;
		instance.secondColor = null;
		instance.transitionTime = 0;
		instance.colorChanged = false;
		this._pool.push(instance);
	}
};


const Spark = {
	drawWidth: 0,
	airDrag: 0.9,

	active: createParticleCollection(),
	_pool: [],

	_new() {
		return {};
	},

	add(x, y, color, angle, speed, life) {
		const instance = this._pool.pop() || this._new();

		instance.x = x;
		instance.y = y;
		instance.prevX = x;
		instance.prevY = y;
		instance.color = color;
		instance.speedX = Math.sin(angle) * speed;
		instance.speedY = Math.cos(angle) * speed;
		instance.life = life;

		this.active[color].push(instance);
		return instance;
	},

	returnInstance(instance) {
		this._pool.push(instance);
	}
};


window.webkitAudioContext = undefined;
const soundManager = {
	_lastSmallBurstTime: 0,
	baseURL: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/329180/',
	ctx: new (window.AudioContext || window.webkitAudioContext),

	pauseAll() {
		this.ctx.suspend().then(() => { });
	},

	playSound(type, scale = 1) {
		scale = Mymath.clamp(scale, 0, 1);

		if (!canPlaySoundSelector() || simSpeed < 0.95) {
			return;
		}

		if (type === 'burstSmall') {
			const now = Date.now();
			if (now - this._lastSmallBurstTime < 20) {
				return;
			}
			this._lastSmallBurstTime = now;
		}

		const source = this.sources[type];

		if (!source) {
			throw new Error(`Sound of type "${type}" doesn't exist.`);
		}

		const initialVolume = source.volume;
		const initialPlaybackRate = Mymath.random(
			source.playbackRateMin,
			source.playbackRateMax
		);

		const scaledVolume = initialVolume * scale;

		const scaledPlaybackRate = initialPlaybackRate * (2 - scale);

		const gainNode = this.ctx.createGain();
		gainNode.gain.value = scaledVolume;

		const buffer = Mymath.randomChoice(source.buffers);
		const bufferSource = this.ctx.createBufferSource();
		bufferSource.playbackRate.value = scaledPlaybackRate;
		bufferSource.buffer = buffer;
		bufferSource.connect(gainNode);
		gainNode.connect(this.ctx.destination);
		bufferSource.start(0);
	},

	preload: function () {
		const allFilePromises = [];

		function checkStatus(response) {
			if (response.status >= 200 && response.status < 300) {
				return response;
			}
			const customError = new Error(response.statusText);
			customError.response = response;
			throw customError;
		}

		const types = Object.keys(this.sources);
		types.forEach(type => {
			const source = this.sources[type];
			const { fileNames } = source;
			const filePromises = [];
			fileNames.forEach(fileName => {
				const fileURL = this.baseURL + fileName;
				const promise = fetch(fileURL)
					.then(checkStatus)
					.then(response => response.arrayBuffer())
					.then(data => {
						return new Promise(resolve => {
							this.ctx.decodeAudioData(data, resolve).then(() => { });
						});
					});

				filePromises.push(promise);
				allFilePromises.push(promise);
			});

			Promise.all(filePromises)
				.then(buffers => {
					source.buffers = buffers;
				});
		});

		return Promise.all(allFilePromises);
	},

	pauseAll() {
		this.ctx.suspend();
	},

	resumeAll() {
		this.playSound('lift', 0);
		setTimeout(() => {
			this.ctx.resume();
		}, 250);
	},

	sources: {
		lift: {
			volume: 1,
			playbackRateMin: 0.85,
			playbackRateMax: 0.95,
			fileNames: [
				'lift1.mp3',
				'lift2.mp3',
				'lift3.mp3'
			]
		},
		burst: {
			volume: 1,
			playbackRateMin: 0.8,
			playbackRateMax: 0.9,
			fileNames: [
				'burst1.mp3',
				'burst2.mp3'
			]
		},
		burstSmall: {
			volume: 0.25,
			playbackRateMin: 0.8,
			playbackRateMax: 1,
			fileNames: [
				'burst-sm-1.mp3',
				'burst-sm-2.mp3'
			]
		},
		crackle: {
			volume: 0.2,
			playbackRateMin: 1,
			playbackRateMax: 1,
			fileNames: ['crackle1.mp3']
		},
		crackleSmall: {
			volume: 0.3,
			playbackRateMin: 1,
			playbackRateMax: 1,
			fileNames: ['crackle-sm-1.mp3']
		}
	}
};


function setLoadingStatus(status) {
	document.querySelector('.loading-init__status').textContent = status;
}

if (IS_HEADER) {
	setTimeout(() => {
		init();
	}, LAZY_LOADING_TIME);
} else {
	setLoadingStatus('准备引燃点火线');
	setTimeout(() => {
		soundManager.preload()
			.then(
				init,
				reason => {
					init();
					return Promise.reject(reason);
				}
			);
	}, LAZY_LOADING_TIME);
}