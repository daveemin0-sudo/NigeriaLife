import { showGameToast } from '../ui/GameToast';
import { Employment } from './Employment';

/**
 * Interactive Nigerian Career Minigames (Milestone B)
 * - Port Harcourt Petrochemical Refinery: Valve Pressure & Cracking Calibration
 * - LASTMA Traffic Management: Intersection Flow & Corridor Enforcement
 * - CcHUB Yaba: FinTech Code Sprint & Production Bug Hunt
 */
export class CareerMinigames {
  private static instance: CareerMinigames | null = null;
  private activeModal: HTMLElement | null = null;

  public static get(): CareerMinigames {
    if (!CareerMinigames.instance) {
      CareerMinigames.instance = new CareerMinigames();
    }
    return CareerMinigames.instance;
  }

  private closeActiveModal(): void {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
  }

  // =========================================================================
  // 1. Port Harcourt Refinery: Pressure & Catalytic Cracking Minigame
  // =========================================================================
  public openRefineryMinigame(onComplete?: (success: boolean) => void): void {
    this.closeActiveModal();

    let pressure = 110; // Target: 145 - 155
    let temp = 330;     // Target: 390 - 410
    const targetPressureMin = 142;
    const targetPressureMax = 158;
    const targetTempMin = 385;
    const targetTempMax = 415;

    const modal = document.createElement('div');
    modal.className = 'career-minigame-overlay';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(10, 15, 29, 0.88);
      backdrop-filter: blur(12px); z-index: 10000; display: flex;
      align-items: center; justify-content: center; font-family: var(--nl-font);
      color: #f8fafc;
    `;

    modal.innerHTML = `
      <div style="
        background: #0f172a; border: 2px solid #f59e0b; border-radius: 20px;
        width: 580px; max-width: 92vw; padding: 28px; box-shadow: 0 25px 60px rgba(0,0,0,0.8);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:32px;">🛢️</span>
            <div>
              <h3 style="margin:0; font-size:18px; color:#f59e0b; font-weight:800;">PH REFINERY: PROCESS VALVE CALIBRATION</h3>
              <span style="font-size:12px; color:#94a3b8;">Fractionation Tower T-101 • Target Range: 145-155 PSI | 390-410°C</span>
            </div>
          </div>
          <button id="refinery-game-close" style="background:#334155; border:0; color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer; font-weight:700;">✕</button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
          <!-- Pressure Gauge Card -->
          <div style="background:#1e293b; padding:16px; border-radius:14px; text-align:center; border:1px solid #334155;">
            <span style="font-size:12px; color:#cbd5e1; font-weight:600;">STEAM BOILER PRESSURE</span>
            <div id="gauge-pressure-val" style="font-size:36px; font-weight:900; color:#38bdf8; margin:8px 0;">${pressure} PSI</div>
            <div id="gauge-pressure-status" style="font-size:12px; font-weight:700; color:#ef4444;">⚠️ UNDER-PRESSURE</div>
          </div>

          <!-- Temperature Gauge Card -->
          <div style="background:#1e293b; padding:16px; border-radius:14px; text-align:center; border:1px solid #334155;">
            <span style="font-size:12px; color:#cbd5e1; font-weight:600;">CATALYTIC CRACKER TEMP</span>
            <div id="gauge-temp-val" style="font-size:36px; font-weight:900; color:#f97316; margin:8px 0;">${temp} °C</div>
            <div id="gauge-temp-status" style="font-size:12px; font-weight:700; color:#ef4444;">⚠️ LOW TEMPERATURE</div>
          </div>
        </div>

        <!-- Controls -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:22px;">
          <button id="btn-boost-inflow" style="background:#0284c7; color:#fff; border:0; padding:12px; border-radius:10px; font-weight:700; cursor:pointer;">
            ➕ Boost Steam (+15 PSI)
          </button>
          <button id="btn-vent-steam" style="background:#475569; color:#fff; border:0; padding:12px; border-radius:10px; font-weight:700; cursor:pointer;">
            ➖ Vent Valve (-12 PSI)
          </button>
          <button id="btn-fire-furnace" style="background:#ea580c; color:#fff; border:0; padding:12px; border-radius:10px; font-weight:700; cursor:pointer;">
            🔥 Fire Cracker (+25 °C)
          </button>
          <button id="btn-quench-oil" style="background:#475569; color:#fff; border:0; padding:12px; border-radius:10px; font-weight:700; cursor:pointer;">
            ❄️ Quench Line (-20 °C)
          </button>
        </div>

        <button id="btn-commit-batch" style="
          width:100%; background:#10b981; color:#fff; border:0; padding:14px;
          border-radius:12px; font-weight:800; font-size:15px; cursor:pointer;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
        ">
          ⚡ DISPATCH 33,000L PMS BATCH (COMMIT)
        </button>
      </div>
    `;

    document.body.appendChild(modal);
    this.activeModal = modal;

    const updateGauges = () => {
      const pVal = modal.querySelector('#gauge-pressure-val') as HTMLElement;
      const pStat = modal.querySelector('#gauge-pressure-status') as HTMLElement;
      const tVal = modal.querySelector('#gauge-temp-val') as HTMLElement;
      const tStat = modal.querySelector('#gauge-temp-status') as HTMLElement;

      if (pVal) pVal.textContent = `${pressure} PSI`;
      if (tVal) tVal.textContent = `${temp} °C`;

      const pOk = pressure >= targetPressureMin && pressure <= targetPressureMax;
      if (pStat) {
        pStat.textContent = pOk ? '✅ OPTIMAL PRESSURE' : pressure < targetPressureMin ? '⚠️ UNDER-PRESSURE' : '🚨 OVER-PRESSURE DANGER';
        pStat.style.color = pOk ? '#10b981' : '#ef4444';
      }

      const tOk = temp >= targetTempMin && temp <= targetTempMax;
      if (tStat) {
        tStat.textContent = tOk ? '✅ CRACKING ZONE OPTIMAL' : temp < targetTempMin ? '⚠️ LOW TEMPERATURE' : '🚨 FLARING DANGER';
        tStat.style.color = tOk ? '#10b981' : '#ef4444';
      }
    };

    modal.querySelector('#btn-boost-inflow')?.addEventListener('click', () => {
      pressure += 15;
      updateGauges();
    });
    modal.querySelector('#btn-vent-steam')?.addEventListener('click', () => {
      pressure = Math.max(80, pressure - 12);
      updateGauges();
    });
    modal.querySelector('#btn-fire-furnace')?.addEventListener('click', () => {
      temp += 25;
      updateGauges();
    });
    modal.querySelector('#btn-quench-oil')?.addEventListener('click', () => {
      temp = Math.max(250, temp - 20);
      updateGauges();
    });

    modal.querySelector('#btn-commit-batch')?.addEventListener('click', () => {
      const pOk = pressure >= targetPressureMin && pressure <= targetPressureMax;
      const tOk = temp >= targetTempMin && temp <= targetTempMax;

      if (pOk && tOk) {
        const jobs = Employment.get();
        const res = jobs.complete('ph-refinery');
        const payout = res.pay ?? 18000;
        showGameToast(`🎉 Excellent calibration! 33,000L PMS loaded into gantry tanker. Earned ₦${payout.toLocaleString()} & +35 XP!`, 'success');
        this.closeActiveModal();
        onComplete?.(true);
      } else {
        showGameToast('⚠️ Valves are out of calibration threshold! Tune gauges into the green zone before committing.', 'warning');
      }
    });

    modal.querySelector('#refinery-game-close')?.addEventListener('click', () => {
      this.closeActiveModal();
      onComplete?.(false);
    });
  }

  // =========================================================================
  // 2. LASTMA: Traffic Intersection Flow Controller Minigame
  // =========================================================================
  public openLastmaMinigame(onComplete?: (success: boolean) => void): void {
    this.closeActiveModal();

    let clearedIncidents = 0;
    const totalRequired = 3;

    const incidents = [
      {
        title: 'Overloaded Yellow Danfo Minibus',
        desc: 'Conductor hanging out the door, blocking the Broad Street inner turn.',
        actionA: 'Flag Down & Impound (Enforce)',
        actionB: 'Wave Onto Service Lane',
        correct: 'B',
      },
      {
        title: 'Executive Black SUV Driving One-Way',
        desc: 'Sirens blaring against oncoming traffic on Marina Expressway BRT corridor!',
        actionA: 'Wave Forward',
        actionB: 'Halt & Issue LASTMA Violation Ticket (₦15,000)',
        correct: 'B',
      },
      {
        title: 'Breakdown: Delivery Okada Stalled on Crosswalk',
        desc: 'Chain snapped at traffic light. Pedestrian flow halted.',
        actionA: 'Push Okada to Pedestrian Pavement & Clear Lane',
        actionB: 'Ignore & Watch',
        correct: 'A',
      },
    ];

    let currentIdx = 0;

    const modal = document.createElement('div');
    modal.className = 'career-minigame-overlay';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(12px); z-index: 10000; display: flex;
      align-items: center; justify-content: center; font-family: var(--nl-font);
      color: #f8fafc;
    `;

    const renderCard = () => {
      const inc = incidents[currentIdx];
      modal.innerHTML = `
        <div style="
          background: #0f172a; border: 2px solid #38bdf8; border-radius: 20px;
          width: 560px; max-width: 92vw; padding: 26px; box-shadow: 0 25px 60px rgba(0,0,0,0.8);
        ">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:32px;">👮‍♂️</span>
              <div>
                <h3 style="margin:0; font-size:18px; color:#38bdf8; font-weight:800;">LASTMA: INTERSECTION DISPATCH</h3>
                <span style="font-size:12px; color:#94a3b8;">Broad Street & Marina Junction • Incident ${currentIdx + 1} of ${totalRequired}</span>
              </div>
            </div>
            <button id="lastma-game-close" style="background:#334155; border:0; color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer; font-weight:700;">✕</button>
          </div>

          <div style="background:#1e293b; padding:18px; border-radius:14px; border:1px solid #334155; margin-bottom:20px;">
            <div style="font-size:16px; font-weight:700; color:#facc15; margin-bottom:6px;">${inc.title}</div>
            <div style="font-size:13px; color:#cbd5e1; line-height:1.5;">${inc.desc}</div>
          </div>

          <div style="display:flex; flex-direction:column; gap:12px;">
            <button id="btn-choice-a" style="background:#0369a1; color:#fff; border:0; padding:14px; border-radius:10px; font-weight:700; cursor:pointer; font-size:14px; text-align:left;">
              🅰️ ${inc.actionA}
            </button>
            <button id="btn-choice-b" style="background:#0284c7; color:#fff; border:0; padding:14px; border-radius:10px; font-weight:700; cursor:pointer; font-size:14px; text-align:left;">
              🅱️ ${inc.actionB}
            </button>
          </div>
        </div>
      `;

      modal.querySelector('#lastma-game-close')?.addEventListener('click', () => {
        this.closeActiveModal();
        onComplete?.(false);
      });

      const handleChoice = (choice: string) => {
        if (choice === inc.correct) {
          clearedIncidents++;
          showGameToast('✅ Correct enforcement protocol! Traffic moving smoothly.', 'success');
        } else {
          showGameToast('⚠️ Suboptimal traffic call, but shift continues.', 'warning');
        }

        currentIdx++;
        if (currentIdx < totalRequired) {
          renderCard();
        } else {
          // Finished shift
          const jobs = Employment.get();
          const res = jobs.complete('lastma-warden');
          const payout = res.pay ?? 14000;
          showGameToast(`👮‍♂️ Shift Completed! Traffic gridlock cleared. Earned ₦${payout.toLocaleString()} & +25 LASTMA Cred!`, 'success');
          this.closeActiveModal();
          onComplete?.(true);
        }
      };

      modal.querySelector('#btn-choice-a')?.addEventListener('click', () => handleChoice('A'));
      modal.querySelector('#btn-choice-b')?.addEventListener('click', () => handleChoice('B'));
    };

    renderCard();
    document.body.appendChild(modal);
    this.activeModal = modal;
  }

