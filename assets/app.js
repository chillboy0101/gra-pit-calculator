'use strict';

(function () {
  const SSNIT_EMPLOYEE_RATE = 0.055;

  // Resident individual bands, Year of Assessment 2026.
  // Published on https://gra.gov.gh/domestic-tax/tax-types/paye/
  // Effective 1 September 2026 (Income Tax (Amendment) Act, 2026, Act 1178).
  const EMPLOYEE_PAYE_BANDS_2026_MONTHLY = [
    { amount: 588, rate: 0 },
    { amount: 80, rate: 5 },
    { amount: 100, rate: 10 },
    { amount: 2900, rate: 17.5 },
    { amount: 16000, rate: 25 },
    { amount: 30332, rate: 30 },
  ];

  const EMPLOYEE_PAYE_BANDS_2026_ANNUAL = [
    { amount: 7056, rate: 0 },
    { amount: 960, rate: 5 },
    { amount: 1200, rate: 10 },
    { amount: 34800, rate: 17.5 },
    { amount: 192000, rate: 25 },
    { amount: 363984, rate: 30 },
  ];

  const EMPLOYEE_EXCEEDING_THRESHOLD_2026_MONTHLY = 50000;
  const EMPLOYEE_EXCEEDING_THRESHOLD_2026_ANNUAL = 600000;

  const EMPLOYEE_PAYE_BANDS_2026_MONTHLY_CENTS = EMPLOYEE_PAYE_BANDS_2026_MONTHLY.map(function (b) {
    return { amountCents: Math.round(b.amount * 100), rate: b.rate };
  });

  const EMPLOYEE_PAYE_BANDS_2026_ANNUAL_CENTS = EMPLOYEE_PAYE_BANDS_2026_ANNUAL.map(function (b) {
    return { amountCents: Math.round(b.amount * 100), rate: b.rate };
  });

  function toCents(value) {
    if (!isFinite(value)) return 0;
    return Math.round(Number(value) * 100);
  }

  function fromCents(cents) {
    if (!isFinite(cents)) return 0;
    return Number(cents) / 100;
  }

  function formatCurrencyFromCents(cents) {
    if (!isFinite(cents)) return '';
    return (
      'GH¢ ' +
      fromCents(cents)
        .toFixed(2)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    );
  }

  function formatCurrency(amount) {
    if (!isFinite(amount)) return '';
    return 'GH¢ ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function parseNumber(raw) {
    const cleaned = String(raw == null ? '' : raw).replace(/,/g, '').trim();
    if (!cleaned) return { ok: false, value: 0 };
    if (!/^\d*(\.\d*)?$/.test(cleaned)) return { ok: false, value: 0 };
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return { ok: false, value: 0 };
    return { ok: true, value: n };
  }

  function calculateTaxCents(chargeableIncomeCents, bandsCents, topRatePercent) {
    if (chargeableIncomeCents <= 0 || !isFinite(chargeableIncomeCents)) {
      return 0;
    }

    let remaining = chargeableIncomeCents;
    let taxCents = 0;

    for (let i = 0; i < bandsCents.length; i++) {
      const band = bandsCents[i];
      if (remaining <= 0) break;

      const taxableInBandCents = Math.min(remaining, band.amountCents);
      if (taxableInBandCents > 0) {
        const rateBp = Math.round(band.rate * 100);
        const trancheTaxCents = Math.round((taxableInBandCents * rateBp) / 10000);
        taxCents += trancheTaxCents;
        remaining -= taxableInBandCents;
      }
    }

    if (remaining > 0) {
      const topRateBp = Math.round(topRatePercent * 100);
      taxCents += Math.round((remaining * topRateBp) / 10000);
    }

    return taxCents;
  }

  function buildBreakdownRowsCents(chargeableIncomeCents, bandsCents, topRatePercent) {
    const rows = [];
    let remaining = chargeableIncomeCents;
    let cumulativeTaxCents = 0;

    for (let i = 0; i < bandsCents.length; i++) {
      const band = bandsCents[i];
      if (remaining <= 0) break;

      const taxableInBandCents = Math.min(remaining, band.amountCents);
      const rateBp = Math.round(band.rate * 100);
      const taxOnBandCents = Math.round((taxableInBandCents * rateBp) / 10000);

      cumulativeTaxCents += taxOnBandCents;
      remaining -= taxableInBandCents;

      rows.push({
        index: i,
        taxableAmountCents: taxableInBandCents,
        rate: band.rate,
        taxOnBandCents,
        cumulativeTaxCents,
      });
    }

    if (remaining > 0) {
      const topRateBp = Math.round(topRatePercent * 100);
      const taxOnBandCents = Math.round((remaining * topRateBp) / 10000);
      cumulativeTaxCents += taxOnBandCents;

      rows.push({
        index: bandsCents.length,
        taxableAmountCents: remaining,
        rate: topRatePercent,
        taxOnBandCents,
        cumulativeTaxCents,
        isExcess: true,
      });
    }

    return rows;
  }

  function buildPayeCumulativeTable(bands) {
    const table = [];
    let cumulativeIncome = 0;
    let cumulativeTax = 0;

    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      const incomeInBand = band.amount;
      const taxOnBand = incomeInBand * (band.rate / 100);

      cumulativeIncome += incomeInBand;
      cumulativeTax += taxOnBand;

      table.push({
        chargeableIncome: incomeInBand,
        rate: band.rate,
        taxPayable: taxOnBand,
        cumulativeIncome,
        cumulativeTax,
      });
    }

    return table;
  }

  function ensureIncomeTaxMarkup() {
    const mount = document.getElementById('gra-pit-calculator');
    if (!mount) return;

    if (document.getElementById('income-tax-form')) return;

    try {
      const hasGoodlayersLayout = !!(
        document.getElementById('gdlr-core-column-paye') ||
        document.querySelector('.gdlr-core-pbf-sidebar-wrapper') ||
        document.querySelector('.gdlr-core-page-builder-body')
      );

      if (!hasGoodlayersLayout) {
        mount.classList.add('gra-pit-standalone');
      } else {
        mount.classList.remove('gra-pit-standalone');
      }
    } catch (e) {
      return;
    }

    mount.innerHTML = `
      <div class="gra-main-panel paye-vat-shell">
        <div class="paye-vat-header">
          <h5>Personal Income Tax (PIT) Calculator</h5>
        </div>
        <div class="paye-vat-body">
          <div class="paye-vat-grid" style="display: block;">
            <div class="paye-vat-col" style="margin: 0 auto 40px;">
              <div class="paye-vat-card">
                <div class="paye-vat-section-title">Income, allowances, and relief</div>
                <form id="income-tax-form" novalidate>
                  <div class="gra-field">
                    <label class="gra-label">Basis</label>
                    <div class="paye-type-toggle" style="margin-top: 6px;">
                      <label>
                        <input type="radio" name="incomeTaxBasis" id="incomeTaxBasisMonthly" value="monthly" checked />
                        <span class="paye-type-option">Monthly</span>
                      </label>
                      <label>
                        <input type="radio" name="incomeTaxBasis" id="incomeTaxBasisAnnual" value="annual" />
                        <span class="paye-type-option">Annual</span>
                      </label>
                    </div>
                  </div>

                  <div class="paye-field-divider"></div>

                  <div class="gra-field">
                    <label id="basicIncomeLabel" class="gra-label" for="basicIncome">Monthly basic income <span aria-hidden="true" style="color: #b91c1c;">*</span></label>
                    <div class="gra-input-wrap" style="margin-top: 6px;">
                      <span class="gra-input-prefix">GH¢</span>
                      <input id="basicIncome" class="gra-input" inputmode="decimal" autocomplete="off" placeholder="e.g. 5000.00" required />
                    </div>
                    <p id="basicIncomeError" class="gra-error" role="alert"><span id="basicIncomeErrorText">Enter the monthly basic income.</span></p>
                  </div>

                  <div class="paye-field-divider"></div>

                  <div class="gra-field">
                    <label id="allowancesLabel" class="gra-label" for="allowances">Monthly allowances (Allowances are included in chargeable income)</label>
                    <div class="gra-input-wrap" style="margin-top: 6px;">
                      <span class="gra-input-prefix">GH¢</span>
                      <input id="allowances" class="gra-input" inputmode="decimal" autocomplete="off" placeholder="e.g. 0.00" />
                    </div>
                  </div>

                  <div class="paye-field-divider"></div>

                  <div class="gra-field">
                    <label id="taxReliefLabel" class="gra-label" for="taxRelief">Tax relief</label>
                    <div class="gra-input-wrap" style="margin-top: 6px;">
                      <span class="gra-input-prefix">GH¢</span>
                      <input id="taxRelief" class="gra-input" inputmode="decimal" autocomplete="off" placeholder="e.g. 0.00" />
                    </div>
                  </div>

                  <div class="gra-actions" style="flex-direction: column; align-items: stretch;">
                    <button type="submit" class="gra-btn-primary">Calculate</button>
                    <button type="button" id="resetBtn" class="gra-btn-secondary" style="width: 100%;">Clear</button>
                  </div>
                </form>

                <section id="income-tax-results" class="gra-results is-hidden" aria-live="polite">
                  <div class="paye-results-simple">
                    <div class="paye-result-line"><span id="resultGrossLabel" class="paye-result-label">GROSS INCOME:</span><span id="resultGross" class="paye-result-value"></span></div>
                    <div class="paye-result-line"><span id="resultSsnitLabel" class="paye-result-label">SSNIT (EMPLOYEE):</span><span id="resultSsnit" class="paye-result-value"></span></div>
                    <div class="paye-result-line">
                      <span id="resultTaxableLabel" class="paye-result-label">TAXABLE INCOME:</span><span id="resultTaxable" class="paye-result-value"></span>
                    </div>
                    <div class="paye-result-line"><span id="resultTaxLabel" class="paye-result-label">INCOME TAX (PAYE):</span><span id="resultTax" class="paye-result-value"></span></div>
                    <div class="paye-result-line" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #cbd5e1;"><span id="resultNetLabel" class="paye-result-label">NET INCOME (TAKE HOME):</span><span id="resultNet" class="paye-result-value"></span></div>
                  </div>

                  <button type="button" id="breakdownToggleBtn" class="gra-btn-secondary" style="width: 100%; margin-top: 10px;">View tax breakdown</button>

                  <div id="incomeTaxBreakdown" class="is-hidden" aria-label="Income tax breakdown">
                    <div class="table-wrapper">
                      <table class="fl-table">
                        <thead>
                          <tr>
                            <th><strong id="breakdownCaption">Band (monthly)</strong></th>
                            <th><strong>Rate (%)</strong></th>
                            <th><strong>Tax on band (GH¢)</strong></th>
                            <th><strong>Taxable amount (GH¢)</strong></th>
                            <th><strong>Cumulative tax (GH¢)</strong></th>
                          </tr>
                        </thead>
                        <tbody id="breakdownBody"></tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div class="paye-vat-col" style="margin: 0 auto 20px;">
              <div class="paye-vat-card">
                <div class="paye-vat-section-title">PAYE Bands</div>
                <div class="table-wrapper">
                  <table class="fl-table" aria-label="Year of Assessment 2026 tax bands">
                    <thead>
                      <tr>
                        <th><strong id="bandsCaption">Year of Assessment 2026 (Monthly)</strong></th>
                        <th><strong>Chargeable Income GH¢</strong></th>
                        <th><strong>Rate %</strong></th>
                        <th><strong>Tax Payable GH¢</strong></th>
                        <th><strong>Cumulative Income GH¢</strong></th>
                        <th><strong>Cumulative Tax GH¢</strong></th>
                      </tr>
                    </thead>
                    <tbody id="bandsTableBody"></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    try {
      const existingPanel = document.getElementById('pit-explainer-panel');
      if (!existingPanel) {
        const panel = document.createElement('div');
        panel.id = 'pit-explainer-panel';
        panel.style.marginTop = '18px';
        panel.innerHTML =
          '<div style="font-weight:700; color:#3e4494; margin-bottom:6px;">PIT explained</div>' +
          '<div class="gra-hint" style="margin-top: 0;">' +
          'Understand personal income tax, who must pay, how it works, and the latest guidance. ' +
          '<a href="https://gra.gov.gh/domestic-tax/personal-income-tax/">Open PIT information page</a>' +
          '</div>' +
          '<div style="font-weight:700; color:#3e4494; margin-bottom:6px; margin-top:18px;">Personal tax reliefs</div>' +
          '<div class="gra-hint" style="margin-top: 0;">' +
          'Learn about available personal tax reliefs and how to claim them. ' +
          '<a href="https://gra.gov.gh/domestic-tax/personal-tax-relief/">Open personal tax reliefs page</a>' +
          '</div>' +
          '<div style="font-weight:700; color:#3e4494; margin-bottom:6px; margin-top:18px;">File and Pay taxes</div>' +
          '<div class="gra-hint" style="margin-top: 0;">' +
          'Register, file your returns, and pay your taxes online through the GRA portal. ' +
          '<a href="https://taxpayersportal.com/auth">Open File and Pay portal</a>' +
          '</div>';

        const pitCards = mount.querySelectorAll('.paye-vat-col .paye-vat-card');
        const pitBandsCard = pitCards && pitCards.length > 1 ? pitCards[1] : null;
        if (pitBandsCard && pitBandsCard.parentNode) {
          if (pitBandsCard.nextSibling) {
            pitBandsCard.parentNode.insertBefore(panel, pitBandsCard.nextSibling);
          } else {
            pitBandsCard.parentNode.appendChild(panel);
          }
        }
      }
    } catch (e) {
      // ignore
    }

    try {
      const existingDisclaimer = document.getElementById('pit-disclaimer-section');
      if (!existingDisclaimer) {
        const disclaimer = document.createElement('div');
        disclaimer.id = 'pit-disclaimer-section';
        disclaimer.style.marginTop = '130px';
        disclaimer.className = 'gdlr-core-pbf-element';
        disclaimer.innerHTML =
          '<div class="gdlr-core-title-item gdlr-core-item-pdb clearfix gdlr-core-left-align gdlr-core-title-item-caption-bottom gdlr_core-item-pdlr" style="padding-left: 20px;">' +
          '<div class="gdlr-core-title-item-title-wrap">' +
          '<h3 class="gdlr-core-title-item-title gdlr-core-skin-title" style="font-size: 20px; font-weight: 600; text-transform: none; color: #313787;">' +
          'Disclaimer on Use Of Tax Calculators' +
          '<span class="gdlr-core-title-item-title-divider gdlr-core-skin-divider"></span>' +
          '</h3>' +
          '</div>' +
          '<span class="gdlr-core-title-item-caption gdlr-core-info-font gdlr-core-skin-caption">' +
          'The use of the Tax Calculators only serves as a guideline. The actual tax payable by you or deduction available to you (if any) will depend on your personal circumstances. It is advised that for filing of returns and for making formal financial decisions, the exact calculation be made as per the provisions contained in the relevant Acts, and Laws.' +
          '</span>' +
          '</div>';

        const contentColumn = document.querySelector('.gdlr-core-pbf-sidebar-content-inner') ||
          document.querySelector('.gdlr-core-pbf-sidebar-content') ||
          mount.parentNode;

        if (contentColumn) {
          contentColumn.appendChild(disclaimer);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  function netIncomeCents(basic, allowances, relief, isAnnual) {
    const basicCents = toCents(basic);
    const allowancesCents = toCents(allowances);
    const reliefCents = toCents(relief);
    const ssnitCents = Math.round(basicCents * SSNIT_EMPLOYEE_RATE);
    const taxableIncomeCents = Math.max(0, basicCents - ssnitCents - reliefCents + allowancesCents);
    const payeTaxCents = calculateTaxCents(
      taxableIncomeCents,
      isAnnual ? EMPLOYEE_PAYE_BANDS_2026_ANNUAL_CENTS : EMPLOYEE_PAYE_BANDS_2026_MONTHLY_CENTS,
      35
    );
    return {
      ssnitCents: ssnitCents,
      taxableIncomeCents: taxableIncomeCents,
      payeTaxCents: payeTaxCents,
      netIncomeCents: basicCents + allowancesCents - ssnitCents - payeTaxCents,
    };
  }

  function runSelfTest() {
    if (!window || !window.location) return;
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('selftest') !== '1') return;

    const cases = [
      { name: 'Monthly basic 588', basic: 588, allowances: 0, relief: 0, annual: false, ssnit: 3234, tax: 0, net: 55566 },
      { name: 'Monthly basic 1000', basic: 1000, allowances: 0, relief: 0, annual: false, ssnit: 5500, tax: 4498, net: 90002 },
      { name: 'Monthly basic 5000', basic: 5000, allowances: 0, relief: 0, annual: false, ssnit: 27500, tax: 78575, net: 393925 },
    ];

    const bandChecks = [
      { name: 'Monthly chargeable 50000', cents: 5000000, annual: false, tax: 1362110 },
      { name: 'Monthly chargeable 50001', cents: 5000100, annual: false, tax: 1362145 },
      { name: 'Annual chargeable 600000', cents: 60000000, annual: true, tax: 16345320 },
    ];

    let passed = 0;
    let failed = 0;
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const actual = netIncomeCents(c.basic, c.allowances, c.relief, c.annual);
      const ok = actual.ssnitCents === c.ssnit && actual.payeTaxCents === c.tax && actual.netIncomeCents === c.net;
      if (ok) {
        passed += 1;
      } else {
        failed += 1;
        console.error('[PIT selftest] FAIL:', c.name, actual);
      }
    }

    for (let i = 0; i < bandChecks.length; i++) {
      const c = bandChecks[i];
      const actual = calculateTaxCents(
        c.cents,
        c.annual ? EMPLOYEE_PAYE_BANDS_2026_ANNUAL_CENTS : EMPLOYEE_PAYE_BANDS_2026_MONTHLY_CENTS,
        35
      );
      if (actual === c.tax) {
        passed += 1;
      } else {
        failed += 1;
        console.error('[PIT selftest] FAIL:', c.name, { actual: actual, expected: c.tax });
      }
    }

    const note = document.createElement('p');
    note.id = 'pit-selftest';
    note.textContent = failed === 0 ? 'PIT selftest PASS ' + passed : 'PIT selftest FAIL ' + failed;
    document.body.appendChild(note);
  }

  function bootPitCalculator() {
  ensureIncomeTaxMarkup();

  const form = document.getElementById('income-tax-form');
  const resetBtn = document.getElementById('resetBtn');
  const basicIncomeEl = document.getElementById('basicIncome');
  const allowancesEl = document.getElementById('allowances');
  const taxReliefEl = document.getElementById('taxRelief');

  const basisMonthlyEl = document.getElementById('incomeTaxBasisMonthly');
  const basisAnnualEl = document.getElementById('incomeTaxBasisAnnual');

  const basicIncomeLabelEl = document.getElementById('basicIncomeLabel');
  const allowancesLabelEl = document.getElementById('allowancesLabel');
  const taxReliefLabelEl = document.getElementById('taxReliefLabel');

  const basicIncomeErrorEl = document.getElementById('basicIncomeError');
  const basicIncomeErrorTextEl = document.getElementById('basicIncomeErrorText');

  const resultsEl = document.getElementById('income-tax-results');
  const resultGrossEl = document.getElementById('resultGross');
  const resultNetEl = document.getElementById('resultNet');
  const resultTaxEl = document.getElementById('resultTax');
  const resultSsnitEl = document.getElementById('resultSsnit');
  const resultTaxableEl = document.getElementById('resultTaxable');

  const resultGrossLabelEl = document.getElementById('resultGrossLabel');
  const resultNetLabelEl = document.getElementById('resultNetLabel');
  const resultTaxLabelEl = document.getElementById('resultTaxLabel');
  const resultSsnitLabelEl = document.getElementById('resultSsnitLabel');
  const resultTaxableLabelEl = document.getElementById('resultTaxableLabel');

  const breakdownToggleBtn = document.getElementById('breakdownToggleBtn');
  const breakdownWrap = document.getElementById('incomeTaxBreakdown');
  const breakdownCaptionEl = document.getElementById('breakdownCaption');
  const breakdownBodyEl = document.getElementById('breakdownBody');

  const bandsTableBodyEl = document.getElementById('bandsTableBody');
  const bandsCaptionEl = document.getElementById('bandsCaption');

  if (!form || !basicIncomeEl) return;

  function setError(msg) {
    if (basicIncomeErrorTextEl) basicIncomeErrorTextEl.textContent = msg;
    if (basicIncomeErrorEl) basicIncomeErrorEl.classList.add('is-visible');
    if (basicIncomeEl) {
      basicIncomeEl.setAttribute('aria-invalid', 'true');
      basicIncomeEl.focus();
    }
  }

  function clearError() {
    if (basicIncomeErrorEl) basicIncomeErrorEl.classList.remove('is-visible');
    if (basicIncomeEl) basicIncomeEl.removeAttribute('aria-invalid');
  }

  function resetBreakdownUi() {
    if (breakdownWrap) breakdownWrap.classList.add('is-hidden');
    if (breakdownToggleBtn) breakdownToggleBtn.textContent = 'View tax breakdown';
    if (breakdownBodyEl) breakdownBodyEl.innerHTML = '';
  }

  function toggleBreakdown() {
    if (!breakdownWrap || !breakdownToggleBtn) return;

    const isHidden = breakdownWrap.classList.contains('is-hidden');
    if (isHidden) {
      breakdownWrap.classList.remove('is-hidden');
      breakdownToggleBtn.textContent = 'Hide tax breakdown';
    } else {
      breakdownWrap.classList.add('is-hidden');
      breakdownToggleBtn.textContent = 'View tax breakdown';
    }
  }

  function renderBreakdown(chargeableBase, bands) {
    if (!breakdownWrap || !breakdownBodyEl || !breakdownCaptionEl) return;

    const basis = resolveBasis();
    breakdownCaptionEl.textContent = basis === 'annual' ? 'Band (annual)' : 'Band (monthly)';
    breakdownBodyEl.innerHTML = '';

    const formatter = new Intl.NumberFormat('en-GH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const rows = buildBreakdownRowsCents(
      toCents(chargeableBase),
      basis === 'annual' ? EMPLOYEE_PAYE_BANDS_2026_ANNUAL_CENTS : EMPLOYEE_PAYE_BANDS_2026_MONTHLY_CENTS,
      35
    );

    const exceedingThreshold =
      basis === 'annual'
        ? EMPLOYEE_EXCEEDING_THRESHOLD_2026_ANNUAL
        : EMPLOYEE_EXCEEDING_THRESHOLD_2026_MONTHLY;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowEl = document.createElement('tr');

      const colBand = document.createElement('td');
      if (r.isExcess) {
        colBand.innerHTML = '<strong>Exceeding ' + formatter.format(exceedingThreshold) + '</strong>';
      } else {
        const labelPrefix = r.index === 0 ? 'First ' : 'Next ';
        colBand.innerHTML = '<strong>' + labelPrefix + formatter.format(bands[r.index].amount) + '</strong>';
      }

      const colRate = document.createElement('td');
      colRate.innerHTML = '<strong>' + String(r.rate) + '</strong>';

      const colTax = document.createElement('td');
      colTax.innerHTML = '<strong>' + formatter.format(fromCents(r.taxOnBandCents)) + '</strong>';

      const colTaxable = document.createElement('td');
      colTaxable.innerHTML = '<strong>' + formatter.format(fromCents(r.taxableAmountCents)) + '</strong>';

      const colCumTax = document.createElement('td');
      colCumTax.innerHTML = '<strong>' + formatter.format(fromCents(r.cumulativeTaxCents)) + '</strong>';

      rowEl.appendChild(colBand);
      rowEl.appendChild(colRate);
      rowEl.appendChild(colTax);
      rowEl.appendChild(colTaxable);
      rowEl.appendChild(colCumTax);

      breakdownBodyEl.appendChild(rowEl);
    }

    if (breakdownWrap) breakdownWrap.classList.add('is-hidden');
    if (breakdownToggleBtn) breakdownToggleBtn.textContent = 'View tax breakdown';
  }

  function resolveBasis() {
    if (basisAnnualEl && basisAnnualEl.checked) return 'annual';
    return 'monthly';
  }

  function updateUiForBasis() {
    const basis = resolveBasis();
    const isAnnual = basis === 'annual';

    if (basicIncomeLabelEl) {
      basicIncomeLabelEl.innerHTML = isAnnual
        ? 'Annual basic income <span aria-hidden="true" style="color: #b91c1c;">*</span>'
        : 'Monthly basic income <span aria-hidden="true" style="color: #b91c1c;">*</span>';
    }

    if (allowancesLabelEl) {
      allowancesLabelEl.textContent = isAnnual
        ? 'Annual allowances (Allowances are included in chargeable income)'
        : 'Monthly allowances (Allowances are included in chargeable income)';
    }

    if (taxReliefLabelEl) {
      taxReliefLabelEl.textContent = isAnnual
        ? 'Tax relief (Enter your total annual tax relief if any)'
        : 'Tax relief (Enter your total monthly tax relief if any)';
    }

    if (basicIncomeEl) {
      basicIncomeEl.setAttribute('placeholder', isAnnual ? 'e.g. 60000.00' : 'e.g. 5000.00');
    }

    if (allowancesEl) {
      allowancesEl.setAttribute('placeholder', isAnnual ? 'e.g. 0.00' : 'e.g. 0.00');
    }

    if (taxReliefEl) {
      taxReliefEl.setAttribute('placeholder', isAnnual ? 'e.g. 0.00' : 'e.g. 0.00');
    }

    if (resultNetLabelEl) {
      resultNetLabelEl.textContent = isAnnual ? 'NET INCOME (ANNUAL):' : 'NET INCOME (TAKE HOME):';
    }

    if (resultGrossLabelEl) {
      resultGrossLabelEl.textContent = isAnnual ? 'GROSS INCOME (ANNUAL):' : 'GROSS INCOME:';
    }

    if (resultTaxLabelEl) {
      resultTaxLabelEl.textContent = isAnnual ? 'INCOME TAX (PAYE) (ANNUAL):' : 'INCOME TAX (PAYE):';
    }

    if (resultSsnitLabelEl) {
      resultSsnitLabelEl.textContent = isAnnual ? 'SSNIT (EMPLOYEE) (ANNUAL):' : 'SSNIT (EMPLOYEE):';
    }

    if (resultTaxableLabelEl) {
      resultTaxableLabelEl.textContent = isAnnual ? 'TAXABLE INCOME (ANNUAL):' : 'TAXABLE INCOME:';
    }

    if (bandsCaptionEl) {
      bandsCaptionEl.textContent = isAnnual ? 'Year of Assessment 2026 (Annual)' : 'Year of Assessment 2026 (Monthly)';
    }
  }

  function renderBandsTable() {
    if (!bandsTableBodyEl) return;

    const basis = resolveBasis();
    const bands = buildPayeCumulativeTable(
      basis === 'annual' ? EMPLOYEE_PAYE_BANDS_2026_ANNUAL : EMPLOYEE_PAYE_BANDS_2026_MONTHLY
    );
    bandsTableBodyEl.innerHTML = '';

    const formatter = new Intl.NumberFormat('en-GH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

    for (let i = 0; i < bands.length; i++) {
      const row = document.createElement('tr');
      const bandData = bands[i];
      const labelPrefix = i === 0 ? 'First' : 'Next';

      const colLabel = document.createElement('td');
      colLabel.innerHTML = '<strong>' + labelPrefix + '</strong>';

      const colBand = document.createElement('td');
      colBand.innerHTML = '<strong>' + formatter.format(bandData.chargeableIncome) + '</strong>';

      const colRate = document.createElement('td');
      colRate.innerHTML = '<strong>' + String(bandData.rate) + '</strong>';

      const colTax = document.createElement('td');
      colTax.innerHTML = '<strong>' + formatter.format(bandData.taxPayable) + '</strong>';

      const colCumIncome = document.createElement('td');
      colCumIncome.innerHTML = '<strong>' + formatter.format(bandData.cumulativeIncome) + '</strong>';

      const colCumTax = document.createElement('td');
      colCumTax.innerHTML = '<strong>' + formatter.format(bandData.cumulativeTax) + '</strong>';

      row.appendChild(colLabel);
      row.appendChild(colBand);
      row.appendChild(colRate);
      row.appendChild(colTax);
      row.appendChild(colCumIncome);
      row.appendChild(colCumTax);

      bandsTableBodyEl.appendChild(row);
    }

    const exceedingRow = document.createElement('tr');

    const exceedingThreshold =
      basis === 'annual'
        ? EMPLOYEE_EXCEEDING_THRESHOLD_2026_ANNUAL
        : EMPLOYEE_EXCEEDING_THRESHOLD_2026_MONTHLY;

    const colLabelExc = document.createElement('td');
    colLabelExc.innerHTML = '<strong>Exceeding</strong>';

    const colBandExc = document.createElement('td');
    colBandExc.innerHTML = '<strong>' + formatter.format(exceedingThreshold) + '</strong>';

    const colRateExc = document.createElement('td');
    colRateExc.innerHTML = '<strong>35</strong>';

    const colTaxExc = document.createElement('td');
    colTaxExc.innerHTML = '<strong></strong>';

    const colCumIncomeExc = document.createElement('td');
    colCumIncomeExc.innerHTML = '<strong></strong>';

    const colCumTaxExc = document.createElement('td');
    colCumTaxExc.innerHTML = '<strong></strong>';

    exceedingRow.appendChild(colLabelExc);
    exceedingRow.appendChild(colBandExc);
    exceedingRow.appendChild(colRateExc);
    exceedingRow.appendChild(colTaxExc);
    exceedingRow.appendChild(colCumIncomeExc);
    exceedingRow.appendChild(colCumTaxExc);

    bandsTableBodyEl.appendChild(exceedingRow);
  }

  function normalizeAmountInput(el) {
    if (!el) return;

    el.addEventListener('input', function () {
      const raw = String(this.value);
      if (!raw.includes('.')) return;

      const parts = raw.split('.');
      const integerPart = parts[0];
      const fracPart = parts.slice(1).join('');

      const limitedFrac = fracPart.slice(0, 2);
      const next = limitedFrac.length > 0 ? integerPart + '.' + limitedFrac : integerPart + '.';

      if (next !== raw) {
        this.value = next;
      }
    });

    el.addEventListener('blur', function () {
      const raw = String(this.value).trim();
      if (raw === '') return;
      const parsed = parseNumber(raw);
      if (!parsed.ok) return;
      this.value = parsed.value.toFixed(2);
    });
  }

  function handleReset() {
    if (basicIncomeEl) basicIncomeEl.value = '';
    if (allowancesEl) allowancesEl.value = '';
    if (taxReliefEl) taxReliefEl.value = '';
    clearError();
    if (resultsEl) resultsEl.classList.add('is-hidden');
    resetBreakdownUi();

    if (resultGrossEl) resultGrossEl.textContent = '';
    if (resultNetEl) resultNetEl.textContent = '';
    if (resultTaxEl) resultTaxEl.textContent = '';
    if (resultSsnitEl) resultSsnitEl.textContent = '';
    if (resultTaxableEl) resultTaxableEl.textContent = '';
  }

  function handleCalculate(event) {
    event.preventDefault();

    const rawBasic = String(basicIncomeEl.value == null ? '' : basicIncomeEl.value).trim();
    const basicIsAnnual = resolveBasis() === 'annual';
    const basicParsed = parseNumber(basicIncomeEl.value);
    if (!rawBasic) {
      setError(basicIsAnnual ? 'Enter the annual basic income.' : 'Enter the monthly basic income.');
      if (resultsEl) resultsEl.classList.add('is-hidden');
      resetBreakdownUi();
      return;
    }
    if (!basicParsed.ok) {
      setError('Enter a number, such as 5000.00.');
      if (resultsEl) resultsEl.classList.add('is-hidden');
      resetBreakdownUi();
      return;
    }
    if (basicParsed.value <= 0) {
      setError('Enter an amount greater than zero.');
      if (resultsEl) resultsEl.classList.add('is-hidden');
      resetBreakdownUi();
      return;
    }

    clearError();

    const allowancesParsed = parseNumber(allowancesEl ? allowancesEl.value : '');
    const reliefParsed = parseNumber(taxReliefEl ? taxReliefEl.value : '');

    const basis = resolveBasis();
    const isAnnual = basis === 'annual';

    const basicCents = toCents(basicParsed.value);
    const allowancesCents = toCents(allowancesParsed.ok ? allowancesParsed.value : 0);

    const grossIncomeCents = basicCents + allowancesCents;
    const result = netIncomeCents(basicParsed.value, allowancesParsed.ok ? allowancesParsed.value : 0, reliefParsed.ok ? reliefParsed.value : 0, isAnnual);
    const ssnitCents = result.ssnitCents;
    const taxableIncomeCents = result.taxableIncomeCents;
    const payeTaxCents = result.payeTaxCents;
    const netCents = result.netIncomeCents;

    if (resultGrossEl) resultGrossEl.textContent = formatCurrencyFromCents(grossIncomeCents);
    if (resultNetEl) resultNetEl.textContent = formatCurrencyFromCents(netCents);
    if (resultTaxEl) resultTaxEl.textContent = formatCurrencyFromCents(payeTaxCents);
    if (resultSsnitEl) resultSsnitEl.textContent = formatCurrencyFromCents(ssnitCents);
    if (resultTaxableEl) resultTaxableEl.textContent = formatCurrencyFromCents(taxableIncomeCents);

    if (resultsEl) resultsEl.classList.remove('is-hidden');

    renderBreakdown(
      fromCents(taxableIncomeCents),
      isAnnual ? EMPLOYEE_PAYE_BANDS_2026_ANNUAL : EMPLOYEE_PAYE_BANDS_2026_MONTHLY
    );
  }

  if (form) {
    form.addEventListener('submit', handleCalculate);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', handleReset);
  }

  if (breakdownToggleBtn) {
    breakdownToggleBtn.addEventListener('click', toggleBreakdown);
  }

  normalizeAmountInput(basicIncomeEl);
  normalizeAmountInput(allowancesEl);
  normalizeAmountInput(taxReliefEl);

  function applyBasis() {
    updateUiForBasis();
    renderBandsTable();
    resetBreakdownUi();
    clearError();
  }

  function clearAmountsForBasisChange() {
    if (basicIncomeEl) basicIncomeEl.value = '';
    if (allowancesEl) allowancesEl.value = '';
    if (taxReliefEl) taxReliefEl.value = '';
    if (resultsEl) resultsEl.classList.add('is-hidden');
  }

  if (basisMonthlyEl) {
    basisMonthlyEl.addEventListener('change', function () {
      if (this.checked) {
        clearAmountsForBasisChange();
        applyBasis();
      }
    });
  }

  if (basisAnnualEl) {
    basisAnnualEl.addEventListener('change', function () {
      if (this.checked) {
        clearAmountsForBasisChange();
        applyBasis();
      }
    });
  }

  applyBasis();
  runSelfTest();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootPitCalculator);
  } else {
    bootPitCalculator();
  }
})();
