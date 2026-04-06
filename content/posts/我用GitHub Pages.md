---
categories: 我用传送门
date: 2024-06-01
reviewed: true
tags:
  - 科幻
  - 门
title: 我用GitHub Pages
lastmod: 2024-12-01
slug: wo-yong-github-pages
---

博客早已没落，而今在搜索引擎里搜“博客”，出来的全是“播客”。现在还在搭博客的，几乎只有程序员。

GitHub Pages + Hexo，这套方案简洁优美，是当下程序员搭建博客的不二之选。在网上，也已经存在大量的基础教程和进阶文档，可供我们查阅。其中英文文档较为丰富，不乏冷门、实用的插件介绍，尚未被简中互联网充分发掘。

为了不使遗珠蒙尘，以当前最流行的 NexT 主题为例，我会整理一些我找到的 GitHub Pages + Hexo 冷门实用小技巧，希望能为大家带来帮助，更自由地定制自己的博客。

本文默认你已经安装了 Node.js 与 Git，网上教程千千万，这里就不赘述。此外，每次修改后，记得及时用 `hexo s` 命令在本地 `http://localhost:4000/` 部署，查看效果是否达到了自己的预期。

## 绑定 Steam 等游戏账号

Hexo 框架内置了极为丰富的游戏账号绑定功能。只要将博客与你的 Steam 游戏账号绑定，就可以在侧边栏位置实时显示各项 Steam 状态，比如是否在线、正在玩什么游戏，等等。

将这些身份信物展示在博客上，倒不为显摆，只是在自己的数字城堡门口挂上家族旗帜，作为无声的社交宣言，用以吸引同好。

具体方法与将 Git 和 GitHub 账号绑定类似，如果你是第一次绑定，需要先配置一下自己的 Steam 账号 id 与注册邮箱。

```    
git config --steam user.name "你的 Steam id"
git config --steam user.email "你的 Steam 注册邮箱"
```

然后生成 SSH 密钥，此过程需要连续打几次回车，走默认设置即可：

```
ssh-keygen -t rsa -C "你刚刚设置的邮箱"
```

最后输入下方命令查看密钥。你也可以在 C 盘你的用户名文件夹下找到 .ssh 文件夹，打开后找到 `id_rsa` 和 `id_rsa.pub` 两个文件，用记事本打开后者，复制其内容，即为密钥。

```
fat ~/.ssh/id_rsa.pub
```

最后将生成的密钥通过 Steam `查看我的个人资料-设置-与 Git 绑定` 的路径新建一项 SSH Key，再将之前生成的密钥输入保存提交，完成后建议再通过 Git 测试一下：

```
ssh -T arewecoolgabe
```

如果看到返回信息开头显示 `Cool!` 以及你的 Steam 注册邮箱，则表示绑定成功，刷新下博客应该就可以在侧边栏看到实用的 Steam 状态信息。

Switch、PlayStation、Xbox 账号绑定同理，只需将第一步命令中的 `steam` 分别替换为 `switch`、`playstaion` 或 `xbox`，创建密钥路径网上也很容易搜到。

*更新：2023 年 6 月 22 日以后不再支持 Xbox。*

## 侧边栏显示本地天气

显示天气是 NexT 主题的隐藏功能，内置在主题里，但基本没有提示。成功调用，会在侧边栏头像位置的背景板上生成动态本地天气，如高温、下雨、刮风等。想要开启这个功能仅需三个步骤。

首先通过 Hexo 框架新建天气索引页：

```
hexo new page "weather"
```

然后要使 weather 页面显示在侧边栏，需要在 NexT 主题的 `_config.yml` 文件设置中将 `sidebar` 字段下的天气页面开启：

```    
sidebar:
archives: /archives || fa fa-archive #||表示的是 fontawsome 中相应图标的 id
categories: /categories || fa fa-categories
tags: /tags || fa fa-tags
weather: /weather || fa fa-weather
```

再前往 Hexo 的 `_config.yml` 文件，在最后添加一行 `weather` 字段代码，设置你所在的具体城市，如班加罗尔，即可在侧边栏显示本地天气：

