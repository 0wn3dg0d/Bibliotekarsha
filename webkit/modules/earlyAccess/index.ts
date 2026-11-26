import { StoreWebkitConfig, fetchViaBackend, idbGet, idbSet } from '../../shared/ipc';

const EAORDATE_STORAGE_KEY = 'USE_EarlyAccess_ordateData_v1';
const EAORDATE_URL =
  'https://gist.githubusercontent.com/0wn3dg0d/58a8e35f3d34014ea749a22d02f7e203/raw/eaordate.json';
const CACHE_DURATION = 180 * 24 * 60 * 60 * 1000;

interface EaOrdateItem {
  appid: number;
  ordate: string;
}

function getYearForm(n: number): string {
  n = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'лет';
  if (n1 === 1) return 'год';
  if (n1 >= 2 && n1 <= 4) return 'года';
  return 'лет';
}

function getMonthForm(n: number): string {
  n = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'месяцев';
  if (n1 === 1) return 'месяц';
  if (n1 >= 2 && n1 <= 4) return 'месяца';
  return 'месяцев';
}

function parseSteamDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();

  const numericParts = clean.split('.');
  if (numericParts.length === 3) {
    const day = parseInt(numericParts[0], 10);
    const month = parseInt(numericParts[1], 10) - 1;
    const year = parseInt(numericParts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }

  const monthsMap: Record<string, number> = {
    янв: 0, фев: 1, мар: 2, апр: 3, мая: 4, май: 4, июн: 5, июл: 6, авг: 7, сен: 8, окт: 9, ноя: 10, дек: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const cleanedStr = clean.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = cleanedStr.split(' ');
  if (parts.length >= 3) {
    if (/^\d+$/.test(parts[0])) {
      const day = parseInt(parts[0], 10);
      const monthKey = parts[1].substring(0, 3).toLowerCase();
      const year = parseInt(parts[2], 10);
      if (monthKey in monthsMap && !isNaN(day) && !isNaN(year)) {
        return new Date(year, monthsMap[monthKey], day);
      }
    } else if (/^\d+$/.test(parts[1])) {
      const monthKey = parts[0].substring(0, 3).toLowerCase();
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      if (monthKey in monthsMap && !isNaN(day) && !isNaN(year)) {
        return new Date(year, monthsMap[monthKey], day);
      }
    }
  }

  const fallback = new Date(clean);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function calculateDuration(startDate: Date, endDate: Date): string {
  let diffMonths =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  if (endDate.getDate() < startDate.getDate()) diffMonths--;
  if (diffMonths < 0) diffMonths = 0;

  const years = Math.floor(diffMonths / 12);
  const months = diffMonths % 12;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${getYearForm(years)}`);
  if (months > 0) parts.push(`${months} ${getMonthForm(months)}`);

  return parts.length > 0 ? parts.join(' и ') : 'менее месяца';
}

async function fetchOrdateData(): Promise<EaOrdateItem[]> {
  const cached = await idbGet<{ timestamp: number; data: EaOrdateItem[] }>(EAORDATE_STORAGE_KEY);
  if (cached && Array.isArray(cached.data) && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const res = await fetchViaBackend(EAORDATE_URL);
  if (res.ok && res.body) {
    try {
      const data = JSON.parse(res.body);
      if (Array.isArray(data)) {
        await idbSet(EAORDATE_STORAGE_KEY, { timestamp: Date.now(), data });
        return data;
      }
    } catch {}
  }
  return cached?.data || [];
}

function createInfoBox(duration: string | null, isReleased: boolean): HTMLDivElement {
  const borderColor = isReleased ? '#2A568E' : '#f5a623';
  const accentColor = isReleased ? '#67c1f5' : '#f5a623';

  const infoBox = document.createElement('div');
  infoBox.className = 'bsh-early-access-badge';
  Object.assign(infoBox.style, {
    position: 'absolute',
    top: '-46px',
    left: 'calc(100% + 10px)',
    background: isReleased ? 'rgba(103, 193, 245, 0.16)' : 'rgba(245, 166, 35, 0.16)',
    padding: '5px 9px',
    borderRadius: '3px',
    border: `1px solid ${borderColor}`,
    fontSize: '12px',
    color: '#dcdedf',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
    fontFamily: '"Motiva Sans", Arial, sans-serif',
    zIndex: '15',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    cursor: 'default',
    userSelect: 'none',
    transition: 'background-color 0.16s ease, border-color 0.16s ease',
  });

  const shortLabel = isReleased ? 'Покинула EA' : 'В EA';
  const fullMessage = isReleased
    ? duration
      ? `Вышла спустя ${duration} раннего доступа`
      : 'Игра вышла из раннего доступа (срок неизвестен)'
    : `В раннем доступе уже ${duration || 'менее месяца'}`;

  const iconEl = document.createElement('span');
  iconEl.textContent = isReleased ? '➡️' : '⏳';
  iconEl.style.color = accentColor;
  iconEl.style.fontWeight = '700';

  const textEl = document.createElement('span');
  textEl.textContent = shortLabel;
  textEl.style.fontWeight = '600';

  const tooltip = document.createElement('div');
  tooltip.textContent = fullMessage;
  Object.assign(tooltip.style, {
    position: 'absolute',
    right: 'calc(100% + 8px)',
    top: '50%',
    transform: 'translateY(-50%)',
    background: '#171d25',
    border: `1px solid ${borderColor}`,
    color: '#e5eef5',
    padding: '6px 10px',
    borderRadius: '3px',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.65)',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.16s ease',
    zIndex: '45',
  });

  infoBox.appendChild(iconEl);
  infoBox.appendChild(textEl);
  infoBox.appendChild(tooltip);

  infoBox.addEventListener('mouseenter', () => {
    infoBox.style.zIndex = '40';
    infoBox.style.background = isReleased ? 'rgba(103, 193, 245, 0.28)' : 'rgba(245, 166, 35, 0.28)';
    tooltip.style.opacity = '1';
  });
  infoBox.addEventListener('mouseleave', () => {
    infoBox.style.zIndex = '15';
    infoBox.style.background = isReleased ? 'rgba(103, 193, 245, 0.16)' : 'rgba(245, 166, 35, 0.16)';
    tooltip.style.opacity = '0';
  });

  return infoBox;
}

export function initStoreEarlyAccessModule(cfg: StoreWebkitConfig): void {
  if (!cfg.earlyAccess) return;
  if (!window.location.pathname.includes('/app/')) return;

  const match = window.location.pathname.match(/\/app\/(\d+)/);
  const appid = match ? parseInt(match[1], 10) : null;
  if (!appid) return;

  let executed = false;

  const run = async () => {
    const detailsBlock = document.querySelector('#genresAndManufacturer');
    const headerCtn = document.querySelector('.game_header_image_ctn') as HTMLElement | null;
    if (!detailsBlock || !headerCtn) return false;
    if (executed || headerCtn.querySelector('.bsh-early-access-badge')) return true;
    executed = true;

    headerCtn.style.position = 'relative';

    const isStillEarlyAccess = Boolean(document.querySelector('#earlyAccessHeader'));
    const fullText = detailsBlock.textContent || '';

    const earlyMatch = fullText.match(/Дата выпуска в раннем доступе:\s*(\d+\s+\S+\s+\d{4})/i);
    const releaseMatch = fullText.match(/Дата выхода:\s*(\d+\s+\S+\s+\d{4})/i);

    let earlyDateStr: string | null = null;
    let releaseDateStr: string | null = null;

    if (isStillEarlyAccess && !earlyMatch && releaseMatch) {
      earlyDateStr = releaseMatch[1];
    } else {
      if (earlyMatch) earlyDateStr = earlyMatch[1];
      if (releaseMatch) releaseDateStr = releaseMatch[1];
    }

    if (!earlyDateStr) {
      const ordateData = await fetchOrdateData();
      const gameData = ordateData.find((item) => Number(item.appid) === appid);
      if (gameData) {
        const ordate = parseSteamDate(gameData.ordate);
        const releaseDate = releaseDateStr ? parseSteamDate(releaseDateStr) : new Date();
        if (ordate && releaseDate && ordate < releaseDate) {
          headerCtn.appendChild(createInfoBox(calculateDuration(ordate, releaseDate), true));
        } else {
          headerCtn.appendChild(createInfoBox(null, true));
        }
      }
      return true;
    }

    const earlyDate = parseSteamDate(earlyDateStr);
    const releaseDate = parseSteamDate(releaseDateStr);
    if (!earlyDate) return true;

    const endDate = isStillEarlyAccess ? new Date() : releaseDate;
    if (!endDate) return true;

    headerCtn.appendChild(createInfoBox(calculateDuration(earlyDate, endDate), !isStillEarlyAccess));
    return true;
  };

  run().then((done) => {
    if (done) return;
    const obs = new MutationObserver(async (_m, o) => {
      if (await run()) o.disconnect();
    });
    if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      run();
    }, 8000);
  });
}
