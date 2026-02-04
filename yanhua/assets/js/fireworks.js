let LOADING_POINT_TIMER = null;
let NEXT_YEAR_TIMER = null;
let NEXT_YEAR_TIME_MONTH = 1;	// 农历月份
let NEXT_YEAR_TIME_DAY = 29;	// 农历日
let NOW_TIME_TIMER = null;		// 农历时间

// 调试时间相关变量
let debugTimeBase = null;  // 调试时间的基准时间（Date对象）
let debugTimeStart = null;  // 开始使用调试时间的真实时间戳

// 获取当前时间的辅助函数（考虑调试时间）
function getCurrentTime() {
	let now = new Date();
	// 检查调试时间配置（支持从 window.configData 直接读取）
	if (typeof window !== 'undefined') {
		let debugTimeString = null;
		// 优先从 window.configData 读取（配置文件）
		if (window.configData && window.configData.debugTime) {
			debugTimeString = window.configData.debugTime;
		}
		// 如果 store 已初始化，也可以从 store 读取（设置面板修改的值）
		if (!debugTimeString && typeof store !== 'undefined' && store.state && store.state.config && store.state.config.debugTime) {
			debugTimeString = store.state.config.debugTime;
		}

		if (debugTimeString && debugTimeString.trim() !== '' && debugTimeString !== 'null') {
			// 如果调试时间基准未设置，或者调试时间字符串改变了，重新初始化
			if (!debugTimeBase || (debugTimeString !== window._lastDebugTimeString)) {
				// 解析调试时间字符串
				let year, month, day, hours, minutes, seconds;
				if (debugTimeString.includes('/')) {
					const [datePart, timePart] = debugTimeString.split(' ');
					[year, month, day] = datePart.split('/').map(Number);
					const timeParts = (timePart || '00:00:00').split(':');
					hours = Number(timeParts[0] || 0);
					minutes = Number(timeParts[1] || 0);
					seconds = Number(timeParts[2] || 0);
				} else {
					const [datePart, timePart] = debugTimeString.split('T');
					[year, month, day] = datePart.split('-').map(Number);
					const timeParts = (timePart || '00:00:00').split(':');
					hours = Number(timeParts[0] || 0);
					minutes = Number(timeParts[1] || 0);
					seconds = Number(timeParts[2] || 0);
				}
				debugTimeBase = new Date(year, month - 1, day, hours, minutes, seconds, 0);
				debugTimeStart = Date.now();  // 记录开始使用调试时间的真实时间戳
				window._lastDebugTimeString = debugTimeString;  // 保存当前调试时间字符串
			}

			// 计算从开始到现在经过的真实时间（毫秒）
			const elapsedRealTime = Date.now() - debugTimeStart;
			// 将经过的时间加到调试时间基准上，实现时间动态流逝
			now = new Date(debugTimeBase.getTime() + elapsedRealTime);
		} else {
			// 如果调试时间被禁用，重置相关变量
			debugTimeBase = null;
			debugTimeStart = null;
			window._lastDebugTimeString = null;
		}
	}
	return now;
}

let NEXT_YEAR_TIME_YEAR = getCurrentTime().getFullYear();	// 年份

function setLoadingPoint() {
	const point = document.querySelector("#loading-init__point");
	LOADING_POINT_TIMER = setInterval(() => {
		if (point.textContent.length >= 3) {
			point.textContent = "";
		} else {
			point.textContent += '.';
		}
	}, 500);
}
setTimeout(() => setLoadingPoint(), 10);

