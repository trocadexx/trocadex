import { useEffect, useRef, useState } from "react";
import {
  signUp,
  signIn,
  signOut,
  currentUser,
  createProfile,
  getMyCards,
  toggleTrade,
  searchCatalog,
  getCatalogCard,
  addUserCard,
  deleteUserCard,
  getExplore,
  getTop10,
  getMyProfile,
  setHidden,
  getReferencePriceBRL,
  getCardPriceByCatalogId,
} from "./lib/trocadex";
import "./App.css";

function placeholderColor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function isMinorAge(birthDate) {
  if (!birthDate) return false;
  const b = new Date(birthDate);
  const age = (Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000);
  return age < 18;
}

function LoginForm({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await signIn(email, password);
      onLoggedIn(user);
    } catch (err) {
      setError(err.message || "Não foi possível entrar. Verifique seus dados.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <label>
        E-mail
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Senha
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="error-msg">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

function SignUpForm({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cityApprox, setCityApprox] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isMinor = isMinorAge(birthDate);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (isMinor && (!guardianName || !guardianPhone || !guardianConsent)) {
      setError("Para contas de menores de idade, preencha os dados do responsável e confirme a autorização.");
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
      await signIn(email, password);
      await createProfile({
        handle,
        displayName,
        fullName,
        birthDate,
        cityApprox,
        guardian: isMinor ? { name: guardianName, phone: guardianPhone } : undefined,
      });
      const user = await currentUser();
      onLoggedIn(user);
    } catch (err) {
      setError(err.message || "Não foi possível criar a conta. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <label>
        E-mail
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Senha
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label>
        Apelido
        <input type="text" value={handle} onChange={(e) => setHandle(e.target.value)} required />
      </label>
      <label>
        Nome de exibição
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      <label>
        Nome completo
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </label>
      <label>
        Data de nascimento
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
      </label>
      <label>
        Cidade/região aproximada
        <input type="text" value={cityApprox} onChange={(e) => setCityApprox(e.target.value)} required />
      </label>

      {isMinor && (
        <fieldset className="guardian-box">
          <legend>Responsável (obrigatório para menores de 18 anos)</legend>
          <label>
            Nome do responsável
            <input type="text" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} required />
          </label>
          <label>
            Telefone do responsável
            <input type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} required />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={guardianConsent}
              onChange={(e) => setGuardianConsent(e.target.checked)}
              required
            />
            Autorizo a criação desta conta como responsável legal.
          </label>
        </fieldset>
      )}

      {error && <p className="error-msg">{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? "Criando conta..." : "Criar conta"}
      </button>
    </form>
  );
}

function AuthScreen({ onLoggedIn }) {
  const [tab, setTab] = useState("entrar");

  return (
    <div className="auth-screen">
      <h1>TrocaDex</h1>
      <div className="tabs">
        <button
          type="button"
          className={tab === "entrar" ? "active" : ""}
          onClick={() => setTab("entrar")}
        >
          Entrar
        </button>
        <button
          type="button"
          className={tab === "criar" ? "active" : ""}
          onClick={() => setTab("criar")}
        >
          Criar conta
        </button>
      </div>
      {tab === "entrar" ? <LoginForm onLoggedIn={onLoggedIn} /> : <SignUpForm onLoggedIn={onLoggedIn} />}
    </div>
  );
}

function PriceBadge({ catalogCardId, usdPrice }) {
  const [state, setState] = useState({ loading: true, available: false, brl: null, isApprox: false });

  useEffect(() => {
    let active = true;
    setState({ loading: true, available: false, brl: null, isApprox: false });

    const fetchPrice = usdPrice !== undefined ? getReferencePriceBRL(usdPrice) : getCardPriceByCatalogId(catalogCardId);

    fetchPrice
      .then((result) => {
        if (active) setState({ loading: false, ...result });
      })
      .catch(() => {
        if (active) setState({ loading: false, available: false });
      });

    return () => {
      active = false;
    };
  }, [catalogCardId, usdPrice]);

  if (state.loading) return <p className="price-loading">Calculando valor...</p>;

  if (!state.available) return <p className="price-unavailable">valor indisponível</p>;

  return (
    <div className="price-msg">
      <p className="price-value">valor de referência ≈ R$ {state.brl.toFixed(2).replace(".", ",")}</p>
      <p className="price-disclaimer">
        estimativa, não é preço oficial de venda{state.isApprox ? " · câmbio aproximado" : ""}
      </p>
    </div>
  );
}

function CatalogCard({ card, onToggleTrade, onDelete }) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleToggle() {
    setError("");
    setToggling(true);
    try {
      await onToggleTrade(card.id, !card.for_trade);
    } catch (err) {
      setError(err.message || "Não foi possível atualizar.");
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Tem certeza que deseja excluir esta carta?")) return;
    setError("");
    setDeleting(true);
    try {
      await onDelete(card);
    } catch (err) {
      setError(err.message || "Não foi possível excluir a carta.");
      setDeleting(false);
    }
  }

  return (
    <div className="card-tile">
      <div className="card-image-wrap">
        {card.official_image_url ? (
          <img src={card.official_image_url} alt={card.name} className="card-image" />
        ) : (
          <div className="card-placeholder" style={{ background: placeholderColor(card.name) }}>
            {card.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        {card.verified && <span className="badge-real">✓ real</span>}
      </div>
      <div className="card-info">
        <p className="card-name">{card.name}</p>
        <p className="card-meta">
          {card.set_name} · {card.number}
        </p>
        <p className="card-meta">{card.rarity}</p>
        <PriceBadge catalogCardId={card.catalog_card_id} />
      </div>
      <div className="card-actions">
        <button
          type="button"
          className={card.for_trade ? "trade-btn active" : "trade-btn"}
          onClick={handleToggle}
          disabled={toggling || deleting}
        >
          {toggling ? "..." : card.for_trade ? "✓ à troca" : "Marcar à troca"}
        </button>
        <button type="button" className="delete-btn" onClick={handleDelete} disabled={deleting} aria-label="Excluir carta">
          {deleting ? "..." : "🗑️"}
        </button>
      </div>
      {error && <p className="error-msg small">{error}</p>}
    </div>
  );
}

function AddCardModal({ onClose, onAdded }) {
  const [step, setStep] = useState("search"); // "search" | "confirm"
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [loadingCard, setLoadingCard] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleSearch(e) {
    e.preventDefault();
    if (!term.trim()) return;
    setSearchError("");
    setSearchLoading(true);
    try {
      const data = await searchCatalog(term.trim());
      setResults(data);
      setSearched(true);
    } catch (err) {
      setSearchError(err.message || "Não foi possível buscar cartas.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handlePick(id) {
    setSearchError("");
    setLoadingCard(true);
    try {
      const full = await getCatalogCard(id);
      setSelectedCard(full);
      setStep("confirm");
    } catch (err) {
      setSearchError(err.message || "Não foi possível carregar os dados da carta.");
    } finally {
      setLoadingCard(false);
    }
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleBack() {
    setStep("search");
    setSelectedCard(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setSaveError("");
  }

  async function handleSave() {
    if (!photoFile || !selectedCard) return;
    setSaveError("");
    setSaving(true);
    try {
      const saved = await addUserCard(selectedCard, photoFile);
      onAdded(saved);
      onClose();
    } catch (err) {
      setSaveError(err.message || "Não foi possível salvar a carta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{step === "search" ? "Buscar carta" : "Confirmar carta"}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        {step === "search" && (
          <div className="modal-body">
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Nome da carta..."
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
              <button type="submit" disabled={searchLoading}>
                {searchLoading ? "Buscando..." : "Buscar"}
              </button>
            </form>

            {searchError && <p className="error-msg">{searchError}</p>}
            {loadingCard && <p className="loading-msg">Carregando carta...</p>}

            {searched && !searchLoading && !searchError && (
              <p className="results-count">
                {results.length} {results.length === 1 ? "carta encontrada" : "cartas encontradas"}
              </p>
            )}

            <div className="search-results">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="search-result-item"
                  onClick={() => handlePick(r.id)}
                  disabled={loadingCard}
                >
                  {r.image ? (
                    <img src={r.image} alt={r.name} />
                  ) : (
                    <div className="card-placeholder small" style={{ background: placeholderColor(r.name) }}>
                      {r.name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <span className="result-name">{r.name}</span>
                  <span className="result-meta">
                    {r.setName} · {r.number}
                  </span>
                </button>
              ))}
            </div>

            {searched && !searchLoading && results.length === 0 && !searchError && (
              <p className="empty-msg">Nenhum resultado. Tente outro termo.</p>
            )}
          </div>
        )}

        {step === "confirm" && selectedCard && (
          <div className="modal-body">
            <div className="confirm-card">
              {selectedCard.image_url ? (
                <img src={selectedCard.image_url} alt={selectedCard.name} className="confirm-image" />
              ) : (
                <div className="card-placeholder" style={{ background: placeholderColor(selectedCard.name) }}>
                  {selectedCard.name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div>
                <p className="card-name">{selectedCard.name}</p>
                <p className="card-meta">
                  {selectedCard.set_name} · {selectedCard.number}
                </p>
                <p className="card-meta">{selectedCard.rarity}</p>
                <PriceBadge usdPrice={selectedCard.usd_price} />
              </div>
            </div>

            <p className="photo-disclaimer">
              A foto oficial acima é pública para todos. A foto da sua carta real é só para comprovação e{" "}
              <strong>não fica visível publicamente</strong>.
            </p>

            <label className="photo-upload">
              Foto da sua carta real (obrigatória)
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} required />
            </label>

            {photoPreview && <img src={photoPreview} alt="Prévia da foto real" className="photo-preview" />}

            {saveError && <p className="error-msg">{saveError}</p>}

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={handleBack} disabled={saving}>
                Voltar
              </button>
              <button type="button" onClick={handleSave} disabled={!photoFile || saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Top10Carousel({ cards }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const SPEED = 0.5; // px por frame (~30px/s a 60fps) — lento e suave
    const RESUME_DELAY = 1500;

    let rafId;
    let paused = false;
    let resumeTimer = null;
    const pauseReasons = new Set();

    function pauseFor(reason) {
      pauseReasons.add(reason);
      paused = true;
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    }

    function releaseFor(reason) {
      pauseReasons.delete(reason);
      if (pauseReasons.size === 0) {
        if (resumeTimer) clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => {
          paused = false;
        }, RESUME_DELAY);
      }
    }

    function step() {
      if (!paused) {
        const half = el.scrollWidth / 2;
        el.scrollLeft += SPEED;
        while (half > 0 && el.scrollLeft >= half) {
          el.scrollLeft -= half;
        }
      }
      rafId = requestAnimationFrame(step);
    }
    rafId = requestAnimationFrame(step);

    const onMouseEnter = () => pauseFor("hover");
    const onMouseLeave = () => releaseFor("hover");
    const onPointerDown = () => pauseFor("drag");
    const onPointerUp = () => releaseFor("drag");

    el.addEventListener("mouseenter", onMouseEnter);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("touchstart", onPointerDown, { passive: true });
    el.addEventListener("touchend", onPointerUp, { passive: true });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup", onPointerUp);

    return () => {
      cancelAnimationFrame(rafId);
      if (resumeTimer) clearTimeout(resumeTimer);
      el.removeEventListener("mouseenter", onMouseEnter);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("touchstart", onPointerDown);
      el.removeEventListener("touchend", onPointerUp);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  // Duplica a lista para dar o efeito de loop contínuo sem "pulo" ao voltar ao início.
  const loopCards = [...cards, ...cards];

  return (
    <div className="top10-scroll" ref={scrollRef}>
      {loopCards.map((card, i) => {
        const rank = i % cards.length;
        return (
          <div key={`${card.id ?? rank}-${i}`} className={rank === 0 ? "top10-card top10-first" : "top10-card"}>
            <span className="top10-rank">{rank === 0 ? "👑 #1" : `#${rank + 1}`}</span>
            <div className="top10-image-wrap">
              {card.official_image_url ? (
                <img src={card.official_image_url} alt={card.name} className="card-image" />
              ) : (
                <div className="card-placeholder small" style={{ background: placeholderColor(card.name) }}>
                  {card.name?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>
            <p className="top10-name">{card.name}</p>
            <p className="top10-meta">{card.rarity}</p>
            <p className="top10-owner">@{card.owner_handle}</p>
          </div>
        );
      })}
    </div>
  );
}

function Top10Section() {
  const [top10, setTop10] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getTop10()
      .then((data) => {
        if (active) setTop10(data || []);
      })
      .catch((err) => {
        if (active) setError(err.message || "Não foi possível carregar o Top 10.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="top10-section">
      <h3 className="top10-title">🏆 Top 10 mais raras da comunidade</h3>

      {loading && <p className="loading-msg">Carregando...</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && top10.length === 0 && (
        <p className="empty-msg">Ainda não há cartas raras cadastradas. Seja o primeiro a aparecer aqui!</p>
      )}

      {!loading && !error && top10.length > 0 && <Top10Carousel cards={top10} />}

      <p className="top10-cta">Cadastre cartas raras e apareça aqui! Não precisa estar à troca.</p>
    </div>
  );
}

function CatalogSection() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  async function loadCards() {
    setError("");
    setLoading(true);
    try {
      const data = await getMyCards();
      setCards(data);
    } catch (err) {
      setError(err.message || "Não foi possível carregar suas cartas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCards();
  }, []);

  async function handleToggleTrade(cardId, value) {
    await toggleTrade(cardId, value);
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, for_trade: value } : c)));
  }

  async function handleDeleteCard(card) {
    await deleteUserCard(card);
    setCards((prev) => prev.filter((c) => c.id !== card.id));
  }

  function handleAdded(newCard) {
    setCards((prev) => [newCard, ...prev]);
  }

  return (
    <div className="catalog-section">
      <Top10Section />

      <div className="catalog-header">
        <h2>Catálogo</h2>
        <button type="button" onClick={() => setShowAdd(true)}>
          + Adicionar carta
        </button>
      </div>

      {loading && <p className="loading-msg">Carregando...</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && cards.length === 0 && (
        <p className="empty-msg">Você ainda não tem cartas. Clique em "+ Adicionar carta" para começar.</p>
      )}

      <div className="catalog-grid">
        {cards.map((card) => (
          <CatalogCard key={card.id} card={card} onToggleTrade={handleToggleTrade} onDelete={handleDeleteCard} />
        ))}
      </div>

      {showAdd && <AddCardModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
    </div>
  );
}

function ExploreCard({ card }) {
  return (
    <div className="card-tile">
      <div className="card-image-wrap">
        {card.official_image_url ? (
          <img src={card.official_image_url} alt={card.name} className="card-image" />
        ) : (
          <div className="card-placeholder" style={{ background: placeholderColor(card.name) }}>
            {card.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
      </div>
      <div className="card-info">
        <p className="card-name">{card.name}</p>
        <p className="card-meta">
          {card.set_name} · {card.number}
        </p>
        <p className="card-meta">{card.rarity}</p>
        <p className="card-owner">
          @{card.owner_handle} · {card.city_approx}
        </p>
      </div>
    </div>
  );
}

function ExploreSection() {
  const [q, setQ] = useState("");
  const [rarity, setRarity] = useState("");
  const [cards, setCards] = useState([]);
  const [rarityOptions, setRarityOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadExplore(filters, captureRarities = false) {
    setError("");
    setLoading(true);
    try {
      const data = await getExplore(filters);
      setCards(data);
      if (captureRarities) {
        const distinct = Array.from(new Set(data.map((c) => c.rarity).filter(Boolean))).sort();
        setRarityOptions(distinct);
      }
    } catch (err) {
      setError(err.message || "Não foi possível carregar as cartas à troca.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadExplore({}, true);
  }, []);

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadExplore({ q: q.trim(), rarity });
  }

  function handleRarityChange(e) {
    const value = e.target.value;
    setRarity(value);
    loadExplore({ q: q.trim(), rarity: value });
  }

  return (
    <div className="explore-section">
      <h2>Explorar</h2>

      <form className="explore-filters" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          placeholder="Buscar por nome ou número..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={rarity} onChange={handleRarityChange}>
          <option value="">Todas as raridades</option>
          {rarityOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button type="submit" disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {loading && <p className="loading-msg">Carregando...</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && !error && (
        <p className="results-count">
          {cards.length} {cards.length === 1 ? "carta disponível" : "cartas disponíveis"}
        </p>
      )}

      {!loading && !error && cards.length === 0 && (
        <p className="empty-msg">Nenhuma carta à troca ainda. Marque cartas suas para troca no Catálogo!</p>
      )}

      <div className="catalog-grid">
        {cards.map((card) => (
          <ExploreCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function ProfileSection() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingHidden, setSavingHidden] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [toggleError, setToggleError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    setLoading(true);
    getMyProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "Não foi possível carregar seu perfil.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleToggleHidden() {
    if (!profile) return;
    const next = !profile.is_hidden;
    setToggleError("");
    setSavedFlash(false);
    setSavingHidden(true);
    try {
      await setHidden(next);
      setProfile((p) => ({ ...p, is_hidden: next }));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      setToggleError(err.message || "Não foi possível atualizar sua visibilidade.");
    } finally {
      setSavingHidden(false);
    }
  }

  if (loading) return <p className="loading-msg">Carregando...</p>;
  if (error) return <p className="error-msg">{error}</p>;
  if (!profile) return null;

  return (
    <div className="profile-section">
      <h2>Perfil</h2>

      <div className="profile-handle-card">
        <p className="profile-handle">@{profile.handle}</p>
        <p className="profile-privacy-note">
          Seu perfil público mostra apenas seu @ e sua região aproximada. Seu nome e endereço nunca aparecem
          para outros usuários.
        </p>
      </div>

      {profile.is_minor && (
        <div className="profile-guardian-box">
          <p className="guardian-title">Responsável</p>
          {profile.guardian ? (
            <>
              <p className="card-meta">Nome: {profile.guardian.name}</p>
              <p className="card-meta">Telefone: {profile.guardian.phone}</p>
            </>
          ) : (
            <p className="card-meta">Dados do responsável não encontrados.</p>
          )}
          <p className="guardian-note">Os dados do responsável são usados nas trocas e envios.</p>
        </div>
      )}

      <div className={profile.is_hidden ? "hide-toggle-card hidden-on" : "hide-toggle-card"}>
        <div className="hide-toggle-row">
          <div>
            <p className="hide-toggle-label">OCULTAR TUDO</p>
            <p className="hide-toggle-desc">
              {profile.is_hidden
                ? "🙈 Você está invisível. Suas cartas não aparecem no Explorar para outros usuários."
                : "Você está visível para outros treinadores."}
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={!!profile.is_hidden}
              onChange={handleToggleHidden}
              disabled={savingHidden}
            />
            <span className="slider" />
          </label>
        </div>
        {savingHidden && <p className="saving-msg">Salvando...</p>}
        {savedFlash && !savingHidden && <p className="saved-msg">✓ Salvo</p>}
        {toggleError && <p className="error-msg">{toggleError}</p>}
      </div>
    </div>
  );
}

function MainScreen({ onLoggedOut }) {
  const [section, setSection] = useState("catalogo");

  async function handleSignOut() {
    await signOut();
    onLoggedOut();
  }

  return (
    <div className="main-screen">
      <header className="app-header">
        <h1>TrocaDex</h1>
        <button type="button" onClick={handleSignOut}>
          Sair
        </button>
      </header>

      <p className="greeting">Olá!</p>

      <nav className="nav-buttons">
        <button
          type="button"
          className={section === "catalogo" ? "active" : ""}
          onClick={() => setSection("catalogo")}
        >
          Catálogo
        </button>
        <button
          type="button"
          className={section === "explorar" ? "active" : ""}
          onClick={() => setSection("explorar")}
        >
          Explorar
        </button>
        <button
          type="button"
          className={section === "avaliar" ? "active" : ""}
          onClick={() => setSection("avaliar")}
        >
          Avaliar carta
        </button>
        <button
          type="button"
          className={section === "perfil" ? "active" : ""}
          onClick={() => setSection("perfil")}
        >
          Perfil
        </button>
      </nav>

      <div className="content-area">
        {section === "catalogo" && <CatalogSection />}
        {section === "explorar" && <ExploreSection />}
        {section === "avaliar" && <p>🔧 Avaliação de cartas em construção. Em breve!</p>}
        {section === "perfil" && <ProfileSection />}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    currentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) {
    return <p>Carregando...</p>;
  }

  return user ? (
    <MainScreen user={user} onLoggedOut={() => setUser(null)} />
  ) : (
    <AuthScreen onLoggedIn={setUser} />
  );
}

export default App;
