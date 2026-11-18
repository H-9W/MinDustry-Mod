// ============================================================
// 自定义面板 —— Mindustry 160.7 JavaScript 模组主程序
//
// 入口路径 scripts/main.js 由游戏硬编码（mindustry.mod.Mods 直接查这个位置），
// 改名会报 “No main.js found”。
//
// 运行环境：游戏内置 Rhino。global.js 已 importPackage 了 arc.* 与 mindustry.*
// 的常用包，所以 Vars / Core / Events / BaseDialog / Table / TextField / Scl /
// Seq 这些类可直接使用；还提供 cons() / run() / prov() / boolp() 把 JS 函数包成
// Java 函数式接口，extend() 生成 JavaAdapter 子类（实测返回的是实例）。
//
// 本文件只用 ES5 语法（无箭头函数、顶层一律 var）：Rhino 的语言级别由游戏决定，
// ES5 在任何级别下都能解析，顶层 let 有可能被稍后触发的回调看不到。
//
// Rhino / 160.7 的三条硬约束，改代码前先看：
// 1) Element.visible 是 boolean 字段而不是方法，要挂每帧显隐条件必须写
//    `elem.visibility = boolp(...)`（赋值字段），写成 elem.visible(boolp(..))
//    会抛 "It is not a function, it is boolean" 并让模组被游戏自动禁用。
// 2) Element 的位置是公有字段 x / y，没有 getX() / getY()。
// 3) 任何可能抛异常的回调都要用 safe() 包一层，异常逃出 JS 回调就会触发
//    游戏的 modcrashdisable（写 mod-<name>-failed 并禁用本模组）。
// 4) Cell 的尺寸与间距方法（width/size/height/minWidth/maxWidth/pad*）内部自己
//    乘界面缩放（字节码：Cell.scl(F) -> arc.scene.ui.layout.Scl.scl(F)），
//    所以喂给它们的必须是「设计像素」原值。再套一层 px() 就是二次缩放：
//    缩放小于 1 时格子比文字缩得快，文字必然顶到框外 —— 这正是上一版
//    「挤在一起 / 字超出框」的根因之一。只有直接作用于 Element 的 API
//    （setSize / setPosition / x / y）才需要 px()。
// 5) Cell.width(v) 等价于 minWidth = maxWidth = v（字节码两次 putfield），
//    Table 布局里 min==max 的列被钉成固定列，所以想「限宽 + 省略号」必须调
//    width() 而不是 minWidth()：后者只钉下限，不换行的 Label 会把整行文字
//    的宽度当成自己的偏好宽度，于是把后面的控件顶出卡片。
// ============================================================

/** 模组显示名，用于日志、标题与提示 */
var MOD_NAME = "自定义面板";
var MOD_VERSION = "1.0";

/**
 * true = 挡掉游戏自己发起的两类远程请求，它们在本机必然失败并弹出
 * 「发生错误 (Connection reset)」：
 *   1) 社区服务器列表：mindustry.ui.dialogs.JoinDialog.fetchServers()，
 *      它第一步读 communityservers 开关，关掉即可；
 *   2) 模组浏览器的远程模组列表：ModBrowserDialog.getModListInternal() 拉
 *      Vars.modJsonURLs（GitHub raw + jsDelivr 两个地址都被本机网络重置），
 *      全部失败后走 ModsDialog.showModError() —— 这一条没有任何设置能关，
 *      只能让它在发请求之前返回（见 blockRemoteFetch() 的注释）。
 * 代价：模组浏览器里不再显示远程模组列表，只显示本地已装的模组。
 * 想恢复远程列表就把这行改成 false 重新打包。
 */
var BLOCK_REMOTE_FETCH = true;

// ---------- HUD 按钮 ----------

/** 首次运行时按钮距左/距底的边距（设计像素） */
var BTN_MARGIN_LEFT = 16;
var BTN_MARGIN_BOTTOM = 160;
/** 量不到文字宽时的兜底宽度；实际宽度按「自定义面板」实测 */
var BTN_WIDTH = 96;
var BTN_HEIGHT = 40;

/** 存档键：HUD 按钮位置（绝对坐标，随游戏设置一起保存） */
var KEY_BTN_X = "cig-btn-x";
var KEY_BTN_Y = "cig-btn-y";

// ---------- 发放数量 ----------

var DEFAULT_AMOUNT = 1000;
var AMOUNT_PRESETS = [100, 1000, 10000, 100000];
var MAX_AMOUNT = 9999999;

// ---------- 自定义加速 ----------

/**
 * 每个类别一根独立滑条：0 = 关（默认）、1 = 原版速度（等效关）、最高 20 倍，整数步进。
 * 不再有全局「倍率」输入框 —— 倍率由每根滑条自己决定。
 */
var BOOST_SLIDER_MIN = 0;
var BOOST_SLIDER_MAX = 20;
var BOOST_SLIDER_STEP = 1;

/**
 * 写进 Building.timeScaleDuration 的余量，单位是 tick 而不是秒。
 * Building.update() 每帧头一步就是
 *   timeScaleDuration -= Time.delta; if(<= 0) timeScale = 1;
 * 所以这个值必须大于一帧的 Time.delta，本帧的加速才留得住；
 * 反过来，只要不再刷新（关掉加速、切到多人、脚本被卸载），
 * 最多 8 tick 就自动回落到原版速度，不需要任何「撤销」代码。
 */
var BOOST_DURATION = 8;

/** 走 Block.category 的六类加速，顺序即 boostCategoryIndex() 的返回值 0~5 */
var BOOST_CATEGORY_KEYS = ["distribution", "production", "crafting", "power", "turret", "units"];
/** 不走 category 的三个特殊类别下标 */
var BOOST_CAT_SHIELD = 6;
var BOOST_CAT_MENDER = 7;
var BOOST_CAT_BUILD = 8;
/** 界面标签：顺序 = category 六类 + 护盾 + 修复机 + 建造拆除，即 boostRates 的下标顺序 */
var BOOST_CATEGORY_LABELS = ["传送带", "挖矿", "制造", "发电", "炮塔", "单位工厂", "护盾", "修复机", "建造拆除"];

/** 长按按钮后判定为「拖动」的位移阈值（实际像素）：小于它松手算点击 */
var DRAG_THRESHOLD = 10;

// ---------- 面板排版 ----------
// 下面全部是设计像素，直接交给 Cell（见文件开头第 4 条），一律不再乘 px()。
// 带实测注释的几项由 initMetrics() 用真控件的 getPrefWidth() 覆盖：
// 格子必须刚好装得下当前语言、当前字号的文字，写死数字必然要么挤要么顶出框外。

var PAD_H = 16;           // 面板左右内边距
var PAD_V = 8;            // 区块上下间距
var GAP_S = 6;            // 行内间距
var ICON_S = 24;          // 物品图标
var ROW_H = 32;           // 卡片/控件统一高度
var ROW_MAX_H = 64;       // 物品少时一行最多拉多高，再高就成横幅了
var NAME_MIN = 64;        // 名称列至少留多宽
var NAME_MAX = 200;       // 名称列最多留多宽，再宽就成了名字和数量之间的走廊
var BUTTON_PAD = 16;      // 按钮实测文字宽之后补的内边距

var HELD_W = 88;          // 「已有 N」列，实测
var GIVE_W = 64;          // 「发放」按钮，实测
var PLUS_W = 40;          // 「+1」按钮，实测
var LABEL_W = 40;         // 行首标签列（搜索/数量/类别名…），实测
var AMOUNT_W = 88;        // 数量输入框，实测
var PRESET_W = 40;        // 预设按钮，实测
var ALL_W = 88;           // 「每种都发」，实测
var TAB_W = 72;           // 标签页按钮，实测
var CHECK_W = 96;         // 「开启加速」复选框，实测
var SLIDER_MIN_W = 90;    // 每类滑条的最小宽度（不实测：太窄了滑块按不住）
var VALUE_W = 44;         // 滑条行尾「×20 / 关」值列，实测
var VSCROLL_W = 24;       // 滚动区里那条竖向滚动条占掉的宽度，实测

/** 一张卡片里除名称列以外占掉的宽度：图标 + 4 段间距 + 已有 + 发放 + 加一 */
function cardFixedWidth(){
    return ICON_S + GAP_S * 4 + HELD_W + GIVE_W + PLUS_W;
}

/** 一行卡片之间的横向间距 */
var COL_GAP = 8;

/** 内容区尺寸下限（设计像素） */
var PANE_MIN_W = 380;
var PANE_MIN_H = 160;