function nextNewYearTime() {
	// 获取目标时间的辅助函数
	function getTargetTime() {
		let targetTimeString = '2026/01/01 00:00:00';
		if (typeof store !== 'undefined' && store.state && store.state.config && store.state.config.countdownTargetTime) {
			targetTimeString = store.state.config.countdownTargetTime;
		}

		// 检查是否有调试时间配置（从 window.configData 读取）
		let debugTimeString = null;
		if (typeof window !== 'undefined' && window.configData && window.configData.debugTime) {
			debugTimeString = window.configData.debugTime;
		}

		// 解析日期时间字符串
		// 支持格式: YYYY/MM/DD HH:mm:ss 或 YYYY-MM-DDTHH:mm:ss
		let year, month, day, hours, minutes, seconds;

		if (targetTimeString.includes('/')) {
			// 新格式: YYYY/MM/DD HH:mm:ss
			const [datePart, timePart] = targetTimeString.split(' ');
			[year, month, day] = datePart.split('/').map(Number);
			const timeParts = (timePart || '00:00:00').split(':');
			hours = Number(timeParts[0] || 0);
			minutes = Number(timeParts[1] || 0);
			seconds = Number(timeParts[2] || 0);
		} else {
			// 旧格式: YYYY-MM-DDTHH:mm:ss 或 YYYY-MM-DDTHH:mm (兼容)
			const [datePart, timePart] = targetTimeString.split('T');
			[year, month, day] = datePart.split('-').map(Number);
			const timeParts = (timePart || '00:00:00').split(':');
			hours = Number(timeParts[0] || 0);
			minutes = Number(timeParts[1] || 0);
			seconds = Number(timeParts[2] || 0);
		}

		// 创建目标日期对象（月份需要减1，因为Date对象中月份从0开始）
		return {
			date: new Date(year, month - 1, day, hours, minutes, seconds, 0),
			year: year
		};
	}

	const targetInfo = getTargetTime();
	const targetTimestamp = targetInfo.date.getTime();
	const targetYear = targetInfo.year;

	function pad(num) {
		return num.toString().padStart(2, '0');
	}

	// 获取倒计时标题和文字的辅助函数
	// 格式化倒计时数字，添加深绿色赛博朋克样式
	function formatCountdownNumber(num) {
		// 使用深绿色渐变，保持原本字体
		return `<span class="cyberpunk-number" style="color: #00CC66; background: linear-gradient(135deg, #00CC66 0%, #00AA55 50%, #008844 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-shadow: 0 0 10px rgba(0, 204, 102, 0.8), 0 0 20px rgba(0, 170, 85, 0.6), 0 0 30px rgba(0, 136, 68, 0.4); font-weight: bold; display: inline-block;">${num}</span>`;
	}

	// 格式化倒计时数字（带单位）
	function formatCountdownWithUnit(num, unit) {
		// 数字使用深绿色渐变，单位保持原本颜色
		const numberStyle = 'color: #00CC66; background: linear-gradient(135deg, #00CC66 0%, #00AA55 50%, #008844 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-shadow: 0 0 10px rgba(0, 204, 102, 0.8), 0 0 20px rgba(0, 170, 85, 0.6), 0 0 30px rgba(0, 136, 68, 0.4); font-weight: bold; display: inline-block;';
		return `<span style="display: inline-block;"><span class="cyberpunk-number" style="${numberStyle}">${num}</span>${unit}</span>`;
	}

	// 给关键词添加橙色渐变样式
	function highlightKeywords(text, year, animal) {
		// 橙色渐变样式
		const gradientStyle = 'background: linear-gradient(135deg, #FF6B35 0%, #F7931E 50%, #FFD23F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;';

		// 转义HTML特殊字符
		text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

		// 需要高亮的关键词列表（按长度从长到短排序，优先匹配长关键词）
		let keywords = [];

		// 添加生肖年春节（如"羊年春节"）- 最长，优先匹配
		if (animal) {
			keywords.push(animal + '年春节');
		}

		// 添加年份
		if (year) {
			keywords.push(year.toString());
		}

		// 添加其他关键词
		keywords.push('春节', '跨年');

		// 替换关键词（按长度从长到短，避免短关键词覆盖长关键词）
		keywords.forEach(keyword => {
			const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			// 使用正则匹配，但排除已经在span标签内的文本
			const regex = new RegExp(escapedKeyword, 'g');
			let result = '';
			let lastIndex = 0;
			let inSpan = false;

			// 遍历文本，找到所有匹配位置
			let match;
			while ((match = regex.exec(text)) !== null) {
				// 检查当前位置是否在span标签内
				const beforeMatch = text.substring(0, match.index);
				const openSpanCount = (beforeMatch.match(/<span[^>]*>/g) || []).length;
				const closeSpanCount = (beforeMatch.match(/<\/span>/g) || []).length;
				const isInSpan = openSpanCount > closeSpanCount;

				// 添加匹配前的文本
				result += text.substring(lastIndex, match.index);

				// 如果不在span标签内，添加高亮
				if (!isInSpan) {
					result += `<span style="${gradientStyle}">${match[0]}</span>`;
				} else {
					result += match[0];
				}

				lastIndex = regex.lastIndex;
			}

			// 添加剩余文本
			result += text.substring(lastIndex);
			text = result;
		});

		return text;
	}

	function getCountdownInfo(targetDate, targetYear) {
		let countdownTitle = "倒计时";
		let countdownText = "";

		// 检查是否是跨年（公历1月1日 00:00:00）
		const isNewYear = targetDate.getMonth() === 0 && targetDate.getDate() === 1 &&
			targetDate.getHours() === 0 && targetDate.getMinutes() === 0 && targetDate.getSeconds() === 0;

		// 检查是否是春节（农历正月初一）
		let isSpringFestival = false;
		let lunarYear = null;
		let animal = null;

		if (typeof calendar !== 'undefined' && calendar.solar2lunar) {
			try {
				const lunarInfo = calendar.solar2lunar(
					targetDate.getFullYear(),
					targetDate.getMonth() + 1,
					targetDate.getDate()
				);

				// 检查是否是农历正月初一（春节）
				// lunar.js 返回的对象使用 lMonth 和 lDay 属性
				const lunarMonth = lunarInfo.lMonth || lunarInfo.lunarMonth;
				const lunarDay = lunarInfo.lDay || lunarInfo.lunarDay;

				if (lunarInfo && Number(lunarMonth) === 1 && Number(lunarDay) === 1) {
					isSpringFestival = true;
					lunarYear = lunarInfo.lYear;
					// 获取生肖（使用农历年份）
					if (calendar.getAnimal && lunarYear) {
						animal = calendar.getAnimal(lunarYear);
					}
				}
			} catch (e) {
				console.warn('农历转换失败:', e);
			}
		}

		// 根据类型设置标题和文字
		if (isSpringFestival) {
			// 春节倒计时
			countdownTitle = "春节倒计时";
			countdownTitle = "春节倒计时";
			const animalText = animal ? animal + "年" : "";
			countdownText = `距离农历${lunarYear}年${animalText}春节还有`;
		} else if (isNewYear) {
			// 跨年倒计时
			countdownTitle = "跨年倒计时";
			countdownText = `距离${targetYear}年跨年还有`;
		} else {
			// 普通倒计时
			countdownTitle = "倒计时";
			countdownText = `距离目标时间还有`;
		}

		return { countdownTitle, countdownText, animal, lunarYear };
	}

	function _getNewYearTime() {
		const now = getCurrentTime();
		// 每次获取时都重新读取目标时间，以支持动态更新
		const currentTargetInfo = getTargetTime();
		const currentTargetTimestamp = currentTargetInfo.date.getTime();
		const currentTargetYear = currentTargetInfo.year;
		const targetDate = currentTargetInfo.date;
		const diff = currentTargetTimestamp - now.getTime();

		// 获取倒计时信息
		const { countdownTitle, countdownText, animal, lunarYear } = getCountdownInfo(targetDate, currentTargetYear);

		// 应用高亮样式
		const highlightedTitle = highlightKeywords(countdownTitle, currentTargetYear, animal);
		const highlightedText = highlightKeywords(countdownText, currentTargetYear, animal);

		// 如果已经过了目标时间，显示0
		if (diff <= 0) {
			return `<div style="width: 100%; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">
			   	<span style="display: inline-block;font-size: 20px;margin-left: 5px;margin-bottom: 10px; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">${highlightedTitle}</span><br>
			   	<span style="display: inline-block;margin-left: 5px; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">${highlightedText}</span><div style="font-size: 30px;text-align: center;width: 100%;white-space: nowrap; font-family: 'Russo One', 'TencentFont', arial, sans-serif;"><span style="font-size: 60%">${formatCountdownWithUnit('00', '天')}</span>&nbsp;${formatCountdownNumber('00')}:${formatCountdownNumber('00')}:${formatCountdownNumber('00')}</div></div>`;
		}

		const totalSeconds = Math.ceil(diff / 1000);
		const days = Math.floor(totalSeconds / (60 * 60 * 24));
		const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
		const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
		const seconds = totalSeconds % 60;

		// 如果天数为0，则不显示"天"
		const daysDisplay = days > 0 ? `<span style="font-size: 60%">${formatCountdownWithUnit(pad(days), '天')}</span>&nbsp;` : '';

		return `<div style="width: 100%; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">
		   	<span style="display: inline-block;font-size: 20px;margin-left: 5px;margin-bottom: 10px; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">${highlightedTitle}</span><br>
		   	<span style="display: inline-block;margin-left: 5px; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">${highlightedText}</span><div style="font-size: 30px;text-align: center;width: 100%;white-space: nowrap; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">${daysDisplay}${formatCountdownNumber(pad(hours))}:${formatCountdownNumber(pad(minutes))}:${formatCountdownNumber(pad(seconds))}</div></div>`;
	}

	let lastCountdownSecond = -1; // 记录上一次显示的倒计时秒数
	let lastCountdownHTML = ''; // 记录上一次显示的倒计时HTML
	let lastCountdownTitle = ''; // 记录上一次显示的倒计时标题（用于检测类型变化）
	let wordFireworksShown = false; // 记录是否已经显示过烟花文字

	// 显示多个烟花文字的函数
	function showMultipleWordFireworks() {
		// 检查必要的函数和变量是否存在
		if (typeof createWordBurst === 'undefined') {
			return;
		}

		// 获取屏幕尺寸
		const screenWidth = typeof stageW !== 'undefined' ? stageW : window.innerWidth;
		const screenHeight = typeof stageH !== 'undefined' ? stageH : window.innerHeight;

		// 获取烟花文字列表
		let words = [];
		if (typeof randomWords !== 'undefined' && Array.isArray(randomWords) && randomWords.length > 0) {
			words = randomWords;
		} else {
			// 默认文字
			words = ["新年快乐", "2025行大运", "蛇年大吉", "阖家欢乐", "巳巳如意", "和睦安康", "生生不息", "前程似锦", "学业有成", "心想事成"];
		}

		// 计算要显示的文字数量，全屏幕分布，但控制总数避免卡顿
		const estimatedWordWidth = 150; // 估算每个文字的宽度
		const estimatedWordHeight = 60; // 估算每个文字的高度
		const padding = 50; // 边距
		const rowSpacing = 1.5; // 行间距倍数
		const colSpacing = 1.3; // 列间距倍数
		const availableWidth = screenWidth - padding * 2;
		const availableHeight = screenHeight - padding * 2;

		// 全屏幕分布，但限制总数避免卡顿（移动端减少数量）
		const maxWordsLimit = screenWidth <= 768 ? 30 : (screenWidth <= 1024 ? 45 : 60);
		const cols = Math.max(4, Math.floor(availableWidth / (estimatedWordWidth * colSpacing)));
		const rows = Math.max(4, Math.floor(availableHeight / (estimatedWordHeight * rowSpacing)));
		const maxWords = Math.min(cols * rows, maxWordsLimit); // 根据屏幕尺寸限制文字数量

		// 使用计算出的行列数
		const actualCols = cols;
		const actualRows = rows;

		// 计算每个文字的位置（全屏幕分布）
		const cellWidth = (availableWidth / actualCols) * colSpacing;
		const cellHeight = (availableHeight / actualRows) * rowSpacing;

		// 创建 Shell 实例来获取 dotStarFactory
		if (typeof Shell !== 'undefined' && typeof shellFromConfig !== 'undefined') {
			const shell = new Shell(shellFromConfig(3)); // 使用中等大小的烟花

			// 根据屏幕尺寸调整粒子参数（移动端延长显示时间）
			let lifeMultiplier = 1; // 生命周期倍数
			let baseSize = 4; // 粒子基础大小
			let speedMultiplier = 1; // 速度倍数（越小越慢，停留越久）

			if (screenWidth <= 480) {
				// 小屏手机：适度延长生命周期，平衡清晰度和性能
				lifeMultiplier = 2.0;
				baseSize = 2.5;
				speedMultiplier = 0.6;
			} else if (screenWidth <= 768) {
				// 大屏手机/小平板：适度延长生命周期，平衡清晰度和性能
				lifeMultiplier = 1.8;
				baseSize = 3;
				speedMultiplier = 0.7;
			} else if (screenWidth <= 1024) {
				// 平板：适度延长
				lifeMultiplier = 1.3;
				baseSize = 3.5;
				speedMultiplier = 0.8;
			} else {
				// 桌面端：保持原样
				lifeMultiplier = 1;
				baseSize = 4;
				speedMultiplier = 1;
			}

			// 定义 dotStarFactory（增大粒子大小让文字更清晰）
			const dotStarFactory = (point, color, strobe, strobeColor) => {
				const standardInitialSpeed = (shell.spreadSize / 1800) * speedMultiplier;

				if (strobe) {
					const speed = (Math.random() * 0.1 + 0.05) * speedMultiplier;
					const baseLife = shell.starLife * lifeMultiplier;
					const star = Star.add(
						point.x,
						point.y,
						color,
						Math.random() * 2 * Math.PI,
						speed,
						baseLife + Math.random() * baseLife * shell.starLifeVariation + speed * 1000,
						0,
						-standardInitialSpeed,
						baseSize
					);
					star.transitionTime = baseLife * (Math.random() * 0.08 + 0.46);
					star.strobe = true;
					star.strobeFreq = Math.random() * 20 + 40;
					star.secondColor = strobeColor;
				} else {
					const baseLife = shell.starLife * lifeMultiplier;
					Spark.add(
						point.x,
						point.y,
						color,
						Math.random() * 2 * Math.PI,
						Math.pow(Math.random(), 0.15) * 1.4 * speedMultiplier,
						baseLife + Math.random() * baseLife * shell.starLifeVariation + 1000
					);
				}

				// 文字尾影
				const tailOffsetX = 5;
				const tailOffsetY = 10;
				const baseLife = shell.starLife * lifeMultiplier;
				Spark.add(point.x + tailOffsetX, point.y + tailOffsetY, color, Math.random() * 2 * Math.PI, Math.pow(Math.random(), 0.05) * 0.4 * speedMultiplier, baseLife + Math.random() * baseLife * shell.starLifeVariation + 2000);
			};

			// 创建包装函数，使用更大的字体让文字更清晰，并根据屏幕尺寸自适应
			const createWordBurstWithLargeFont = (wordText, particleFactory, center_x, center_y) => {
				if (typeof getWordDots !== 'undefined' && typeof Mymath !== 'undefined' && Mymath.literalLattice) {
					// 根据屏幕宽度自适应字体大小
					let baseFontSize, fontSizeRange;
					if (screenWidth <= 480) {
						// 小屏手机：40-60px
						baseFontSize = 40;
						fontSizeRange = 20;
					} else if (screenWidth <= 768) {
						// 大屏手机/小平板：50-70px
						baseFontSize = 50;
						fontSizeRange = 20;
					} else if (screenWidth <= 1024) {
						// 平板：60-80px
						baseFontSize = 60;
						fontSizeRange = 20;
					} else {
						// 桌面端：80-100px
						baseFontSize = 80;
						fontSizeRange = 20;
					}
					const fontSize = Math.floor(Math.random() * fontSizeRange + baseFontSize);
					// 调整点阵密度：移动端使用参数2平衡清晰度和性能，桌面端使用参数3
					const latticeDensity = screenWidth <= 768 ? 2 : 3;
					const map = Mymath.literalLattice(wordText, latticeDensity, "Gabriola,华文琥珀", fontSize + "px");
					if (!map) return;

					const dcenterX = map.width / 2;
					const dcenterY = map.height / 2;
					const color = typeof randomColor === 'function' ? randomColor() : '#FFD700';
					const strobed = Math.random() < 0.5;
					const strobeColor = strobed && typeof randomColor === 'function' ? randomColor() : color;

					// 确保文字位置在屏幕范围内
					const wordWidth = map.width;
					const wordHeight = map.height;
					const wordPadding = 30;

					let safeX = center_x;
					let safeY = center_y;

					if (typeof stageW !== 'undefined' && typeof stageH !== 'undefined') {
						if (safeX - dcenterX < wordPadding) {
							safeX = wordPadding + dcenterX;
						}
						if (safeX + dcenterX > stageW - wordPadding) {
							safeX = stageW - wordPadding - dcenterX;
						}
						if (safeY - dcenterY < wordPadding) {
							safeY = wordPadding + dcenterY;
						}
						if (safeY + dcenterY > stageH - wordPadding) {
							safeY = stageH - wordPadding - dcenterY;
						}
					}

					for (let i = 0; i < map.points.length; i++) {
						const point = map.points[i];
						let x = safeX + (point.x - dcenterX);
						let y = safeY + (point.y - dcenterY);
						particleFactory({ x, y }, color, strobed, strobeColor);
					}
				} else if (typeof createWordBurst === 'function') {
					// 如果新方法不可用，回退到原方法
					createWordBurst(wordText, particleFactory, center_x, center_y);
				}
			};

			// 创建所有位置数组，全屏幕分布
			const positions = [];
			const centerX = screenWidth / 2;
			const centerY = screenHeight / 2;

			for (let i = 0; i < maxWords; i++) {
				const col = i % actualCols;
				const row = Math.floor(i / actualCols);

				// 计算位置（全屏幕分布）
				const x = padding + col * cellWidth + cellWidth / 2 + (Math.random() - 0.5) * cellWidth * 0.1;
				const y = padding + row * cellHeight + cellHeight / 2 + (Math.random() - 0.5) * cellHeight * 0.1;

				// 计算到屏幕中心的距离和方向
				const dx = x - centerX;
				const dy = y - centerY;
				const distance = Math.sqrt(dx * dx + dy * dy);

				// 判断方向：上、下、左、右
				let direction = 'center';
				if (Math.abs(dx) > Math.abs(dy)) {
					direction = dx > 0 ? 'right' : 'left';
				} else {
					direction = dy > 0 ? 'bottom' : 'top';
				}

				positions.push({
					x: x,
					y: y,
					distance: distance,
					direction: direction,
					word: words[i % words.length]
				});
			}

			// 按照方向和距离排序，实现从四面八方向中心汇聚的效果
			positions.sort((a, b) => {
				// 先按方向分组：上、下、左、右
				const directionOrder = { 'top': 0, 'bottom': 1, 'left': 2, 'right': 3, 'center': 4 };
				const dirDiff = directionOrder[a.direction] - directionOrder[b.direction];
				if (dirDiff !== 0) return dirDiff;
				// 同一方向内，按距离从远到近（从外向内）
				return b.distance - a.distance;
			});

			// 将文字按方向分组
			const topPositions = positions.filter(p => p.direction === 'top');
			const bottomPositions = positions.filter(p => p.direction === 'bottom');
			const leftPositions = positions.filter(p => p.direction === 'left');
			const rightPositions = positions.filter(p => p.direction === 'right');
			const centerPositions = positions.filter(p => p.direction === 'center');

			// 在多个位置显示文字，持续1分钟，多个文字同时从不同方向出现
			const duration = 60000; // 60秒（1分钟）
			// 根据屏幕尺寸调整批处理参数，移动端减少同时显示数量
			const wordsPerBatch = screenWidth <= 768 ? 4 : (screenWidth <= 1024 ? 6 : 8);
			const batchInterval = screenWidth <= 768 ? 1000 : 800; // 移动端增加间隔时间

			// 计算每批需要从每个方向取多少个文字（平均分配）
			const directions = [topPositions, bottomPositions, leftPositions, rightPositions, centerPositions].filter(d => d.length > 0);
			const wordsPerDirection = Math.ceil(wordsPerBatch / directions.length);

			// 计算总批次数（基于最长的方向）
			const maxBatches = Math.max(...directions.map(d => Math.ceil(d.length / wordsPerDirection)));

			// 将文字分批，每批包含来自不同方向的文字
			for (let batchIndex = 0; batchIndex < maxBatches; batchIndex++) {
				const batch = [];

				// 从各个方向取文字
				if (topPositions.length > 0) {
					const start = batchIndex * wordsPerDirection;
					const end = Math.min(start + wordsPerDirection, topPositions.length);
					batch.push(...topPositions.slice(start, end));
				}
				if (bottomPositions.length > 0) {
					const start = batchIndex * wordsPerDirection;
					const end = Math.min(start + wordsPerDirection, bottomPositions.length);
					batch.push(...bottomPositions.slice(start, end));
				}
				if (leftPositions.length > 0) {
					const start = batchIndex * wordsPerDirection;
					const end = Math.min(start + wordsPerDirection, leftPositions.length);
					batch.push(...leftPositions.slice(start, end));
				}
				if (rightPositions.length > 0) {
					const start = batchIndex * wordsPerDirection;
					const end = Math.min(start + wordsPerDirection, rightPositions.length);
					batch.push(...rightPositions.slice(start, end));
				}
				if (centerPositions.length > 0) {
					const start = batchIndex * wordsPerDirection;
					const end = Math.min(start + wordsPerDirection, centerPositions.length);
					batch.push(...centerPositions.slice(start, end));
				}

				if (batch.length > 0) {
					// 同一批文字同时显示，从不同方向同时出现
					setTimeout(() => {
						batch.forEach((pos) => {
							createWordBurstWithLargeFont(pos.word, dotStarFactory, pos.x, pos.y);
						});
					}, batchIndex * batchInterval);
				}
			}

			// 如果文字数量较少，可以循环显示以填满60秒
			const totalTime = maxBatches * batchInterval;
			if (totalTime < duration && positions.length > 0) {
				const cycles = Math.ceil(duration / totalTime);
				for (let cycle = 1; cycle < cycles; cycle++) {
					for (let batchIndex = 0; batchIndex < maxBatches; batchIndex++) {
						const batch = [];

						// 从各个方向取文字
						if (topPositions.length > 0) {
							const start = batchIndex * wordsPerDirection;
							const end = Math.min(start + wordsPerDirection, topPositions.length);
							batch.push(...topPositions.slice(start, end));
						}
						if (bottomPositions.length > 0) {
							const start = batchIndex * wordsPerDirection;
							const end = Math.min(start + wordsPerDirection, bottomPositions.length);
							batch.push(...bottomPositions.slice(start, end));
						}
						if (leftPositions.length > 0) {
							const start = batchIndex * wordsPerDirection;
							const end = Math.min(start + wordsPerDirection, leftPositions.length);
							batch.push(...leftPositions.slice(start, end));
						}
						if (rightPositions.length > 0) {
							const start = batchIndex * wordsPerDirection;
							const end = Math.min(start + wordsPerDirection, rightPositions.length);
							batch.push(...rightPositions.slice(start, end));
						}
						if (centerPositions.length > 0) {
							const start = batchIndex * wordsPerDirection;
							const end = Math.min(start + wordsPerDirection, centerPositions.length);
							batch.push(...centerPositions.slice(start, end));
						}

						if (batch.length > 0) {
							setTimeout(() => {
								batch.forEach((pos) => {
									// 稍微偏移位置，避免完全重叠
									const offsetX = (Math.random() - 0.5) * 50;
									const offsetY = (Math.random() - 0.5) * 50;
									createWordBurstWithLargeFont(pos.word, dotStarFactory, pos.x + offsetX, pos.y + offsetY);
								});
							}, cycle * totalTime + batchIndex * batchInterval);
						}
					}
				}
			}
		}
	}

	function _set() {
		const now = getCurrentTime();
		const nextYearDOM = document.querySelector('#Next-Year-Time');

		// 每次更新时都重新获取目标时间
		const currentTargetInfo = getTargetTime();
		const currentTargetTimestamp = currentTargetInfo.date.getTime();
		const currentTargetYear = currentTargetInfo.year;
		const diff = currentTargetTimestamp - now.getTime();

		// 计算剩余总秒数（使用Math.ceil与显示倒计时保持一致）
		const totalSeconds = Math.ceil(diff / 1000);

		// 在倒计时剩余6秒时，强制开启结局模式并发射一次烟花（不管之前是否已开启）
		// 必须在更新 lastCountdownSecond 之前检查，使用 currentSecond 来判断避免重复触发
		if (diff > 0 && diff <= 6000 && totalSeconds === 6) {
			// 使用 currentSecond 来避免重复触发（因为 lastCountdownSecond 会在后面更新）
			const currentSecond = totalSeconds;
			if (currentSecond !== lastCountdownSecond) {
				// 强制开启结局模式（不管之前是否已开启）
				if (typeof store !== 'undefined' && store.state && store.state.config) {
					// 确保自动发射开启（结局模式需要自动发射）
					if (!store.state.config.autoLaunch) {
						store.setState({
							config: {
								...store.state.config,
								autoLaunch: true,
								finale: true
							}
						});
					} else {
						// 强制开启结局模式
						store.setState({
							config: {
								...store.state.config,
								finale: true
							}
						});
					}

					// 依赖结局模式的自动发射机制，立即触发一次发射
					// 使用延迟执行确保状态更新和函数可用后再触发
					const tryLaunchFirework = (attempts = 0) => {
						if (attempts > 20) {
							console.warn('无法在6秒时通过结局模式发射烟花: 函数不可用');
							return;
						}

						// 优先使用 seqRandomFastShell（结局模式使用的函数）
						if (typeof seqRandomFastShell === 'function') {
							try {
								seqRandomFastShell();
								return; // 成功发射，退出
							} catch (e) {
								console.warn('seqRandomFastShell 调用失败:', e);
							}
						}

						// 如果 seqRandomFastShell 不可用，尝试使用 startSequence
						if (typeof startSequence === 'function') {
							try {
								startSequence();
								return; // 成功发射，退出
							} catch (e) {
								console.warn('startSequence 调用失败:', e);
							}
						}

						// 如果函数还未定义，继续重试
						setTimeout(() => tryLaunchFirework(attempts + 1), 100);
					};

					// 延迟执行，确保状态更新完成
					setTimeout(() => tryLaunchFirework(), 100);
				}
			}
		}

		// 检查是否在最后10秒内（diff > 0 且 totalSeconds <= 10）
		if (diff > 0 && totalSeconds > 0 && totalSeconds <= 10 && typeof startCountdown3D === 'function' && typeof showCountdownNumber === 'function') {
			// 启动3D特效（如果还没启动）
			const isActive = typeof isCountdown3DRunning === 'function' ? isCountdown3DRunning() : false;
			if (!isActive) {
				startCountdown3D();
			}

			// 显示对应的数字（10、9、8、7、6、5、4、3、2、1）
			const currentSecond = totalSeconds;
			if (currentSecond !== lastCountdownSecond && currentSecond > 0 && currentSecond <= 10) {
				showCountdownNumber(currentSecond);
				lastCountdownSecond = currentSecond;
			}

			// 隐藏倒计时显示
			if (nextYearDOM) {
				nextYearDOM.style.opacity = '0';
			}
		} else {
			// 不在最后10秒内，停止3D特效
			const isActive = typeof isCountdown3DRunning === 'function' ? isCountdown3DRunning() : false;
			if (isActive && typeof stopCountdown3D === 'function') {
				stopCountdown3D();
				lastCountdownSecond = -1;
			}

			// 恢复倒计时显示
			if (nextYearDOM) {
				nextYearDOM.style.opacity = '1';
			}
		}

		// 如果已经过了目标时间，停止3D特效
		if (diff <= 0) {
			const isActive = typeof isCountdown3DRunning === 'function' ? isCountdown3DRunning() : false;
			if (isActive && typeof stopCountdown3D === 'function') {
				stopCountdown3D();
				lastCountdownSecond = -1;
			}

			// 倒计时刚结束时，显示多个烟花文字
			const timeSinceEnd = now.getTime() - currentTargetTimestamp;
			if (timeSinceEnd < 10000 && timeSinceEnd >= 0) { // 前10秒内显示烟花文字
				// 只在第一次触发时显示
				if (!wordFireworksShown) {
					wordFireworksShown = true;
					// 延迟一点显示，让倒计时数字先消失
					setTimeout(() => {
						if (typeof showMultipleWordFireworks === 'function') {
							showMultipleWordFireworks();
						}
					}, 800);
				}
			}
		}

		if (now.getTime() >= currentTargetTimestamp) {
			// 跨年后的24小时内显示庆祝信息
			if ((now.getTime() - currentTargetTimestamp) < 1000 * 60 * 60 * 24) {
				// 从配置中获取文案，如果没有则使用默认值
				let countdownText = '恭祝全球华人新年快乐！\n梦虽遥，追则能达；愿虽艰，持则可圆。\n河山添锦绣，星光映万家！\n${year}年，新年新气象！';

				if (typeof store !== 'undefined' && store.state && store.state.config) {
					// 如果 countdownText 是数组，转换为字符串
					let configText = store.state.config.countdownText;
					if (Array.isArray(configText)) {
						configText = configText.join('\n');
					}
					countdownText = configText || countdownText;
				}

				// 替换 ${year} 占位符，使用目标年份（从目标时间中解析出的年份）
				// 确保使用正确的目标年份，而不是当前年份
				const targetYear = currentTargetYear; // 这个值来自 getTargetTime()，应该是正确的
				countdownText = countdownText.replace(/\$\{year\}/g, targetYear);

				// 按换行符分割文案
				const lines = countdownText.split(/\r?\n/).filter(line => line.trim());

				// 生成HTML，第一行大字体，其他行正常字体，渐显动画
				let htmlContent = '<div class="countdown-text-container" style="width:100%;text-align:center;position: fixed;top: 25%;left: 50%;transform: translate(-50%, calc(-50% - 3px));opacity: 0;">';

				lines.forEach((line, index) => {
					if (index === 0) {
						// 第一行：粒子效果和阴影效果
						htmlContent += `<div style=""><span class="particle-text" style="background: linear-gradient(to left, #F44336, #FF9800);-webkit-background-clip: text;color: transparent;font-size:1.8rem;display: inline-block;">${line}</span></div>`;
					} else {
						// 其他行：正常字体
						const marginTop = index === 1 ? '30px' : '10px';
						const animation = index === 1 ? 'animation: fade-in 0.5s linear;' : '';
						htmlContent += `<div style="margin-top: ${marginTop};${animation}"><span style="background: linear-gradient(to left, #F44336, #FF9800);-webkit-background-clip: text;color: transparent;text-shadow: none;font-size:1.5em">${line}</span></div>`;
					}
				});

				htmlContent += '</div>';
				const newHTML = htmlContent;
				if (nextYearDOM) {
					// 跨年后的显示直接更新，不使用叠化
					// 只有当内容发生变化时才更新，避免重复触发动画
					if (lastCountdownHTML !== newHTML) {
						nextYearDOM.innerHTML = newHTML;
						nextYearDOM.style.opacity = '1';
						lastCountdownHTML = newHTML;
						lastCountdownTitle = ''; // 跨年后的显示不需要标题
					}
				}
			} else {
				// 超过24小时后，重新获取目标时间（可能用户已经修改了）
				let currentTargetTimeString = '2026-01-01T00:00';
				if (typeof store !== 'undefined' && store.state && store.state.config && store.state.config.countdownTargetTime) {
					currentTargetTimeString = store.state.config.countdownTargetTime;
				}
				const [currentDatePart, currentTimePart] = currentTargetTimeString.split('T');
				const [currentYear, currentMonth, currentDay] = currentDatePart.split('-').map(Number);
				const [currentHours, currentMinutes] = (currentTimePart || '00:00').split(':').map(Number);
				const currentTargetDate = new Date(currentYear, currentMonth - 1, currentDay, currentHours, currentMinutes, 0, 0);
				const currentTargetTimestamp = currentTargetDate.getTime();

				// 如果当前时间已经超过目标时间，显示已过期
				if (now.getTime() >= currentTargetTimestamp) {
					const { countdownTitle, animal } = getCountdownInfo(currentTargetDate, currentYear);
					const highlightedTitle = highlightKeywords(countdownTitle, currentYear, animal);
					const newHTML = `<div style="font-family: 'Russo One', 'TencentFont', arial, sans-serif;">
					   	<span style="display: inline-block;font-size: 20px;margin-left: 5px;margin-bottom: 10px; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">${highlightedTitle}</span><br>
					   	<span style="display: inline-block;margin-left: 5px; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">目标时间已过期，请在设置中修改目标时间</span></div>`;

					const isTypeChanged = countdownTitle !== lastCountdownTitle;

					if (nextYearDOM) {
						if (isTypeChanged && lastCountdownTitle) {
							// 类型改变时，使用叠化效果
							if (nextYearDOM.innerHTML) {
								nextYearDOM.style.opacity = '0';
								// 使用 requestAnimationFrame 实现更快的叠化
								requestAnimationFrame(() => {
									requestAnimationFrame(() => {
										nextYearDOM.innerHTML = newHTML;
										nextYearDOM.style.opacity = '1';
									});
								});
							} else {
								nextYearDOM.innerHTML = newHTML;
								nextYearDOM.style.opacity = '0';
								requestAnimationFrame(() => {
									nextYearDOM.style.opacity = '1';
								});
							}
							lastCountdownTitle = countdownTitle;
						} else {
							// 内容变化，直接更新，不使用叠化
							nextYearDOM.innerHTML = newHTML;
							nextYearDOM.style.opacity = '1';
							if (!lastCountdownTitle) {
								lastCountdownTitle = countdownTitle;
							}
						}
						lastCountdownHTML = newHTML;
					}
				} else {
					const diff = currentTargetTimestamp - now.getTime();
					const totalSeconds = Math.ceil(diff / 1000);
					const days = Math.floor(totalSeconds / (60 * 60 * 24));
					const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
					const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
					const seconds = totalSeconds % 60;

					const { countdownTitle, countdownText, animal } = getCountdownInfo(currentTargetDate, currentYear);
					const highlightedTitle = highlightKeywords(countdownTitle, currentYear, animal);
					const highlightedText = highlightKeywords(countdownText, currentYear, animal);

					// 如果天数为0，则不显示"天"
					const daysDisplay = days > 0 ? `<span style="font-size: 60%">${formatCountdownWithUnit(pad(days), '天')}</span>&nbsp;` : '';

					const newHTML = `<div style="width: 100%; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">
					   	<span style="display: inline-block;font-size: 20px;margin-left: 5px;margin-bottom: 10px; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">${highlightedTitle}</span><br>
					   	<span style="display: inline-block;margin-left: 5px; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">${highlightedText}</span><div style="font-size: 30px;text-align: center;width: 100%;white-space: nowrap; font-family: 'Russo One', 'TencentFont', arial, sans-serif;">${daysDisplay}${formatCountdownNumber(pad(hours))}:${formatCountdownNumber(pad(minutes))}:${formatCountdownNumber(pad(seconds))}</div></div>`;

					const isTypeChanged = countdownTitle !== lastCountdownTitle;

					if (nextYearDOM) {
						if (isTypeChanged && lastCountdownTitle) {
							// 类型改变时，使用叠化效果
							if (nextYearDOM.innerHTML) {
								nextYearDOM.style.opacity = '0';
								// 使用 requestAnimationFrame 实现更快的叠化
								requestAnimationFrame(() => {
									requestAnimationFrame(() => {
										nextYearDOM.innerHTML = newHTML;
										nextYearDOM.style.opacity = '1';
									});
								});
							} else {
								nextYearDOM.innerHTML = newHTML;
								nextYearDOM.style.opacity = '0';
								requestAnimationFrame(() => {
									nextYearDOM.style.opacity = '1';
								});
							}
							lastCountdownTitle = countdownTitle;
						} else {
							// 只是秒数变化，直接更新，不使用叠化
							nextYearDOM.innerHTML = newHTML;
							nextYearDOM.style.opacity = '1';
							if (!lastCountdownTitle) {
								lastCountdownTitle = countdownTitle;
							}
						}
						lastCountdownHTML = newHTML;
					}
				}
			}
		} else {
			const newHTML = _getNewYearTime();
			// 获取当前的倒计时标题，用于检测类型变化
			const currentTargetInfo = getTargetTime();
			const { countdownTitle } = getCountdownInfo(currentTargetInfo.date, currentTargetInfo.year);

			// 检测类型是否改变（只有类型改变时才使用叠化）
			const isTypeChanged = countdownTitle !== lastCountdownTitle;

			if (nextYearDOM) {
				if (isTypeChanged && lastCountdownTitle) {
					// 类型改变时，使用叠化效果
					if (nextYearDOM.innerHTML) {
						nextYearDOM.style.opacity = '0';

						// 使用 requestAnimationFrame 实现更快的叠化
						requestAnimationFrame(() => {
							requestAnimationFrame(() => {
								nextYearDOM.innerHTML = newHTML;
								nextYearDOM.style.opacity = '1';
							});
						});
					} else {
						// 第一次显示，直接设置并淡入
						nextYearDOM.innerHTML = newHTML;
						nextYearDOM.style.opacity = '0';
						requestAnimationFrame(() => {
							nextYearDOM.style.opacity = '1';
						});
					}
					lastCountdownTitle = countdownTitle;
				} else {
					// 只是秒数变化，直接更新，不使用叠化
					nextYearDOM.innerHTML = newHTML;
					nextYearDOM.style.opacity = '1';
					if (!lastCountdownTitle) {
						lastCountdownTitle = countdownTitle;
					}
				}
				lastCountdownHTML = newHTML;
			}
		}
	}

	// 只有在系统已启动时才执行倒计时更新
	if (typeof store !== 'undefined' && store.state && !store.state.paused) {
		_set();
	}

	// 只有在系统已启动时才启动定时器
	if (typeof store !== 'undefined' && store.state && !store.state.paused) {
		if (!NEXT_YEAR_TIMER) {
			NEXT_YEAR_TIMER = setInterval(() => {
				// 再次检查系统是否还在运行
				if (typeof store !== 'undefined' && store.state && !store.state.paused) {
					_set();
				} else {
					// 如果系统已暂停，清除定时器
					if (NEXT_YEAR_TIMER) {
						clearInterval(NEXT_YEAR_TIMER);
						NEXT_YEAR_TIMER = null;
					}
				}
			}, 1000);
		}
	}
}

