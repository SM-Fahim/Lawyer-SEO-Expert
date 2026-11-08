// Static HTML for the settlement calculator. The post's Markdown has a "{{calculator}}" line, and
// src/content.config.ts swaps in this markup before the Markdown is rendered. It is pre-rendered with the default
// inputs, so the page has its final height before any script runs and shows real figures without JavaScript.
// CalculatorScript.astro wires it. Nothing typed here is sent anywhere or stored: the fields sit in a plain
// group, not a <form> (check-dist requires every form to post to /api/lead), so nothing can submit them. One Markdown HTML block: no blank lines.
import { calculate, comparisonLine, defaults, formatPercent, formatUsd, OVERDRAWN_MESSAGE } from '../../lib/calculator';

const grouped = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);

function field(id: string, label: string, help: string, attrs: string, value: string, unit: { text: string; side: 'pre' | 'post' }, wide = false) {
  return `<div class="lse-calc__field${wide ? ' lse-calc__field--wide' : ''}">
<label class="lse-calc__label" for="calc-${id}">${label}</label>
<div class="lse-calc__input lse-calc__input--${unit.side}"><span class="lse-calc__unit" aria-hidden="true">${unit.text}</span><input id="calc-${id}" name="${id}" value="${value}" aria-describedby="calc-${id}-help calc-${id}-err" ${attrs}></div>
<p class="lse-calc__help" id="calc-${id}-help">${help}</p>
<p class="lse-calc__err" id="calc-${id}-err" hidden></p>
</div>`;
}

const moneyAttrs = 'type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-kind="money"';
const percentAttrs = `type="text" inputmode="decimal" autocomplete="off" spellcheck="false" data-kind="percent"`;

export function calculatorHtml(): string {
  const d = defaults;
  const r = calculate(d);
  const rows = [
    ['Settlement or offer', formatUsd(d.settlement), 'settlement'],
    ['Attorney fee', `minus ${formatUsd(r.fee)}`, 'fee'],
    ['Case costs', `minus ${formatUsd(r.costs)}`, 'costs'],
    ['Medical liens and bills, after any reduction', `minus ${formatUsd(r.lien)}`, 'lien'],
  ]
    .map(([l, v, k]) => `<tr><th scope="row">${l}</th><td data-out="${k}">${v}</td></tr>`)
    .join('\n');
  const money = (id: string, label: string, help: string, v: number, wide = false) => field(id, label, help, moneyAttrs, grouped(v), { text: '$', side: 'pre' }, wide);
  const percent = (id: string, label: string, help: string, v: number) => field(id, label, help, percentAttrs, String(v), { text: '%', side: 'post' });
  return `<div class="lse-calc" data-lse-calc>
<p class="lse-calc__note"><strong>Estimate only, not legal advice.</strong> Nothing you type here leaves your browser.</p>
<div class="lse-calc__form" role="group" aria-label="Settlement calculator" data-calc-fields>
${money('settlement', 'Settlement or offer amount', 'The total before anything is paid out.', d.settlement, true)}
${percent('feeRate', 'Attorney fee rate', 'The percentage in your fee agreement.', d.feeRate)}
${money('costs', 'Case costs', 'Filing fees, records, experts and other expenses.', d.costs)}
<fieldset class="lse-calc__field lse-calc__field--wide lse-calc__order" aria-describedby="calc-order-help">
<legend class="lse-calc__label">Take costs out</legend>
<div class="lse-calc__seg">
<label><input type="radio" name="order" value="before" checked><span>Before the fee</span></label>
<label><input type="radio" name="order" value="after"><span>After the fee</span></label>
</div>
<p class="lse-calc__help" id="calc-order-help">Your fee agreement says which. It changes the fee.</p>
</fieldset>
${money('lien', 'Medical liens and bills to repay', 'Insurer, hospital or government claims.', d.lien)}
${percent('lienReduction', 'Expected lien reduction', 'Only if one has been agreed, or to test one.', d.lienReduction)}
<div class="lse-calc__actions"><button type="button" class="lse-calc__reset" data-calc-reset>Reset to the example</button></div>
</div>
<div class="lse-calc__results" role="region" aria-labelledby="calc-results-h">
<h3 id="calc-results-h" class="lse-calc__rh">Estimated take-home</h3>
<div aria-live="polite" aria-atomic="true" class="lse-calc__live">
<p class="lse-calc__big"><span data-out="takeHome">${formatUsd(r.takeHome)}</span></p>
<p class="lse-calc__share"><span data-out="share">${r.takeHomeShare === null ? 'No share to show' : `${formatPercent(r.takeHomeShare)} of the settlement`}</span>, before any tax.</p>
</div>
<table class="lse-calc__table"><caption class="lse-vh">How the estimate is worked out</caption><tbody>
${rows}
</tbody></table>
<p class="lse-calc__compare" data-out="compare">${comparisonLine(d.order, r.orderDifference)}</p>
<p class="lse-calc__warn" data-out="warn" role="alert"${r.overdrawn ? '' : ' hidden'}>${OVERDRAWN_MESSAGE}</p>
<p class="lse-calc__invalid" data-out="invalid" hidden>Fix the marked fields to see your estimate.</p>
</div>
<p class="lse-calc__disclaimer"><strong>Estimate only, not legal advice.</strong> This tool gives an estimate for general information only. It is not legal advice and does not create an attorney-client relationship. Fees, costs, liens and taxes depend on your agreement, your state and the facts of your case. Ask your lawyer to confirm every figure.</p>
<noscript><p class="lse-calc__nojs">Your browser has JavaScript off, so the figures above stay on the example: a ${formatUsd(d.settlement)} settlement, a ${d.feeRate}% fee and ${formatUsd(d.costs)} in costs. The worked example below shows how to do the sum by hand.</p></noscript>
</div>`
    .split('\n')
    .filter((l) => l.trim() !== '')
    .join('\n');
}