  // =========================================================================
  // 3. CcHUB Yaba: FinTech Code Sprint Minigame
  // =========================================================================
  public openTechHubMinigame(onComplete?: (success: boolean) => void): void {
    this.closeActiveModal();

    const modal = document.createElement('div');
    modal.className = 'career-minigame-overlay';
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(12px); z-index: 10000; display: flex;
      align-items: center; justify-content: center; font-family: var(--nl-font);
      color: #f8fafc;
    `;

    modal.innerHTML = `
      <div style="
        background: #0f172a; border: 2px solid #818cf8; border-radius: 20px;
        width: 600px; max-width: 92vw; padding: 26px; box-shadow: 0 25px 60px rgba(0,0,0,0.8);
      ">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:32px;">💻</span>
            <div>
              <h3 style="margin:0; font-size:18px; color:#818cf8; font-weight:800;">CCHUB YABA: CODE SPRINT & BUG FIX</h3>
              <span style="font-size:12px; color:#94a3b8;">NaijaPay Microservice v2.4 • Race Condition in Instant Naira Transfer</span>
            </div>
          </div>
          <button id="tech-game-close" style="background:#334155; border:0; color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer; font-weight:700;">✕</button>
        </div>

        <div style="background:#090d16; padding:16px; border-radius:12px; font-family:monospace; font-size:13px; color:#a5f3fc; border:1px solid #1e293b; margin-bottom:18px; line-height:1.6;">
          <span style="color:#64748b;">// Buggy NaijaPay Transfer Function</span><br/>
          <span style="color:#f472b6;">async function</span> <span style="color:#fbbf24;">transferNaira</span>(fromUser, toUser, amount) {<br/>
          &nbsp;&nbsp;<span style="color:#ef4444;">// BUG: Missing atomic wallet balance lock</span><br/>
          &nbsp;&nbsp;<span style="color:#f472b6;">const</span> senderBalance = <span style="color:#f472b6;">await</span> getBalance(fromUser);<br/>
          &nbsp;&nbsp;<span style="color:#f472b6;">await</span> creditWallet(toUser, amount);<br/>
          &nbsp;&nbsp;<span style="color:#f472b6;">await</span> debitWallet(fromUser, amount);<br/>
          }
        </div>

        <div style="font-size:13px; color:#cbd5e1; font-weight:600; margin-bottom:10px;">Select Optimal Production Patch:</div>

        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:18px;">
          <button class="tech-fix-btn" data-correct="false" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:12px; border-radius:10px; font-weight:600; cursor:pointer; text-align:left; font-size:13px;">
            A) Double the client-side timeout delay before calling creditWallet()
          </button>
          <button class="tech-fix-btn" data-correct="true" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:12px; border-radius:10px; font-weight:600; cursor:pointer; text-align:left; font-size:13px;">
            B) Wrap debit/credit in an Atomic Database Transaction with Idempotency Key
          </button>
          <button class="tech-fix-btn" data-correct="false" style="background:#1e293b; color:#fff; border:1px solid #334155; padding:12px; border-radius:10px; font-weight:600; cursor:pointer; text-align:left; font-size:13px;">
            C) Convert amount to US Dollars before calculating sender balance
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.activeModal = modal;

    modal.querySelector('#tech-game-close')?.addEventListener('click', () => {
      this.closeActiveModal();
      onComplete?.(false);
    });

    modal.querySelectorAll('.tech-fix-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const isCorrect = (e.currentTarget as HTMLElement).dataset.correct === 'true';
        if (isCorrect) {
          const jobs = Employment.get();
          const res = jobs.complete('cchub-yaba');
          const payout = res.pay ?? 26000;
          showGameToast(`🚀 PR Merged & Deployed! All CI/CD tests green. Earned ₦${payout.toLocaleString()} & +40 Tech XP!`, 'success');
          this.closeActiveModal();
          onComplete?.(true);
        } else {
          showGameToast('❌ Build Failed! That patch causes double-spending in production. Try again.', 'error');
        }
      });
    });
  }
}