/**
 * 面板上下被标题栏、标签页、状态行、操作条占掉的高度（设计像素）。
 * 实测拆项：标签行 32+8+6=46，状态行 21+6=27，操作条两行 45+45+6=96，
 * 内容底衬 8，标题栏 40，再留 20 余量 = 237，取整 252。
 * 列表高度 = 屏高 - 这一项，所以列表永远正好铺到屏幕下沿，不多不少。
 */
var PANEL_VERTICAL_CHROME = 252;

/** 标签页 */
var TAB_ITEMS = 0;
var TAB_BOOST = 1;

// ---------- 运行时状态 ----------

var panel = null;        // 悬浮窗，懒构建，只建一次
var tabCell = null;      // 标签页那一行的 Cell（宽度随屏幕变）
var bodyCell = null;     // 标签页内容区的 Cell
var bodyTable = null;    // 标签页内容容器（切换标签就整个重填）
var listTable = null;    // 「取物」页里的物品列表容器
var paneCell = null;     // 列表滚动区的 Cell（尺寸随屏幕变）
var statusCell = null;   // 状态行的 Cell
var tabBtnItems = null;  // 「取物」标签按钮
var tabBtnBoost = null;  // 「加速」标签按钮
var tabCellItems = null; // 两个标签按钮各自的 Cell（窄屏时宽度按屏宽分摊）
var tabCellBoost = null;
var btnEl = null;        // HUD 上的按钮元素
var dragListener = null; // 挂在按钮上的自建输入监听（点击 + 拖动二合一）
var btnPlaced = false;   // 按钮是否已经定位过（等 hudGroup 有真实尺寸才置真）
var btnDragging = false; // 按钮当前正被按住（拖动期间跳过边界回夹）
var dragMoved = false;   // 本次按压是否已越过拖动阈值（区分点击与拖动）
var dragPrevX = 0;
var dragPrevY = 0;
var dragStartX = 0;
var dragStartY = 0;
var matchedCount = 0;    // 当前列表匹配到的物品数量
var lastError = "";      // 上一次记录的错误，避免同一句刷屏
var activeTab = TAB_ITEMS;

// 输入框的值一律存在这里，而不是从控件里现取：切换标签会把控件整个重建，
// 只存在控件上的话，切一次标签就把用户填的数量、搜索词全洗掉了。
var amountText = String(DEFAULT_AMOUNT);
var searchText = "";

// 当前活着的那几个输入框控件（可能为 null，也可能随标签切换被换掉）：
// 只有预设按钮需要往回写文字，读值一律读上面两个字符串。
var amountField = null;

// 加速状态（只在本次游戏内有效，重开游戏一律回到「关闭」，免得不知不觉一直在加速）
var boostOn = false;
// 每类滑条的档位（0 ~ 20 整数），与 BOOST_CATEGORY_LABELS 同序。
// 0 = 关（默认），1 = 原版速度（等效关），扫描时只有 > 1 的档位才动手。
var boostRates = [0, 0, 0, 0, 0, 0, 0, 0, 0];
var boostApplied = 0;                  // 最近一轮扫描实际加速了多少座建筑
var boostHooked = false;
var catIndexCache = null;              // 方块名 -> 分类下标（-1 = 不参与加速）
var metricsReady = false;              // 字宽实测是否已经完成

// 建造/拆除加速改的是玩家单位的 buildSpeedMultiplier 公有字段。
// 先记下捕获时的原值：单位换了、加速关了都要按原值还原。
var buildBoostUnit = null;
var buildBoostBase = -1;

// ---------- 基础工具 ----------

/**
 * 把设计像素换算成当前界面缩放下的实际像素。
 * 只给直接作用于 Element 的 API 用（setSize / setPosition / x / y）；
 * Cell 的尺寸与间距方法自己会乘缩放，喂给它之前再调一次 px() 就是二次缩放。
 */
function px(value){
    return Scl.scl(value);
}

/** 当前界面缩放：1 设计像素 = dscale() 实际像素。取不到有效值时按 1 算。 */
function dscale(){
    var k = 0;
    try{
        k = Scl.scl();
    }catch(e){
        k = 0;
    }
    if(!(k > 0)) return 1;
    return k;
}

/**
 * global.js 提供了 cons/run/prov/boolp，但没有 Boolc 的包装（复选框的回调要它）。
 * 写法与它们一致：Rhino 的 JavaAdapter，方法名都是 get（arc.func.Boolc#get(boolean)）。
 */
function boolc(fn){
    return new Packages.arc.func.Boolc(){
        get: fn
    };
}

/**
 * 滑条回调要 arc.func.Floatc（javap 确认：接口里唯一方法 get(float)）。
 * global.js 同样没提供它的包装，写法与 boolc 一致。
 */
function floatc(fn){
    return new Packages.arc.func.Floatc(){
        get: fn
    };
}

/**
 * 实测一个控件在当前语言、当前字号下需要多宽，返回「设计像素」。
 * 做法是把它塞进一个用完就丢的 Table，读 getPrefWidth()（实际像素）再除以缩放。
 * 为什么要量而不是写死：模组注册的物品名长短能差好几倍，中文、英文、日文的占宽
 * 也完全不同，格子写死就一定出现「文字顶出框外」或者「右边空一大条」。
 * 量不出来（皮肤还没就绪等）返回 -1，调用方保留缺省值。
 */
function measureCellWidth(makeWidget){
    try{
        var parent = new Table();
        var targetCell = makeWidget(parent);
        // TextButton 构造器里给标签加的是 wrap()，窄按钮会折成两行而不是省略，
        // 而且折行之后 getPrefWidth() 量到的是折行之后的宽度，先关掉换行再量。
        if(targetCell.wrapLabel != null) targetCell.wrapLabel(false);
        var widget = targetCell.get();
        if(widget == null) return -1;
        var realPx = widget.getPrefWidth();
        if(!(realPx > 0) || isNaN(realPx)) return -1;
        return realPx / dscale();
    }catch(e){
        return -1;
    }
}

/** 量一段纯文字的宽度（设计像素） */
function measureText(text){
    return measureCellWidth(function(probeTable){
        return probeTable.add(text);
    });
}

/** 量一个按钮的宽度：文字宽 + 补出来的内边距 */
function measureButton(text){
    var bareWidth = measureCellWidth(function(probeTable){
        return probeTable.button(text, run(function(){}));
    });
    if(bareWidth < 0) return -1;
    return bareWidth + BUTTON_PAD;
}

/** 量一个复选框的宽度（含方框与间距，CheckBox 的 getPrefWidth 已经带上） */
function measureCheck(text){
    return measureCellWidth(function(probeTable){
        return probeTable.check(text, false, boolc(function(){}));
    });
}

/** 量一个输入框的宽度：TextField 自己带样式最小宽，只量文字会量窄一截 */
function measureField(text){
    return measureCellWidth(function(probeTable){
        return probeTable.field(text, cons(function(){}));
    });
}

/**
 * 量滚动区那条竖向滚动条占掉的宽度。
 * 必须量：卡片宽度 = 列表宽 - 这条宽度，少算一点最后一列（+1）就被裁掉半截。
 * ScrollPane 只有在内容真的超高（scrollY 为真）时才报得出宽度，所以里面塞一个
 * 两千高的占位行；量不到就返回 -1，调用方保留缺省值。
 */
function measureVScroll(){
    try{
        var inner = new Table();
        inner.add("").height(2000);
        var pane = new Packages.arc.scene.ui.ScrollPane(inner);
        pane.setSize(300, 200);
        pane.validate();
        var realPx = pane.getScrollBarWidth();
        if(!(realPx > 0) || isNaN(realPx)) return -1;
        return realPx / dscale();
    }catch(e){
        return -1;
    }
}

/** 一组文字里挑最宽的实测值；全都量不到就用 fallback */
function widestFallback(values, fallback){
    var best = -1;
    for(var i = 0; i < values.length; i++){
        if(values[i] > best) best = values[i];
    }
    return best > 0 ? Math.ceil(best) : fallback;
}

/**
 * 把排版格子按真实字宽定下来，只跑一次。
 * 必须在界面与皮肤就绪之后（ClientLoadEvent 之后）才能量得到，
 * 所以由 currentLayout() 懒触发，而不是在脚本加载时跑。
 */
