// ==UserScript==
// @name         Epic Games 喜加一全自动领取助手 (v4.0 实测防卡死版)
// @namespace    https://github.com/AdaSeraph/epic-free-games-claimer
// @version      4.0.0
// @description  精准过滤常驻免费游戏干扰、已访问Slug黑名单防死循环、全DOM识别“已在库中”0.5秒秒跳、8秒倒计时硬兜底绝不卡死
// @author       AdaSeraph
// @match        https://store.epicgames.com/*
// @match        https://payment-website-pci.ol.epicgames.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const QUEUE_KEY = 'tm_epic_queue_v4';
    const VISITED_KEY = 'tm_epic_visited_v4';
    const RUNNING_KEY = 'tm_epic_running_v4';

    // =========================================================================
    // 模块 1：结算弹窗内部自动下单 (iframe: /purchase 或 payment-website-pci)
    // =========================================================================
    const isPurchaseIframe =
        window.location.hostname.includes('payment-website-pci.ol.epicgames.com') ||
        window.location.pathname.includes('/purchase');

    if (isPurchaseIframe) {
        let clickedOrder = false;

        setInterval(() => {
            // 1. 自动勾选同意协议复选框
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (cb.id === 'agree' || (cb.name && cb.name.toLowerCase().includes('agree'))) {
                    if (!cb.checked) cb.click();
                }
            });

            // 2. 查找并点击 "Place Order" / "下订单"
            const buttons = Array.from(document.querySelectorAll('button'));
            const placeOrderBtn = buttons.find(btn => {
                const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                return (
                    txt === 'place order' ||
                    txt.includes('place order') ||
                    txt.includes('下订单') ||
                    txt.includes('下单')
                );
            });

            if (placeOrderBtn && !placeOrderBtn.disabled && !clickedOrder) {
                clickedOrder = true;
                console.log('[Epic 喜加一] 自动点击 Place Order (下订单)！');
                placeOrderBtn.click();
                setTimeout(() => { clickedOrder = false; }, 4000);
            }

            // 3. 自动点击二次确认 "I Agree" / "我同意"
            const agreeBtn = buttons.find(btn => {
                const txt = (btn.innerText || btn.textContent || '').trim().toLowerCase();
                return txt === 'i agree' || txt === 'accept' || txt === '我同意' || txt === '接受';
            });
            if (agreeBtn && !agreeBtn.disabled) {
                agreeBtn.click();
            }
        }, 700);

        return;
    }

    // =========================================================================
    // 模块 2：队列与已访问黑名单管理（彻底杜绝在同一个游戏上反复卡住）
    // =========================================================================
    let isJumping = false;
    let hasClickedGet = false;
    let lastSlug = '';
    let slugEnterTime = Date.now();

    function getQueue() {
        try { return JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]'); }
        catch { return []; }
    }
    function setQueue(arr) {
        sessionStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
    }

    function getVisited() {
        try { return JSON.parse(sessionStorage.getItem(VISITED_KEY) || '[]'); }
        catch { return []; }
    }
    function markVisited(slug) {
        if (!slug) return;
        const v = new Set(getVisited());
        v.add(slug.toLowerCase());
        sessionStorage.setItem(VISITED_KEY, JSON.stringify(Array.from(v)));
    }

    function isRunning() {
        return sessionStorage.getItem(RUNNING_KEY) === '1';
    }
    function setRunning(val) {
        if (val) sessionStorage.setItem(RUNNING_KEY, '1');
        else sessionStorage.removeItem(RUNNING_KEY);
    }

    function getCurrentSlug() {
        const m = window.location.pathname.match(/\/(?:p|bundles)\/([^/?#]+)/i);
        return m ? m[1].toLowerCase() : '';
    }

    function log(msg, color = '#26bbff') {
        const el = document.getElementById('tm-epic-log-v4');
        if (el) {
            el.textContent = msg;
            el.style.color = color;
        }
        console.log('[Epic 喜加一]', msg);
    }

    // 立即拉黑当前页并跳往队列下一款
    function skipToNext(reason) {
        if (isJumping) return;
        isJumping = true;

        const currSlug = getCurrentSlug();
        if (currSlug) markVisited(currSlug);

        const visited = new Set(getVisited());
        // 过滤掉任何已经访问过的游戏，防止死循环
        const queue = getQueue().filter(item => !visited.has(item.slug.toLowerCase()));
        setQueue(queue);

        if (queue.length > 0) {
            const next = queue.shift();
            setQueue(queue);
            markVisited(next.slug);
            log(`${reason} -> 正在跳转下一款：《${next.title}》 (还剩 ${queue.length} 款)`, '#52c41a');
            setTimeout(() => {
                window.location.href = next.url;
            }, 600);
        } else {
            setRunning(false);
            log(`${reason} -> 🎉 本周所有限免游戏已全部处理完毕！`, '#52c41a');
            setTimeout(() => { isJumping = false; }, 1500);
        }
    }

    // =========================================================================
    // 模块 3：从官方 API 获取本周真正的限免游戏 (实测过滤常驻F2P网游干扰)
    // =========================================================================
    async function fetchRealFreeGames() {
        const langMatch = window.location.pathname.match(/^\/([a-z]{2}-[A-Z]{2})(?:\/|$)/);
        const locale = langMatch ? langMatch[1] : 'en-US';
        const api = `https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=${locale}&country=US&allowCountries=US`;

        const res = await fetch(api);
        const json = await res.json();
        const elements = json?.data?.Catalog?.searchStore?.elements || [];
        const now = new Date();

        const paidToFreeGames = []; // 原价 > 0，限时 0 元的真正喜加一（优先）
        const f2pPromoGames = [];   // 原价 = 0，但处于本周促销区的游戏

        for (const item of elements) {
            const promos = item?.promotions?.promotionalOffers || [];
            let hasActiveZeroPromo = false;

            for (const group of promos) {
                for (const offer of (group.promotionalOffers || [])) {
                    const start = new Date(offer.startDate);
                    const end = new Date(offer.endDate);
                    if (now >= start && now <= end && offer?.discountSetting?.discountPercentage === 0) {
                        hasActiveZeroPromo = true;
                        break;
                    }
                }
            }

            const origPrice = item?.price?.totalPrice?.originalPrice ?? 0;
            const discPrice = item?.price?.totalPrice?.discountPrice ?? -1;

            // 必须当前折扣价为 0 且有激活的限免促销
            if (!hasActiveZeroPromo && discPrice !== 0) continue;
            if (!hasActiveZeroPromo) continue;

            const slugRaw =
                item?.catalogNs?.mappings?.find(m => m.pageType === 'productHome')?.pageSlug ||
                item?.catalogNs?.mappings?.[0]?.pageSlug ||
                item?.offerMappings?.[0]?.pageSlug ||
                item?.productSlug ||
                item?.urlSlug;

            if (!slugRaw || slugRaw === '[]') continue;
            const slug = slugRaw.replace(/\/home$/, '');
            const isBundle = item.offerType === 'BUNDLE' || item.categories?.some(c => c.path === 'bundles');
            const url = `https://store.epicgames.com/${locale}/${isBundle ? 'bundles' : 'p'}/${slug}`;

            const entry = { title: item.title || slug, slug, url, origPrice };
            if (origPrice > 0) {
                paidToFreeGames.push(entry);
            } else {
                f2pPromoGames.push(entry);
            }
        }

        // 优先排真正的付费转免费游戏，最后才排常驻免费游戏
        return [...paidToFreeGames, ...f2pPromoGames];
    }

    async function startAutoClaim(resetVisited = true) {
        try {
            isJumping = false;
            if (resetVisited) {
                sessionStorage.removeItem(VISITED_KEY);
            }

            log('🔍 正在通过官方 API 获取本周限免列表...', '#26bbff');
            const allGames = await fetchRealFreeGames();

            // 如果当前已经站在其中某一款游戏的页面上，且该页面已经检查过，过滤掉已访问项
            const visited = new Set(getVisited());
            const pendingGames = allGames.filter(g => !visited.has(g.slug.toLowerCase()));

            if (pendingGames.length === 0) {
                log('⚠️ 没有未检查的限免游戏（如想重新检查请再点一次按钮）', '#ffa940');
                sessionStorage.removeItem(VISITED_KEY);
                return;
            }

            setRunning(true);
            const [first, ...rest] = pendingGames;
            setQueue(rest);
            markVisited(first.slug);

            const names = pendingGames.map(g => `《${g.title}》`).join('、');
            log(`🎯 待处理 ${pendingGames.length} 款：${names}`, '#52c41a');

            // 如果当前页面恰好就是队列第 1 款游戏，直接在当前页执行检查，不重复刷新
            if (getCurrentSlug() === first.slug.toLowerCase()) {
                slugEnterTime = Date.now();
                hasClickedGet = false;
                checkPage();
            } else {
                isJumping = true;
                setTimeout(() => {
                    window.location.href = first.url;
                }, 700);
            }
        } catch (err) {
            log(`❌ 启动失败: ${err.message}`, '#ff4d4f');
        }
    }

    // =========================================================================
    // 模块 4：详情页状态检测（全局扫描“已在库中” + 8秒倒计时硬兜底）
    // =========================================================================
    function checkPage() {
        const currSlug = getCurrentSlug();

        // 只有当真正换了一款游戏（Slug 改变）时才重置计时器，彻底修复 URL 参数重定向导致计时器无限重置的 Bug！
        if (currSlug !== lastSlug) {
            lastSlug = currSlug;
            hasClickedGet = false;
            isJumping = false;
            slugEnterTime = Date.now();
        }

        if (isJumping) return;

        // 1. 如果在领取成功感谢页 (/thank-you)
        if (window.location.pathname.includes('thank-you')) {
            skipToNext('✅ 领取成功');
            return;
        }

        if (!currSlug) return; // 不在商品详情页 (/p/ 或 /bundles/)

        // 2. 自动过 18+ 年龄遮罩
        const ageBtn =
            document.querySelector('button[data-testid="btn-continue"]') ||
            Array.from(document.querySelectorAll('button')).find(b => {
                const t = (b.textContent || '').trim().toLowerCase();
                return t === 'continue' || t === '继续';
            });
        if (ageBtn) {
            ageBtn.click();
            return;
        }

        // 3. 全局查找购买区按钮（不限制 <aside>，覆盖所有购买按钮与链接）
        const ctaCandidates = Array.from(
            document.querySelectorAll(
                '[data-testid="purchase-cta-button"], button[class*="eds_"], a[data-testid="purchase-cta-button"], aside button, aside a'
            )
        );

        for (const el of ctaCandidates) {
            const rawText = (el.innerText || el.textContent || '').trim();
            const txt = rawText.toLowerCase();
            if (!txt || txt.length > 30) continue;

            // A. 识别【已在库中 / 已拥有】-> 立即跳过！
            if (
                txt === 'in library' ||
                txt.includes('in library') ||
                txt.includes('已在库中') ||
                txt === 'owned' ||
                txt.includes('已拥有') ||
                txt === 'unavailable' ||
                txt === '不可用'
            ) {
                if (isRunning() || getQueue().length > 0) {
                    skipToNext(`⏭️ 检测到【${rawText}】已在库中，立即跳过`);
                } else {
                    log(`✅ 当前游戏状态：【${rawText}】（已在库中）`, '#52c41a');
                }
                return;
            }

            // B. 识别【Get / 获取】-> 自动点击！
            if (txt === 'get' || txt === '获取') {
                if (!hasClickedGet && !el.disabled) {
                    hasClickedGet = true;
                    slugEnterTime = Date.now(); // 点击 Get 后给结算弹窗预留时间
                    log('⚡ 检测到免费【Get / 获取】按钮，正在自动点击...', '#52c41a');
                    el.click();
                }
                return;
            }

            // C. 识别【付费购买 Buy Now】-> 安全跳过！
            if (txt === 'buy now' || txt === '立即购买') {
                if (isRunning() || getQueue().length > 0) {
                    skipToNext(`⚠️ 非免费状态 (${rawText})，安全跳过`);
                }
                return;
            }
        }

        // 4. 硬核 8 秒倒计时兜底：如果处于自动领取模式，且未打开结算 iframe，满 8 秒无条件跳下一款！
        const hasCheckoutModal = !!document.querySelector(
            'iframe[src*="purchase"], iframe[src*="payment-website-pci"], #webPurchaseContainer'
        );

        if ((isRunning() || getQueue().length > 0) && !hasCheckoutModal && !hasClickedGet) {
            const elapsedSec = Math.floor((Date.now() - slugEnterTime) / 1000);
            const remainSec = Math.max(0, 8 - elapsedSec);
            log(`⏳ 正在检测页面状态... (${remainSec}秒后若无Get按钮将自动跳过)`, '#ffa940');

            if (elapsedSec >= 8) {
                skipToNext('⏱️ 8秒未检测到可领按钮(已在库中/常驻免费)');
            }
        }
    }

    // =========================================================================
    // 模块 5：悬浮控制面板 UI
    // =========================================================================
    function createUI() {
        if (document.getElementById('tm-epic-panel-v4')) return;

        const panel = document.createElement('div');
        panel.id = 'tm-epic-panel-v4';
        panel.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 999999;
            background: #121216; color: #f5f5f5; padding: 14px;
            border-radius: 8px; border: 1px solid #26bbff;
            box-shadow: 0 6px 24px rgba(0,0,0,0.9);
            font-family: Inter, system-ui, sans-serif; font-size: 12px;
            width: 280px; display: flex; flex-direction: column; gap: 8px;
        `;

        const qLen = getQueue().length;
        panel.innerHTML = `
            <div style="font-weight:bold; font-size:14px; color:#26bbff; display:flex; justify-content:space-between; align-items:center;">
                <span>🎁 Epic 喜加一助手 v4.0</span>
                <span style="font-size:11px; background:#1f3a4d; color:#26bbff; padding:2px 6px; border-radius:4px;">实测版</span>
            </div>
            <div id="tm-epic-log-v4" style="min-height:36px; line-height:1.4; color:#a0a0ab; word-break:break-word;">
                ${qLen > 0 ? `正在自动运行队列 (剩余 ${qLen} 款)...` : '准备就绪：点击下方按钮全自动领取本周限免'}
            </div>
            <button id="tm-epic-btn-run" style="background:#26bbff; color:#000; font-weight:700; border:none; padding:8px; border-radius:4px; cursor:pointer;">
                🚀 一键全自动领取本周限免
            </button>
            <div style="display:flex; gap:6px;">
                <button id="tm-epic-btn-skip" style="flex:1; background:#2a2a32; color:#fff; border:1px solid #444; padding:6px; border-radius:4px; cursor:pointer;">
                    ⏭️ 立即跳过此页
                </button>
                <button id="tm-epic-btn-stop" style="flex:1; background:#3a1d22; color:#ff7875; border:1px solid #5c2830; padding:6px; border-radius:4px; cursor:pointer;">
                    ⏹️ 停止队列
                </button>
            </div>
        `;

        document.body.appendChild(panel);

        document.getElementById('tm-epic-btn-run').onclick = () => startAutoClaim(true);
        document.getElementById('tm-epic-btn-skip').onclick = () => {
            isJumping = false;
            skipToNext('⏭️ 手动跳过');
        };
        document.getElementById('tm-epic-btn-stop').onclick = () => {
            setQueue([]);
            setRunning(false);
            isJumping = false;
            log('⏹️ 队列已停止。', '#ffa940');
        };
    }

    createUI();
    setInterval(() => {
        createUI();
        checkPage();
    }, 800);
})();
