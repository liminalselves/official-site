import{n as e,r as t}from"./api.s_tb2hLd.js";function n(e){return e.replace(/[&<>"']/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,'"':`&quot;`,"'":`&#39;`})[e])}var r=/^\*\*Full Changelog\*\*|^## What's Changed|^## New Contributors/i,i=/^[-*]\s+.* by @\S+ in https?:\/\/\S+$/;function a(e){return e.replace(/`([^`]+)`/g,`$1`).replace(/\*\*([^*]+)\*\*/g,`<strong>$1</strong>`).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,`<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`)}function o(e){let t=[],n=[],r=[],i=()=>{n.length&&t.push(`<p>${a(n.join(` `))}</p>`),n=[]},o=()=>{r.length&&t.push(`<ul>${r.map(e=>`<li>${a(e)}</li>`).join(``)}</ul>`),r=[]};for(let t of e){if(!t){i(),o();continue}let e=t.match(/^[-*]\s+(.*)$/);e?(i(),r.push(e[1])):(o(),n.push(t))}return i(),o(),t.join(`
`)}function s(e){let t=[];for(let a of n(e).split(/\r?\n/)){let e=a.trim();r.test(e)||i.test(e)||t.push(e)}return t}function c(e){let t=[],n=[],r=``,i=null;for(let a of s(e)){let e=a.match(/^#{2,4}\s+(.*)$/);e?(i&&n.push({title:r,html:o(i)}),r=e[1].trim(),i=[]):i?i.push(a):t.push(a)}return i&&n.push({title:r,html:o(i)}),{summary:o(t),sections:n}}var l=3;function u(e){return/新增/.test(e)?`add`:/改进|优化/.test(e)?`imp`:/修复/.test(e)?`fix`:`other`}function d(e,r,i){let{summary:a,sections:o}=c(e.notes??``),s=[i?`<span class="rel__badge">最新版本</span>`:``,e.minVersion?`<span class="rel__badge rel__badge--major">重要更新</span>`:``].filter(Boolean).join(``),d=e.minVersion?`<p class="rel__min">低于 v${n(e.minVersion)} 的版本需要更新后才能继续使用</p>`:``,f=o.filter(e=>e.title&&e.html).map(e=>`<section class="rel__sec rel__sec--${u(e.title)}"><h4>${e.title}</h4>${e.html}</section>`).join(`
`),p=t(e.publishedAt),m=r>=l;return`<li class="rel${m?` rel--old`:``}"${m?` hidden`:``}>
  <span class="rel__node" aria-hidden="true"></span>
  <article class="rel__card">
    <header class="rel__head">
      <h3 class="rel__version serif">v${n(e.version)}</h3>
      ${p?`<p class="rel__date">${p}</p>`:``}
      ${s?`<p class="rel__badges">${s}</p>`:``}
      ${d}
    </header>
    ${a?`<div class="rel__summary">${a}</div>`:``}
    ${f}
  </article>
</li>`}var f=(e,t)=>{let n=document.querySelector(e);n&&t&&(n.textContent=t)};async function p(){let n=document.querySelector(`[data-releases-list]`),r=document.querySelector(`[data-releases-more]`),i=()=>{n&&r&&(r.hidden=!n.querySelector(`.rel--old`))};n&&r&&r.addEventListener(`click`,()=>{n.querySelectorAll(`.rel--old`).forEach(e=>e.removeAttribute(`hidden`)),r.hidden=!0}),i();let a=await e(),o=a?.find(e=>e.latest)??a?.[0];if(o){f(`[data-log-version]`,`v${o.version}`),f(`[data-log-date]`,t(o.publishedAt));let e=document.querySelector(`[data-release]`);e&&o.releaseUrl&&(e.href=o.releaseUrl)}if(!n||!a)return;let s=a.some(e=>e.latest);n.innerHTML=a.map((e,t)=>d(e,t,s?!!e.latest:t===0)).join(`
`),i()}typeof document<`u`&&p();