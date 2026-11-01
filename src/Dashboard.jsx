import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, BookOpen, Calendar, Camera, Check, CheckCircle2, ChevronDown, Clock, Copy, CreditCard, Disc3, Download, ExternalLink, Eye, FileText, Globe, Image as ImageIcon, LayoutDashboard, Link2, LogOut, Mail, Menu, Minus, Pause, PenTool, Play, Plus, Save, Shield, ShieldCheck, Square, Target, Trash2, Trophy, Upload, UserPlus, UserRound, Users, Video, Wallet, X, Zap } from 'lucide-react';
import { sb, query, save, patch, upload, fileUrl, signedUrl, date, time, money, fmtClock, errorText, isCore, isAdmin, getPostImages, getCleanPostBody, getYouTubeEmbedUrl, getVimeoEmbedUrl } from './lib.js';
import { useAuth, Empty, Flash, Modal, useDialog } from './App.jsx';
import { useTheme } from './ThemeContext.jsx';
import SquadManager from './SquadManager.jsx';
const nav = [['overview', 'Overview', LayoutDashboard], ['profile', 'My profile', UserRound], ['posts', 'Stories & gallery', BookOpen], ['strategies', 'Strategies', Target], ['whiteboard', 'Tactics whiteboard', PenTool], ['tournaments', 'Tournaments', Trophy], ['scoring', 'Live scoring', Activity], ['finances', 'Club accounts', Wallet], ['squad', 'Squad selection', ShieldCheck], ['members', 'Members & squad', Users], ['messages', 'Contact inbox', FileText]];
function useData(table, options = {}, listen = false) { const [data, setData] = useState([]), [loading, setLoading] = useState(true), [version, setVersion] = useState(0); const key = JSON.stringify(options); const reload = useCallback(() => setVersion(n => n + 1), []); useEffect(() => { if (!sb) { setLoading(false); return; } let active = true; query(table, options).then(r => { if (active) setData(r) }).catch(e => console.error(e)).finally(() => active && setLoading(false)); let sub; if (listen) sub = sb.channel('dashboard-' + table + '-' + Math.random()).on('postgres_changes', { schema: 'public', table, event: '*' }, reload).subscribe(); return () => { active = false; if (sub) sb.removeChannel(sub) } }, [table, key, version, listen, reload]); return { data, loading, reload }; }
const Input = ({ label, children, ...rest }) => <label className="field">{label}{children || <input {...rest} />}</label>;
const FormButton = ({ busy, children }) => <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'SAVING…' : children} <ArrowUpRight size={16} /></button>;
function Panel({ title, subtitle, children, action }) { return <section className="dash-panel"><div className="dash-panel-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section> }
function Heading({ eyebrow, title, subtitle }) { return <div className="dash-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div> }
function useAsync() { const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [ok, setOk] = useState(''); async function run(fn, msg = 'Saved successfully') { setBusy(true); setErr(''); setOk(''); try { await fn(); setOk(msg); return true } catch (e) { setErr(errorText(e)); return false } finally { setBusy(false) } } return { busy, err, ok, run, clear: () => { setErr(''); setOk('') } } }
export default function Dashboard() { const { profile, user, logout } = useAuth(), { logoSrc } = useTheme(), [search, setSearch] = useSearchParams(); const section = search.get('tab') || 'overview'; const [mobile, setMobile] = useState(false); const core = isCore(profile), admin = isAdmin(profile); const show = tab => setSearch({ tab }); const allowed = nav.filter(([id]) => !['scoring', 'finances', 'squad', 'members', 'messages'].includes(id) || core); const active = allowed.some(([id]) => id === section) ? section : 'overview'; return <section className="dashboard-shell"><aside className={'dash-side ' + (mobile ? 'dash-mobile-open' : '')}><div className="dash-side-top"><img src={logoSrc} alt="Kiducatchis" /><div className="small-eyebrow">CLUB MANAGEMENT</div></div><div className="side-nav">{allowed.map(([id, title, Icon]) => <button key={id} className={active === id ? 'active' : ''} onClick={() => { show(id); setMobile(false) }}><Icon size={18} />{title}</button>)}</div><div className="side-foot"><Link to="/"><ArrowRight size={17} /> Back to website</Link><button onClick={logout}><LogOut size={17} /> Sign out</button></div></aside><div className="dash-content"><div className="dash-topbar"><button className="mobile-dash-toggle" onClick={() => setMobile(!mobile)}><Menu size={20} /> MENU</button><span><ShieldCheck size={16} /> {profile.role.toUpperCase()} ACCESS</span><Link to={`/profile/${user.id}`}>{profile.avatar_path ? <img src={fileUrl('club-media', profile.avatar_path)} alt="Profile" /> : <span className="dash-letter">{profile.full_name?.charAt(0) || 'K'}</span>}<b>{profile.full_name}</b></Link></div><div className="dash-body">{active === 'overview' && <Overview profile={profile} show={show} />} {active === 'profile' && <MyProfile />}{active === 'posts' && <Posts />}{active === 'strategies' && <Strategies />}{active === 'whiteboard' && <Whiteboard />}{active === 'tournaments' && <TournamentAdmin core={core} />} {active === 'scoring' && core && <Scoring />}{active === 'finances' && core && <Finance />}{active === 'squad' && core && <SquadManager />}{active === 'members' && core && <Members />}{active === 'messages' && core && <Messages />}</div></div></section> }
function Overview({ profile, show }) { const { data: members } = useData('profiles'), { data: tournaments } = useData('tournaments'), { data: matches } = useData('matches', { order: 'scheduled_at', limit: 80 }, true), { data: posts } = useData('posts', { order: 'created_at', limit: 50 }), { data: strategies } = useData('strategies', { limit: 100 }); const core = isCore(profile); return <><Heading eyebrow="// YOUR CLUB, AT A GLANCE" title={`HELLO, ${profile.full_name.split(' ')[0].toUpperCase()}.`} subtitle="Here's what is happening inside the Kiducatchis club." /><div className="dash-stats"><div><Users /><span>ACTIVE PLAYERS</span><strong>{members.filter(p => p.is_active).length}</strong></div><div><Trophy /><span>TOURNAMENTS</span><strong>{tournaments.length}</strong></div><div><Activity /><span>RECORDED MATCHES</span><strong>{matches.length}</strong></div><div><PenTool /><span>GAME PLANS</span><strong>{strategies.length}</strong></div></div><div className="dash-two"><Panel title="Next up" subtitle="Upcoming and active club matches" action={<button className="inline-button" onClick={() => show('tournaments')}>VIEW ALL <ArrowRight size={15} /></button>}>{matches.filter(m => m.status !== 'completed').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)).slice(0, 4).map(m => <Link key={m.id} to={`/games/${m.id}`} className="dash-list-row"><div><b>Kiducatchis vs {m.opponent}</b><small>{date(m.scheduled_at)} · {m.status}</small></div><ArrowUpRight size={16} /></Link>)}{!matches.some(m => m.status !== 'completed') && <Empty icon={Calendar} title="Nothing on the calendar" />}</Panel><Panel title="Quick actions" subtitle="Get back into the game"><div className="quick-actions"><button onClick={() => show('posts')}><ImageIcon /> Share a club moment <ArrowRight /></button><button onClick={() => show('whiteboard')}><PenTool /> Open tactics board <ArrowRight /></button><button onClick={() => show('strategies')}><Target /> View game plans <ArrowRight /></button>{core && <><button onClick={() => show('scoring')}><Activity /> Score a match <ArrowRight /></button><button onClick={() => show('finances')}><Wallet /> Finance dashboard <ArrowRight /></button></>}</div></Panel></div><Panel title="Recent club updates"><div className="dash-updates">{posts.slice(0, 3).map(p => <div key={p.id}><BookOpen size={17} /><div><b>{p.title}</b><small>{date(p.created_at)}</small></div></div>)}{!posts.length && <Empty title="No club stories yet" />}</div></Panel></> }
function MyProfile() { const { user, profile, refresh } = useAuth(); const [form, setForm] = useState({ full_name: profile.full_name || '', position: profile.position || 'Flexible', jersey_number: profile.jersey_number ?? '', bio: profile.bio || '' }), [image, setImage] = useState(null); const task = useAsync(); async function submit(e) { e.preventDefault(); await task.run(async () => { const path = image ? await upload('club-media', image, user) : profile.avatar_path; const { error } = await sb.from('profiles').update({ full_name: form.full_name.trim(), position: form.position, jersey_number: form.jersey_number === '' ? null : Number(form.jersey_number), bio: form.bio, avatar_path: path }).eq('id', user.id); if (error) throw error; await refresh() }, 'Profile updated') } return <><Heading eyebrow="// MEMBER IDENTITY" title="MY PROFILE" subtitle="Your own player record and public profile." /><div className="dash-two"><Panel title="Edit player details"><form className="form-stack" onSubmit={submit}><Input label="Display name" value={form.full_name} required onChange={e => setForm({ ...form, full_name: e.target.value })} /><Input label="Preferred position"><select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}>{['Handler', 'Cutter', 'Flexible'].map(p => <option key={p}>{p}</option>)}</select></Input><Input label="Jersey number" type="number" min="0" max="999" value={form.jersey_number} onChange={e => setForm({ ...form, jersey_number: e.target.value })} /><Input label="About you"><textarea value={form.bio} rows={4} maxLength={750} onChange={e => setForm({ ...form, bio: e.target.value })} /></Input><Input label="Profile picture (JPG / PNG / WEBP)"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImage(e.target.files[0])} /></Input><Flash error={task.err} success={task.ok} /><FormButton busy={task.busy}>SAVE PROFILE</FormButton></form></Panel><Panel title="Member card"><div className="profile-preview">{profile.avatar_path ? <img src={fileUrl('club-media', profile.avatar_path)} alt="Profile" /> : <UserRound size={90} />}<h2>{profile.full_name}</h2><span className="role-chip">{profile.role}</span><p>#{profile.jersey_number ?? '—'} · {profile.position}</p><Link to={`/profile/${user.id}`} className="btn btn-outline">VIEW PUBLIC RECORD <ArrowUpRight size={16} /></Link></div></Panel></div></> }
function Posts() {
    const { user, profile } = useAuth(), admin = isAdmin(profile), { data: posts, reload } = useData('posts', { order: 'created_at', limit: 200 });
    const { confirm } = useDialog();
    const [form, setForm] = useState({ type: 'blog', title: '', body: '', published: true });
    const [items, setItems] = useState([]);
    const [editing, setEditing] = useState(null);
    const fileInputRef = useRef(null);
    const task = useAsync();

    function handleFiles(e) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const newItems = files.map(file => ({
            id: crypto.randomUUID(),
            file,
            path: null,
            previewUrl: URL.createObjectURL(file),
            caption: ''
        }));
        setItems(prev => [...prev, ...newItems]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function updateCaption(index, text) {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, caption: text } : item));
    }

    function moveItem(fromIdx, toIdx) {
        if (toIdx < 0 || toIdx >= items.length) return;
        setItems(prev => {
            const next = [...prev];
            const [moved] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, moved);
            return next;
        });
    }

    function removeItem(index) {
        setItems(prev => prev.filter((_, i) => i !== index));
    }

    function startEdit(p) {
        setEditing(p.id);
        setForm({
            type: p.type,
            title: p.title,
            body: getCleanPostBody(p.body),
            published: p.published
        });
        const imgs = getPostImages(p);
        setItems(imgs.map(img => ({
            id: crypto.randomUUID(),
            file: null,
            path: img.path,
            previewUrl: fileUrl('club-media', img.path),
            caption: img.caption || ''
        })));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelEdit() {
        setEditing(null);
        setForm({ type: 'blog', title: '', body: '', published: true });
        setItems([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function submit(e) {
        e.preventDefault();
        const did = await task.run(async () => {
            if (form.type === 'photo' && items.length === 0) {
                throw Error('A gallery post must include at least one photo.');
            }
            if (!form.title.trim()) {
                throw Error('Enter a post title.');
            }

            const finalImages = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                let path = item.path;
                if (item.file) {
                    path = await upload('club-media', item.file, user);
                }
                if (path) {
                    finalImages.push({
                        path,
                        caption: (item.caption || '').trim()
                    });
                }
            }

            const primaryPath = finalImages[0]?.path || null;
            const cleanBody = form.body.trim();

            if (editing) {
                try {
                    await patch('posts', editing, {
                        title: form.title.trim(),
                        body: cleanBody,
                        image_path: primaryPath,
                        images: finalImages,
                        published: form.published
                    });
                } catch (colErr) {
                    const fallbackBody = finalImages.length > 0
                        ? `${cleanBody}\n\n<!--kiducatchis_images:${JSON.stringify(finalImages)}-->`
                        : cleanBody;
                    await patch('posts', editing, {
                        title: form.title.trim(),
                        body: fallbackBody,
                        image_path: primaryPath,
                        published: form.published
                    });
                }
            } else {
                try {
                    await save('posts', {
                        author_id: user.id,
                        type: form.type,
                        title: form.title.trim(),
                        body: cleanBody,
                        image_path: primaryPath,
                        images: finalImages,
                        published: form.published
                    });
                } catch (colErr) {
                    const fallbackBody = finalImages.length > 0
                        ? `${cleanBody}\n\n<!--kiducatchis_images:${JSON.stringify(finalImages)}-->`
                        : cleanBody;
                    await save('posts', {
                        author_id: user.id,
                        type: form.type,
                        title: form.title.trim(),
                        body: fallbackBody,
                        image_path: primaryPath,
                        published: form.published
                    });
                }
            }
            reload();
        }, editing ? 'Post updated' : 'Post published');

        if (did) {
            cancelEdit();
        }
    }

    async function remove(id) {
        const ok = await confirm({
            title: 'Delete Post',
            message: 'Are you sure you want to permanently delete this post and its photos from the club stream?',
            confirmText: 'DELETE POST',
            danger: true
        });
        if (!ok) return;
        await task.run(async () => {
            const { error } = await sb.from('posts').delete().eq('id', id);
            if (error) throw error;
            reload();
        }, 'Post deleted');
    }

    async function pin(p) {
        await task.run(async () => {
            const { error } = await sb.rpc('core_pin_post', { p_id: p.id, p_pin: !p.pinned });
            if (error) throw error;
            reload();
        }, 'Pin status updated');
    }

    const own = posts.filter(p => p.author_id === user.id || isCore(profile));

    return <>
        <Heading eyebrow="// CLUB PUBLISHING" title="STORIES & GALLERY" subtitle="Post club updates, blogs, pictures, and news with multi-image galleries and custom photo captions." />
        <div className="dash-two unequal">
            <Panel title={editing ? 'Edit post' : 'Create new post'} subtitle="Add multiple images. Each photo can carry its own individual caption.">
                <form className="form-stack" onSubmit={submit}>
                    {!editing && (
                        <Input label="Post type">
                            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                                <option value="blog">Blog / news story</option>
                                <option value="photo">Gallery photo album</option>
                            </select>
                        </Input>
                    )}
                    <Input label="Title" required maxLength={150} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. National Championship Final Recap" />
                    <Input label="Story body / article text">
                        <textarea rows={5} maxLength={15000} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Share the story, highlights, key moments..." />
                    </Input>

                    <div className="field">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontWeight: 800 }}>PHOTOS & CAPTIONS ({items.length})</span>
                            <button type="button" className="small-btn" onClick={() => fileInputRef.current?.click()}>
                                <Plus size={14} /> ADD PHOTOS
                            </button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            style={{ display: 'none' }}
                            onChange={handleFiles}
                        />

                        {!items.length ? (
                            <div className="media-drop-zone" onClick={() => fileInputRef.current?.click()}>
                                <Camera size={32} />
                                <b>Select one or more photos</b>
                                <small>JPG, PNG, WEBP, GIF up to 20 MB each. You can add captions to each photo once attached.</small>
                            </div>
                        ) : (
                            <div className="media-items-grid">
                                {items.map((it, idx) => (
                                    <div key={it.id} className="media-item-row">
                                        <div className="media-thumb-wrap">
                                            <img src={it.previewUrl} alt="" />
                                            <span className="media-order-badge">{idx === 0 ? 'COVER' : `#${idx + 1}`}</span>
                                        </div>
                                        <div className="media-caption-col">
                                            <label className="caption-sublabel">
                                                <span>Photo #{idx + 1} caption</span>
                                                <input
                                                    type="text"
                                                    maxLength={250}
                                                    placeholder="Add an individual caption (e.g. Layout block in finals / Team huddle)"
                                                    value={it.caption}
                                                    onChange={e => updateCaption(idx, e.target.value)}
                                                />
                                            </label>
                                        </div>
                                        <div className="media-item-btns">
                                            <button
                                                type="button"
                                                disabled={idx === 0}
                                                className="icon-btn"
                                                title="Move earlier (make cover)"
                                                onClick={() => moveItem(idx, idx - 1)}
                                            >
                                                ▲
                                            </button>
                                            <button
                                                type="button"
                                                disabled={idx === items.length - 1}
                                                className="icon-btn"
                                                title="Move later"
                                                onClick={() => moveItem(idx, idx + 1)}
                                            >
                                                ▼
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-btn danger"
                                                title="Remove this photo"
                                                onClick={() => removeItem(idx)}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button type="button" className="small-btn" style={{ alignSelf: 'center', marginTop: 6 }} onClick={() => fileInputRef.current?.click()}>
                                    <Plus size={14} /> ADD MORE PHOTOS
                                </button>
                            </div>
                        )}
                    </div>

                    <label className="checkbox-field">
                        <input type="checkbox" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} /> Publish publicly
                    </label>
                    <Flash error={task.err} success={task.ok} />
                    <div className="actions">
                        <FormButton busy={task.busy}>{editing ? 'UPDATE POST' : 'PUBLISH POST'}</FormButton>
                        {editing && (
                            <button type="button" className="btn btn-outline" onClick={cancelEdit}>
                                CANCEL
                            </button>
                        )}
                    </div>
                </form>
            </Panel>

            <Panel title="My content / moderation" subtitle="Council can pin news to the public homepage">
                {own.length ? (
                    <div className="management-list">
                        {own.map(p => {
                            const pImgs = getPostImages(p);
                            const cover = pImgs[0]?.path ? fileUrl('club-media', pImgs[0].path) : null;
                            return (
                                <div className="manage-item" key={p.id}>
                                    <div className="manage-item-visual">
                                        {cover ? <img src={cover} alt="" /> : <BookOpen size={25} />}
                                        {pImgs.length > 1 && (
                                            <span className="manage-item-counter">
                                                <Camera size={10} /> {pImgs.length}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <b>{p.title}</b>
                                        <small>
                                            {p.type} · {pImgs.length ? `${pImgs.length} photo${pImgs.length > 1 ? 's' : ''} · ` : ''}{date(p.created_at)} · {p.published ? 'Public' : 'Draft'} {p.pinned ? '· Pinned' : ''}
                                        </small>
                                        {pImgs[0]?.caption && (
                                            <small className="manage-item-caption">
                                                📷 "{pImgs[0].caption}"
                                            </small>
                                        )}
                                    </div>
                                    <div className="item-actions">
                                        {isCore(profile) && (
                                            <button title="Pin on homepage" onClick={() => pin(p)}>
                                                <Target size={16} />
                                            </button>
                                        )}
                                        {(p.author_id === user.id || isCore(profile)) && (
                                            <button title="Edit post" onClick={() => startEdit(p)}>
                                                <PenTool size={16} />
                                            </button>
                                        )}
                                        {admin && (
                                            <button title="Delete post" onClick={() => remove(p.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <Empty title="No posts yet" text="Write a new story or upload gallery photos to get started." />
                )}
            </Panel>
        </div>
    </>;
}
function Strategies() {
    const { user, profile } = useAuth(), admin = isAdmin(profile), { data: rows, reload } = useData('strategies', { order: 'created_at', limit: 120 });
    const { confirm } = useDialog();
    const [form, setForm] = useState({ title: '', description: '', source_type: 'link', link_url: '', media_type: 'video' });
    const [file, setFile] = useState(null);
    const [urls, setUrls] = useState({});
    const [viewing, setViewing] = useState(null);
    const task = useAsync();

    useEffect(() => {
        let on = true;
        (async () => {
            const pairs = await Promise.all(rows.map(async r => {
                try {
                    const isWebUrl = r.link_url?.startsWith('http') || r.media_path?.startsWith('http');
                    const mediaUrl = isWebUrl
                        ? (r.link_url || r.media_path)
                        : (r.media_path ? await signedUrl('strategy-files', r.media_path) : '');
                    const snapUrl = r.snapshot_path ? await signedUrl('strategy-files', r.snapshot_path) : '';
                    return [r.id, { media: mediaUrl, snapshot: snapUrl }];
                } catch {
                    return [r.id, {}];
                }
            }));
            if (on) setUrls(Object.fromEntries(pairs));
        })();
        return () => { on = false; };
    }, [rows]);

    function getStrategyMediaInfo(r) {
        const rawUrl = r.link_url || (r.media_path?.startsWith('http') ? r.media_path : '');
        const isDirectLink = Boolean(rawUrl);
        const effectiveUrl = isDirectLink ? rawUrl : (urls[r.id]?.media || '');
        const ytEmbed = rawUrl ? getYouTubeEmbedUrl(rawUrl) : null;
        const vimeoEmbed = rawUrl ? getVimeoEmbedUrl(rawUrl) : null;
        let domain = '';
        if (isDirectLink) {
            try {
                domain = new URL(rawUrl).hostname.replace(/^www\./, '');
            } catch (_) {}
        }
        return { isDirectLink, url: effectiveUrl, rawUrl, ytEmbed, vimeoEmbed, domain };
    }

    async function submit(e) {
        e.preventDefault();
        const did = await task.run(async () => {
            if (!form.title.trim()) throw Error('Enter a strategy title.');
            if (form.source_type === 'link') {
                if (!form.link_url.trim()) throw Error('Enter a valid link or video URL.');
                let url = form.link_url.trim();
                if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

                const isVideo = url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo') || /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
                const mediaType = isVideo ? 'video' : form.media_type;

                try {
                    await save('strategies', {
                        author_id: user.id,
                        title: form.title.trim(),
                        description: form.description.trim(),
                        media_type: mediaType,
                        media_path: url,
                        link_url: url
                    });
                } catch (_) {
                    await save('strategies', {
                        author_id: user.id,
                        title: form.title.trim(),
                        description: form.description.trim(),
                        media_type: mediaType === 'link' ? 'other' : mediaType,
                        media_path: url
                    });
                }
            } else {
                if (!file) throw Error('Choose a file to upload.');
                const path = await upload('strategy-files', file, user, 100);
                await save('strategies', {
                    author_id: user.id,
                    title: form.title.trim(),
                    description: form.description.trim(),
                    media_type: form.media_type,
                    media_path: path
                });
            }
            reload();
        }, form.source_type === 'link' ? 'Strategy link saved to playbook' : 'Strategy uploaded');

        if (did) {
            setForm({ title: '', description: '', source_type: 'link', link_url: '', media_type: 'video' });
            setFile(null);
            e.target.reset();
        }
    }

    async function remove(id) {
        const ok = await confirm({
            title: 'Delete Strategy',
            message: 'Permanently remove this playbook strategy from the club tactical library?',
            confirmText: 'DELETE STRATEGY',
            danger: true
        });
        if (!ok) return;
        await task.run(async () => {
            const { error } = await sb.from('strategies').delete().eq('id', id);
            if (error) throw error;
            reload();
        }, 'Strategy deleted');
    }

    return <>
        <Heading eyebrow="// OUR PLAYBOOK" title="STRATEGIES" subtitle="Private game plans, video walkthroughs, tactics links, and drills shared with club members only." />
        <div className="dash-two unequal">
            <Panel title="Add a strategy" subtitle="Share YouTube drill videos, Google Drive playbooks, tactics links, or uploaded files.">
                <form className="form-stack" onSubmit={submit}>
                    <Input
                        label="Strategy title"
                        required
                        maxLength={160}
                        placeholder="e.g. Zone Defense: 3-3-1 Cup / Endzone Stack"
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                    />

                    <div className="field">
                        <span style={{ fontWeight: 800 }}>Media source</span>
                        <div className="source-choice-tabs">
                            <button
                                type="button"
                                className={`source-tab ${form.source_type === 'link' ? 'active' : ''}`}
                                onClick={() => setForm({ ...form, source_type: 'link' })}
                            >
                                <Link2 size={14} /> WEB LINK / VIDEO URL
                            </button>
                            <button
                                type="button"
                                className={`source-tab ${form.source_type === 'file' ? 'active' : ''}`}
                                onClick={() => setForm({ ...form, source_type: 'file' })}
                            >
                                <Upload size={14} /> UPLOAD FILE
                            </button>
                        </div>
                    </div>

                    {form.source_type === 'link' ? (
                        <>
                            <Input label="Link / Video URL" required>
                                <input
                                    type="url"
                                    placeholder="https://www.youtube.com/watch?v=... or https://drive.google.com/..."
                                    value={form.link_url}
                                    onChange={e => setForm({ ...form, link_url: e.target.value })}
                                />
                                <small className="small-note">
                                    YouTube and Vimeo links embed directly for players to watch inside the dashboard.
                                </small>
                            </Input>
                            <Input label="Link category">
                                <select
                                    value={form.media_type}
                                    onChange={e => setForm({ ...form, media_type: e.target.value })}
                                >
                                    <option value="video">Video (YouTube / Vimeo / MP4)</option>
                                    <option value="other">Document / Playbook (Google Drive / Docs / Website)</option>
                                    <option value="image">Image / Diagram URL</option>
                                </select>
                            </Input>
                        </>
                    ) : (
                        <>
                            <Input label="Media type">
                                <select
                                    value={form.media_type}
                                    onChange={e => setForm({ ...form, media_type: e.target.value })}
                                >
                                    <option value="video">Video</option>
                                    <option value="image">Image</option>
                                    <option value="other">PDF / other</option>
                                </select>
                            </Input>
                            <Input label="Upload video, image or PDF (up to 100 MB)">
                                <input
                                    type="file"
                                    required
                                    accept="video/webm,video/mp4,image/jpeg,image/png,image/webp,application/pdf"
                                    onChange={e => setFile(e.target.files[0])}
                                />
                            </Input>
                        </>
                    )}

                    <Input label="Game plan & tactical notes">
                        <textarea
                            rows={4}
                            placeholder="Explain the strategy, player assignments, force direction, and key cues..."
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                        />
                    </Input>
                    <Flash error={task.err} success={task.ok} />
                    <FormButton busy={task.busy}>
                        {form.source_type === 'link' ? 'ADD STRATEGY LINK' : 'UPLOAD STRATEGY'}
                    </FormButton>
                </form>
            </Panel>

            <Panel title="Member playbook" subtitle="Game plans and tactical videos available to all squad players">
                <div className="strategy-list">
                    {rows.length ? rows.map(r => {
                        const info = getStrategyMediaInfo(r);
                        return (
                            <article key={r.id} className="strategy-item">
                                <div className="strategy-media">
                                    {info.ytEmbed ? (
                                        <div className="strategy-card-embed">
                                            <iframe
                                                src={info.ytEmbed}
                                                title={r.title}
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        </div>
                                    ) : info.vimeoEmbed ? (
                                        <div className="strategy-card-embed">
                                            <iframe
                                                src={info.vimeoEmbed}
                                                title={r.title}
                                                allow="autoplay; fullscreen; picture-in-picture"
                                                allowFullScreen
                                            />
                                        </div>
                                    ) : info.isDirectLink && (r.media_type === 'image' || /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(info.rawUrl)) ? (
                                        <img src={info.rawUrl} alt={r.title} onClick={() => setViewing(r)} style={{ cursor: 'pointer' }} />
                                    ) : info.isDirectLink ? (
                                        <div className="strategy-link-card-box" onClick={() => setViewing(r)}>
                                            <Globe size={32} />
                                            <b>{info.domain || 'External Resource'}</b>
                                            <a href={info.rawUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="strategy-link-anchor">
                                                OPEN LINK <ExternalLink size={13} />
                                            </a>
                                        </div>
                                    ) : r.media_type === 'image' && info.url ? (
                                        <img src={info.url} alt={r.title} onClick={() => setViewing(r)} style={{ cursor: 'pointer' }} />
                                    ) : ['video', 'whiteboard'].includes(r.media_type) && info.url ? (
                                        <video controls preload="metadata" src={info.url} />
                                    ) : (
                                        <div className="strategy-doc-card-box" onClick={() => setViewing(r)}>
                                            <FileText size={38} />
                                            <span>Tactical Document</span>
                                        </div>
                                    )}
                                </div>

                                <div className="strategy-header-row">
                                    <h3>{r.title}</h3>
                                    {info.ytEmbed ? (
                                        <span className="strategy-type-chip yt"><Play size={10} /> YOUTUBE</span>
                                    ) : info.vimeoEmbed ? (
                                        <span className="strategy-type-chip vimeo"><Play size={10} /> VIMEO</span>
                                    ) : info.isDirectLink ? (
                                        <span className="strategy-type-chip link"><Link2 size={10} /> {info.domain || 'LINK'}</span>
                                    ) : (
                                        <span className="strategy-type-chip file">{r.media_type.toUpperCase()}</span>
                                    )}
                                </div>

                                <small>{date(r.created_at)}</small>
                                <p>{r.description}</p>

                                <div className="actions strategy-actions-row">
                                    <button type="button" className="inline-button" onClick={() => setViewing(r)}>
                                        <Eye size={14} /> VIEW DIRECTLY
                                    </button>
                                    {info.rawUrl ? (
                                        <a className="inline-button" target="_blank" rel="noreferrer" href={info.rawUrl}>
                                            OPEN LINK <ExternalLink size={13} />
                                        </a>
                                    ) : r.media_type === 'other' && info.url ? (
                                        <a className="inline-button" target="_blank" rel="noreferrer" href={info.url}>
                                            OPEN FILE <ArrowUpRight size={13} />
                                        </a>
                                    ) : null}
                                    {admin && (
                                        <button type="button" className="inline-button danger" onClick={() => remove(r.id)}>
                                            DELETE <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    }) : (
                        <Empty icon={Target} title="Your playbook is empty" text="Add the first strategy link or upload a game plan." />
                    )}
                </div>
            </Panel>
        </div>

        {viewing && (
            <Modal title={viewing.title} onClose={() => setViewing(null)}>
                <div className="strategy-modal-detail">
                    {(() => {
                        const info = getStrategyMediaInfo(viewing);
                        if (info.ytEmbed) {
                            return (
                                <div className="strategy-modal-iframe-wrap">
                                    <iframe
                                        src={info.ytEmbed}
                                        title={viewing.title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            );
                        }
                        if (info.vimeoEmbed) {
                            return (
                                <div className="strategy-modal-iframe-wrap">
                                    <iframe
                                        src={info.vimeoEmbed}
                                        title={viewing.title}
                                        allow="autoplay; fullscreen; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            );
                        }
                        if (info.isDirectLink && (viewing.media_type === 'image' || /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(info.rawUrl))) {
                            return <img src={info.rawUrl} alt={viewing.title} className="strategy-modal-image" />;
                        }
                        if (info.isDirectLink) {
                            return (
                                <div className="strategy-modal-link-card">
                                    <Globe size={34} />
                                    <div>
                                        <b>{info.domain || 'External Resource'}</b>
                                        <p className="small-note">{info.rawUrl}</p>
                                    </div>
                                    <a
                                        href={info.rawUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-primary"
                                    >
                                        OPEN LINK <ExternalLink size={15} />
                                    </a>
                                </div>
                            );
                        }
                        if (viewing.media_type === 'image' && info.url) {
                            return <img src={info.url} alt={viewing.title} className="strategy-modal-image" />;
                        }
                        if (['video', 'whiteboard'].includes(viewing.media_type) && info.url) {
                            return <video controls autoPlay playsInline src={info.url} className="strategy-modal-video" />;
                        }
                        if (info.url) {
                            return (
                                <div className="strategy-modal-link-card">
                                    <FileText size={34} />
                                    <div>
                                        <b>Tactical Document</b>
                                        <p className="small-note">PDF or playbook attachment</p>
                                    </div>
                                    <a href={info.url} target="_blank" rel="noreferrer" className="btn btn-primary">
                                        OPEN DOCUMENT <ExternalLink size={15} />
                                    </a>
                                </div>
                            );
                        }
                        return null;
                    })()}

                    <div className="strategy-modal-notes">
                        <span className="small-eyebrow">// PLAYBOOK BREAKDOWN</span>
                        <h3>GAME PLAN & INSTRUCTIONS</h3>
                        <p>{viewing.description || 'No additional notes provided for this strategy.'}</p>
                    </div>

                    <div className="strategy-modal-footer">
                        <small>{date(viewing.created_at)} · {viewing.media_type.toUpperCase()}</small>
                        {(() => {
                            const info = getStrategyMediaInfo(viewing);
                            if (info.rawUrl) {
                                return (
                                    <a href={info.rawUrl} target="_blank" rel="noreferrer" className="inline-button">
                                        OPEN ORIGINAL LINK <ExternalLink size={14} />
                                    </a>
                                );
                            }
                            if (info.url) {
                                return (
                                    <a href={info.url} target="_blank" rel="noreferrer" className="inline-button">
                                        DOWNLOAD / OPEN FILE <ArrowUpRight size={14} />
                                    </a>
                                );
                            }
                            return null;
                        })()}
                    </div>
                </div>
            </Modal>
        )}
    </>;
}
function Whiteboard() {
    const { user } = useAuth(), canvas = useRef(null), painting = useRef(false), last = useRef(null), recorder = useRef(null), chunks = useRef([]), [recording, setRecording] = useState(false), [videoBlob, setVideoBlob] = useState(null), [pen, setPen] = useState('#b389ff'), [size, setSize] = useState(5), [name, setName] = useState(''), [notes, setNotes] = useState(''), task = useAsync(); const WIDTH = 960, HEIGHT = 540;
    const base = useCallback(() => { const ctx = canvas.current?.getContext('2d'); if (!ctx) return; ctx.fillStyle = '#101222'; ctx.fillRect(0, 0, WIDTH, HEIGHT); ctx.strokeStyle = 'rgba(255,255,255,.085)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(WIDTH / 2, 0); ctx.lineTo(WIDTH / 2, HEIGHT); ctx.stroke(); ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 85, 0, Math.PI * 2); ctx.stroke(); ctx.strokeRect(35, 35, WIDTH - 70, HEIGHT - 70); ctx.strokeRect(35, 155, 130, 230); ctx.strokeRect(WIDTH - 165, 155, 130, 230); ctx.strokeStyle = 'rgba(170,116,255,.38)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(WIDTH / 2, HEIGHT / 2, 9, 0, Math.PI * 2); ctx.stroke() }, []); useEffect(() => { base() }, [base]);
    function point(e) { const rect = canvas.current.getBoundingClientRect(); return { x: (e.clientX - rect.left) * WIDTH / rect.width, y: (e.clientY - rect.top) * HEIGHT / rect.height } }
    function down(e) { e.preventDefault(); painting.current = true; canvas.current.setPointerCapture(e.pointerId); const p = point(e); last.current = p; const ctx = canvas.current.getContext('2d'); ctx.fillStyle = pen; ctx.beginPath(); ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2); ctx.fill() }
    function move(e) { if (!painting.current) return; const p = point(e), ctx = canvas.current.getContext('2d'); ctx.strokeStyle = pen; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last.current = p }
    function up() { painting.current = false; last.current = null }
    function startRecord() { if (!canvas.current?.captureStream || typeof MediaRecorder === 'undefined') { task.run(async () => { throw Error('Your browser does not support canvas video recording. Try recent Chrome or Firefox, or save a static board.') }); return } const stream = canvas.current.captureStream(25); const formats = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']; const mime = formats.find(x => MediaRecorder.isTypeSupported(x)); if (!mime) { task.run(async () => { throw Error('This browser cannot record a supported video type. Use Export board PNG.') }); stream.getTracks().forEach(t => t.stop()); return } try { chunks.current = []; const r = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1800000 }); recorder.current = r; r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data) }; r.onstop = () => { setVideoBlob(new Blob(chunks.current, { type: mime })); setRecording(false); stream.getTracks().forEach(t => t.stop()) }; r.start(300); setVideoBlob(null); setRecording(true) } catch (e) { stream.getTracks().forEach(t => t.stop()); task.run(async () => { throw e }) } }
    function stopRecord() { if (recorder.current?.state === 'recording') recorder.current.stop() }
    async function uploadBoard(onlyImage = false) { await task.run(async () => { if (!name.trim()) throw Error('Add a title for your tactics session.'); let path, type, snapshot = null; if (videoBlob && !onlyImage) { const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm'; path = await upload('strategy-files', new File([videoBlob], `tactics.${ext}`, { type: videoBlob.type.split(';')[0] }), user, 100); type = 'whiteboard' } else { const blob = await new Promise(resolve => canvas.current.toBlob(resolve, 'image/png')); path = await upload('strategy-files', new File([blob], 'tactics.png', { type: 'image/png' }), user, 100); type = 'image' } await save('strategies', { author_id: user.id, title: name, description: notes, media_type: type, media_path: path, snapshot_path: snapshot }); setVideoBlob(null); setName(''); setNotes('') }, onlyImage ? 'Board saved as an image' : 'Recording saved to the private strategy library') }
    function exportPng() { const link = document.createElement('a'); link.download = 'kiducatchis-tactics.png'; link.href = canvas.current.toDataURL('image/png'); link.click() }
    return <><Heading eyebrow="// X'S, O'S & EVERY THROW" title="TACTICS WHITEBOARD" subtitle="Draw with your mouse, finger or stylus. Record the actual board animation and share it privately with the squad." /><Panel title="LIVE TACTICS STUDIO" subtitle="The video records the canvas only (no microphone or camera)."><div className="board-toolbar"><div className="board-colors">{['#b389ff', '#35d8ef', '#ffffff', '#ffd76b', '#ff7387', '#101222'].map(c => <button type="button" key={c} title={c === '#101222' ? 'Erase with background' : c} className={c === pen ? 'chosen' : ''} style={{ background: c }} onClick={() => setPen(c)} />)}</div><label className="brush-range">BRUSH <input type="range" min="2" max="22" value={size} onChange={e => setSize(+e.target.value)} /></label><button className="small-btn" onClick={base}>CLEAR BOARD</button><button className="small-btn" onClick={exportPng}><Download size={15} /> PNG</button></div><div className="board-canvas-wrap"><canvas ref={canvas} width={WIDTH} height={HEIGHT} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Tactics drawing canvas" /></div><div className="record-controls">{!recording ? <button className="btn btn-primary" onClick={startRecord}><span className="rec-dot" /> START RECORDING</button> : <button className="btn btn-danger" onClick={stopRecord}><Square size={16} /> STOP RECORDING</button>}<p>{recording ? 'RECORDING • Draw your routes, plays and movement now.' : videoBlob ? 'Recording complete. Add a title and save to Strategies.' : 'Press record, then demonstrate your plays on the board. Stop to save the video.'}</p></div><div className="board-save form-stack"><div className="form-grid"><Input label="Strategy title" placeholder="End-zone set play" value={name} onChange={e => setName(e.target.value)} /><Input label="Optional notes" placeholder="Formation, cuts, movement..." value={notes} onChange={e => setNotes(e.target.value)} /></div><Flash error={task.err} success={task.ok} /><div className="actions"><button className="btn btn-primary" disabled={task.busy || recording || !videoBlob} onClick={() => uploadBoard(false)}><Save size={17} /> SAVE VIDEO TO PLAYBOOK</button><button className="btn btn-outline" disabled={task.busy || recording} onClick={() => uploadBoard(true)}><ImageIcon size={17} /> SAVE STILL IMAGE</button></div></div></Panel></>
}
function TournamentAdmin({ core }) { const { profile } = useAuth(), admin = isAdmin(profile), { confirm } = useDialog(), { data: tourneys, reload: reloadT } = useData('tournaments', { order: 'starts_on', asc: false }), { data: profiles } = useData('profiles', { order: 'full_name' }), { data: roster, reload: reloadR } = useData('tournament_roster', { limit: 2000 }), { data: matches, reload: reloadM } = useData('matches', { order: 'scheduled_at', limit: 300 }); const [form, setForm] = useState({ name: '', description: '', location: '', starts_on: '', ends_on: '' }), [selected, setSelected] = useState([]), [tourId, setTourId] = useState(''), [match, setMatch] = useState({ opponent: '', venue: '', scheduled_at: '' }), [addPlayer, setAddPlayer] = useState(''), [edits, setEdits] = useState({}), task = useAsync(); useEffect(() => { if (tourneys.length && !tourneys.some(t => t.id === tourId)) setTourId(tourneys[0].id) }, [tourneys, tourId]); const pMap = Object.fromEntries(profiles.map(p => [p.id, p])); const current = roster.filter(r => r.tournament_id === tourId); async function create(e) { e.preventDefault(); const did = await task.run(async () => { const t = await save('tournaments', { ...form, ends_on: form.ends_on || null }); if (selected.length) { const items = selected.map(id => ({ tournament_id: t.id, player_id: id, position: pMap[id]?.position || 'Flexible', jersey_number: pMap[id]?.jersey_number ?? null, team_role: 'Player' })); const { error } = await sb.from('tournament_roster').insert(items); if (error) throw error; } reloadT(); reloadR(); setTourId(t.id) }, 'Tournament and selected roster created'); if (did) { setForm({ name: '', description: '', location: '', starts_on: '', ends_on: '' }); setSelected([]) } } async function removeTournament(id) { const t = tourneys.find(x => x.id === id); const ok = await confirm({ title: 'Delete Tournament', message: `Permanently delete tournament "${t?.name || 'this competition'}"?\nThis removes all fixtures and roster assignments.`, confirmText: 'DELETE TOURNAMENT', danger: true }); if (!ok) return; await task.run(async () => { const { error } = await sb.from('tournaments').delete().eq('id', id); if (error) throw error; reloadT(); reloadM(); reloadR(); const remaining = tourneys.filter(x => x.id !== id); setTourId(remaining.length ? remaining[0].id : ''); }, 'Tournament deleted') } async function createMatch(e) { e.preventDefault(); const did = await task.run(async () => { if (!tourId) throw Error('Create or select a tournament first.'); await save('matches', { tournament_id: tourId, opponent: match.opponent, venue: match.venue, scheduled_at: new Date(match.scheduled_at).toISOString() }); reloadM() }, 'Match scheduled'); if (did) setMatch({ opponent: '', venue: '', scheduled_at: '' }) } async function removeMatch(matchId) { const m = matches.find(x => x.id === matchId); const ok = await confirm({ title: 'Delete Match', message: `Permanently delete match vs "${m?.opponent || 'opponent'}"?`, confirmText: 'DELETE MATCH', danger: true }); if (!ok) return; await task.run(async () => { const { error } = await sb.from('matches').delete().eq('id', matchId); if (error) throw error; reloadM(); }, 'Match deleted') } async function addToRoster() { await task.run(async () => { if (!addPlayer) throw Error('Select a player.'); const p = pMap[addPlayer]; if (!p || !p.is_active || !p.in_squad) throw Error('Select an active squad player.'); await save('tournament_roster', { tournament_id: tourId, player_id: addPlayer, position: p.position, jersey_number: p.jersey_number, team_role: 'Player' }); reloadR(); setAddPlayer('') }, 'Player added') } async function updateRoster(r) { const values = edits[r.id] || r; await task.run(async () => { await patch('tournament_roster', r.id, { position: values.position, team_role: values.team_role, jersey_number: values.jersey_number === '' ? null : values.jersey_number }); reloadR() }, 'Squad role updated') } async function removeRoster(r) { const pName = pMap[r.player_id]?.full_name || 'this player'; const ok = await confirm({ title: 'Remove from Squad', message: `Remove ${pName} from this tournament squad?`, confirmText: 'REMOVE PLAYER', danger: true }); if (!ok) return; await task.run(async () => { const { error } = await sb.from('tournament_roster').delete().eq('id', r.id); if (error) throw error; reloadR() }, 'Player removed') } async function editTournament(t, value) { await task.run(async () => { await patch('tournaments', t.id, value); reloadT() }, 'Tournament updated') } return <><Heading eyebrow="// SCHEDULE & SELECTION" title="TOURNAMENT MANAGEMENT" subtitle="Build the competition, select your squad, assign captains, then create individual matches." />{!core && <Panel title="Select tournament"><select value={tourId} onChange={e => setTourId(e.target.value)}><option value="">Select...</option>{tourneys.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Panel>}{core && <div className="dash-two unequal"><Panel title="Create a tournament"><form className="form-stack" onSubmit={create}><Input label="Tournament name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><Input label="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /><div className="form-grid"><Input label="Starts on" type="date" required value={form.starts_on} onChange={e => setForm({ ...form, starts_on: e.target.value })} /><Input label="Ends on" type="date" min={form.starts_on} value={form.ends_on} onChange={e => setForm({ ...form, ends_on: e.target.value })} /></div><Input label="Description"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></Input><label className="field">Choose squad now (optional)</label><div className="roster-picker">{profiles.filter(p => p.is_active && p.in_squad).map(p => <label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={e => setSelected(a => e.target.checked ? [...a, p.id] : a.filter(id => id !== p.id))} />{p.full_name} <small>#{p.jersey_number ?? '—'} · {p.position}</small></label>)}</div><Flash error={task.err} success={task.ok} /><FormButton busy={task.busy}>CREATE TOURNAMENT</FormButton></form></Panel><Panel title="Manage competition" subtitle="Select tournament to edit squad and fixtures"><Input label="Selected tournament"><select value={tourId} onChange={e => setTourId(e.target.value)}><option value="">Select...</option>{tourneys.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Input>{tourId && <><div className="admin-tournament-toolbar"><span>{tourneys.find(t => t.id === tourId)?.name}</span><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><select value={tourneys.find(t => t.id === tourId)?.status || 'upcoming'} onChange={e => editTournament(tourneys.find(t => t.id === tourId), { status: e.target.value })}><option>upcoming</option><option>ongoing</option><option>completed</option></select>{admin && <button type="button" className="small-btn danger" onClick={() => removeTournament(tourId)}><Trash2 size={14} /> DELETE TOURNAMENT</button>}</div></div><form className="form-stack" onSubmit={createMatch}><h4>SCHEDULE A MATCH</h4><Input label="Opponent name" required value={match.opponent} onChange={e => setMatch({ ...match, opponent: e.target.value })} /><Input label="Venue" value={match.venue} onChange={e => setMatch({ ...match, venue: e.target.value })} /><Input label="Date and time" type="datetime-local" required value={match.scheduled_at} onChange={e => setMatch({ ...match, scheduled_at: e.target.value })} /><FormButton busy={task.busy}>ADD MATCH</FormButton></form></>}{!tourneys.length && <Empty title="Create a tournament first" />}</Panel></div>}<Panel title="Squad selection" subtitle="Tournament-specific positions, jersey numbers and leadership roles">{tourId ? <>{core && <div className="squad-edit-top"><select value={addPlayer} onChange={e => setAddPlayer(e.target.value)}><option value="">Select additional player</option>{profiles.filter(p => p.is_active && p.in_squad && !current.some(r => r.player_id === p.id)).map(p => <option value={p.id} key={p.id}>{p.full_name}</option>)}</select><button className="small-btn" onClick={addToRoster} disabled={!addPlayer}><Plus size={15} /> ADD PLAYER</button></div>}{current.length ? <div className="roster-edit-list">{current.map(r => { const v = edits[r.id] || r; const field = (key, value) => setEdits({ ...edits, [r.id]: { ...v, [key]: value } }); return <div key={r.id} className="roster-edit-row"><b>{pMap[r.player_id]?.full_name || 'Unknown'}</b><input aria-label="Jersey" disabled={!core} type="number" min="0" max="999" placeholder="#" value={v.jersey_number ?? ''} onChange={e => field('jersey_number', e.target.value)} /><select disabled={!core} aria-label="Position" value={v.position} onChange={e => field('position', e.target.value)}>{['Handler', 'Cutter', 'Flexible'].map(p => <option key={p}>{p}</option>)}</select><select disabled={!core} aria-label="Tournament responsibility" value={v.team_role} onChange={e => field('team_role', e.target.value)}>{['Player', 'Captain', 'Spirit Captain', 'Coach', 'Vice Captain', 'Manager'].map(p => <option key={p}>{p}</option>)}</select>{core && <button title="Save player role" onClick={() => updateRoster(r)}><Check size={18} /></button>}{admin && <button title="Remove player from squad" onClick={() => removeRoster(r)}><Trash2 size={16} /></button>}</div> })}</div> : <Empty title="No squad selected" text="Add players to set their tournament roles." />}</> : <Empty title="Choose a tournament" />}</Panel><Panel title="Scheduled matches">{matches.filter(m => !tourId || m.tournament_id === tourId).length ? <div className="management-list">{matches.filter(m => !tourId || m.tournament_id === tourId).map(m => <div className="dash-list-row" key={m.id}><Link to={`/games/${m.id}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'inherit' }}><div><b>Kiducatchis vs {m.opponent}</b><small>{date(m.scheduled_at)} · {m.status} · {m.score_us}:{m.score_them}</small></div><ArrowUpRight size={17} /></Link>{admin && <button type="button" className="small-btn danger" style={{ marginLeft: 10 }} title="Delete match" onClick={e => { e.preventDefault(); e.stopPropagation(); removeMatch(m.id); }}><Trash2 size={14} /></button>}</div>)}</div> : <Empty title="No matches added" />}</Panel></> }
function Scoring() { const { user, profile } = useAuth(), admin = isAdmin(profile), { confirm } = useDialog(), { data: matches, reload: reloadM } = useData('matches', { order: 'scheduled_at', limit: 300 }, true), { data: tournaments } = useData('tournaments'), { data: roster } = useData('tournament_roster', { limit: 2000 }), { data: profiles } = useData('profiles'), { data: events, reload: reloadE } = useData('match_events', { order: 'game_second', limit: 1000 }, true); const [selected, setSelected] = useState(''), [form, setForm] = useState({ kind: 'point_us', player_id: '', assist_id: '', detail: '' }), [now, setNow] = useState(Date.now()), task = useAsync(); useEffect(() => { if (!selected && matches.length) setSelected(matches.find(m => m.status === 'live')?.id || matches[0].id) }, [selected, matches]); useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, []); const m = matches.find(x => x.id === selected), team = roster.filter(r => r.tournament_id === m?.tournament_id), pMap = Object.fromEntries(profiles.map(p => [p.id, p])), elapsed = m ? m.elapsed_before_pause + (m.clock_running && m.clock_started_at ? Math.max(0, Math.floor((now - new Date(m.clock_started_at).getTime()) / 1000)) : 0) : 0; const history = events.filter(e => e.match_id === m?.id); async function clockAction(action) { if (!m) return; await task.run(async () => { const changes = action === 'start' ? { status: 'live', clock_running: true, clock_started_at: new Date().toISOString() } : action === 'pause' ? { clock_running: false, clock_started_at: null, elapsed_before_pause: elapsed } : { status: 'completed', clock_running: false, clock_started_at: null, elapsed_before_pause: elapsed }; await patch('matches', m.id, changes); reloadM() }, action === 'start' ? 'Match is live' : action === 'pause' ? 'Timer paused' : 'Match completed') } async function endGame() { const ok = await confirm({ title: 'End Match', message: 'End this game and publish the final score?', confirmText: 'END GAME', danger: true }); if (ok) clockAction('end'); } async function removeMatch(matchId) { const target = matches.find(x => x.id === matchId); const ok = await confirm({ title: 'Delete Match', message: `Permanently delete match vs "${target?.opponent || 'opponent'}" and all recorded events?`, confirmText: 'DELETE MATCH', danger: true }); if (!ok) return; await task.run(async () => { const { error } = await sb.from('matches').delete().eq('id', matchId); if (error) throw error; reloadM(); const remaining = matches.filter(x => x.id !== matchId); setSelected(remaining.length ? remaining[0].id : ''); }, 'Match deleted') } async function enterEvent(e) { e.preventDefault(); if (!m || m.status !== 'live') return; await task.run(async () => { await save('match_events', { match_id: m.id, kind: form.kind, player_id: form.player_id || null, assist_id: form.kind === 'point_us' && form.assist_id ? form.assist_id : null, detail: form.detail, game_second: elapsed, created_by: user.id }); reloadE(); reloadM(); setForm({ ...form, detail: '' }) }, 'Event recorded') } async function undo(e) { const ok = await confirm({ title: 'Undo Event', message: 'Remove this event and recalculate the score?', confirmText: 'REMOVE EVENT', danger: true }); if (!ok) return; await task.run(async () => { const { error } = await sb.from('match_events').delete().eq('id', e.id); if (error) throw error; reloadE(); reloadM() }, 'Event removed') } async function pin() { await task.run(async () => { await patch('matches', m.id, { pinned: !m.pinned }); reloadM() }, 'Homepage pin changed') } const label = { point_us: 'Point scored', point_them: 'Opponent point', block: 'Block', turnover: 'Turnover', on: 'Player on', off: 'Player off', other: 'Other' }; return <><Heading eyebrow="// SCORE IT LIVE" title="MATCH CONTROL" subtitle="Live scores feed the public homepage and match page. Every event has a game-clock timestamp." /><Panel title="Choose a game"><Input label="Tournament / game"><select value={selected} onChange={e => setSelected(e.target.value)}><option value="">Choose game</option>{matches.map(x => <option key={x.id} value={x.id}>{tournaments.find(t => t.id === x.tournament_id)?.name || 'Tournament'} — vs {x.opponent} ({x.status})</option>)}</select></Input>{!matches.length && <p className="muted">Create a tournament and a match first.</p>}</Panel>{m && <><div className="score-console"><div className="score-console-top"><span className={'status ' + (m.status === 'live' ? 'live' : '')}>{m.status.toUpperCase()}</span><div style={{ display: 'flex', gap: 8 }}><button className="small-btn" onClick={pin}>{m.pinned ? '★ PINNED' : '☆ PIN ON HOMEPAGE'}</button>{admin && <button type="button" className="small-btn danger" onClick={() => removeMatch(m.id)}><Trash2 size={14} /> DELETE MATCH</button>}</div></div><div className="score-console-main"><div><small>OUR CLUB</small><b>KIDUCATCHIS</b></div><strong>{m.score_us} <em>:</em> {m.score_them}</strong><div><small>OPPONENT</small><b>{m.opponent}</b></div></div><div className="timer-line"><Clock size={18} /><strong>{fmtClock(elapsed)}</strong><span>GAME CLOCK</span></div><div className="actions center">{m.status !== 'completed' && (m.clock_running ? <button className="btn btn-outline" onClick={() => clockAction('pause')}><Pause size={16} /> PAUSE CLOCK</button> : <button className="btn btn-primary" onClick={() => clockAction('start')}><Play size={16} /> {m.status === 'upcoming' ? 'START MATCH' : 'RESUME MATCH'}</button>)}{m.status === 'live' && <button className="btn btn-danger" onClick={endGame}><Square size={16} /> END GAME</button>}</div></div><div className="dash-two"><Panel title="Record a game event" subtitle="Scorer, assister and defensive events are saved with time"><form className="form-stack" onSubmit={enterEvent}><Input label="Action"><select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value, assist_id: '' })}>{Object.entries(label).map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select></Input><Input label="Player / scorer"><select value={form.player_id} required={form.kind === 'point_us'} onChange={e => setForm({ ...form, player_id: e.target.value })}><option value="">{form.kind === 'point_them' ? 'Opponent point (no player)' : 'Select player...'}</option>{team.map(r => <option key={r.player_id} value={r.player_id}>#{r.jersey_number ?? '?'} {pMap[r.player_id]?.full_name}</option>)}</select></Input>{form.kind === 'point_us' && <Input label="Assisted by (optional)"><select value={form.assist_id} onChange={e => setForm({ ...form, assist_id: e.target.value })}><option value="">No assist</option>{team.filter(r => r.player_id !== form.player_id).map(r => <option key={r.player_id} value={r.player_id}>{pMap[r.player_id]?.full_name}</option>)}</select></Input>}<Input label="Note (optional)" value={form.detail} placeholder="Layout D / break throw..." onChange={e => setForm({ ...form, detail: e.target.value })} /><Flash error={task.err} success={task.ok} /><button className="btn btn-primary" type="submit" disabled={task.busy || m.status !== 'live' || !team.length}><Plus size={17} /> RECORD AT {fmtClock(elapsed)}</button>{!team.length && <p className="small-note">Set the tournament squad before recording players or points.</p>}</form></Panel><Panel title="Event timeline" subtitle="Latest events · remove wrong entries to update the score">{history.length ? <div className="events-list">{history.map(e => <div className="event-row" key={e.id}><time>{fmtClock(e.game_second)}</time><div><b>{label[e.kind]}</b><p>{pMap[e.player_id]?.full_name || ''}{e.assist_id ? ` · Assist: ${pMap[e.assist_id]?.full_name || ''}` : ''} {e.detail}</p></div>{admin && <button title="Undo this event" onClick={() => undo(e)}><Trash2 size={16} /></button>}</div>)}</div> : <Empty title="No events recorded yet" />}</Panel></div></>}</> }
function Finance() {
    const { user, profile } = useAuth(), { confirm, alert } = useDialog(), { data: rows, reload } = useData('finance_transactions', { order: 'occurred_on', limit: 1500 }), { data: members } = useData('profiles', { order: 'full_name' }), task = useAsync(), [proof, setProof] = useState(null), [form, setForm] = useState({ kind: 'expense', scope: 'club', reason: '', amount: '', holder_id: '', transferred_to_id: '', player_id: '', occurred_on: new Date().toISOString().slice(0, 10) }), [period, setPeriod] = useState('all'); const core = members.filter(x => ['admin', 'council'].includes(x.role) && x.is_active), name = id => members.find(m => m.id === id)?.full_name || 'Unknown'; const filtered = rows.filter(r => period === 'all' || r.occurred_on.startsWith(period)); const total = kind => filtered.filter(r => r.kind === kind).reduce((n, r) => n + Number(r.amount), 0); const income = total('income'), expense = total('expense'), totalBalance = income - expense; const balances = core.map(p => { const amount = filtered.reduce((n, r) => { if (r.kind === 'income' && r.holder_id === p.id) return n + Number(r.amount); if (r.kind === 'expense' && r.holder_id === p.id) return n - Number(r.amount); if (r.kind === 'transfer') { if (r.holder_id === p.id) n -= Number(r.amount); if (r.transferred_to_id === p.id) n += Number(r.amount) } return n }, 0); return { ...p, amount } }); const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return d.toISOString().slice(0, 7) }); const series = months.map(m => ({ month: m, income: rows.filter(r => r.kind === 'income' && r.occurred_on.startsWith(m)).reduce((n, r) => n + Number(r.amount), 0), expense: rows.filter(r => r.kind === 'expense' && r.occurred_on.startsWith(m)).reduce((n, r) => n + Number(r.amount), 0) })); const max = Math.max(1, ...series.map(x => Math.max(x.income, x.expense))); const periods = [...new Set(rows.map(x => x.occurred_on.slice(0, 7)))].sort().reverse(); async function submit(e) { e.preventDefault(); const done = await task.run(async () => { if (form.kind === 'transfer' && !form.transferred_to_id) throw Error('Select which council member receives this transfer.'); if (form.kind === 'transfer' && form.transferred_to_id === form.holder_id) throw Error('Choose two different holders.'); if (form.scope === 'player' && !form.player_id) throw Error('Select a player.'); const path = proof ? await upload('finance-proofs', proof, user, 20) : null; await save('finance_transactions', { kind: form.kind, scope: form.kind === 'transfer' ? 'club' : form.scope, reason: form.reason, amount: Number(form.amount), holder_id: form.holder_id, transferred_to_id: form.kind === 'transfer' ? form.transferred_to_id : form.kind === 'expense' ? (form.transferred_to_id || null) : null, player_id: form.kind !== 'transfer' && form.scope === 'player' ? form.player_id : null, occurred_on: form.occurred_on, proof_path: path, created_by: user.id }); reload() }, 'Transaction recorded'); if (done) { setForm({ ...form, reason: '', amount: '', transferred_to_id: '', player_id: '' }); setProof(null); e.target.reset() } } async function remove(r) { const ok = await confirm({ title: 'Delete Transaction', message: `Permanently delete this transaction (${r.reason} · ₹${r.amount})?`, confirmText: 'DELETE TRANSACTION', danger: true }); if (!ok) return; await task.run(async () => { const { error } = await sb.from('finance_transactions').delete().eq('id', r.id); if (error) throw error; reload() }, 'Transaction deleted') } async function viewProof(path) { const w = window.open('about:blank', '_blank'); try { const url = await signedUrl('finance-proofs', path); if (w) w.location.href = url; else window.location.href = url } catch (e) { if (w) w.close(); await alert({ title: 'Cannot Open Proof', message: errorText(e), type: 'error' }) } } function exportCSV() {
        // Keep UUIDs in the database; export human-readable names in the CSV.
        const headers = [
            'Date',
            'Transaction Type',
            'Amount (INR)',
            'Related To',
            'Player Name',
            'Held / Paid By',
            'Transferred To',
            'Reason',
            'Recorded By'
        ];

        const memberName = (id) => id ? name(id) : '';
        // Prevent spreadsheet formula execution from user-entered descriptions/names.
        const escapeCell = (value) => {
            let text = String(value ?? '');
            if (/^[\s]*[=+@-]/.test(text) && text !== '') text = "'" + text;
            return '"' + text.replaceAll('"', '""') + '"';
        };

        const lines = [headers, ...filtered.map((r) => [
            r.occurred_on,
            r.kind,
            Number(r.amount),
            r.scope === 'player' ? 'Player' : 'Club',
            r.scope === 'player' ? memberName(r.player_id) : '',
            memberName(r.holder_id),
            memberName(r.transferred_to_id),
            r.reason,
            memberName(r.created_by)
        ])];
        const csv = '\uFEFF' + lines.map(row => row.map(escapeCell).join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'kiducatchis-accounts.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
    } return <><Heading eyebrow="// CLUB TREASURY" title="FINANCE DASHBOARD" subtitle="Private cashflow, member holdings, expenses, internal transfers and optional proof receipts." /><div className="finance-header"><select aria-label="Month filter" value={period} onChange={e => setPeriod(e.target.value)}><option value="all">All time</option>{periods.map(p => <option value={p} key={p}>{p}</option>)}</select><button className="small-btn" onClick={exportCSV}><Download size={16} /> EXPORT CSV</button></div><div className="dash-stats"><div><ArrowDownRight /><span>TOTAL INCOME</span><strong>{money(income)}</strong></div><div><CreditCard /><span>TOTAL EXPENSES</span><strong>{money(expense)}</strong></div><div><Wallet /><span>NET CASH BALANCE</span><strong>{money(totalBalance)}</strong></div><div><Activity /><span>INTERNAL TRANSFERS</span><strong>{money(total('transfer'))}</strong></div></div><div className="dash-two"><Panel title="Income vs expenditure" subtitle="Monthly recorded transactions"><div className="finance-chart">{series.map(s => <div className="bar-group" key={s.month}><div className="bar-pair"><span title={`Income ${money(s.income)}`} style={{ height: `${Math.max(1, s.income / max * 100)}%` }} /><span title={`Expense ${money(s.expense)}`} style={{ height: `${Math.max(1, s.expense / max * 100)}%` }} /></div><small>{s.month.slice(5)}</small></div>)}</div><div className="chart-legend"><i /> Income <i /> Expense</div></Panel><Panel title="Held by core members" subtitle="Net balance with each treasurer; transfers move cash without affecting club profit"><div className="holder-list">{balances.map(p => <div key={p.id}><span><UserRound size={16} />{p.full_name}</span><b className={p.amount < 0 ? 'negative' : ''}>{money(p.amount)}</b></div>)}{!balances.length && <Empty title="No council accounts" text="Assign council roles to track individual cash holders." />}</div><p className="small-note">Negative amounts may indicate an incomplete opening balance or that a member paid out of pocket. Enter opening funds as income.</p></Panel></div><div className="dash-two unequal"><Panel title="Record transaction"><form className="form-stack" onSubmit={submit}><Input label="Transaction type"><select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="income">Income / funds received</option><option value="expense">Expense / payment</option><option value="transfer">Internal transfer between core members</option></select></Input><div className="form-grid"><Input label="Amount (INR)" type="number" required min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /><Input label="Date" required type="date" value={form.occurred_on} onChange={e => setForm({ ...form, occurred_on: e.target.value })} /></div>{form.kind !== 'transfer' && <Input label="Related to"><select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}><option value="club">Club</option><option value="player">Specific player</option></select></Input>}{form.kind !== 'transfer' && form.scope === 'player' && <Input label="Player"><select required value={form.player_id} onChange={e => setForm({ ...form, player_id: e.target.value })}><option value="">Select player</option>{members.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Input>}<Input label={form.kind === 'transfer' ? 'Transfer from which core member?' : form.kind === 'income' ? 'Received/held by' : 'Paid by / taken from'}><select required value={form.holder_id} onChange={e => setForm({ ...form, holder_id: e.target.value })}><option value="">Select council member</option>{core.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Input>{form.kind !== 'income' && <Input label={form.kind === 'transfer' ? 'Transferred to which core member?' : 'Transferred to core member (optional)'}><select required={form.kind === 'transfer'} value={form.transferred_to_id} onChange={e => setForm({ ...form, transferred_to_id: e.target.value })}><option value="">{form.kind === 'transfer' ? 'Select recipient' : 'None / external expense'}</option>{core.filter(p => p.id !== form.holder_id).map(p => <option value={p.id} key={p.id}>{p.full_name}</option>)}</select></Input>}<Input label="Reason / description" required maxLength={1500} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /><Input label="Proof (optional, JPEG / PNG / PDF up to 20 MB)"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setProof(e.target.files[0])} /></Input><Flash error={task.err} success={task.ok} /><FormButton busy={task.busy}>RECORD TRANSACTION</FormButton></form></Panel><Panel title="Transaction ledger" subtitle="Income, payments and transfers, newest first"><div className="ledger-list">{filtered.map(r => <article key={r.id} className="ledger-row"><div className={'tx-icon ' + r.kind}>{r.kind === 'income' ? <ArrowDownRight /> : r.kind === 'expense' ? <CreditCard /> : <ArrowRight />}</div><div><b>{r.reason}</b><small>{date(r.occurred_on)} · {r.kind.toUpperCase()} · {r.scope === 'player' ? `PLAYER: ${name(r.player_id)}` : 'CLUB'}</small><small>{name(r.holder_id)} {r.transferred_to_id ? `→ ${name(r.transferred_to_id)}` : ''}</small><div className="actions">{r.proof_path && <button className="inline-button" onClick={() => viewProof(r.proof_path)}>VIEW PROOF <ArrowUpRight size={14} /></button>}{isAdmin(profile) && <button className="inline-button danger" onClick={() => remove(r)}>DELETE <Trash2 size={14} /></button>}</div></div><strong className={r.kind}>{r.kind === 'expense' ? '−' : r.kind === 'income' ? '+' : '⇄'}{money(r.amount)}</strong></article>)}{!filtered.length && <Empty title="No financial entries" text="Record the club's first payment or income." />}</div></Panel></div></>
}
function Members() {
    const { user, profile } = useAuth();
    const admin = isAdmin(profile);
    const { confirm, alert } = useDialog();
    const { data: members, reload: reloadP } = useData('profiles', { order: 'full_name' });
    const [form, setForm] = useState({
        mode: 'invite', // 'invite' | 'squad'
        full_name: '',
        email: '',
        role: 'player',
        position: 'Flexible',
        jersey_number: '',
        council_title: '',
        in_squad: false,
        bio: ''
    });
    const [createdInvite, setCreatedInvite] = useState(null);
    const [copied, setCopied] = useState(false);
    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [guestEmail, setGuestEmail] = useState('');
    const task = useAsync();

    async function copyInviteLink(link) {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (_) {
            window.prompt('Copy activation link:', link);
        }
    }

    async function resendInvite(m) {
        if (!m) return;
        await task.run(async () => {
            const { data, error } = await sb.functions.invoke('invite-member', {
                body: { action: 'resend_invite', member_id: m.id }
            });
            if (error) {
                let msg = error.message;
                try { const d = await error.context?.json(); msg = d?.error || msg; } catch {}
                throw Error(msg);
            }
            if (!data?.ok) throw Error(data?.error || 'Could not send invitation.');
            if (data?.invite_link) {
                setCreatedInvite({
                    name: m.full_name,
                    email: data.email || 'Member',
                    link: data.invite_link
                });
            }
        }, `Activation invite prepared for ${m.full_name}`);
    }

    async function removeMember(target) {
        if (!target) return;
        if (target.id === profile.id || target.id === user?.id) {
            await alert({
                title: 'Action Not Allowed',
                message: 'You cannot delete your own admin account.',
                type: 'warning'
            });
            return;
        }
        const ok = await confirm({
            title: 'Delete Member',
            message: `Permanently delete member "${target.full_name}"?\nThis removes their squad selection, tournament roster slots and profile record.`,
            confirmText: 'DELETE MEMBER',
            danger: true
        });
        if (!ok) return;
        await task.run(async () => {
            let deleted = false;
            let lastErr = null;

            // 1. Try atomic PostgreSQL RPC (cleans up auth.users and all foreign keys)
            try {
                const { error: rpcError } = await sb.rpc('admin_delete_member', { p_id: target.id });
                if (!rpcError) {
                    deleted = true;
                } else {
                    lastErr = rpcError.message;
                    console.warn('admin_delete_member RPC warning:', rpcError);
                }
            } catch (e) {
                lastErr = e?.message || lastErr;
            }

            // 2. Try Edge Function (service_role privilege)
            if (!deleted) {
                try {
                    const { data: edgeData, error: edgeErr } = await sb.functions.invoke('invite-member', {
                        body: { action: 'delete_member', member_id: target.id }
                    });
                    if (!edgeErr && edgeData?.ok) {
                        deleted = true;
                    } else if (edgeErr || edgeData?.error) {
                        lastErr = edgeErr?.message || edgeData?.error || lastErr;
                        console.warn('invite-member edge delete warning:', edgeErr || edgeData?.error);
                    }
                } catch (e) {
                    lastErr = e?.message || lastErr;
                }
            }

            // 3. Fallback direct client cascade deletion
            if (!deleted) {
                try { await sb.from('tournament_roster').delete().eq('player_id', target.id); } catch (_) {}
                try { await sb.from('match_events').delete().eq('player_id', target.id); } catch (_) {}
                try { await sb.from('match_events').delete().eq('assist_id', target.id); } catch (_) {}
                try { await sb.from('finance_transactions').delete().eq('player_id', target.id); } catch (_) {}
                try { await sb.from('posts').delete().eq('author_id', target.id); } catch (_) {}
                try { await sb.from('strategies').delete().eq('author_id', target.id); } catch (_) {}
                try { await sb.from('invitations').delete().eq('created_by', target.id); } catch (_) {}
                try { await sb.from('invitations').delete().eq('used_by', target.id); } catch (_) {}
                const { error: profErr } = await sb.from('profiles').delete().eq('id', target.id);
                if (!profErr) {
                    deleted = true;
                } else {
                    lastErr = profErr.message;
                }
            }

            // 4. If direct delete failed due to missing RLS policy or grant, gracefully deactivate player
            if (!deleted) {
                try {
                    await sb.rpc('admin_update_member', {
                        p_id: target.id,
                        p_role: 'player',
                        p_position: target.position || 'Flexible',
                        p_number: target.jersey_number ?? null,
                        p_title: null,
                        p_active: false
                    });
                    await sb.rpc('core_set_squad_player', {
                        p_player_id: target.id,
                        p_in_squad: false
                    });
                } catch (_) {}
                reloadP();
                if (editing === target.id) setEditing(null);
                throw Error(`Could not delete "${target.full_name}": ${lastErr || 'Database permission denied'}. Run supabase/admin-delete-member.sql in your Supabase SQL Editor.`);
            }

            reloadP();
            if (editing === target.id) setEditing(null);
        }, `Member "${target.full_name}" deleted successfully`);
    }

    async function add(e) {
        e.preventDefault();
        const isInvite = form.mode === 'invite';
        const sending = isInvite && Boolean(form.email.trim());
        const message = isInvite
            ? 'Member profile created and invitation issued.'
            : 'Player added to squad pool. Select them in Squad Selection.';

        const did = await task.run(async () => {
            if (isInvite && form.role !== 'player' && !admin) {
                throw Error('Only an administrator can assign council or admin roles.');
            }
            if (isInvite && !form.email.trim()) {
                throw Error('An email address is required for member login invitation.');
            }
            if (!form.full_name.trim() || form.full_name.trim().length < 2) {
                throw Error('Enter the player full name.');
            }

            if (isInvite) {
                const { data, error } = await sb.functions.invoke('invite-member', {
                    body: {
                        full_name: form.full_name.trim(),
                        email: form.email.trim(),
                        role: form.role,
                        position: form.position,
                        jersey_number: form.jersey_number === '' ? null : Number(form.jersey_number),
                        council_title: (form.role !== 'player' && form.council_title?.trim()) ? form.council_title.trim() : null,
                        bio: form.bio?.trim() || null,
                        in_squad: Boolean(form.in_squad)
                    }
                });
                if (error) {
                    let msg = error.message;
                    try { const details = await error.context?.json(); msg = details?.error || msg; } catch {}
                    throw Error(msg);
                }
                if (!data?.ok) throw Error(data?.error || 'Invitation could not be delivered.');

                if (data?.invite_link) {
                    setCreatedInvite({
                        name: form.full_name.trim(),
                        email: form.email.trim(),
                        link: data.invite_link
                    });
                }
            } else {
                // Squad-only player
                const { data: newId, error } = await sb.rpc('admin_create_squad_player', {
                    p_name: form.full_name.trim(),
                    p_position: form.position,
                    p_number: form.jersey_number === '' ? null : Number(form.jersey_number)
                });
                if (error) throw error;

                if (newId) {
                    if (form.in_squad) {
                        try {
                            await sb.rpc('core_set_squad_player', { p_player_id: newId, p_in_squad: true });
                        } catch (_) {}
                    }
                    if (form.bio?.trim()) {
                        try {
                            await sb.from('profiles').update({ bio: form.bio.trim() }).eq('id', newId);
                        } catch (_) {}
                    }
                }
            }
            reloadP();
        }, message);

        if (did) {
            setForm({
                mode: form.mode,
                full_name: '',
                email: '',
                role: 'player',
                position: 'Flexible',
                jersey_number: '',
                council_title: '',
                in_squad: false,
                bio: ''
            });
        }
    }

    function edit(m) {
        setGuestEmail('');
        setEditing(m.id);
        setEditForm({
            role: m.role,
            position: m.position,
            jersey_number: m.jersey_number ?? '',
            council_title: m.council_title ?? '',
            is_active: m.is_active,
            in_squad: m.in_squad ?? false,
            bio: m.bio || ''
        });
    }

    async function inviteExistingGuest() {
        await task.run(async () => {
            const existing = members.find(m => m.id === editing);
            if (!existing?.is_guest) throw Error('Select a squad-only player first.');
            if (!guestEmail.trim()) throw Error('Enter an email address to enable login.');
            const { data, error } = await sb.functions.invoke('invite-member', {
                body: {
                    guest_profile_id: editing,
                    email: guestEmail.trim(),
                    full_name: existing.full_name,
                    role: 'player',
                    position: editForm.position,
                    jersey_number: editForm.jersey_number === '' ? null : Number(editForm.jersey_number),
                    council_title: editForm.council_title || null,
                    bio: editForm.bio || null,
                    in_squad: Boolean(editForm.in_squad)
                }
            });
            if (error) {
                let msg = error.message;
                try { const d = await error.context?.json(); msg = d?.error || msg; } catch {}
                throw Error(msg);
            }
            if (!data?.ok) throw Error(data?.error || 'Unable to send invitation.');
            if (data?.invite_link) {
                setCreatedInvite({
                    name: existing.full_name,
                    email: guestEmail.trim(),
                    link: data.invite_link
                });
            }
            reloadP();
            setEditing(null);
            setGuestEmail('');
        }, 'Squad member history preserved and invitation email sent.');
    }

    async function update() {
        await task.run(async () => {
            const { error } = await sb.rpc('admin_update_member', {
                p_id: editing,
                p_role: editForm.role,
                p_position: editForm.position,
                p_number: editForm.jersey_number === '' ? null : Number(editForm.jersey_number),
                p_title: editForm.council_title || null,
                p_active: editForm.is_active
            });
            if (error) throw error;

            try {
                await sb.rpc('core_set_squad_player', {
                    p_player_id: editing,
                    p_in_squad: Boolean(editForm.in_squad)
                });
            } catch (_) {}

            try {
                await sb.from('profiles').update({ bio: editForm.bio || '' }).eq('id', editing);
            } catch (_) {}

            reloadP();
            setEditing(null);
        }, 'Member details updated');
    }

    return <>
        <Heading eyebrow="// WHO'S IN THE CLUB" title="MEMBERS & SQUAD" subtitle="Admin and Council can manage player records; only Admin can assign access roles or deactivate members." />
        <div className="dash-two unequal">
            <Panel title="Add player / send invite" subtitle="Choose between inviting with a login account or adding a squad-only player.">
                {createdInvite && (
                    <div className="invite-success-card">
                        <div className="invite-success-top">
                            <CheckCircle2 size={18} />
                            <div>
                                <b>Invitation ready for {createdInvite.name}</b>
                                <p>{createdInvite.email ? `Invitation sent to ${createdInvite.email}.` : 'Account created.'} You can also copy and share this link directly:</p>
                            </div>
                            <button type="button" className="icon-btn" onClick={() => setCreatedInvite(null)} title="Dismiss"><X size={15} /></button>
                        </div>
                        {createdInvite.link && (
                            <div className="invite-link-row">
                                <input readOnly value={createdInvite.link} onClick={e => e.target.select()} />
                                <button type="button" className="small-btn" onClick={() => copyInviteLink(createdInvite.link)}>
                                    {copied ? <><Check size={14} /> COPIED</> : <><Copy size={14} /> COPY LINK</>}
                                </button>
                            </div>
                        )}
                    </div>
                )}
                <div className="form-mode-tabs">
                    <button
                        type="button"
                        className={'tab-pill ' + (form.mode === 'invite' ? 'active' : '')}
                        onClick={() => setForm({ ...form, mode: 'invite' })}
                    >
                        <Mail size={14} /> Invite with Login
                    </button>
                    <button
                        type="button"
                        className={'tab-pill ' + (form.mode === 'squad' ? 'active' : '')}
                        onClick={() => setForm({ ...form, mode: 'squad', role: 'player', email: '' })}
                    >
                        <Users size={14} /> Squad Player Only
                    </button>
                </div>
                <form className="form-stack" onSubmit={add}>
                    <Input label="Full name" required maxLength={120} value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Alex Morgan" />
                    {form.mode === 'invite' && (
                        <Input label="Email address (required for login)" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="player@example.com" />
                    )}
                    <div className="form-grid">
                        <Input label="Member role"><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                            <option value="player">Player</option>
                            {admin && form.mode === 'invite' && <option value="council">Council member</option>}
                            {admin && form.mode === 'invite' && <option value="admin">Administrator</option>}
                        </select></Input>
                        <Input label="Preferred position"><select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}>
                            {['Handler', 'Cutter', 'Flexible'].map(v => <option key={v}>{v}</option>)}
                        </select></Input>
                    </div>
                    {form.mode === 'invite' && form.role !== 'player' && (
                        <Input label="Council title / responsibility (optional)" placeholder="e.g. Spirit Captain, Treasurer, President..." value={form.council_title} onChange={e => setForm({ ...form, council_title: e.target.value })} />
                    )}
                    <div className="form-grid">
                        <Input label="Jersey number (optional)" type="number" min="0" max="999" value={form.jersey_number} onChange={e => setForm({ ...form, jersey_number: e.target.value })} placeholder="e.g. 7" />
                        <label className="checkbox-field" style={{ alignSelf: 'center', marginTop: 14 }}>
                            <input type="checkbox" checked={form.in_squad} onChange={e => setForm({ ...form, in_squad: e.target.checked })} />
                            <span>Add to active squad now</span>
                        </label>
                    </div>
                    <Input label="About player / bio (optional)">
                        <textarea rows={2} maxLength={500} placeholder="Playstyle, throwing hand, club background..." value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
                    </Input>
                    <p className="small-note">
                        {form.mode === 'invite'
                            ? 'A login profile will be provisioned, an invitation email sent, and a shareable direct link generated.'
                            : 'This creates a player record in the player pool. Admin or Council can track stats and include them in rosters.'}
                    </p>
                    <Flash error={task.err} success={task.ok} />
                    <FormButton busy={task.busy}>{form.mode === 'invite' ? 'CREATE PROFILE & SEND INVITE' : 'ADD SQUAD PLAYER'}</FormButton>
                </form>
            </Panel>
            <Panel title="Club members" subtitle="Squad-only players and invited accounts, including positions and jerseys">
                <Flash error={task.err} success={task.ok} />
                <div className="management-list">
                    {members.map(m => <div key={m.id} className="manage-item member-admin-row">
                        <div className="mini-avatar">{m.avatar_path ? <img src={fileUrl('club-media', m.avatar_path)} alt="" /> : (m.full_name || 'P').charAt(0)}</div>
                        <div>
                            <b>{m.full_name}</b>
                            <small>{m.role} · #{m.jersey_number ?? '—'} · {m.position} · {m.is_active ? 'Active' : 'Inactive'} {m.in_squad ? '· In Squad' : ''} {m.is_guest ? '· No login' : '· Login account'}</small>
                        </div>
                        <div className="item-actions">
                            {admin && !m.is_guest && (
                                <button type="button" className="small-btn" title="Resend invitation / copy direct link" onClick={() => resendInvite(m)}>
                                    <Mail size={14} /> RESEND
                                </button>
                            )}
                            <button className="small-btn" onClick={() => edit(m)}><PenTool size={14} /> EDIT</button>
                            {admin && m.id !== profile.id && (
                                <button type="button" className="small-btn danger" title="Delete member" onClick={() => removeMember(m)}>
                                    <Trash2 size={14} /> DELETE
                                </button>
                            )}
                        </div>
                    </div>)}
                    {!members.length && <Empty title="No members added" text="Create your first squad player above." />}
                </div>
            </Panel>
        </div>
        {editing && <Modal title="Edit member" onClose={() => setEditing(null)}><div className="form-stack">
            <Input label="Club role"><select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                {['player', 'council', 'admin'].map(r => <option key={r} value={r} disabled={!admin || members.find(m => m.id === editing)?.is_guest && r !== 'player'}>{r}</option>)}
            </select></Input>
            <Input label="Position"><select value={editForm.position} onChange={e => setEditForm({ ...editForm, position: e.target.value })}>{['Handler', 'Cutter', 'Flexible'].map(p => <option key={p}>{p}</option>)}</select></Input>
            <Input label="Jersey number" type="number" min="0" max="999" value={editForm.jersey_number} onChange={e => setEditForm({ ...editForm, jersey_number: e.target.value })} />
            <Input label="Council title (optional)" disabled={!admin} placeholder="Treasurer, President, Coach..." value={editForm.council_title} onChange={e => setEditForm({ ...editForm, council_title: e.target.value })} />
            <Input label="About player / bio"><textarea rows={3} maxLength={750} value={editForm.bio || ''} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} placeholder="Bio or background..." /></Input>
            <div className="form-grid">
                <label className="checkbox-field"><input type="checkbox" disabled={!admin} checked={editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} /> Active member</label>
                <label className="checkbox-field"><input type="checkbox" checked={editForm.in_squad} onChange={e => setEditForm({ ...editForm, in_squad: e.target.checked })} /> In active squad</label>
            </div>
            {members.find(m => m.id === editing)?.is_guest ? (
                <div className="guest-upgrade">
                    <h4>Enable player login</h4>
                    <p className="small-note">Give this squad-only player an email login without losing tournament history, scores or finance records.</p>
                    <Input label="Email for invitation" type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="player@example.com" />
                    <button type="button" className="btn btn-secondary" disabled={task.busy || !guestEmail.trim()} onClick={inviteExistingGuest}>SEND LOGIN INVITATION <UserPlus size={16} /></button>
                </div>
            ) : admin && (
                <div style={{ marginTop: 6 }}>
                    <button type="button" className="btn btn-secondary" style={{ width: '100%' }} disabled={task.busy} onClick={() => resendInvite(members.find(x => x.id === editing))}>
                        <Mail size={16} /> RESEND ACTIVATION EMAIL / LINK
                    </button>
                </div>
            )}
            <Flash error={task.err} success={task.ok} />
            <button className="btn btn-primary" disabled={task.busy} onClick={update}>SAVE MEMBER CHANGES <Check size={16} /></button>
            {admin && editing !== profile.id && (
                <button
                    type="button"
                    className="btn btn-danger"
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={task.busy}
                    onClick={() => removeMember(members.find(x => x.id === editing))}
                >
                    <Trash2 size={16} /> PERMANENTLY DELETE MEMBER
                </button>
            )}
        </div></Modal>}
    </>;
}
function Messages() { const { data: rows, reload } = useData('contact_messages', { order: 'created_at', limit: 250 }), task = useAsync(), { profile } = useAuth(), { confirm } = useDialog(); async function remove(id) { const ok = await confirm({ title: 'Delete Message', message: 'Permanently remove this message from the contact inbox?', confirmText: 'DELETE MESSAGE', danger: true }); if (!ok) return; await task.run(async () => { const { error } = await sb.from('contact_messages').delete().eq('id', id); if (error) throw error; reload() }, 'Message deleted') } return <><Heading eyebrow="// FROM THE COMMUNITY" title="CONTACT INBOX" subtitle="Messages submitted using the public club website." /><Panel title="Inbox"><Flash error={task.err} success={task.ok} />{rows.length ? <div className="message-list">{rows.map(r => <article key={r.id}><div><h3>{r.name}</h3><span>{date(r.created_at)} · <a href={`mailto:${r.email}`}>{r.email}</a></span></div><p>{r.message}</p>{isAdmin(profile) && <button className="inline-button danger" onClick={() => remove(r.id)}>DELETE <Trash2 size={14} /></button>}</article>)}</div> : <Empty title="Inbox is empty" text="Messages sent via Contact Us appear here." />}</Panel></> }