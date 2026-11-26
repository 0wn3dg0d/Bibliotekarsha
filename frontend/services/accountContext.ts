export interface ActiveAccountInfo {
  steamId64: string;
  personaName: string;
  accountName: string;
  countryCode: string;
}

const EMPTY_ACCOUNT: ActiveAccountInfo = {
  steamId64: '',
  personaName: '',
  accountName: '',
  countryCode: '',
};

let currentAccount: ActiveAccountInfo = { ...EMPTY_ACCOUNT };
const listeners = new Set<(acc: ActiveAccountInfo, prevId: string) => void>();
let initialized = false;

function isValidSteamId64(val: unknown): val is string {
  return typeof val === 'string' && /^7656\d{13}$/.test(val.trim());
}

function readAccountFromGlobals(): Partial<ActiveAccountInfo> {
  try {
    const w = window as any;
    const idCandidates = [
      w.App?.m_CurrentUser?.strSteamID,
      w.g_FriendsUIApp?.CMInterface?.steamid?.ConvertTo64BitString?.(),
      w.securitystore?.m_strSteamID,
      w.App?.m_CurrentUser?.strSteamid,
    ];
    let steamId64 = '';
    for (const c of idCandidates) {
      const s = String(c || '').trim();
      if (isValidSteamId64(s)) {
        steamId64 = s;
        break;
      }
    }
    const personaName = String(
      w.App?.m_CurrentUser?.strPersonaName ||
        w.g_FriendsUIApp?.FriendStore?.self?.display_name ||
        ''
    ).trim();
    const accountName = String(w.App?.m_CurrentUser?.strAccountName || '').trim();
    const countryCode = String(w.App?.m_CurrentUser?.strUserCountry || '').trim();
    return { steamId64, personaName, accountName, countryCode };
  } catch {
    return {};
  }
}

function applyAccountPatch(patch: Partial<ActiveAccountInfo>, allowReset = false): void {
  const prevId = currentAccount.steamId64;
  const nextId = patch.steamId64 !== undefined ? patch.steamId64.trim() : currentAccount.steamId64;

  if (!allowReset && !isValidSteamId64(nextId)) {
    if (prevId) {
      const updatedName = patch.personaName || currentAccount.personaName;
      const updatedAcc = patch.accountName || currentAccount.accountName;
      const updatedCountry = patch.countryCode || currentAccount.countryCode;
      if (
        updatedName !== currentAccount.personaName ||
        updatedAcc !== currentAccount.accountName ||
        updatedCountry !== currentAccount.countryCode
      ) {
        currentAccount = {
          ...currentAccount,
          personaName: updatedName,
          accountName: updatedAcc,
          countryCode: updatedCountry,
        };
        listeners.forEach((fn) => fn(currentAccount, prevId));
      }
    }
    return;
  }

  const finalId = isValidSteamId64(nextId) ? nextId : '';
  const idChanged = finalId !== prevId;

  const next: ActiveAccountInfo = {
    steamId64: finalId,
    personaName: idChanged
      ? patch.personaName || ''
      : patch.personaName || currentAccount.personaName,
    accountName: idChanged
      ? patch.accountName || ''
      : patch.accountName || currentAccount.accountName,
    countryCode: idChanged
      ? patch.countryCode || ''
      : patch.countryCode || currentAccount.countryCode,
  };

  if (
    idChanged ||
    next.personaName !== currentAccount.personaName ||
    next.accountName !== currentAccount.accountName ||
    next.countryCode !== currentAccount.countryCode
  ) {
    currentAccount = next;
    listeners.forEach((fn) => fn(currentAccount, prevId));
  }
}

export function reportAccountFromAuthSync(steamId64: string): void {
  if (isValidSteamId64(steamId64)) {
    const g = readAccountFromGlobals();
    applyAccountPatch({
      steamId64,
      personaName: g.personaName,
      accountName: g.accountName,
      countryCode: g.countryCode,
    });
  }
}

function initAccountWatcher(): void {
  if (initialized) return;
  initialized = true;

  const pollGlobals = () => {
    const g = readAccountFromGlobals();
    if (g.steamId64) {
      applyAccountPatch(g);
    }
  };

  pollGlobals();

  try {
    const sc = (window as any).SteamClient?.SharedConnection;
    if (sc?.AllocateSharedConnection && sc?.RegisterOnLogonInfoChanged) {
      sc.AllocateSharedConnection()
        .then((handle: number) => {
          sc.RegisterOnLogonInfoChanged(handle, (info: any) => {
            if (!info) return;
            if (info.bLoggedOn && isValidSteamId64(info.strSteamid)) {
              applyAccountPatch(
                {
                  steamId64: info.strSteamid,
                  personaName: String(info.strPersonaName || ''),
                  accountName: String(info.strAccountName || ''),
                  countryCode: String(info.strUserCountry || ''),
                },
                true
              );
            } else if (info.bLoggedOn === false) {
              applyAccountPatch({ ...EMPTY_ACCOUNT }, true);
            }
          });
        })
        .catch(() => {});
    }
  } catch {}

  setInterval(pollGlobals, 5000);
}

initAccountWatcher();

export function getCurrentAccount(): ActiveAccountInfo {
  if (!currentAccount.steamId64) {
    const g = readAccountFromGlobals();
    if (g.steamId64) applyAccountPatch(g);
  }
  return currentAccount;
}

export function getAccountDisplayLabel(acc: ActiveAccountInfo = currentAccount): string {
  if (!acc.steamId64) return 'Аккаунт не определён';
  const name = acc.personaName || acc.accountName;
  const tail = acc.steamId64.slice(-6);
  const cc = acc.countryCode ? ` [${acc.countryCode}]` : '';
  return name ? `${name}${cc} (…${tail})` : `ID ${acc.steamId64}${cc}`;
}

export function subscribeAccountChange(
  fn: (acc: ActiveAccountInfo, prevId: string) => void
): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function waitForAccountId(timeoutMs = 8000): Promise<string> {
  const existing = getCurrentAccount().steamId64;
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let done = false;
    const finish = (id: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      unsub();
      resolve(id);
    };

    const unsub = subscribeAccountChange((acc) => {
      if (acc.steamId64) finish(acc.steamId64);
    });

    const timer = setTimeout(() => {
      finish(getCurrentAccount().steamId64);
    }, timeoutMs);
  });
}