function initMetrics(){
    if(metricsReady) return;
    metricsReady = true;

    var heldWidth = measureText("已有 9999999");
    if(heldWidth > 0) HELD_W = Math.ceil(heldWidth);

    var giveWidth = measureButton("发放");
    if(giveWidth > 0) GIVE_W = Math.ceil(giveWidth);

    var plusWidth = measureButton("+1");
    if(plusWidth > 0) PLUS_W = Math.ceil(plusWidth);

    var sendAllWidth = measureButton("每种都发");
    if(sendAllWidth > 0) ALL_W = Math.ceil(sendAllWidth);

    var tabWidths = [];
    tabWidths.push(measureButton("取物"));
    tabWidths.push(measureButton("加速"));
    var tabWidth = widestFallback(tabWidths, TAB_W);
    if(tabWidth > 0) TAB_W = tabWidth;

    var presets = [];
    var p;
    for(p = 0; p < AMOUNT_PRESETS.length; p++){
        presets.push(measureButton(presetLabel(AMOUNT_PRESETS[p])));
    }
    var presetW = widestFallback(presets, PRESET_W);
    if(presetW > 0) PRESET_W = presetW;

    var checkW = measureCheck("开启加速");
    if(checkW > 0) CHECK_W = Math.ceil(checkW);

    // 加速页每行行首是类别名，和「搜索/数量」标签列对齐成同一列宽
    var labels = [];
    labels.push(measureText("搜索"));
    labels.push(measureText("数量"));
    for(p = 0; p < BOOST_CATEGORY_LABELS.length; p++){
        labels.push(measureText(BOOST_CATEGORY_LABELS[p]));
    }
    var labelW = widestFallback(labels, LABEL_W);
    if(labelW > 0) LABEL_W = labelW + GAP_S;

    var valueW = measureText("×20");
    if(valueW > 0) VALUE_W = Math.ceil(valueW) + GAP_S;

    // 输入框：取「装得下 7 位数字」和「TextField 自己的偏好宽」里大的那个。
    // 上一版只按文字量出 125，可控件的偏好宽是 150 —— 格子比控件还窄，
    // 数字当然顶到框外面，这就是「字体会超出去」的直接原因。
    var sampleWidth = measureText("0000000");
    var fieldWidth = measureField("0000000");
    if(fieldWidth > 0) AMOUNT_W = Math.ceil(fieldWidth);
    if(sampleWidth > 0 && Math.ceil(sampleWidth) + 8 > AMOUNT_W){
        AMOUNT_W = Math.ceil(sampleWidth) + 8;
    }

    var scrollWidth = measureVScroll();
    if(scrollWidth > 0) VSCROLL_W = Math.ceil(scrollWidth);

    // Table 布局没有「挤不下就缩短」这一步，固定列加起来超过格子宽就直接顶出去，
    // 所以把两个页面里最挤的一行按实测宽度累加出来，当内容区宽度的下限。
    var itemsRow = LABEL_W + GAP_S + AMOUNT_W + GAP_S
        + AMOUNT_PRESETS.length * (PRESET_W + GAP_S) + ALL_W + 8;
    // 加速页最挤的一行：类别标签 + 滑条最小宽 + 值列
    var boostRow = LABEL_W + GAP_S + SLIDER_MIN_W + GAP_S + VALUE_W + 8;
    // 单列卡片行的下限：图标 + 已有 + 发放 + +1 + 名称列最小宽
    var cardMin = cardFixedWidth() + NAME_MIN;
    PANE_MIN_W = Math.ceil(Math.max(itemsRow, boostRow, cardMin));
}

/**
 * 夹到 [low, high]。
 * high < low 是「尺寸还没生效」的信号（比如屏幕宽 0 时 high = 0 - 元素宽 = 负数），
 * 这时必须退回 low：上一版没管这个情况，把按钮算成了 x=-104，
 * 于是每次启动按钮都被甩到屏幕外、拖动也永远夹在一个空区间里 —— 看起来就是拖不动。
 */
function clamp(value, low, high){
    if(high < low) return low;
    if(value < low) return low;
    if(value > high) return high;
    return value;
}

/** 包一层异常防护：错误只进日志，绝不让游戏把模组禁用掉。
 *  arguments 原样转出去：Cons/Boolc 这类回调是要收参数的（新文本、新勾选状态）。
 *  返回值也必须原样转出去：状态行是 prov(safe(...)) 包出来的，
 *  吞掉返回值就等于让 Label 每帧显示 "undefined"。 */
function safe(tag, fn){
    return function(){
        try{
            return fn.apply(null, arguments);
        }catch(e){
            var msg = tag + "出错：" + e;
            if(e && e.lineNumber) msg += "（main.js 第 " + e.lineNumber + " 行）";
            if(msg != lastError){
                lastError = msg;
                print(MOD_NAME + "：" + msg);
            }
        }
    };
}

/** 弹一条游戏内提示；界面尚未就绪时退回日志 */
function notice(text){
    try{
        Vars.ui.showInfoFade(text);
    }catch(e){
        print(MOD_NAME + "：" + text);
    }
}

/** 物品显示名：优先本地化名（跟随游戏语言，中文客户端即中文名） */
function itemName(item){
    var named = item.localizedName;
    if(named == null || String(named).length == 0) return String(item.name);
    return String(named);
}

/** 物品图标；某些模组物品没打包 uiIcon，回落到 fullIcon */
function itemIcon(item){
    if(item.uiIcon != null) return item.fullIcon == null ? null : item.uiIcon;
    return item.fullIcon;
}

/** 预设按钮上的短标签：1000 -> 1k，100000 -> 100k */
function presetLabel(value){
    if(value < 1000) return String(value);
    var k = value / 1000;
    return (k == Math.floor(k) ? String(k) : String(k)) + "k";
}

/** 当前是否在多人客户端里。本模组只支持单人（含自己当主人的听服地图）。 */
function isClient(){
    try{
        return Vars.net != null && Vars.net.client();
    }catch(e){
        return false;
    }
}

/** 当前地图本队的所有核心建筑，取不到返回 null */
function teamCores(){
    if(Vars.state == null || Vars.player == null) return null;
    if(!Vars.state.isPlaying()) return null;
    var cores = Vars.state.teams.cores(Vars.player.team());
    if(cores == null || cores.size <= 0) return null;
    return cores;
}

/** 本队核心仓库里已有多少该物品（多核心累加） */
function heldAmount(item){
    var cores = teamCores();
    if(cores == null) return 0;
    var total = 0;
    for(var i = 0; i < cores.size; i++){
        total += cores.get(i).items.get(item);
    }
    return total;
}

/**
 * 舞台尺寸（实际像素，不是设计像素）。
 * ClientLoadEvent 触发时 hudGroup 还是 0x0（日志实测），所以任何定位都不能
 * 在初始化时一次算死，必须每次用到时现取；两个来源都取不到有效值就返回 0，
 * 调用方据此推迟这一帧的动作。
 */
function stageSize(){
    var w = 0;
    var h = 0;
    try{
        if(Core.scene != null){
            w = Core.scene.getWidth();
            h = Core.scene.getHeight();
        }
    }catch(e){
        w = 0; h = 0;
    }
    return {w: w, h: h};
}

/** 舞台尺寸换算成设计像素，好和排版常量放在同一个量纲里比 */
function stageDesignSize(){
    var s = stageSize();
    var k = dscale();
    return {w: s.w / k, h: s.h / k};
}

// ---------- 布局计算 ----------

/**
 * 按当前舞台尺寸算出内容区该多宽、列表该多高，全部是设计像素。
 * 面板是铺满整屏的原版对话框，所以内容宽度就是「屏宽减左右内边距」，
 * 不再有任何上限：上一版这里写死了 760，1536 宽的屏幕只用了一半，
 * 剩下的全空，看上去就是「窝在一个角落里」。
 */
function currentLayout(){
    initMetrics();

    var view = stageDesignSize();
    var bodyWidth = PANE_MIN_W;
    var listHeight = PANE_MIN_H;

    if(view.w > 0){
        bodyWidth = Math.max(PANE_MIN_W, view.w - 2 * PAD_H);
    }
    if(view.h > 0){
        listHeight = Math.max(PANE_MIN_H, view.h - PANEL_VERTICAL_CHROME);
    }

    bodyWidth = Math.floor(bodyWidth);
    listHeight = Math.floor(listHeight);

    // 列表在 ScrollPane 里面，可视宽 = 格子宽 - 竖滚动条宽。
    // 卡片按格子宽排就会超出可视宽，最后一列被裁掉半截 —— 实机截图里就是这样。
    var rowWidth = bodyWidth - VSCROLL_W;

    return {
        bodyWidth: bodyWidth,
        listHeight: listHeight,
        rowWidth: rowWidth
    };
}

// ---------- 发放 ----------

