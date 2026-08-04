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

// ---------- CATÁLOGO (TCGdex) ----------
const TCGDEX = "https://api.tcgdex.net/v2/en/cards";
const imgUrl = (base) => (base ? base + "/high.webp" : null);
export async function searchCatalog(term) {
  const res = await fetch(`${TCGDEX}?name=${encodeURIComponent(term)}`);
  if (!res.ok) throw new Error("Falha ao buscar no TCGdex.");
  const data = await res.json();
  return (Array.isArray(data) ? data : []).filter((c) => c.image).slice(0, 24)
    .map((c) => ({ id: c.id, name: c.name, image: imgUrl(c.image) }));
}
export async function getCatalogCard(id) {
  const res = await fetch(`${TCGDEX}/${id}`);
  const c = await res.json();
  return {
    id: c.id, name: c.name, set_name: c.set?.name || "—",
    number: `${c.localId || "?"}/${c.set?.cardCount?.official || "?"}`,
    rarity: c.rarity || "—", card_type: (c.types && c.types[0]) || "Incolor",
    image_url: imgUrl(c.image),
  };
}

// ---------- CARTAS DO USUÁRIO ----------
export async function addUserCard(card, realPhotoFile) {
  const user = await currentUser();
  if (!realPhotoFile) throw new Error("A foto da carta real é obrigatória.");
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage.from("real-photos").upload(path, realPhotoFile, { upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase.from("user_cards").insert({
    owner_id: user.id, catalog_card_id: card.id, name: card.name, set_name: card.set_name,
    number: card.number, rarity: card.rarity, card_type: card.card_type,
    official_image_url: card.image_url, real_photo_path: path, verified: true,
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
