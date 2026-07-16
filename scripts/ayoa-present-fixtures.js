'use strict';

// Shared fixture/helpers for the Ayoa Present mode auto-regression suite.
// Keep this file focused on reusable code; the policy of "fixtures per test
// file" applies: this module does not keep shared mutable state between tests.

const path = require('path');
const fs = require('fs');

const CHROME_PATH = process.env.PREFIX
  ? `${process.env.PREFIX}/lib/chromium/headless_shell`
  : '/data/data/com.termux/files/usr/lib/chromium/headless_shell';

function requireAyoaPresenter() {
  return require(path.join(__dirname, 'ayoa-presenter.js'));
}

function fakeCookiesPath() {
  return path.join(process.env.HOME, 'tmp/fake.json');
}

function injectAyoaArgs() {
  // The CLI parser reads --cookies/--target. Tests that exercise the CLI binary
  // bypass require(); headless unit tests rely on this shim.
  const argv = process.argv;
  if (!argv.includes('--cookies')) argv.push('--cookies', fakeCookiesPath());
  if (!argv.includes('--target')) {
    argv.push('--target', 'https://app.ayoa.com/mindmaps/00000000-0000-0000-0000-000000000000');
  }
}

function withBrowser() {
  const puppeteer = require('puppeteer-core');
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'shell',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process',
    ],
  });
}