/** 多人客户端里的统一拒绝提示 */
function refuseMultiplayer(){
    notice("多人游戏里物品由服务器管理，本模组只在单人地图（或你自己当主人的图）里发放。");
    return false;
}

/**
 * 把指定数量的物品放进本队第一个核心仓库（HUD 左上角显示的就是它）。
 * 没有核心时退化成放进当前单位的手持栏。返回是否发放成功。
 */
function giveItem(item, amount){
    if(!(amount > 0)) return false;

    // 只支持单人：客户端改本地数据会被服务器同步覆盖，Call.setItem 又需要
    // 管理员权限，与其静默失败不如明确不支持。
    if(isClient()) return false;

    var cores = teamCores();
    if(cores != null){
        cores.first().items.add(item, amount);
        return true;
    }

    var unit = Vars.player.unit();
    if(unit != null){
        // 手持栏一次只能装一种物品，且受单位载货量限制。
        // 比较用 id 而不是对象引用：Rhino 会把 Java 对象包成包装器，
        // 同一个 Item 两次取出来包装器不同，== 可能判成不相等。
        var carried = unit.item();
        if(!unit.hasItem() || carried == null || carried.id == item.id){
            unit.addItem(item, amount);
            notice("地图上没有本队核心，已放入手持栏；超出载货量的部分会被丢弃。");
            return true;
        }
        notice("手持栏里已经装了别的物品，先按 Q 放下再发放。");
        return false;
    }

    notice("这张地图没有本队核心，你也没有操控单位，无处存放物品。");
    return false;
}

/** 数量：非法输入一律当 0；空输入按「没填」处理，调用方会提示 */
function readAmount(){
    var parsed = parseInt(amountText, 10);
    if(isNaN(parsed) || parsed < 0) parsed = 0;
    if(parsed > MAX_AMOUNT) parsed = MAX_AMOUNT;
    return parsed;
}

/** 按当前数量给每种可见物品发一份 */
function giveEveryItem(amount){
    if(isClient()){
        refuseMultiplayer();
        return;
    }
    var items = Vars.content.items();
    var given = 0;
    for(var i = 0; i < items.size; i++){
        var item = items.get(i);
        if(item.isHidden()) continue;
        if(giveItem(item, amount)) given++;
    }
    if(given > 0){
        notice("已对 " + given + " 种物品各发放 " + amount + "。核心容量不够时超出部分会被裁剪。");
    }else{
        notice("没有发放任何物品：这张地图可能还没有本队核心，也没有可装载物品的单位。");
    }
}

// ---------- 取物列表 ----------

/**
 * 一张物品卡片：图标 | 名称 | 已有 N | 发放 | +1
 * 每一列都用 width() 钉死（min == max，Table 布局会把它当固定列，见文件开头第 5 条），
 * 名称列宽由调用方按「当前这批名字里最宽的那个」实测给出，所以卡片总宽是紧凑的，
 * 名字后面不会拖出一条空白走廊，多出来的宽度由列间距摊到整行。
 * rowHeight 也一样传进来：物品少时行要高一些，列表才竖向也铺得开。
 * item 是函数参数，所以每个卡片各自持有自己的绑定，ES5 闭包不会串。
 */
function buildCard(item, nameWidth, rowHeight){
    var card = new Table();
    card.left().top();

    var h = rowHeight == null ? ROW_H : rowHeight;
    var buttonHeight = Math.max(ROW_H, h - 4);

    // 图标不跟着行高放大：卡片总宽是按 ICON_S 算死的，放大图标就会顶破格子。
    var icon = itemIcon(item);
    if(icon != null){
        card.image(prov(function(){ return icon; })).size(ICON_S).padRight(GAP_S);
    }else{
        // 没有图标的物品留个同尺寸空位，保证各列对齐
        card.add("").size(ICON_S).padRight(GAP_S);
    }

    // ellipsis(true) 让超长的名字（模组物品能长到十几个字）截断成「铜合金板…」，
    // 而不是把后面的按钮一路顶到卡片外面 —— 上一版这里只写了 minWidth，
    // 不换行的 Label 把整行文字的宽度当成自己的偏好宽度，于是整行被撑爆。
    card.add(itemName(item)).width(nameWidth).left().ellipsis(true).padRight(GAP_S);

    // label(Prov) 每帧重新求值，所以持有数量是实时刷新的
    card.label(prov(function(){
        return "已有 " + heldAmount(item);
    })).width(HELD_W).ellipsis(true).padRight(GAP_S);

    // 按钮默认是 wrap()，格子比文字窄时折成两行，看起来就是一堆挤在一起；
    // 换成不换行 + 省略号，宽度就永远守得住 ROW_H。
    card.button("发放", run(safe("发放", function(){
        if(isClient()){
            refuseMultiplayer();
            return;
        }
        var amount = readAmount();
        if(amount <= 0){
            notice("请先在上方填写大于 0 的数量。");
            return;
        }
        if(giveItem(item, amount)){
            notice("已获得 " + itemName(item) + " ×" + amount + "，已放进核心仓库。");
        }
    }))).size(GIVE_W, buttonHeight).wrapLabel(false).ellipsis(true);

    card.button("+1", run(safe("加一", function(){
        if(isClient()){
            refuseMultiplayer();
            return;
        }
        giveItem(item, 1);
    }))).size(PLUS_W, buttonHeight).wrapLabel(false).ellipsis(true).padLeft(GAP_S);

    return card;
}

/**
 * 按搜索关键词重填列表容器（只动列表，不动操作条，输入框焦点才不会丢）。
 * 排法是「一行几列 + 列间距摊平」：
 * 卡片宽先按当前这批名字里最宽的那个实测出来（不超过 NAME_MAX），
 * 一行能塞几列塞几列，剩下的宽度平均分成列间距，
 * 于是第一列贴左、最后一列贴右，行里没有空白走廊，也没有横向滚动条。
 * 只动列表，不动操作条，输入框焦点才不会丢。
 */
function fillItemList(){
    if(listTable == null) return;

    var sizes = currentLayout();

    listTable.clearChildren();
    listTable.left().top();
    matchedCount = 0;

    var keyword = String(searchText).trim().toLowerCase();
    var items = Vars.content.items();
    var matched = [];
    var widestName = 0;
    for(var i = 0; i < items.size; i++){
        var item = items.get(i);
        if(item.isHidden()) continue;

        var name = itemName(item).toLowerCase();
        if(keyword.length > 0 && name.indexOf(keyword) < 0
            && String(item.name).toLowerCase().indexOf(keyword) < 0){
            continue;
        }
        matchedCount++;
        matched.push(item);

        var namePx = measureText(itemName(item));
        if(namePx > widestName) widestName = namePx;
    }

    if(matchedCount == 0){
        listTable.add("没有匹配的物品。").width(sizes.rowWidth).ellipsis(true).top().row();
        return;
    }

    var nameWidth = clamp(Math.ceil(widestName), NAME_MIN, NAME_MAX);
    var cardWidth = cardFixedWidth() + nameWidth;
    var columns = Math.floor((sizes.rowWidth + COL_GAP) / (cardWidth + COL_GAP));
    if(columns < 1) columns = 1;

    // 摊平列间距：每行最后一列不留间距，所以一行正好 = cardWidth*列数 + 间距*(列数-1)
    var gap = COL_GAP;
    if(columns > 1){
        gap = Math.max(COL_GAP, Math.floor((sizes.rowWidth - cardWidth * columns) / (columns - 1)));
    }

    // 行高：物品少的时候把列表区竖向也铺满，不然屏幕下半截全是空的。
    // 最多 64，再多就成了一条条横幅；物品多到放不下时回到 ROW_H 并开始滚动。
    var rows = Math.ceil(matched.length / columns);
    var rowHeight = clamp(Math.floor(sizes.listHeight / rows), ROW_H, ROW_MAX_H);

    for(var c = 0; c < matched.length; c++){
        var cell = listTable.add(buildCard(matched[c], nameWidth, rowHeight))
            .size(cardWidth, rowHeight).top();
        if((c + 1) % columns != 0){
            cell.padRight(gap);
        }else{
            cell.row();
        }
    }
    // 最后一行没凑满一整列时，上面那句 row() 没被触发，补一次
    if(matched.length % columns != 0){
        listTable.row();
    }
}

// ---------- 操作条 ----------

/** 把数量写回字符串，再顺手写回当前活着的那个输入框。
 *  字符串才是根：切一次标签控件就整个换一批，只写控件等于把用户填的洗掉。 */
function setAmountValue(text){
    amountText = text;
    if(amountField != null){
        try{
            amountField.setText(text);
        }catch(e){
            print(MOD_NAME + "：数量写回输入框失败：" + e);
        }
    }
}

