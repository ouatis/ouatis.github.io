---
categories: 我用传送门
date: 2023-01-01
reviewed: true
tags:
  - 黑曜石
  - 门
title: 我用Tasks
lastmod: 2023-01-01
slug: wo-yong-tasks
---

说起日程表，我首先想到的，还是盖茨比的父亲。那位老人来参加葬礼。他很为儿子骄傲，珍藏着一张小盖茨比童年时的作息表。这张作息表的时间是 1906 年 9 月 12 日，写在一本牛仔小说封底，小说叫《牛仔卡西迪》。这当然是小说家的虚构，如同账单有时也能成为诗歌。奇怪的是，我看到这张作息表，便会联想到富兰克林、爱迪生一类的人物，虽然我对他们其实并不了解。

>起床上午 6.00[^1]
>哑铃体操及爬墙 6.15—6.30
>学习电学等 7.15—8.15
>工作 8.50—下午 4.30
>棒球及其他运动下午 4.30—5.00
>练习演说、仪态 5.00—6.00
>学习有用的新发明 7.00—9.00
>
>个人决心
>
>不要浪费时间去沙夫特家或（另一姓，字迹不清）
>不再吸烟或嚼烟
>每隔一天洗澡
>每周读有益的书或杂志一册
>每周储蓄五元（涂去）三元
> 对父母更加体贴

“Study needed inventions”，巫宁坤译作“学习有用的新发明”，我记得还有一个旧译本，用的是“研究有用的发明”。

“研究”“有用”“发明”放在一起，很有力量。以小见大，可以读出一个少年的进取心、勤奋，以及天真的抱负。但他具体研究什么，没人知道。“发明”这个词本身就不确定，是科学，也是炼金术，一种朦胧的渴望。詹姆斯·盖茨一生最核心的工程，就是将贫穷的自己，发明成富有的杰伊·盖茨比。

译作“学习有用的新发明”，一字之差，调子就转弱许多。变得像是在课堂上被动地记住知识点，缺少了那种主动探索的神秘感。而盖茨比的魅力，正在于此。他用的就是功利头脑，去伺候一颗狂野之心。

这张作息表很适合过度解读。“爬墙”是阶层攀爬的隐喻；“演说和仪态”是打造一副入流社会的面具；储蓄从五块改成三块，是穷孩子心有余而力不足的窘迫。

他照着这张图纸，勤勤恳恳，把零件备齐，最后点火升空，眼看要碰到天上的星星，却发现翅膀早让那些镀金的砂砾给焊死了。可退一步看，这不过是泰勒的科学管理法失效了。把人当机器，把时间当零件，美式流水线的作业指导书失效了。

多年以后，信息时代人类做时间表，已经有大量软件应用可选。点几下，一张表就列出来了。不至于像小盖茨比那样，拿一张可怜的纸条记录，有修改还得涂抹。很多人因此天真地相信，只要吃够营养成分完美配比的代餐棒，自己就能变成理想中的那个人。

作息表一旦失去灵魂，它便会扭曲变形，很容易沦为《美国精神病人》中那样的晨间流程：抹脸，举铁，挑西装，比谁都讲究，无非是给一个空壳抛光。

东拉西扯，我主要是想聊聊自己怎么使用时间表。

我正式开始做时间表，是在安装了 Obsidian 以后了，主要用到 Tasks 插件，好处是可以使用语句，搜寻、过滤、罗列散落在 Vault 里的各个任务。语句非常简单，字面意思就很清楚。基于这个功能，我通过核心插件“模板”功能，为每天的日记加入日常任务和提醒，跟有秘书似的。

因为试图在其中加入一点点文化人的要素，这部分笔记被我叫做 G.T.K.，戏仿 Getting Things Done，实际上是 Ganzer Tag Kanzlei 的缩写。名号一定，这套方法便不再是寻常工具。

