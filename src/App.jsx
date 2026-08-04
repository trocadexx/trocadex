import { useEffect, useState } from "react";
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

function CatalogCard({ card, onToggleTrade }) {
  const [toggling, setToggling] = useState(false);
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
      </div>
      <button
        type="button"
        className={card.for_trade ? "trade-btn active" : "trade-btn"}
        onClick={handleToggle}
        disabled={toggling}
      >
        {toggling ? "..." : card.for_trade ? "✓ à troca" : "Marcar à troca"}
      </button>
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
                  <span>{r.name}</span>
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

  function handleAdded(newCard) {
    setCards((prev) => [newCard, ...prev]);
  }

  return (
    <div className="catalog-section">
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
          <CatalogCard key={card.id} card={card} onToggleTrade={handleToggleTrade} />
        ))}
      </div>

      {showAdd && <AddCardModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
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
        {section === "explorar" && (
          <div>
            <h2>Explorar</h2>
            <p>em breve</p>
          </div>
        )}
        {section === "avaliar" && <p>🔧 Avaliação de cartas em construção. Em breve!</p>}
        {section === "perfil" && (
          <div>
            <h2>Perfil</h2>
            <p>em breve</p>
          </div>
        )}
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