/** 数量预设按钮。单独抽成函数是为了让 value 成为独立的作用域绑定 ——
 *  ES5 里直接在 for 循环里建闭包会共享同一个变量，全部按最后一次的值生效。 */
function addPresetButton(slot, value){
    slot.button(presetLabel(value), run(safe("预设 " + value, function(){
        setAmountValue(String(value));
    }))).size(PRESET_W, ROW_H).wrapLabel(false).ellipsis(true).padRight(GAP_S);
}

/** 数量输入框，只收数字 */
function addAmountField(slot){
    var inputCell = slot.field(amountText, cons(safe("数量变化", function(text){
        amountText = String(text);
    })));
    amountField = inputCell.get();
    amountField.setMaxLength(9);
    amountField.setFilter(TextField.TextFieldFilter.digitsOnly);
    inputCell.width(AMOUNT_W).padRight(GAP_S);
}

/** 搜索输入框。改动只重填列表、不重建操作条：否则每敲一个字就把正在输入的
 *  控件拆掉，光标和输入法都断了。宽度 growX 把这一行剩下的宽度全吃掉，
 *  操作条和下面的列表才左右对齐、右边不留白。 */
function addSearchField(slot){
    var inputCell = slot.field(searchText, cons(safe("搜索", function(text){
        searchText = String(text);
        fillItemList();
    })));
    inputCell.get().setMaxLength(30);
    inputCell.minWidth(90).growX();
}

/** 每种都发 */
function addGiveAllButton(slot){
    slot.button("每种都发", run(safe("每种都发", function(){
        var amount = readAmount();
        if(amount <= 0){
            notice("请先填写大于 0 的数量。");
            return;
        }
        giveEveryItem(amount);
    }))).size(ALL_W, ROW_H).wrapLabel(false).ellipsis(true);
}

/**
 * 顶部操作条：搜索、数量各占一个独立 Table。
 * 两行必须分开建：Table 的列是跨行共享的，把「搜索 + 一个 growX 输入框」
 * 和「数量 + 输入框 + 五个按钮」塞进同一个 Table，第一行那个撑开的列会把
 * 第二行的数量输入框顶到中间去（实机 dump：数量框跑到 x=445），
 * 于是看上去就是「字对不齐、中间空一大块」。
 */
function buildToolbar(){
    var searchRow = new Table();
    searchRow.left().top();
    searchRow.add("搜索").width(LABEL_W).ellipsis(true).padRight(GAP_S);
    addSearchField(searchRow);

    var amountRow = new Table();
    amountRow.left().top();
    amountRow.add("数量").width(LABEL_W).ellipsis(true).padRight(GAP_S);
    addAmountField(amountRow);
    for(var p = 0; p < AMOUNT_PRESETS.length; p++){
        addPresetButton(amountRow, AMOUNT_PRESETS[p]);
    }
    // 「每种都发」贴右边缘：中间垫一个 growX 空列，把余量全吃掉
    amountRow.add("").growX();
    addGiveAllButton(amountRow);

    var slot = new Table();
    slot.left().top();
    slot.add(searchRow).growX().padBottom(GAP_S).row();
    slot.add(amountRow).growX();
    return slot;
}

/** 「取物」页：操作条 + 单列可滚动列表 */
function buildItemsBody(parent, sizes){
    parent.add(buildToolbar()).width(sizes.bodyWidth).padBottom(GAP_S).row();

    listTable = new Table();
    listTable.left().top();
    paneCell = parent.pane(listTable);
    // 关掉横向滚动：卡片宽度就是按这个宽度算出来的，本来就不该有横向内容
    paneCell.get().setScrollingDisabledX(true);
    paneCell.size(sizes.bodyWidth, sizes.listHeight).row();

    fillItemList();
}

// ---------- 自定义加速 ----------

/**
 * block.category -> 加速分类下标，-1 表示这种方块不参与加速。
 * 按 category 而不是 instanceof：Forge 版把大量方块改成直接继承
 * mindustry.world.Block（实测 Router/Junction/ItemBridge 不再是 Conveyor 的子类，
 * BeamDrill/BurstDrill 不再是 Drill 的子类），靠继承链分类会漏掉一多半传送带和钻头；
 * category 是原版给每个方块都填好的字段，模组方块也照常填。
 *
 * 六个 category 档对应到 160.7 的实际内容（把 mindustry.content.Blocks$NNN 的字节码
 * 全扫了一遍，按「基类 -> requirements(Category.x, ...) 里的 x」统计出来的，不是猜的；
 * 每档后面括号里是方块定义数，括号外的基类都实测过 update 走 delta()/edelta()）：
 *   distribution(28) = Conveyor/Router/Junction/ItemBridge/MassDriver/Unloader…，「传送带」；
 *   production(14)   = Drill/BurstDrill/BeamDrill/Fracker/SolidPump/WallCrafter/AttributeCrafter，
 *                      全是「从地上/从墙里取资源」的钻头类，「挖矿」；熔炉化工厂在 crafting 档，
 *                      只推「挖矿」滑条时它们一秒都不快。
 *   crafting(36)     = GenericCrafter(17)/HeatCrafter/HeatProducer/Separator/Incinerator…，
 *                      熔炉、化工厂、玻璃/硅制造机、分离器，「制造」。
 *   power(25)        = 电源线/节点/二极管/电池 + 全部发电机与反应堆，「发电」
 *                      （线路类没有计时行为，推了也没有可见效果）。
 *   turret(28)       = ItemTurret/LiquidTurret/LaserTurret/PowerTurret/ContinuousTurret 等，
 *                      TurretBuild 的装填计时走 delta()，「炮塔」射速变快。
 *   units(35)        = UnitFactory/Reconstructor/UnitAssembler/Constructor 等单位生产与
 *                      重构建筑，计时走 delta()/edelta()，「单位工厂」。
 *                      （这一档里还混着 PayloadConveyor 等载荷搬运类，canOverdrive=false，
 *                      applyBoost 第一行就把它们挡掉，无害。）
 * 另外三个类别不走 category：
 *   护盾（下标 6）= 沿继承链找 ForceProjector。护盾投影仪在 effect 档（和雷达、核心、
 *       加速投影仪混在一起，不能整档拿来用），而这个 jar 里已经没有 ShieldProjector 类，
 *       大小护盾都是 ForceProjector；ForceBuild 的护盾回充计时走 delta()，applyBoost 直接有效。
 *   修复机（下标 7）= 沿继承链找 MendProjector（恢复/维修投影仪），同样在 effect 档，
 *       MendBuild 的工作计时走 delta()；模组的维修机只要是它的子类也一并命中。
 *   建造拆除（下标 8）= 不作用于任何建筑，改的是玩家单位的
 *       buildSpeedMultiplier 字段，见 applyBuildBoost()。
 * 两个边界记在这里：液体管道(Conduit)填的是 liquid，字节码里 update 完全不引用
 * delta() —— 引擎不吃 timeScale；载荷传送带(PayloadConveyor) canOverdrive=false。
 * 这两类滑条推到几档都不会变快，是原版的限制，不是本模组漏做。
 * 结果按方块名缓存（名字在同类内容里唯一，换图重载内容也不会串），
 * 每帧扫描只剩一次字符串哈希。
 */
function classChainHas(block, simpleName){
    try{
        var cls = block.getClass();
        while(cls != null){
            if(String(cls.getSimpleName()) == simpleName) return true;
            cls = cls.getSuperclass();
        }
    }catch(e){
        print(MOD_NAME + "：方块类别识别失败：" + e);
    }
    return false;
}

function boostCategoryIndex(block){
    if(catIndexCache == null) catIndexCache = {};
    var blockKey = String(block.name);
    var cached = catIndexCache[blockKey];
    if(cached !== undefined) return cached;

    var result = -1;
    var cat = block.category;
    if(cat != null){
        var catKey = String(cat.name()).toLowerCase();
        for(var i = 0; i < BOOST_CATEGORY_KEYS.length; i++){
            if(BOOST_CATEGORY_KEYS[i] == catKey){
                result = i;
                break;
            }
        }
    }
    if(result < 0){
        if(classChainHas(block, "ForceProjector")) result = BOOST_CAT_SHIELD;
        else if(classChainHas(block, "MendProjector")) result = BOOST_CAT_MENDER;
    }
    catIndexCache[blockKey] = result;
    return result;
}

