import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
console.log("URL:", import.meta.env.VITE_SUPABASE_URL); // TODO: remover depois do debug

// ---------- AUTENTICAÇÃO + CADASTRO ----------
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data.user;
}
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}
export async function signOut() { await supabase.auth.signOut(); }
export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}
function calcIsMinor(birthDate) {
  const b = new Date(birthDate);
  const age = (Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000);
  return age < 18;
}
export async function createProfile({ handle, displayName, fullName, birthDate, cityApprox, guardian }) {
  const user = await currentUser();
  if (!user) throw new Error("Faça login primeiro.");
  const isMinor = calcIsMinor(birthDate);
  const { error: pErr } = await supabase.from("profiles").insert({
    id: user.id, handle, display_name: displayName, full_name: fullName,
    birth_date: birthDate, is_minor: isMinor, city_approx: cityApprox,
  });
  if (pErr) throw pErr;
  if (isMinor) {
    if (!guardian?.name || !guardian?.phone) throw new Error("Conta de menor exige responsável.");
    const { error: gErr } = await supabase.from("guardians").insert({
      profile_id: user.id, name: guardian.name, phone: guardian.phone,
      consent_at: new Date().toISOString(),
    });
    if (gErr) throw gErr;
  }
  return { isMinor };
}
export async function setHidden(hidden) {
  const user = await currentUser();
  const { error } = await supabase.from("profiles").update({ is_hidden: hidden }).eq("id", user.id);
  if (error) throw error;
}
export async function getMyProfile() {
  const user = await currentUser();
  if (!user) throw new Error("Faça login primeiro.");
  const { data: profile, error: pErr } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (pErr) throw pErr;
  let guardian = null;
  if (profile.is_minor) {
    const { data: g, error: gErr } = await supabase.from("guardians").select("*").eq("profile_id", user.id).single();
    if (gErr) throw gErr;
    guardian = g;
  }
  return { ...profile, guardian };
}
export async function isCurrentUserAdmin() {
  const user = await currentUser();
  if (!user) return false;
  const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (error) return false;
  return data?.role === "admin";
}

// ---------- CATÁLOGO (TCGdex) ----------
const TCGDEX = "https://api.tcgdex.net/v2/pt/cards";
const TCGDEX_SETS = "https://api.tcgdex.net/v2/pt/sets";
const imgUrl = (base) => (base ? base + "/high.webp" : null);

// Cache em memória do índice de sets (id -> { name, cardCount }), buscado uma única vez.
let setsIndexPromise = null;
function getSetsIndex() {
  if (!setsIndexPromise) {
    setsIndexPromise = fetch(TCGDEX_SETS)
      .then((res) => (res.ok ? res.json() : []))
      .then((sets) => new Map((Array.isArray(sets) ? sets : []).map((s) => [s.id, s])))
      .catch(() => new Map());
  }
  return setsIndexPromise;
}

// O id de uma carta no TCGdex é sempre `${setId}-${localId}`.
function setIdFromCardId(cardId, localId) {
  const suffix = `-${localId}`;
  return cardId && localId && cardId.endsWith(suffix) ? cardId.slice(0, -suffix.length) : null;
}