// 不自动启动，等待用户点击按钮
// setTimeout(() => nextNewYearTime(), 0);

function nowTime() {
	function pad(num) {
		return num.toString().padStart(2, '0');
	}

	function _getMonthFullName(month) {
		const monthFullName = [
			'01', '02', '03', '04',
			'05', '06', '07', '08',
			'09', '10', '11', '12'
		];
		return monthFullName[month];
	}

	function _getWeekFullName(week) {
		const weekFullName = [
			'日', '一', '二', '三', '四', '五', '六'
		];
		return weekFullName[week];
	}

	function _set() {
		// console.log("nowTime",new Date().getSeconds())
		const now = getCurrentTime();
		const timeDom = document.querySelector('#Now-Time .time');
		const dateDom = document.querySelector('#Now-Time .date');
		timeDom.innerHTML = `${pad(now.getHours())} : ${pad(now.getMinutes())}<span> : ${pad(now.getSeconds())}</span>`;
		dateDom.textContent = `${now.getFullYear()}年${_getMonthFullName(now.getMonth())}月${pad(now.getDate())}日 , 星期${_getWeekFullName(now.getDay())} `;
	}
	_set();

	NOW_TIME_TIMER = setInterval(() => _set(), 1000);
}
nowTime()
// setTimeout(() => nowTime(), 0);

function setBottomRightButton(toggleMenu) {
	document.querySelector("#right-bottom-button .parent-button").addEventListener("click", toggleMenu);
}