/**
 * 一轮扫描：给本阵营的建筑贴上加速。
 * 用的是引擎自己的 Building.applyBoost(boost, duration) —— 超频投影仪走的也是它，
 * 字节码里它是 timeScale = Math.max(timeScale, boost)，所以只会往上取，
 * 永远不会把别处已经给得更高的加速压下去；开头那句 if(!block.canOverdrive) return
 * 又替我们把不该加速的方块挡在外面。
 * 敌方建筑根本不在遍历范围里，下一波计时也不经过这里，两者都是原版速度。
 * 建造拆除走单位字段，单独处理（见 applyBuildBoost）。
 */
function sweepBoost(){
    boostApplied = 0;
    if(!boostOn || isClient()){
        resetBuildBoost();
        return;
    }
    if(Vars.player == null || Vars.state == null || !Vars.state.isPlaying()){
        resetBuildBoost();
        return;
    }

    // 建造拆除不依赖建筑列表：单位在就能改，team 数据取不到也不影响它
    var buildRate = boostRates[BOOST_CAT_BUILD];
    if(buildRate > 1){
        applyBuildBoost(buildRate);
    }else{
        resetBuildBoost();
    }

    var data = Vars.state.teams.getOrNull(Vars.player.team());
    if(data == null) return;

    var list = data.buildings;
    for(var i = 0; i < list.size; i++){
        var b = list.get(i);
        if(b == null || b.block == null) continue;
        var idx = boostCategoryIndex(b.block);
        if(idx < 0) continue;
        var rate = boostRates[idx];
        if(rate <= 1) continue;
        b.applyBoost(rate, BOOST_DURATION);
        boostApplied++;
    }
}

/**
 * 建造/拆除加速：直接改玩家单位的 buildSpeedMultiplier 公有字段。
 * 两个要点：
 * 1) Rhino 的属性查找公有字段优先于同名方法（与 Element.visible 同一个坑），
 *    所以这里按字段读写，绝不调 unit.buildSpeedMultiplier()。
 * 2) 全 jar 扫描确认没有别的代码每帧重写这个字段（Logic 只写 TeamRule，
 *    StatusEntry 只在状态增减时写），所以每 tick 末尾写 base*rate 是稳定的；
 *    代价是它不像 timeScale 那样会自动回落，关闭/换单位必须显式还原。
 */
function applyBuildBoost(rate){
    try{
        var unit = Vars.player.unit();
        if(unit == null) return;
        // Unit.id 是公有字段（public transient int id），Rhino 里字段挡方法，
        // 所以按字段读（unit.id() 反而会被挡住报错）。
        // Rhino 的 Java 包装器不保证同一对象两次取出 ===，所以用实体 id 比较。
        if(buildBoostUnit != null && buildBoostUnit.id != unit.id){
            resetBuildBoost();
        }
        if(buildBoostUnit == null){
            var base = unit.buildSpeedMultiplier;
            if(!(base > 0)) base = 1;
            buildBoostBase = base;
            buildBoostUnit = unit;
        }
        unit.buildSpeedMultiplier = buildBoostBase * rate;
    }catch(e){
        print(MOD_NAME + "：建造加速失败：" + e);
    }
}

/** 把捕获过的单位还原回原版建造倍率 */
function resetBuildBoost(){
    if(buildBoostUnit == null) return;
    try{
        buildBoostUnit.buildSpeedMultiplier = buildBoostBase;
    }catch(e){
        print(MOD_NAME + "：建造倍率还原失败：" + e);
    }
    buildBoostUnit = null;
    buildBoostBase = -1;
}

/** 只挂一次：beforeGameUpdate 在游戏逻辑里每帧触发，早于建筑自己的 update() */
function registerBoostHook(){
    if(boostHooked) return;
    try{
        Events.run(EventType.Trigger.beforeGameUpdate, run(safe("加速扫描", sweepBoost)));
        boostHooked = true;
        print(MOD_NAME + "：加速扫描已挂到 beforeGameUpdate。");
    }catch(e){
        print(MOD_NAME + "：加速扫描挂载失败，加速功能不可用：" + e);
    }
}

/** 状态行里的加速摘要 */
function boostSummary(){
    if(isClient()) return "多人客户端不加速，速度由服务器决定";
    if(!boostOn) return "未开启，所有建筑都是原版速度";

    var parts = [];
    for(var i = 0; i < BOOST_CATEGORY_LABELS.length; i++){
        if(boostRates[i] > 1) parts.push(BOOST_CATEGORY_LABELS[i] + "×" + boostRates[i]);
    }
    if(parts.length == 0) return "已开启，但所有滑条都在 0 或 1，等于没加速";
    return "已开启 · " + parts.join("、") + " · 我方 " + boostApplied + " 座建筑";
}

/** 往内容容器里加一整行：宽度钉死成 rowWidth，行里的控件才撑不破面板 */
function addRow(parent, rowWidth){
    var rowBox = new Table();
    rowBox.left().top();
    parent.add(rowBox).width(rowWidth).padBottom(GAP_S).row();
    return rowBox;
}

/**
 * 一根类别滑条行：类别名 | 滑条（0 ~ 20，整数步进）| 当前档位。
 * index 是函数参数，每根滑条各自绑自己的下标，ES5 闭包不会串。
 * 拖动中回调会连续触发，只写 boostRates[index]，扫描下一 tick 自然跟上。
 */
function addBoostSlider(parent, rowWidth, index){
    var rowBox = addRow(parent, rowWidth);
    rowBox.add(BOOST_CATEGORY_LABELS[index]).width(LABEL_W).ellipsis(true).padRight(GAP_S);
    var sliderCell = rowBox.slider(BOOST_SLIDER_MIN, BOOST_SLIDER_MAX, BOOST_SLIDER_STEP,
        boostRates[index],
        floatc(safe("加速滑条 " + index, function(v){
            boostRates[index] = Math.round(v);
        })));
    sliderCell.minWidth(SLIDER_MIN_W).growX().padRight(GAP_S);
    rowBox.label(prov(safe("加速档位 " + index, function(){
        var r = boostRates[index];
        return r > 1 ? "×" + r : "关";
    }))).width(VALUE_W).ellipsis(true);
}

/**
 * 「加速」页：总开关 + 每类一根滑条 + 几句说明。
 * 9 根滑条加说明一共十几行，手机横屏放不下，所以整页装进 ScrollPane，
 * 和取物页同款：行宽 = 内容宽 - 竖滚动条宽，关掉横向滚动。
 */
function buildBoostBody(parent, sizes){
    var inner = new Table();
    inner.left().top();
    var rowWidth = sizes.bodyWidth - VSCROLL_W;

    var rowBox = addRow(inner, rowWidth);
    rowBox.check("开启加速", boostOn, boolc(safe("加速开关", function(on){
        boostOn = on;
    }))).wrapLabel(false).ellipsis(true);

    for(var c = 0; c < BOOST_CATEGORY_LABELS.length; c++){
        addBoostSlider(inner, rowWidth, c);
    }

    rowBox = addRow(inner, rowWidth);
    rowBox.add("0 或 1 = 原版速度；档位越高越快，燃料与电力消耗也按档位一起涨。")
        .width(rowWidth).ellipsis(true);

    rowBox = addRow(inner, rowWidth);
    rowBox.add("液体管道和载荷传送带是原版引擎不支持加速的两类，推到几档都不会变快。")
        .width(rowWidth).ellipsis(true);

    rowBox = addRow(inner, rowWidth);
    rowBox.add("建造拆除改玩家单位速度；护盾、修复机改投影仪节拍。只加速我方，敌方与下一波计时保持原版。")
        .width(rowWidth).ellipsis(true);

    var boostPaneCell = parent.pane(inner);
    boostPaneCell.get().setScrollingDisabledX(true);
    boostPaneCell.size(sizes.bodyWidth, sizes.listHeight).row();
}

// ---------- 状态行 ----------

function statusText(){
    if(activeTab == TAB_BOOST) return "加速页 · " + boostSummary();
    if(isClient()) return "取物页 · 共 " + matchedCount + " 种 · 多人客户端不发放";
    return "取物页 · 共 " + matchedCount + " 种 · 每次发放 " + readAmount();
}

// ---------- 悬浮窗 ----------

/** 标签页那一行：两个页名按钮，当前页按下高亮 */
function buildTabBar(){
    var tabRow = new Table();
    tabRow.left().top();

    tabCellItems = tabRow.button("取物", run(safe("切到取物页", function(){
        switchTab(TAB_ITEMS);
    }))).size(TAB_W, ROW_H).wrapLabel(false).ellipsis(true).padRight(GAP_S);
    tabBtnItems = tabCellItems.get();

    tabCellBoost = tabRow.button("加速", run(safe("切到加速页", function(){
        switchTab(TAB_BOOST);
    }))).size(TAB_W, ROW_H).wrapLabel(false).ellipsis(true);
    tabBtnBoost = tabCellBoost.get();

    return tabRow;
}