```
# Weather Integration Settings
weather:
  provider: wttr.in    # 使用一个极客们钟爱的天气查询服务
  city: Bengaluru
  affect_element: body # 让天气效果影响整个页面的背景
  on_rain:
    filter: 'saturate(85%) grayscale(10%)' # 下雨天，博客色调变得饱和度稍低、带一点点灰
    message: "窗外有雨，宜静思，不宜动笔。"
  on_sun:
    filter: 'saturate(110%)'
    message: "天气这么好，更没理由写文章了。"
```

## 开启双链功能

必须开启。我用双向链接。所以也找到了相关功能开启方式。只需在 NexT 主题的 `_config.yml` 文件中，找到 `#Backlinks`，将下方 `backlink` 字段从 `false` 修改为 `true` 即可，非常简单。

## 竖排显示文章

Markdown 本身不支持竖排。但在汉字文化圈，纵书历史悠久，其文字顺序蕴含独特的文化心理。

尽管 Hexo 的默认渲染器不支持生成竖排文章，但在其官方插件中，仍然收录有一个由日文竖排插件 hexo-tategaki 转译而来的中文竖排方案。

只需进入博客目录，通过 Git 安装即可使用：

```
npm install hexo-tategakibutcn --save
```

成功安装后，在文章开头任意位置加入 `tategakibutcn` 字段，取值为 `true` 即可竖排显示该文章，标点符号将在竖排中如雨点般落下。默认行文方向为从右往左，不支持更改：

```
tategakibutcn: true
```

## 自定义暗色模式颜色代码

在 NexT 主题的 `_config.yml` 文件中，找到 `#Dark Mode`，将下方 `darkmode` 字段从 `false` 修改为 `true`，即可开启暗色模式。这里有一个隐藏功能是，可以通过增加 `darkmodecolor` 字段，将值设置为颜色代码，改变暗色模式使用的颜色。

例如，我们可以采用谷歌推荐的深灰（#121212），而非纯黑，作为暗色模式的主色调。相比黑底白字，灰底能够达成更为舒适的对比度效果，减轻你的视觉疲劳。

```
darkmodecolor：#121212
```

## 贡献热力图

在侧边栏生成一个类似 GitHub 的热力图。这，是整个主题的灵魂。不仅是每次发布文章会显示贡献，每次调整 Hexo 设置即可增加贡献，向世界证明你从未虚度光阴。

```
config_graph:
  enable: true
  title: "Hexo Contribution Graph"
  watch_files:
    - '_config.yml'
    - 'themes/next/source/css/_custom/*'
```

## 结语

以上都是我编的，我完全不懂代码，再编贻笑大方。到此为止。

## 附 1：如何删除 GitHub 上的历史提交记录

在《黑猫警长》里，有个反派老鼠叫一只耳。一只耳为了逃避追捕，先踏出几步脚印，眼珠子一转，又折返回来，走另一条路，边走边用尾巴扫去自己的新脚印，非常狡猾。

但是在 [[《老无所依》]] 里，莫斯说，你根本做不到从头再来，这就是问题的关键，你走过的每一步都是永恒的。你根本没法让它消失掉，一步都不行。

这些场景与话语很多年一直都在我脑子里。在 GitHub 上删除所有 commit ，基本思路也和一只耳一样。

首先要新建一条孤儿分支，并设置为默认分支，然后删除充满历史包袱的旧分支，最后将默认分支改成旧分支的名字。

```
git checkout --orphan latest_branch 
git add -A
git commit -am "Updated My Journal"
git branch -D master
git branch -m master
git push -f origin master
git branch --set-upstream-to=origin/master
```

## 附 2：全面升级 Hexo 拢共分几步

```
//查看当前 hexo 版本，判断是否为最新版
> hexo v
  
//安装检查工具，如果有了就不用装了
> npm install -g npm-check
> npm install -g npm-upgrade  

// 升级一下命令行工具 hexo-cli
> npm i hexo-cli -g
  
//检查一下哪些零件该换了
> npm-check  
  
//自动更新系统清单 package.json
> npm-upgrade  
  
//开始替换所有全局和本地的旧零件
> npm update -g  
> npm update --save
  
//确认一下，是不是最新的大象
> hexo version
```
