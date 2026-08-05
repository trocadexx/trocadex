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

// ---------- PREÇO DE REFERÊNCIA (preço USD do TCGdex + câmbio) ----------
const FX_URL = "https://economia.awesomeapi.com.br/last/USD-BRL";
const FX_FALLBACK_RATE = 5.5;

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

// Cache em memória da cotação USD->BRL, buscada uma única vez por sessão.
let fxRatePromise = null;
function getUsdToBrlRate() {
  if (!fxRatePromise) {
    fxRatePromise = fetch(FX_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const bid = parseFloat(data?.USDBRL?.bid);
        return Number.isFinite(bid) && bid > 0 ? { rate: bid, isFallback: false } : { rate: FX_FALLBACK_RATE, isFallback: true };
      })
      .catch(() => ({ rate: FX_FALLBACK_RATE, isFallback: true }));
  }
  return fxRatePromise;
}

export async function getReferencePriceBRL(usdPrice) {
  if (typeof usdPrice !== "number" || !Number.isFinite(usdPrice)) return { available: false };
  const { rate, isFallback } = await getUsdToBrlRate();
  return { available: true, brl: usdPrice * rate, isApprox: isFallback };
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
    ref_value_brl: priceResult.available ? priceResult.brl : null,
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
export async function getWalletTotal() {
  const user = await currentUser();
  const { data, error } = await supabase.from("user_cards").select("ref_value_brl").eq("owner_id", user.id);
  if (error) throw error;
  const total = (data || []).reduce((sum, c) => sum + (Number(c.ref_value_brl) || 0), 0);
  return { total, count: (data || []).length };
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