function switchTab(index){
    if(activeTab == index) return;
    activeTab = index;
    refillBody();
}

/** 高亮当前页。就算默认按钮样式没有 checked 图（按下才看得见），
 *  状态行开头也写着「取物页 / 加速页」，用户总看得出自己在哪一页。 */
function refreshTabs(){
    try{
        if(tabBtnItems != null) tabBtnItems.setChecked(activeTab == TAB_ITEMS);
        if(tabBtnBoost != null) tabBtnBoost.setChecked(activeTab == TAB_BOOST);
    }catch(e){
        print(MOD_NAME + "：标签高亮失败（不影响使用）：" + e);
    }
}

/**
 * 按当前标签页重填内容区，并把三段宽度对齐到当前屏幕。
 * 切标签、改分辨率、每次打开面板都走这里：内容整个重建，所以其它模组
 * 后注册的物品、方块也会一起出现。
 * 三段宽度一律改各自的 Cell：直接写元素的 width 字段会被父 Table 下一帧
 * 按 Cell 的约束重新覆盖掉，等于没改。
 */
function refillBody(){
    if(bodyTable == null) return;

    var sizes = currentLayout();

    if(tabCell != null) tabCell.width(sizes.bodyWidth);
    if(statusCell != null) statusCell.width(sizes.bodyWidth);
    if(bodyCell != null) bodyCell.width(sizes.bodyWidth);

    // 移动端窄屏：两个页签按 TAB_W 排不下时按屏宽分摊，保证不顶出面板
    if(tabCellItems != null && tabCellBoost != null){
        var tabW = TAB_W;
        var fit = Math.floor((sizes.bodyWidth - GAP_S) / 2);
        if(fit > 0 && fit < tabW) tabW = Math.max(40, fit);
        tabCellItems.width(tabW);
        tabCellBoost.width(tabW);
    }

    bodyTable.clearChildren();
    bodyTable.left().top();
    // 下面这些只属于「取物」页，切走就清空，
    // 免得搜索回调摸到已经被拆掉的格子（Cell 是池化复用的，改它等于改别人）
    listTable = null;
    paneCell = null;
    amountField = null;

    if(activeTab == TAB_BOOST){
        buildBoostBody(bodyTable, sizes);
    }else{
        buildItemsBody(bodyTable, sizes);
    }

    refreshTabs();
}

/** 构建悬浮窗（只构建一次） */
function buildPanel(){
    var sizes = currentLayout();
    var frame = new BaseDialog(MOD_NAME);
    // BaseDialog 构造器里写死 setFillParent(true)（字节码偏移 7），
    // 这一版就要它：面板铺满整屏，内容按屏幕尺寸排，和原版每个对话框一个感觉。
    // 上一版为了「窗口收拢到内容」把它关掉，结果 pack() 算出的窗口只有 806 宽，
    // 又停在 (0,0) 左下角 —— 用户看到的正是「窝在一个角落里，一半没显示」。
    frame.addCloseButton();

    var contentArea = frame.cont;
    contentArea.left().top();

    // 横向内边距只加在这三段上，内容区里每一行都是同样的 bodyWidth，
    // 左右边缘才是一条直线 —— 上一版有的格子带 pad、有的不带，看上去就是
    // 「东西都挤在左边，右边空一条」。
    tabCell = contentArea.add(buildTabBar()).width(sizes.bodyWidth)
        .pad(PAD_V, PAD_H, GAP_S, PAD_H).row();

    statusCell = contentArea.label(prov(safe("状态行", statusText)));
    statusCell.width(sizes.bodyWidth).ellipsis(true)
        .pad(0, PAD_H, GAP_S, PAD_H).row();

    bodyTable = new Table();
    bodyTable.left().top();
    bodyCell = contentArea.add(bodyTable).width(sizes.bodyWidth)
        .pad(0, PAD_H, PAD_V, PAD_H).row();

    // 改分辨率、改界面缩放之后按新屏幕重排（只在面板没显示时触发，
    // 显示中改尺寸由下一次打开时的 refillBody 负责）。
    // 注意不能写成 frame.shown(...)：那是 BaseDialog 自己挂暂停/恢复的地方，
    // 覆盖掉它，面板开着时游戏不再暂停、关掉后暂停状态也回不去。
    frame.resizedShown(run(safe("面板重排", refillBody)));

    return frame;
}

/** 打开悬浮窗：铺满整屏的原版对话框，位置尺寸都由 Dialog 自己管 */
function openPanel(){
    if(panel == null) panel = buildPanel();
    // 每次打开整个重填一次：其它模组后注册的物品、方块才会一起出现，
    // 卡片列数也才跟得上当前屏幕。
    refillBody();
    panel.show();
}

// ---------- HUD 按钮：可拖拽 ----------

/** 按钮什么时候该出现：只在游戏进行中、且没在游戏结束画面 */
function hudVisible(){
    return Vars.state != null && Vars.state.isPlaying() && !Vars.state.gameOver;
}

/**
 * 按钮可用的活动范围。
 * hudGroup 在 ClientLoadEvent 时还是 0x0（日志实测），所以优先取它的有效尺寸，
 * 取不到就退回舞台尺寸；两个都无效时返回 0，调用方据此什么也不做。
 */
function hudBounds(){
    var w = 0;
    var h = 0;
    try{
        if(Vars.ui != null && Vars.ui.hudGroup != null){
            w = Vars.ui.hudGroup.getWidth();
            h = Vars.ui.hudGroup.getHeight();
        }
    }catch(e){
        w = 0; h = 0;
    }
    if(w <= 0 || h <= 0){
        var s = stageSize();
        if(s.w > 0 && s.h > 0){
            w = s.w;
            h = s.h;
        }
    }
    return {w: w, h: h};
}

function defaultButtonPosition(b){
    return {
        x: px(BTN_MARGIN_LEFT),
        y: b.h - px(BTN_MARGIN_BOTTOM) - btnEl.getHeight()
    };
}

function saveButtonPosition(){
    var b = hudBounds();
    if(btnEl == null || b.w <= 0 || b.h <= 0) return;
    try{
        Core.settings.putFloat(KEY_BTN_X, btnEl.x);
        Core.settings.putFloat(KEY_BTN_Y, btnEl.y);
    }catch(e){
        print(MOD_NAME + "：按钮位置保存失败：" + e);
    }
}

/** 首次定位：有记录用记录，没有就用默认边距；一律夹进有效范围 */
function placeButton(){
    var b = hudBounds();
    if(btnEl == null || b.w <= 0 || b.h <= 0) return;
    btnPlaced = true;

    var w = btnEl.getWidth();
    var h = btnEl.getHeight();
    var x = -1;
    var y = -1;
    try{
        x = Core.settings.getFloat(KEY_BTN_X, -1);
        y = Core.settings.getFloat(KEY_BTN_Y, -1);
    }catch(e){
        x = -1; y = -1;
    }
    if(x < 0 || y < 0){
        var def = defaultButtonPosition(b);
        x = def.x;
        y = def.y;
    }
    btnEl.setPosition(clamp(x, 0, b.w - w), clamp(y, 0, b.h - h));
}

/** 分辨率/界面缩放变了就把按钮夹回可见区域 */
function keepButtonInside(){
    var b = hudBounds();
    if(btnEl == null || b.w <= 0 || b.h <= 0) return;
    var w = btnEl.getWidth();
    var h = btnEl.getHeight();
    var nx = clamp(btnEl.x, 0, b.w - w);
    var ny = clamp(btnEl.y, 0, b.h - h);
    if(nx != btnEl.x || ny != btnEl.y){
        btnEl.setPosition(nx, ny);
    }
}

/**
 * 摘掉 TextButton 自带的 ClickListener —— 这正是之前「长按却拖不动」的根源：
 * TextButton 构造器先装了 ClickListener，它的 touchDown 返回 true 就把整个手势
 * 捕获了，后挂上来的 DragListener 根本收不到 touchDragged，按钮只能点、不能拖。
 * 摘掉之后改挂自建的 InputListener，统一处理「点击 or 拖动」。
 */