其中，第一部分 [[TEMPLATE#Ganzer Tag Kanzlei]] 和第三部分 [[TEMPLATE#Lage Unverändert]] 都使用 Tasks 插件，罗列任务；第二部分这是“我用 Dataview”。

第一部分：近期最重要的任务。它应用了一套复合筛选逻辑：若优先级为“最高/高”，需在 7 天内到期或计划；若为“中/普通”，需在 3 天内；若为“低/最低”，需在 1 天内。满足上述任一条件的任务会被抓取。结果按优先级进行分组。组内排序规则依次为：截止日期升序、排程日期升序。最后以“短模式”渲染，隐藏部分元数据。

````
> [!important]+ Ganzer Tag Kanzlei
>
> ```tasks
> not done
> not done
> ( (priority is above medium) AND (due before in 7 days OR scheduled before in 7 days) ) OR ( (priority is medium) OR (priority is none) ) AND ( (due before in 3 days) OR (scheduled before in 3 days) ) OR ( priority is below none ) AND ( (due before in 1 day) OR (scheduled before in 1 day) )
> group by priority
> sort by due asc
> sort by scheduled asc
> short mode
> ```
````

第三部分：筛选“未完成”的远期或非紧急任务。我不希望当下的视野被所有事情填满，所以这里应用了一套反向逻辑：使用 `NOT` 运算符，直接剔除掉第一部分里已经显示的那些紧急事项。剩下的就是那些还没火烧眉毛的事，相当于一个远景仓库。同时，我也顺手过滤掉了“最低优先级”的琐事，毕竟如果不紧急又不重要，那就先别出现在眼前了。

````
> [!todo]+ Lage Unverändert
>
> ```tasks
> not done
> priority is not lowest
> NOT ( ( (priority is above medium) AND (due before in 7 days OR scheduled before in 7 days) ) OR ( (priority is medium) OR (priority is none) ) AND ( (due before in 3 days) OR (scheduled before in 3 days) ) OR ( priority is below none ) AND ( (due before in 1 day) OR (scheduled before in 1 day) ) )
> has due date
> group by due
> sort by due asc
> sort by priority desc
> sort by scheduled asc
> limit 7
> ```
````

Tasks 插件也有个短处，它的截止时间无法精确到每时每分，最小单位就是天。如果像小盖茨比那样，有更细的提醒需求，可以寻找另外的插件。

## 我也用 Dataview

Dataview 博大精深，要比记账伙计更厉害，像是个账房先生。我只展示几个具体的案例。其中的使用逻辑，可以参考网上数不胜数的教程。

在我用 Tasks 的过程中，特别给 [[TEMPLATE#Nicht Gearbeitet]] 添加了“历史上的这个月”功能。这个功能就像盖茨比的父亲，每天忠实地翻出我的旧笔记。所以我也叫它“dadview”。

它会检索全库的过往历史笔记，生成一个包含分类、文件链接、日期及更新时间的表格。自动计算当年日期与今年的差值。如果今天恰好有日记，它会把今天所有的“🎉 整十”或“🌱 周年”纪念日全部罗列出来（整十优先）；如果今天刚好是个平淡的日子，它会寻找距离当下最近的下一个纪念日，并将那一天包含的所有周年和整十记录一并呈现。

````
Nicht Gearbeitet

```dataviewjs
const today = dv.date("today");
const todayStr = today.toFormat("MM-dd");
const currentYear = today.year;

const pages = dv.pages('""').where(p => p.date && p.date.year < currentYear);

let todayFiles = [];
let futureFiles = [];

for (let p of pages) {
	let mDateStr = p.date.toFormat("MM-dd");
	let diffYear = currentYear - p.date.year;
	
	let isDecade = (diffYear % 10 === 0);
	let category = isDecade ? "🎉 整十" : "🌱 周年";
	let updateTime = p.updated ? p.updated : p.file.mtime;
	
	let rowData = [
		category,                          // [0]
		p.file.link,                       // [1]
		p.date.toFormat("yyyy-MM-dd"),     // [2]
		updateTime.toFormat("yyyy-MM-dd"), // [3]
		mDateStr,                          // [4] 用于排序的月日
		isDecade ? 1 : 0                   // [5] 用于排序的整十权重
		];
		
	if (mDateStr === todayStr) {
		todayFiles.push(rowData);
	} else if (mDateStr > todayStr) {
		rowData.push(0); // [6] 标识：今年的未来
		futureFiles.push(rowData);
	} else {
		rowData.push(1); // [6] 标识：明年的未来
		futureFiles.push(rowData);
	}
}

let finalRows = [];

if (todayFiles.length > 0) {
    // 优先按整十排序
	todayFiles.sort((a, b) => b[5] - a[5]); 
	finalRows = todayFiles;
} else if (futureFiles.length > 0) {
	futureFiles.sort((a, b) => {
		if (a[6] !== b[6]) return a[6] - b[6]; // 先判断是今年还是明年
		if (a[4] !== b[4]) return a[4] < b[4] ? -1 : 1; // 按日期远近排序
		return b[5] - a[5]; // 同一天优先展示整十
	});
    
	// 升级逻辑：获取最近的那个日期，把同一天所有的周年/整十都挑出来
    let closestDate = futureFiles[0][4];
    finalRows = futureFiles.filter(r => r[4] === closestDate);
}

if (finalRows.length > 0) {
	dv.table(["分类", "文件", "日期", "更新时间"], finalRows.map(r => r.slice(0, 4)));
} else {
	dv.paragraph("📭 没有找到任何历史整十或周年记录。");
}
```
````

现在，流水线已经开启，祝我好运。

[^1]: 盖茨比在分秒数字之间使用句点。起初我以为是排版错误，翻了英文原版，竟然没错。我们翻开符号学与文化地理的地图，会发现一条清晰的轨迹：句点作为时间分隔符，是日耳曼语言区的惯例。而盖茨比曾在明尼苏达的路德派圣奥拉夫学院就读。路德宗，源自德国的信仰；明尼苏达，德裔与北欧移民的文化飞地。这个小小的标点符号，就像密码一样，暗示了盖茨比的出身来自中西部，而非使用冒号的盎格鲁 - 撒克逊“老钱”世界。当然，也有可能菲茨没想那么多，但我作为读者，应该想那么多。
