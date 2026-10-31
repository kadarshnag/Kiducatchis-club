import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Routes, Route, Link, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Disc3, Menu, X, Instagram, Mail, LogIn, LogOut, LayoutDashboard, UserRound, Shield, ChevronRight } from 'lucide-react';
import { sb, configured, isCore, errorText } from './lib.js';
import { Home, About, Squad, Council, Stories, Gallery, Contact, Tournaments, MatchPage, Login, Join, ProfilePage } from './Public.jsx';
import Dashboard from './Dashboard.jsx';
import { ThemeProvider, useTheme, ThemeSwitcher } from './ThemeContext.jsx';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null), [profile, setProfile] = useState(null), [loading, setLoading] = useState(true);
    const refresh = useCallback(async (u) => { if (!sb || !u) { setProfile(null); return; } const { data, error } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle(); if (error) console.warn('Profile lookup:', error.message); setProfile(data || null); }, []);
    useEffect(() => { if (!sb) { setLoading(false); return; } let active = true; sb.auth.getUser().then(async ({ data }) => { if (active) { setUser(data.user || null); await refresh(data.user); setLoading(false) } }).catch(() => setLoading(false)); const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => { if (!active) return; const next = session?.user || null; setUser(next); setTimeout(() => refresh(next), 0); }); return () => { active = false; subscription.unsubscribe() }; }, [refresh]);
    const logout = async () => { await sb?.auth.signOut(); setUser(null); setProfile(null) };
    return <AuthContext.Provider value={{ user, profile, loading, refresh: () => refresh(user), logout }}>{children}</AuthContext.Provider>;
}
export function Loader() { const { logoSrc } = useTheme(), [show, setShow] = useState(true); useEffect(() => { const id = setTimeout(() => setShow(false), 1500); return () => clearTimeout(id) }, []); return show ? <div className="launch-loader" aria-label="Loading Kiducatchis"><div className="launch-disc"><Disc3 size={58} strokeWidth={1.8} /></div><img src={logoSrc} alt="Kiducatchis" /><span>CATCH THE SPIRIT.</span></div> : null; }
function Brand() { const { logoSrc } = useTheme(); return <Link className="brand" to="/"><img src={logoSrc} alt="Kiducatchis logo" /></Link> }
function Header() { const [open, setOpen] = useState(false), { user, profile } = useAuth(), location = useLocation(); useEffect(() => setOpen(false), [location.pathname]); const paths = [['/', 'Home'], ['/squad', 'The Squad'], ['/tournaments', 'Game Day'], ['/stories', 'Stories'], ['/gallery', 'Gallery'], ['/about', 'Our Club'], ['/contact', 'Contact']]; return <header className="site-header"><div className="wrap header-inner"><Brand /><nav className={'main-nav ' + (open ? 'is-open' : '')} aria-label="Main navigation">{paths.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}<div className="mobile-theme-row"><ThemeSwitcher /></div></nav><div className="header-actions"><ThemeSwitcher />{user ? <Link className="member-pill" to="/dashboard" title="Member dashboard">{profile?.avatar_path ? <img src={sb.storage.from('club-media').getPublicUrl(profile.avatar_path).data.publicUrl} alt="Profile" /> : <span>{(profile?.full_name || 'M').charAt(0)}</span>}<small>Dashboard</small></Link> : <Link className="login-pill" to="/login"><LogIn size={15} /> Member login</Link>}<button className="mobile-toggle" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div></div></header> }
function Footer() { return <footer className="footer"><div className="wrap footer-top"><div><Brand /><p>Fierce on the field. Family off it.<br />Built for the love of ultimate.</p></div><div><b>EXPLORE</b><Link to="/squad">The squad</Link><Link to="/tournaments">Tournaments</Link><Link to="/gallery">Gallery</Link></div><div><b>THE CLUB</b><Link to="/about">Our story</Link><Link to="/council">Council</Link><Link to="/contact">Get in touch</Link></div><div><b>ONE DISC. ONE FAMILY.</b><p>Catch the game. Chase the moment. Be part of something bigger.</p><Link to="/contact" className="footer-cta">Talk to us <ArrowUpRight size={15} /></Link></div></div><div className="wrap footer-bottom"><span>© {new Date().getFullYear()} Kiducatchis Ultimate Frisbee Club</span><span>MADE FOR THE SPIRIT OF THE GAME <Disc3 size={16} /></span></div></footer> }
export function SectionHeader({ eyebrow, title, copy, action }) { return <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{copy && <p>{copy}</p>}</div>{action}</div> }
export function Empty({ title = 'Nothing here yet', text = 'Check back for an update.', icon: Icon = Disc3 }) { return <div className="empty"><Icon size={33} /><h3>{title}</h3><p>{text}</p></div> }
export function Flash({ error, success }) { return <>{error && <div className="flash error" role="alert">{errorText(error)}</div>}{success && <div className="flash success" role="status">{success}</div>}</> }
export function Modal({ title, children, onClose }) { useEffect(() => { const key = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [onClose]); return <div className="modal-shade" onMouseDown={e => e.target === e.currentTarget && onClose()} role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>{children}</section></div> }
export function Protected({
    children,
    core = false,
    admin = false
}) {
    const { loading, user, profile, logout } = useAuth();

    if (loading) {
        return (
            <div className="wrap padded">
                <Empty title="Checking access..." />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!profile) {
        return (
            <div className="wrap padded">
                <Empty
                    title="No member profile found"
                    text="Ask the club administrator to invite your account email from Members & Squad. No approval or invitation code is required."
                />

                <button
                    className="btn btn-primary"
                    onClick={logout}
                >
                    SIGN OUT & TRY ANOTHER EMAIL
                </button>
            </div>
        );
    }

    if (!profile.is_active) {
        return (
            <div className="wrap padded">
                <Empty
                    title="Your access is inactive"
                    text="Please contact the council."
                />
            </div>
        );
    }

    if (
        (core && !isCore(profile)) ||
        (admin && profile.role !== 'admin')
    ) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

function Activate() {
    const navigate = useNavigate();
    const { user, refresh } = useAuth();

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const [error, setError] = useState('');
    const [activeUser, setActiveUser] = useState(null);

    useEffect(() => {
        let mounted = true;

        async function verifyInvitation() {
            setError('');
            setVerifying(true);

            try {
                if (!sb) {
                    throw new Error('Supabase is not configured.');
                }

                // Check for error parameters in hash or search (e.g. from expired or rejected token)
                const rawHash = window.location.hash.replace(/^#/, '');
                const hashParams = new URLSearchParams(rawHash);
                const searchParams = new URLSearchParams(window.location.search);

                const errCode = hashParams.get('error_code') || searchParams.get('error_code');
                const errDesc = hashParams.get('error_description') || searchParams.get('error_description') || hashParams.get('error') || searchParams.get('error');

                if (errCode || errDesc) {
                    const cleanDesc = errDesc ? decodeURIComponent(errDesc.replace(/\+/g, ' ')) : '';
                    throw new Error(cleanDesc || 'This invitation link is invalid or has expired (403). Please ask your club administrator to send a new invite.');
                }

                // Check for access_token in hash (Implicit flow / invite link redirect)
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (accessToken) {
                    const { data: sessionData, error: sessionErr } = await sb.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || '',
                    });

                    if (sessionErr) throw sessionErr;

                    // Clean tokens from URL address bar without page reload
                    window.history.replaceState(null, '', window.location.pathname);

                    if (mounted) {
                        setActiveUser(sessionData.user);
                        await refresh();
                    }
                    return;
                }

                // Check for code in query (PKCE flow)
                const code = searchParams.get('code');
                if (code) {
                    const { data: sessionData, error: exchangeErr } = await sb.auth.exchangeCodeForSession(code);
                    if (exchangeErr) throw exchangeErr;

                    window.history.replaceState(null, '', window.location.pathname);

                    if (mounted) {
                        setActiveUser(sessionData.user);
                        await refresh();
                    }
                    return;
                }

                // Check for token_hash in query (Direct OTP link)
                const tokenHash = searchParams.get('token_hash');
                const type = searchParams.get('type') || 'invite';
                if (tokenHash) {
                    const { data: sessionData, error: otpErr } = await sb.auth.verifyOtp({ token_hash: tokenHash, type });
                    if (otpErr) throw otpErr;

                    window.history.replaceState(null, '', window.location.pathname);

                    if (mounted) {
                        setActiveUser(sessionData.user);
                        await refresh();
                    }
                    return;
                }

                // If no tokens in URL, check if there is an active session
                const { data: currentSession } = await sb.auth.getSession();
                if (currentSession?.session?.user) {
                    // Validate session token with getUser to ensure it is not a stale/expired 403 JWT
                    const { data: userData, error: userErr } = await sb.auth.getUser();
                    if (userErr) {
                        await sb.auth.signOut();
                        throw new Error('Your previous session has expired. Please open the activation link from your email again.');
                    }
                    if (mounted) {
                        setActiveUser(userData.user);
                    }
                } else {
                    if (mounted) {
                        setActiveUser(null);
                    }
                }
            } catch (err) {
                if (mounted) {
                    setError(errorText(err));
                    setActiveUser(null);
                }
            } finally {
                if (mounted) {
                    setVerifying(false);
                }
            }
        }

        verifyInvitation();

        return () => {
            mounted = false;
        };
    }, [refresh]);

    async function submit(e) {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must contain at least 8 characters.');
            return;
        }

        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }

        setBusy(true);

        try {
            const { data: sessionData } = await sb.auth.getSession();

            if (!sessionData?.session) {
                throw new Error(
                    'No active session found. Please open the latest invitation link from your email.'
                );
            }

            const { data: updated, error: updateError } =
                await sb.auth.updateUser({ password });

            if (updateError) throw updateError;

            await refresh();

            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy(false);
        }
    }

    const currentEmail = activeUser?.email || user?.email;
    const { logoSrc } = useTheme();

    return (
        <section className="auth-screen">
            <div className="auth-panel">
                <img
                    src={logoSrc}
                    alt="Kiducatchis"
                />

                <span className="eyebrow">
                    // MEMBER ACTIVATION
                </span>

                <h1>
                    SET YOUR <em>PASSWORD.</em>
                </h1>

                {verifying ? (
                    <p>Verifying invitation link...</p>
                ) : currentEmail ? (
                    <p>
                        Activating account for <b>{currentEmail}</b>. Set a password to complete your membership setup.
                    </p>
                ) : (
                    <p>
                        Open the invitation link sent to your email to activate your club membership.
                    </p>
                )}

                <Flash error={error} />

                {(!verifying && !currentEmail) ? (
                    <div style={{ marginTop: '20px' }}>
                        <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
                            GO TO MEMBER LOGIN <ChevronRight size={16} />
                        </Link>
                    </div>
                ) : (
                    <form className="form-stack" onSubmit={submit}>
                        <label>
                            New password
                            <input
                                type="password"
                                minLength={8}
                                required
                                autoComplete="new-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </label>

                        <label>
                            Confirm password
                            <input
                                type="password"
                                minLength={8}
                                required
                                autoComplete="new-password"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                            />
                        </label>

                        <button
                            className="btn btn-primary"
                            disabled={busy || verifying || !currentEmail}
                        >
                            {busy
                                ? 'ACTIVATING...'
                                : 'ACTIVATE MEMBERSHIP'}

                            <ChevronRight size={16} />
                        </button>
                    </form>
                )}

                <p className="auth-foot">
                    Already activated?{' '}
                    <Link to="/login">Member login</Link>
                </p>
            </div>
        </section>
    );
}

function AppShell() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' })
    }, [pathname]);

    return <>
        <Loader />
        <Header />

        {!configured && <div className="config-banner">
            Preview mode: connect Supabase using the .env file to enable members, live games and uploads.
        </div>}

        <main>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/squad" element={<Squad />} />
                <Route path="/council" element={<Council />} />
                <Route path="/stories" element={<Stories />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/games/:id" element={<MatchPage />} />
                <Route path="/login" element={<Login />} />
                <Route
                    path="/join"
                    element={<Navigate to="/login" replace />}
                />

                <Route
                    path="/activate"
                    element={<Activate />}
                />

                <Route path="/dashboard/*" element={<Protected><Dashboard /></Protected>} />

                <Route path="/profile/:id" element={<ProfilePage />} />

                <Route path="*" element={
                    <div className="wrap padded">
                        <Empty
                            title="Page not found"
                            text="This disc went out of bounds."
                        />
                        <Link className="btn" to="/">Back home</Link>
                    </div>
                } />
            </Routes>
        </main>

        <Footer />
    </>
}

export default function App() { return <ThemeProvider><AuthProvider><AppShell /></AuthProvider></ThemeProvider> }