// Build a presenter panel DOM that mirrors Ayoa Web 8.170.88. The fixture is
// parametric so individual tests can override behaviour (deck size, language,
// boundary marker, dual-screen availability, etc.).
function buildPanelDom({
  empty = false,
  deckSize = 3,
  expectedCount = deckSize,
  presenting = false,
  compact = false,
  fullscreen = false,
  nextDisabled = false,
  prevDisabled = true,
  boundary = true,
  popout = true,
  labels = { add: 'Add', autoCreate: 'Auto-create', clearAll: 'Clear all' },
  includeMapNodes = true,
  includeTogglePresenter = true,
} = {}) {
  const items = empty ? '' : Array.from({ length: deckSize }, (_, i) => `
    <li id="slide-${i + 1}" class="slides-list-group-item${i === 0 ? ' selected' : ''}" draggable="true">
      <div class="slides-list-group-counter">${i + 1}</div>
      <div class="slides-list-group-content">${['One','Two','Three','Four','Five','Six'][i] || `Slide ${i + 1}`}</div>
      ${boundary ? '<span class="blue-square"></span>' : ''}
    </li>`).join('');

  const navClass = compact ? ' compact' : '';
  const presentingClass = presenting ? ' presenting' : '';
  const playSelected = presenting ? ' selected' : '';
  const appFullscreen = fullscreen ? ' presenter-fullscreen' : '';
  const nextD = nextDisabled ? ' disabled' : '';
  const prevD = prevDisabled ? ' disabled' : '';
  const popoutHtml = popout ? '<button class="btn btn-default slides-popout-button"></button>' : '';
  const toggle = includeTogglePresenter ? '<div class="toggle-presenter"></div>' : '';
  const mapHtml = includeMapNodes ? `<div class="map-canvas">${Array.from({ length: expectedCount }, (_, i) => `<div class="map-node" data-branch="b${i + 1}">Branch ${i + 1}</div>`).join('')}</div>` : '';
  const emptyBlock = empty
    ? `<div class="slides-list-empty"><button class="btn btn-default">${labels.autoCreate}</button></div>`
    : '';

  return `
    <div id="app-content" class="${appFullscreen.trim()}">
      ${toggle}
      ${mapHtml}
      <div class="slides-list-container${presentingClass}${navClass}">
        <div class="slides-list-header">
          <div class="slides-list-title"><span>Presenter</span><div class="help-icon"></div></div>
          <div class="slides-header-add-button"><button class="btn btn-default disabled">${labels.add}</button></div>
          <div class="slides-header-more-button"><div class="more-trigger"><i class="icon-dt_more"></i></div></div>
        </div>
        <div class="slides-list-content">
          <ol>${items}</ol>
          ${emptyBlock}
        </div>
        <div class="slides-list-footer">
          <button class="btn btn-default slides-play-stop-button${playSelected}"></button>
          <div class="slides-nav-container">
            <button class="previous" aria-label="Previous slide"${prevD}></button>
            <button class="next" aria-label="Next slide"${nextD}></button>
          </div>
          ${popoutHtml}
          <button class="btn btn-default slides-compact-button"></button>
          <button class="btn btn-default slides-fullscreen-button"></button>
        </div>
      </div>
    </div>
    <script>
      const panel = document.querySelector('.slides-list-container');
      const play = document.querySelector('.slides-play-stop-button');
      const nextBtn = document.querySelector('.slides-nav-container .next');
      const prevBtn = document.querySelector('.slides-nav-container .previous');
      const moreTrigger = document.querySelector('.slides-header-more-button');
      const compactBtn = document.querySelector('.slides-compact-button');
      const fullscreenBtn = document.querySelector('.slides-fullscreen-button');
      const selected = () => document.querySelector('.slides-list-group-item.selected');
      const items = () => [...document.querySelectorAll('.slides-list-group-item')];
      const updateNavState = () => {
        const i = items().indexOf(selected());
        if (nextBtn) nextBtn.disabled = i === -1 || i >= items().length - 1;
        if (prevBtn) prevBtn.disabled = i <= 0;
      };
      const select = (el) => {
        items().forEach(x => x.classList.remove('selected'));
        if (el) el.classList.add('selected');
        updateNavState();
        // Mirror what Ayoa does in production: the central canvas re-renders
        // for the active slide so the screenshot varies per-slide.
        const canvas = document.querySelector('.map-canvas');
        if (canvas) {
          const idx = items().indexOf(el);
          const title = el ? (el.querySelector('.slides-list-group-content')?.innerText || 'Slide') : 'Slide';
          canvas.innerHTML = '<div class="map-node active" data-slide-index="' + idx + '">'
            + '<div class="map-node-title">' + title + '</div>'
            + '<div class="map-node-body">Slide ' + (idx + 1) + ' of ' + items().length
            + ' — unique body for slide ' + (idx + 1) + '</div>'
            + '</div>';
        }
      };
      items().forEach(el => el.addEventListener('click', () => select(el)));
      if (play) play.addEventListener('click', () => {
        const active = panel.classList.toggle('presenting');
        play.classList.toggle('selected', active);
        if (active) setTimeout(() => { select(items()[0]); updateNavState(); }, 200);
      });
      if (nextBtn) nextBtn.addEventListener('click', () => {
        const all = items();
        const i = all.indexOf(selected()); select(all[Math.min(all.length - 1, i + 1)]);
      });
      if (prevBtn) prevBtn.addEventListener('click', () => {
        const all = items();
        const i = all.indexOf(selected()); select(all[Math.max(0, i - 1)]);
      });
      let saved = '';
      if (compactBtn) compactBtn.addEventListener('click', e => {
        const content = panel.querySelector('.slides-list-content');
        const enabling = !panel.classList.contains('compact');
        panel.classList.toggle('compact', enabling);
        e.currentTarget.classList.toggle('selected', enabling);
        if (enabling) { saved = content.innerHTML; content.innerHTML = ''; }
        else { content.innerHTML = saved; }
      });
      if (fullscreenBtn) fullscreenBtn.addEventListener('click', e => {
        document.querySelector('#app-content').classList.toggle('presenter-fullscreen');
        e.currentTarget.classList.toggle('selected');
      });
      const openMenu = () => {
        const existing = document.querySelector('.slides-popper-content');
        if (existing) existing.remove();
        const portal = document.createElement('div');
        portal.className = 'slides-popper-content';
        const clear = document.createElement('div');
        clear.className = 'slides-more-item';
        clear.innerText = '${labels.clearAll}';
        clear.addEventListener('click', () => {
          items().forEach(el => el.remove());
          portal.remove();
          if (!document.querySelector('.slides-list-content ol').children.length) {
            let empty = document.querySelector('.slides-list-empty');
            if (!empty) {
              empty = document.createElement('div');
              empty.className = 'slides-list-empty';
              const btn = document.createElement('button');
              btn.className = 'btn btn-default';
              btn.innerText = '${labels.autoCreate}';
              btn.addEventListener('click', () => {
                const ol = document.querySelector('ol');
                ['Auto one','Auto two','Auto three'].forEach((name, i) => {
                  const li = document.createElement('li'); li.id = 'auto-' + (i + 1);
                  li.className = 'slides-list-group-item' + (i === 0 ? ' selected' : '');
                  li.innerHTML = '<div class="slides-list-group-counter">' + (i + 1) + '</div><div class="slides-list-group-content">' + name + '</div>';
                  li.addEventListener('click', () => select(li));
                  ol.appendChild(li);
                });
                empty.remove();
                updateNavState();
              });
              empty.appendChild(btn);
              document.querySelector('.slides-list-content').appendChild(empty);
            }
          }
          updateNavState();
        });
        portal.appendChild(clear);
        document.body.appendChild(portal);
      };
      if (moreTrigger) moreTrigger.addEventListener('click', openMenu);
      const moreParent = document.querySelector('.slides-header-more-button');
      if (moreParent && moreParent !== moreTrigger) moreParent.addEventListener('click', openMenu);
      const autoBtn = document.querySelector('.slides-list-empty button');
      if (autoBtn) autoBtn.addEventListener('click', () => {
        const ol = document.querySelector('ol');
        ['Auto one','Auto two','Auto three'].forEach((name, i) => {
          const li = document.createElement('li'); li.id = 'auto-' + (i + 1);
          li.className = 'slides-list-group-item' + (i === 0 ? ' selected' : '');
          li.innerHTML = '<div class="slides-list-group-counter">' + (i + 1) + '</div><div class="slides-list-group-content">' + name + '</div>';
          li.addEventListener('click', () => select(li));
          ol.appendChild(li);
        });
        document.querySelector('.slides-list-empty').remove();
        updateNavState();
      });
      updateNavState();
    </script>
  `;
}

async function installPanel(page, options = {}) {
  await page.setContent(buildPanelDom(options));
}

function safeUnlink(target) {
  try { fs.unlinkSync(target); } catch (_) { /* ignore */ }
}

module.exports = {
  CHROME_PATH,
  requireAyoaPresenter,
  injectAyoaArgs,
  withBrowser,
  buildPanelDom,
  installPanel,
  safeUnlink,
};