export async function searchCatalog(term) {
  const res = await fetch(`${TCGDEX}?name=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error("Falha ao buscar no TCGdex.");
  const data = await res.json();
  const cards = (Array.isArray(data) ? data : []).filter((c) => c.image).slice(0, 60);
  const setsIndex = await getSetsIndex();
  return cards.map((c) => {
    const setId = setIdFromCardId(c.id, c.localId);
    const set = setId ? setsIndex.get(setId) : null;
    return {
      id: c.id,
      name: c.name,
      image: imgUrl(c.image),
      setName: set?.name || setId || "—",
      number: `${c.localId || "?"}/${set?.cardCount?.official || "?"}`,
    };
  });
}
export async function getCatalogCard(id) {
  const res = await fetch(`${TCGDEX}/${id}`);
  const c = await res.json();
  return {
    id: c.id, name: c.name, set_name: c.set?.name || "—",
    number: `${c.localId || "?"}/${c.set?.cardCount?.official || "?"}`,
    rarity: c.rarity || "—", card_type: (c.types && c.types[0]) || "Incolor",
    image_url: imgUrl(c.image),
    usd_price: extractUsdMarketPrice(c.pricing),
  };
}

// ---------- PREÇO DE REFERÊNCIA (preço USD do TCGdex + câmbio em cache compartilhado) ----------
const FX_URL = "https://economia.awesomeapi.com.br/last/USD-BRL";
const FX_FALLBACK_RATE = 5.5;
const FX_CACHE_MS = 2 * 24 * 60 * 60 * 1000; // 2 dias

// O preço em USD do TCGdex vem aninhado por variante (holofoil, normal, etc.),
// então pegamos o marketPrice da primeira variante que tiver um valor numérico.
function extractUsdMarketPrice(pricing) {
  const tp = pricing?.tcgplayer;
  if (!tp || typeof tp !== "object") return null;
  for (const [key, val] of Object.entries(tp)) {
    if (key === "unit" || key === "updated" || key === "url") continue;
    if (val && typeof val === "object" && typeof val.marketPrice === "number") {
      return val.marketPrice;
    }
  }
  return null;
}

async function fetchFreshDollarRate() {
  try {
    const res = await fetch(FX_URL);
    if (!res.ok) return null;
    const data = await res.json();
    const bid = parseFloat(data?.USDBRL?.bid);
    return Number.isFinite(bid) && bid > 0 ? bid : null;
  } catch {
    return null;
  }
}

// Cotação USD->BRL cacheada na tabela "app_config", compartilhada entre todos os usuários.
// Só busca uma cotação nova na AwesomeAPI se o cache tiver mais de 2 dias.
let dollarRatePromise = null;
export function getDollarRate() {
  if (!dollarRatePromise) {
    dollarRatePromise = (async () => {
      const { data: config, error } = await supabase.from("app_config").select("*").eq("id", true).single();

      if (error || !config) {
        return (await fetchFreshDollarRate()) ?? FX_FALLBACK_RATE;
      }

      const updatedAt = new Date(config.updated_at).getTime();
      const isStale = !Number.isFinite(updatedAt) || Date.now() - updatedAt >= FX_CACHE_MS;
      const savedRate = typeof config.usd_brl_rate === "number" ? config.usd_brl_rate : FX_FALLBACK_RATE;

      if (!isStale) return savedRate;

      const fresh = await fetchFreshDollarRate();
      if (fresh === null) return savedRate;

      // RLS só permite este UPDATE se a linha realmente estiver "vencida" (>2 dias),
      // então mesmo com vários usuários batendo aqui ao mesmo tempo não há spam de escrita.
      await supabase.from("app_config").update({ usd_brl_rate: fresh, updated_at: new Date().toISOString() }).eq("id", true);
      return fresh;
    })().finally(() => {
      dollarRatePromise = null;
    });
  }
  return dollarRatePromise;
}

export async function getReferencePriceBRL(usdPrice) {
  if (typeof usdPrice !== "number" || !Number.isFinite(usdPrice)) return { available: false };
  const rate = await getDollarRate();
  return { available: true, brl: usdPrice * rate };
}

export async function getCardPriceByCatalogId(catalogCardId) {
  if (!catalogCardId) return { available: false };
  try {
    const res = await fetch(`${TCGDEX}/${catalogCardId}`);
    if (!res.ok) return { available: false };
    const c = await res.json();
    return getReferencePriceBRL(extractUsdMarketPrice(c.pricing));
  } catch {
    return { available: false };
  }
}

// ---------- CARTAS DO USUÁRIO ----------
export async function addUserCard(card, realPhotoFile) {
  const user = await currentUser();
  if (!realPhotoFile) throw new Error("A foto da carta real é obrigatória.");
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage.from("real-photos").upload(path, realPhotoFile, { upsert: false });
  if (upErr) throw upErr;
  const priceResult = await getReferencePriceBRL(card.usd_price);
  const { data, error } = await supabase.from("user_cards").insert({
    owner_id: user.id, catalog_card_id: card.id, name: card.name, set_name: card.set_name,
    number: card.number, rarity: card.rarity, card_type: card.card_type,
    official_image_url: card.image_url, real_photo_path: path, verified: true,
    ref_value_usd: typeof card.usd_price === "number" ? card.usd_price : null,
    ref_value_brl: priceResult.available ? priceResult.brl : null,
    price_updated_at: new Date().toISOString(),
    status: "pendente",
  }).select().single();
  if (error) throw error;
  return data;
}
export async function getMyCards() {
  const user = await currentUser();
  const { data, error } = await supabase.from("user_cards").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function toggleTrade(cardId, value) {
  const { error } = await supabase.from("user_cards").update({ for_trade: value }).eq("id", cardId);
  if (error) throw error;
}
export async function realPhotoUrl(path) {
  const { data, error } = await supabase.storage.from("real-photos").createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}
export async function deleteUserCard(card) {
  if (card.real_photo_path) {
    const { error: storageErr } = await supabase.storage.from("real-photos").remove([card.real_photo_path]);
    if (storageErr) throw storageErr;
  }
  const { error } = await supabase.from("user_cards").delete().eq("id", card.id);
  if (error) throw error;
}
// Reenvia a foto real de uma carta recusada — volta o status para "pendente" e limpa o motivo da recusa.
export async function resubmitCardPhoto(card, realPhotoFile) {
  const user = await currentUser();
  if (!realPhotoFile) throw new Error("Selecione uma foto para reenviar.");
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage.from("real-photos").upload(path, realPhotoFile, { upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase
    .from("user_cards")
    .update({ real_photo_path: path, status: "pendente", reject_reason: null })
    .eq("id", card.id)
    .select()
    .single();
  if (error) throw error;
  if (card.real_photo_path) {
    supabase.storage.from("real-photos").remove([card.real_photo_path]);
  }
  return data;
}
// Cartas sem status definido (cadastradas antes desse recurso existir) contam como já aprovadas.
export async function getWalletTotal() {
  const user = await currentUser();
  const { data, error } = await supabase.from("user_cards").select("ref_value_usd,status").eq("owner_id", user.id);
  if (error) throw error;
  const rate = await getDollarRate();
  const approved = (data || []).filter((c) => c.status === "aprovada" || c.status == null);
  const total = approved.reduce((sum, c) => {
    const usd = Number(c.ref_value_usd);
    return sum + (Number.isFinite(usd) ? usd * rate : 0);
  }, 0);
  return { total, count: approved.length };
}
const PRICE_CACHE_MS = 2 * 24 * 60 * 60 * 1000; // 2 dias

// Reatualiza em segundo plano o preço de cartas cujo price_updated_at é nulo ou tem mais de 2 dias.
// Roda de forma automática (sem botão): chame após carregar o Catálogo. `onCardUpdated(cardId, patch)`
// é chamado a cada carta atualizada com sucesso, pra quem estiver ouvindo já atualizar seu estado local.
export async function refreshStaleCardPrices(onCardUpdated) {
  const user = await currentUser();
  const { data: cards, error } = await supabase
    .from("user_cards")
    .select("id, catalog_card_id, price_updated_at")
    .eq("owner_id", user.id);
  if (error) throw error;

  const now = Date.now();
  const stale = (cards || []).filter((c) => {
    if (!c.catalog_card_id) return false;
    if (!c.price_updated_at) return true;
    const t = new Date(c.price_updated_at).getTime();
    return !Number.isFinite(t) || now - t >= PRICE_CACHE_MS;
  });

  for (const card of stale) {
    try {
      const detail = await getCatalogCard(card.catalog_card_id);
      const usd = typeof detail.usd_price === "number" ? detail.usd_price : null;
      const priceResult = await getReferencePriceBRL(usd);
      const patch = {
        ref_value_usd: usd,
        ref_value_brl: priceResult.available ? priceResult.brl : null,
        price_updated_at: new Date().toISOString(),
      };
      const { error: updateErr } = await supabase.from("user_cards").update(patch).eq("id", card.id);
      if (!updateErr && typeof onCardUpdated === "function") {
        onCardUpdated(card.id, patch);
      }
    } catch {
      // Carta sem preço no TCGdex ou falha pontual de rede: pula e segue pras próximas.
    }
  }

  return { checked: stale.length };
}

// ---------- EXPLORAR + TOP 10 ----------
export async function getTop10() {
  const { data, error } = await supabase.from("top_rarest").select("*");
  if (error) throw error;
  return data;
}
export async function getExplore({ q = "", rarity = "" } = {}) {
  let query = supabase.from("explore_cards").select("*");
  if (q) query = query.or(`name.ilike.%${q}%,number.ilike.%${q}%`);
  if (rarity) query = query.eq("rarity", rarity);
  const { data, error } = await query.limit(60);
  if (error) throw error;
  return data;
}

// ---------- ADMIN ----------
export async function getAdminOverview() {
  const [usersRes, cardsRes, tradeRes, minorsRes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("user_cards").select("id", { count: "exact", head: true }),
    supabase.from("user_cards").select("id", { count: "exact", head: true }).eq("for_trade", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_minor", true),
  ]);
  const firstError = usersRes.error || cardsRes.error || tradeRes.error || minorsRes.error;
  if (firstError) throw firstError;
  return {
    totalUsers: usersRes.count ?? 0,
    totalCards: cardsRes.count ?? 0,
    cardsForTrade: tradeRes.count ?? 0,
    minors: minorsRes.count ?? 0,
  };
}

export async function getAdminUsers(search = "") {
  let query = supabase
    .from("profiles")
    .select("id,handle,display_name,city_approx,is_minor,created_at,guardians(phone)")
    .order("created_at", { ascending: false });
  if (search.trim()) {
    const term = search.trim();
    query = query.or(`handle.ilike.%${term}%,display_name.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((u) => ({ ...u, phone: u.guardians?.[0]?.phone ?? null }));
}

export async function getAdminUserDetail(profileId) {
  const [profileRes, cardsRes] = await Promise.all([
    supabase.from("profiles").select("*, guardians(*)").eq("id", profileId).single(),
    supabase.from("user_cards").select("*").eq("owner_id", profileId).order("created_at", { ascending: false }),
  ]);
  if (profileRes.error) throw profileRes.error;
  if (cardsRes.error) throw cardsRes.error;
  const { guardians, ...profile } = profileRes.data;
  return { profile: { ...profile, guardian: guardians?.[0] ?? null }, cards: cardsRes.data || [] };
}

export async function getAdminReports() {
  const { data, error } = await supabase
    .from("reports")
    .select("id,reason,created_at,reporter:reporter_id(handle),reported:reported_id(handle)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getPendingCards() {
  const { data, error } = await supabase
    .from("user_cards")
    .select("*, owner:owner_id(handle)")
    .eq("status", "pendente")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function approveCard(cardId) {
  const { data, error } = await supabase
    .from("user_cards")
    .update({ status: "aprovada", reject_reason: null })
    .eq("id", cardId)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Não foi possível aprovar (0 linhas afetadas — confira a policy de UPDATE do admin em user_cards).");
  }
}

export async function rejectCard(cardId, reason) {
  const { data, error } = await supabase
    .from("user_cards")
    .update({ status: "recusada", reject_reason: reason || null })
    .eq("id", cardId)
    .select();
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Não foi possível recusar (0 linhas afetadas — confira a policy de UPDATE do admin em user_cards).");
  }
}
