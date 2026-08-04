import { useEffect, useState } from "react";
import { signUp, signIn, signOut, currentUser, createProfile } from "./lib/trocadex";
import "./App.css";

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
        {section === "catalogo" && (
          <div>
            <h2>Catálogo</h2>
            <p>em breve</p>
          </div>
        )}
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