function stripClickListener(el){
    try{
        var ClickListener = Packages.arc.scene.event.ClickListener;
        var listeners = el.getListeners();
        var removed = 0;
        // 倒序删：removeListener 会挪动 Seq 里的元素，正序删会跳
        for(var i = listeners.size - 1; i >= 0; i--){
            var l = listeners.get(i);
            if(l instanceof ClickListener){
                el.removeListener(l);
                removed++;
            }
        }
        return removed > 0;
    }catch(e){
        print(MOD_NAME + "：摘除自带 ClickListener 失败：" + e);
        return false;
    }
}

/**
 * 给按钮挂「点击 + 拖动」二合一输入监听（自建 InputListener，缘由见 stripClickListener）。
 * 位置按「这一帧相对上一帧移动了多少」来推，而不是把按钮中心硬贴到鼠标上：
 * 这样从按钮任何位置按下都能抓着走（不会一按就跳中心），
 * 也不用赌舞台坐标和 hudGroup 坐标的 y 轴朝向 —— 增量法两边方向天然一致。
 * 位移累计超过 DRAG_THRESHOLD 才算拖动并开始移动；没超过就松手视为点击，打开面板。
 */
function attachDrag(){
    try{
        dragListener = extend(Packages.arc.scene.event.InputListener, {
            touchDown: function(event, x, y, pointer){
                dragPrevX = event.stageX;
                dragPrevY = event.stageY;
                dragStartX = event.stageX;
                dragStartY = event.stageY;
                dragMoved = false;
                btnDragging = true;
                // 返回 true = 捕获这一路手势，后续拖动/抬起都交给本监听
                return true;
            },
            touchDragged: function(event, x, y, pointer){
                try{
                    if(!dragMoved){
                        var travel = Math.abs(event.stageX - dragStartX)
                            + Math.abs(event.stageY - dragStartY);
                        if(travel < DRAG_THRESHOLD) return;
                        dragMoved = true;
                    }
                    var b = hudBounds();
                    var w = btnEl.getWidth();
                    var h = btnEl.getHeight();
                    if(b.w <= 0 || b.h <= 0) return;
                    btnEl.setPosition(
                        clamp(btnEl.x + (event.stageX - dragPrevX), 0, b.w - w),
                        clamp(btnEl.y + (event.stageY - dragPrevY), 0, b.h - h));
                    dragPrevX = event.stageX;
                    dragPrevY = event.stageY;
                    btnPlaced = true;
                }catch(e){
                    print(MOD_NAME + "：拖动出错：" + e);
                }
            },
            touchUp: function(event, x, y, pointer, keycode){
                btnDragging = false;
                if(dragMoved){
                    dragMoved = false;
                    saveButtonPosition();
                    return;
                }
                openPanel();
            }
        });
        // 先建好监听再摘 ClickListener：extend 万一失败，原点击行为原样保留
        stripClickListener(btnEl);
        btnEl.addListener(dragListener);
        print(MOD_NAME + "：按钮点击+拖拽监听已挂载。");
    }catch(e){
        dragListener = null;
        print(MOD_NAME + "：拖拽挂载失败，按钮仍可点击但无法拖动：" + e);
    }
}

function makeHudButton(){
    // 借 Table.button(...) 造一个带样式、已经把点击事件接好的 TextButton，
    // 造完立刻从 Table 里摘出来单独挂到 hudGroup 上。
    // 为什么要摘出来：Table 每帧都会按对齐重排自己的子元素，手动设的坐标会被抹掉，
    // 只有让按钮成为 WidgetGroup（hudGroup）的直接子元素，绝对坐标才说了算。
    var btnText = MOD_NAME;
    // 按钮宽度按当前语言/字号实测，量不到就用兜底值，避免文字顶出按钮
    var measuredWidth = measureButton(btnText);
    var buttonWidth = measuredWidth > 0 ? Math.ceil(measuredWidth) : BTN_WIDTH;
    var parent = new Table();
    var inputCell = parent.button(btnText, run(safe("打开面板", function(){
        // 兜底路径：只有 stripClickListener 没能摘掉自带 ClickListener 时才会走到这，
        // 正常情况下点击由自建 InputListener 的 touchUp 处理，本回调不会再触发。
        if(btnDragging || dragMoved) return;
        openPanel();
    })));
    inputCell.size(px(buttonWidth), px(BTN_HEIGHT));

    btnEl = inputCell.get();
    parent.removeChild(btnEl);

    // 脱离 Table 后没人再给它尺寸，这里自己定；setSize 会让它下一帧重新排版，
    // 文字仍然居中显示。
    btnEl.setSize(px(buttonWidth), px(BTN_HEIGHT));

    // 注意是赋值 visibility 字段而不是调 visible(Boolp)：见文件开头第 1 条坑
    btnEl.visibility = boolp(function(){
        return hudVisible();
    });

    Vars.ui.hudGroup.addChild(btnEl);

    // 关键：这里不在初始化时定位。ClientLoadEvent 时 hudGroup 还是 0x0，
    // 那时算出来的坐标一定是废的（上一版就是这么把按钮甩到 x=-104 的）。
    // 定位交给 update：哪一帧拿到有效尺寸，哪一帧才落地。
    btnEl.update(run(safe("按钮定位", function(){
        if(!btnPlaced){
            placeButton();
        }else if(!btnDragging){
            // 正被按住拖动时不回夹：否则每帧和 touchDragged 的 setPosition 打架，
            // 按钮在屏幕边缘会抖，看上去就像「抓不动」。
            keepButtonInside();
        }
    })));

    attachDrag();

    print(MOD_NAME + "：已注入「自定义面板」按钮（可按住拖动）。");
}

// ---------- 挡掉必然失败的远程请求 ----------

/**
 * 关掉游戏自己发起的两类远程请求，它们失败后都会弹「发生错误 (Connection reset)」。
 *
 * 模组浏览器那条路径的字节码（160.7）：
 *   ModBrowserDialog.getModList(cons):
 *     0: getfield modList
 *     4: ifnull 18             // modList != null 就当场回调它，直接 return
 *    18: fetchCallbacks.add(cons)
 *    27: getfield fetchingMods; ifeq 35; return
 *    35: getModListInternal(0)
 *   getModListInternal(i):
 *     1: getstatic Vars.modJsonURLs; arraylength; if_icmplt 9; return
 *     ...Http.get(url, ok, fail)，失败换下一个地址，全失败 -> ModsDialog.showModError
 * 所以只要 modList 不是 null，请求根本发不出去，弹窗也就不会出现。
 *
 * modList 是 protected（javac 从别的包访问它直接被拒绝，已实证），Rhino 的属性查找
 * 同样只认公有字段，所以这里只能走反射 —— 这不是备胎写法，是唯一可行的写法。
 */
function blockRemoteFetch(){
    if(!BLOCK_REMOTE_FETCH) return;

    // 1) 社区服务器列表：JoinDialog.fetchServers() 第一步就读这个开关
    try{
        // 缺省按 true 处理：Mindustry 读这个键时用的默认值就是 true
        if(Core.settings.getBool("communityservers", true)){
            Core.settings.put("communityservers", false);
        }
    }catch(e){
        print(MOD_NAME + "：关闭社区服务器列表失败：" + e);
    }

    // 2) 模组浏览器的远程模组列表：没有任何设置能关，只能喂一个空列表给它
    try{
        var browser = Vars.ui.mods.browser;
        if(browser == null){
            print(MOD_NAME + "：模组浏览器还没建好，这次不挡远程列表。");
            return;
        }
        var modListField = Packages.java.lang.Class
            .forName("mindustry.ui.dialogs.ModBrowserDialog")
            .getDeclaredField("modList");
        modListField.setAccessible(true);
        if(modListField.get(browser) == null){
            modListField.set(browser, new Seq());
            print(MOD_NAME + "：已挡掉远程模组列表（不再弹 Connection reset；"
                + "模组浏览器只显示本地已装的模组）。");
        }
    }catch(e){
        print(MOD_NAME + "：挡远程模组列表失败（只会多出报错弹窗，不影响取物）：" + e);
    }
}

// ---------- 入口 ----------

// ClientLoadEvent 在界面与内容全部就绪后触发一次，是注入 HUD 的官方时机。
Events.on(ClientLoadEvent, cons(function(){
    try{
        blockRemoteFetch();
        makeHudButton();
        registerBoostHook();
    }catch(e){
        print(MOD_NAME + "：初始化失败：" + e);
    }
}));

// 脚本一加载就先把开关关掉：JoinDialog 可能在界面就绪前就被创建。
try{
    blockRemoteFetch();
}catch(e){
    print(MOD_NAME + "：早期挡远程请求失败：" + e);
}

print(MOD_NAME + "：脚本已加载（v" + MOD_VERSION + "）。");
